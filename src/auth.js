const STORAGE_KEY = 'charterschoodle-auth:v2';
const STORAGE_KEYS = [STORAGE_KEY, `${STORAGE_KEY}-code-verifier`, `${STORAGE_KEY}-user`];
const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type', 'type', 'provider_token', 'provider_refresh_token', 'token_hash'];
const STORAGE_MESSAGE = 'Email sign-in needs available browser storage. You can keep playing as a guest.';
const RETRY_MESSAGE = 'This sign-in link could not be used. Request a new link and open it in this browser. You can keep playing as a guest.';

/** Load the pinned, same-origin official UMD bundle; no runtime CDN dependency. */
export function loadLocalAuthClient({ document = globalThis.document, scope = globalThis } = {}) {
  return new Promise((resolve, reject) => {
    if (!document?.head) return reject(new Error('Unable to load local authentication client'));
    const script = document.createElement('script');
    script.src = new URL('./vendor/supabase.js', import.meta.url).href;
    script.async = true;
    const timer = setTimeout(() => fail(), 10000);
    function fail() {
      clearTimeout(timer);
      script.remove?.();
      reject(new Error('Unable to load local authentication client'));
    }
    script.onerror = fail;
    script.onload = () => {
      clearTimeout(timer);
      if (typeof scope.supabase?.createClient === 'function') resolve(scope.supabase.createClient);
      else fail();
    };
    document.head.append(script);
  });
}

function trustedUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) return null;
    return url.href;
  } catch { return null; }
}
function publicKey(value) {
  if (typeof value !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const parts = value.split('.');
    return parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)) && JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}
function callbackUrl() {
  try { return new URL(globalThis.location.href); } catch { return null; }
}
function cleanCallback(url) {
  if (!url || !globalThis.history) return;
  const hash = new URLSearchParams(url.hash.slice(1));
  let changed = false;
  for (const name of AUTH_PARAMS) {
    if (url.searchParams.has(name) || hash.has(name)) changed = true;
    url.searchParams.delete(name);
    hash.delete(name);
  }
  if (!changed) return;
  url.hash = hash.toString();
  globalThis.history.replaceState(globalThis.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * @typedef {{phase: 'unavailable'|'guest'|'sending'|'sent'|'signed-in'|'error', userId: string|null, message: string, resendAt: number}} AuthState
 * @typedef {{ready: Promise<void>, readonly state: AuthState, subscribe: (listener: (state: AuthState) => void) => () => void, sendLink: (email: string) => Promise<void>, signOut: () => Promise<void>, getClient: () => object|null}} AuthController
 */
/**
 * Optional passwordless account boundary. Sessions and tokens remain SDK-private.
 * @param {{config: object, storage: import('./storage.js').SafeStorage, loadClient: () => Promise<Function>, now?: () => number}} options
 * @returns {AuthController}
 */
export function createAuthController({ config, storage, loadClient = loadLocalAuthClient, now = Date.now }) {
  const url = trustedUrl(config?.url);
  const publicUrl = trustedUrl(config?.publicUrl);
  const enabled = config?.leaderboardEnabled === true && url && publicUrl && publicKey(config?.anonKey);
  let state = Object.freeze({ phase: enabled ? 'guest' : 'unavailable', userId: null, message: enabled ? '' : 'Accounts are unavailable. You can keep playing as a guest.', resendAt: 0 });
  const listeners = new Set();
  let life = null;
  let loading = null;
  let epoch = 0;
  function update(patch) {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) { try { listener(state); } catch { /* A view cannot interrupt auth cleanup. */ } }
  }
  function clearStorage() {
    for (const key of STORAGE_KEYS) storage.removeItem(key);
  }
  function deactivate(current) {
    current.active = false;
    current.subscription?.unsubscribe();
    for (const controller of current.requests) controller.abort();
    if (life === current) life = null;
  }
  async function dispose(current) {
    if (!current?.client) return;
    await Promise.allSettled([
      Promise.resolve().then(() => current.client.auth.stopAutoRefresh()),
      Promise.resolve().then(() => current.client.auth.dispose()),
      Promise.resolve().then(() => current.client.removeAllChannels()),
    ]);
  }
  function acceptSession(current, session, signedOut = false) {
    if (!current.active) return;
    if (!storage.persistent) { update({ phase: 'guest', userId: null, message: STORAGE_MESSAGE }); return; }
    const id = session?.user?.id;
    const userId = typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
    // A delayed initial guest notification must not erase request feedback.
    if (!userId && !state.userId && !signedOut && ['sending', 'sent', 'error'].includes(state.phase)) return;
    update({ phase: userId ? 'signed-in' : 'guest', userId, message: '' });
  }
  async function initialize() {
    if (!enabled || life?.client) return;
    const current = { active: true, client: null, subscription: null, requests: new Set(), retryAt: null, signoutStorage: null };
    life = current;
    const callback = callbackUrl();
    const hash = new URLSearchParams(callback?.hash.slice(1));
    const code = callback?.searchParams.get('code');
    try {
      const invalidCallback = callback?.searchParams.has('error') || hash.has('error') || (!code && (hash.has('access_token') || hash.has('refresh_token')));
      if (invalidCallback || (code && !storage.getItem(`${STORAGE_KEY}-code-verifier`))) {
        clearStorage();
        deactivate(current);
        update({ phase: 'guest', userId: null, message: RETRY_MESSAGE });
        return;
      }
      if (!storage.persistent) {
        deactivate(current);
        update({ phase: 'guest', userId: null, message: STORAGE_MESSAGE });
        return;
      }
      const createClient = await loadClient();
      if (!current.active) return;
      // Revocable storage prevents a disposed SDK's in-flight refresh from
      // persisting a session after sign-out, even when its fetch finishes late.
      const scopedStorage = {
        getItem: (key) => current.active ? storage.getItem(key) : current.signoutStorage?.get(key) ?? null,
        setItem: (key, value) => { if (current.active) storage.setItem(key, value); },
        removeItem: (key) => { if (current.active) storage.removeItem(key); },
      };
      const fetch = globalThis.fetch.bind(globalThis);
      async function timedFetch(input, options = {}) {
        const pathname = new URL(typeof input === 'string' || input instanceof URL ? input : input.url).pathname;
        const logout = pathname.endsWith('/logout');
        if (!current.active && !logout) throw new Error('Authentication client is closed');
        // signInWithOtp writes its PKCE verifier BEFORE dispatching fetch.
        // SafeStorage can fall back to memory at that exact write.
        if (pathname.endsWith('/otp') && !storage.persistent) throw new Error(STORAGE_MESSAGE);
        const controller = new AbortController();
        current.requests.add(controller);
        const signal = options.signal || (typeof input === 'object' ? input.signal : undefined);
        const abort = () => controller.abort(signal.reason);
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(() => controller.abort(new DOMException('Authentication request timed out', 'TimeoutError')), 10000);
        try {
          const response = await fetch(input, { ...options, signal: controller.signal });
          const retry = response.headers.get('Retry-After');
          if (retry !== null) {
            const seconds = Number(retry);
            const deadline = /^\d+(\.\d+)?$/.test(retry.trim()) ? now() + seconds * 1000 : Date.parse(retry);
            if (Number.isFinite(deadline) && deadline > now()) current.retryAt = deadline;
          }
          return response;
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', abort);
          current.requests.delete(controller);
        }
      }
      current.client = createClient(url, config.anonKey, {
        auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true, storageKey: STORAGE_KEY, storage: scopedStorage },
        global: { fetch: timedFetch },
      });
      const { data } = current.client.auth.onAuthStateChange((event, session) => acceptSession(current, session, event === 'SIGNED_OUT'));
      current.subscription = data.subscription;
      const initialized = await current.client.auth.initialize();
      if (initialized.error) throw initialized.error;
      const result = await current.client.auth.getSession();
      if (result.error) throw result.error;
      acceptSession(current, result.data.session);
    } catch {
      if (current.active) {
        deactivate(current);
        clearStorage();
        await dispose(current);
        update({ phase: 'guest', userId: null, message: code ? RETRY_MESSAGE : 'Sign-in is unavailable. You can keep playing as a guest.' });
      }
    } finally { cleanCallback(callback); }
  }
  async function ensureClient() {
    if (!loading) loading = initialize().finally(() => { loading = null; });
    await loading;
  }
  const ready = Promise.resolve().then(() => { if (epoch === 0) return ensureClient(); });
  return {
    ready,
    get state() { return state; },
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    getClient() { return life?.active ? life.client : null; },
    async sendLink(email) {
      await ready;
      if (!enabled || state.userId || state.phase === 'sending' || now() < state.resendAt) return;
      if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        update({ phase: 'error', message: 'Enter a valid email address.' });
        return;
      }
      if (!storage.persistent) { update({ phase: 'guest', userId: null, message: STORAGE_MESSAGE }); return; }
      const requestEpoch = epoch;
      update({ phase: 'sending', message: 'Requesting a sign-in link…' });
      await ensureClient();
      const current = life;
      if (requestEpoch !== epoch || !current?.active || !current.client) return;
      current.retryAt = null;
      try {
        const { error } = await current.client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: publicUrl } });
        if (!current.active) return;
        const suppliedSeconds = Number(error?.retryAfter ?? error?.retry_after);
        const resendAt = current.retryAt ?? now() + (Number.isFinite(suppliedSeconds) && suppliedSeconds > 0 ? suppliedSeconds * 1000 : 60000);
        if (error || !storage.persistent) {
          update({ phase: 'error', userId: null, resendAt, message: storage.persistent ? 'Unable to request a sign-in link. Please try again later.' : STORAGE_MESSAGE });
        } else update({ phase: 'sent', userId: null, resendAt, message: 'Sign-in link requested. Check your email and open the link in this browser.' });
      } catch {
        if (current.active) update({ phase: 'error', userId: null, resendAt: current.retryAt ?? now() + 60000, message: storage.persistent ? 'Unable to request a sign-in link. Please try again later.' : STORAGE_MESSAGE });
      }
    },
    async signOut() {
      epoch++;
      const current = life;
      if (current) {
        // The SDK reads storage to obtain the token for remote logout. Give
        // only this disposed client its old snapshot, never a new session.
        current.signoutStorage = new Map(STORAGE_KEYS.map((key) => [key, storage.getItem(key)]));
        deactivate(current);
      }
      clearStorage();
      update({ phase: enabled ? 'guest' : 'unavailable', userId: null, message: 'Signed out. You can keep playing as a guest.', resendAt: 0 });
      if (current?.client) {
        await Promise.allSettled([Promise.resolve().then(() => current.client.auth.signOut({ scope: 'local' })), dispose(current)]);
        current.signoutStorage = null;
        // Storage was cleared before dispatch. A second cleanup here could
        // erase a replacement client's new PKCE verifier.
      }
    },
  };
}
