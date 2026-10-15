import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthController, loadLocalAuthClient } from '../../src/auth.js';
import { createSafeStorage } from '../../src/storage.js';
import { createClient } from '@supabase/supabase-js';

const config = { leaderboardEnabled: true, url: 'https://fixture.supabase.co', anonKey: 'sb_publishable_fixture', publicUrl: 'https://game.example/' };
const key = 'charterschoodle-auth:v2';
const session = { user: { id: '00000000-0000-0000-0000-000000000001' }, access_token: 'private-access', refresh_token: 'private-refresh' };
function storage() {
  const values = new Map();
  const backing = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  return { backing, kv: createSafeStorage(() => backing) };
}
function fixture({ initializeError = null, initialSession = null, sendError = null, signoutError = null } = {}) {
  const { kv, backing } = storage();
  const calls = { loads: 0, sends: [], disposed: 0, unsubscribed: 0, stopped: 0, options: null };
  let callback;
  const client = { auth: {
    initialize: async () => ({ error: initializeError }),
    getSession: async () => ({ data: { session: initialSession }, error: null }),
    onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() { calls.unsubscribed++; } } } }; },
    signInWithOtp: async (value) => { calls.sends.push(value); return { data: { user: null, session: null }, error: sendError }; },
    signOut: async () => ({ error: signoutError }),
    stopAutoRefresh: async () => { calls.stopped++; },
    dispose: async () => { calls.disposed++; },
  }, removeAllChannels: async () => [] };
  const loadClient = async () => { calls.loads++; return (_url, _key, options) => { calls.options = options; return client; }; };
  const auth = createAuthController({ config, storage: kv, loadClient, now: () => 1000 });
  return { auth, kv, backing, calls, emit: (event, value) => callback(event, value) };
}
function browser(url) {
  const oldLocation = globalThis.location;
  const oldHistory = globalThis.history;
  const location = new URL(url);
  globalThis.location = location;
  globalThis.history = { state: { retained: true }, replaceState(state, _title, value) { assert.deepEqual(state, { retained: true }); location.href = new URL(value, location).href; } };
  return { location, restore() { globalThis.location = oldLocation; globalThis.history = oldHistory; } };
}

// Breaks caught: loading on disabled/invalid config and silently issuing OTP requests on initialization.
test('disabled_auth_performs_no_network_request', async () => {
  for (const patch of [{ leaderboardEnabled: false }, { leaderboardEnabled: 'true' }, { url: 'javascript:bad' }, { anonKey: '' }, { publicUrl: 'https://game.example/?code=bad' }, { publicUrl: 'https://user:pass@game.example/' }]) {
    let loaded = false;
    const auth = createAuthController({ config: { ...config, ...patch }, storage: storage().kv, loadClient: async () => { loaded = true; } });
    await auth.ready;
    await auth.sendLink('person@example.com');
    assert.equal(loaded, false);
    assert.equal(auth.getClient(), null);
    assert.equal(auth.state.phase, 'unavailable');
  }
});
test('email_submission_is_explicit', async () => {
  const f = fixture();
  await f.auth.ready;
  assert.equal(f.auth.state.phase, 'guest');
  assert.equal(f.calls.sends.length, 0);
  await f.auth.sendLink('bad email');
  assert.equal(f.calls.sends.length, 0);
  await f.auth.sendLink(' person@example.com ');
  assert.deepEqual(f.calls.sends, [{ email: 'person@example.com', options: { emailRedirectTo: 'https://game.example/' } }]);
  assert.equal(f.auth.state.phase, 'sent');
  assert.equal(f.calls.options.auth.flowType, 'pkce');
  assert.equal(f.calls.options.auth.detectSessionInUrl, true);
  assert.equal(f.calls.options.auth.storageKey, key);
  assert.equal(f.calls.options.auth.persistSession, true);
});
test('unavailable_storage_does_not_send_link', async () => {
  const f = fixture();
  await f.auth.ready;
  f.backing.setItem = () => { throw new Error('quota'); };
  f.kv.setItem('probe', 'value');
  await f.auth.sendLink('person@example.com');
  assert.equal(f.calls.sends.length, 0);
  assert.equal(f.auth.state.userId, null);
  assert.match(f.auth.state.message, /storage/i);
});
test('pkce_quota_failure_blocks_email_at_fetch_boundary', async () => {
  const { kv, backing } = storage();
  let requests = 0;
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { requests++; return new Response('{}', { status: 200 }); };
  try {
    const auth = createAuthController({ config, storage: kv, loadClient: async () => createClient });
    await auth.ready;
    backing.setItem = () => { throw new Error('quota'); };
    await auth.sendLink('person@example.com');
    assert.equal(kv.persistent, false);
    assert.equal(requests, 0);
    assert.notEqual(auth.state.phase, 'sent');
    assert.match(auth.state.message, /storage/i);
    await auth.signOut();
  } finally { globalThis.fetch = oldFetch; }
});
test('link_request_has_resend_cooldown', async () => {
  const f = fixture();
  await f.auth.ready;
  await f.auth.sendLink('person@example.com');
  await f.auth.sendLink('person@example.com');
  assert.equal(f.calls.sends.length, 1);
  assert.equal(f.auth.state.resendAt, 61000);
});
test('server_retry_after_controls_cooldown_without_promising_delivery', async () => {
  const { kv } = storage();
  const oldFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response(JSON.stringify({ code: 'over_email_send_rate_limit', msg: 'limited' }), { status: 429, headers: { 'Retry-After': '120', 'Content-Type': 'application/json' } }); };
  try {
    const auth = createAuthController({ config, storage: kv, loadClient: async () => createClient, now: () => 1000 });
    await auth.ready;
    await auth.sendLink('person@example.com');
    assert.equal(auth.state.resendAt, 121000);
    assert.equal(auth.state.phase, 'error');
    assert.doesNotMatch(auth.state.message, /sent|delivered|check your/i);
    await auth.sendLink('person@example.com');
    assert.equal(requests, 1);
    await auth.signOut();
  } finally { globalThis.fetch = oldFetch; }
});
test('expired_or_reused_callback_can_retry', async () => {
  const b = browser('https://game.example/?error=access_denied&error_code=otp_expired&error_description=Expired&date=2026-10-14');
  try {
    const f = fixture();
    await f.auth.ready;
    assert.equal(f.auth.state.phase, 'guest');
    assert.match(f.auth.state.message, /new link/i);
    assert.equal(b.location.search, '?date=2026-10-14');
    await f.auth.sendLink('person@example.com');
    assert.equal(f.auth.state.phase, 'sent');
  } finally { b.restore(); }
});
test('missing_pkce_verifier_returns_to_guest', async () => {
  const b = browser('https://game.example/?code=fixture-code');
  try {
    const f = fixture();
    await f.auth.ready;
    assert.equal(f.calls.loads, 0);
    assert.equal(f.auth.state.phase, 'guest');
    assert.equal(f.auth.state.userId, null);
    assert.equal(b.location.search, '');
    await f.auth.sendLink('person@example.com');
    assert.equal(f.auth.state.phase, 'sent');
  } finally { b.restore(); }
});
test('callback_params_are_removed_on_success_and_failure', async () => {
  for (const error of [null, new Error('reused code')]) {
    const b = browser('https://game.example/?code=fixture-code&mode=archive#refresh_token=secret&view=map');
    try {
      const f = fixture({ initializeError: error, initialSession: session });
      // fixture constructs asynchronously: seed verifier before its loader runs.
      f.kv.setItem(`${key}-code-verifier`, 'verifier');
      await f.auth.ready;
      assert.equal(b.location.search, '?mode=archive');
      assert.equal(b.location.hash, '#view=map');
      assert.equal(f.auth.state.userId, error ? null : session.user.id);
      assert.doesNotMatch(JSON.stringify(f.auth.state), /private-access|private-refresh/);
    } finally { b.restore(); }
  }
});
test('sdk_load_failure_keeps_guest', async () => {
  const auth = createAuthController({ config, storage: storage().kv, loadClient: async () => { throw new Error('offline'); } });
  await auth.ready;
  assert.equal(auth.state.userId, null);
  assert.equal(auth.getClient(), null);
  assert.match(auth.state.message, /guest/i);
});
test('failed_signout_clears_local_identity_and_blocks_old_callbacks_and_writes', async () => {
  const f = fixture({ initialSession: session, signoutError: new Error('offline') });
  const seen = [];
  f.auth.subscribe((state) => seen.push(state));
  await f.auth.ready;
  assert.equal(f.auth.state.userId, session.user.id);
  f.kv.setItem(key, 'session');
  f.kv.setItem(`${key}-code-verifier`, 'verifier');
  await f.auth.signOut();
  f.emit('SIGNED_IN', session);
  f.calls.options.auth.storage.setItem(key, 'late-refresh');
  assert.equal(f.auth.state.phase, 'guest');
  assert.equal(f.auth.state.userId, null);
  assert.equal(f.auth.getClient(), null);
  assert.equal(f.kv.getItem(key), null);
  assert.equal(f.kv.getItem(`${key}-code-verifier`), null);
  assert.equal(f.calls.unsubscribed, 1);
  assert.equal(f.calls.stopped, 1);
  assert.equal(f.calls.disposed, 1);
  assert.doesNotMatch(JSON.stringify(seen), /private-access|private-refresh/);
});
test('local_loader_uses_only_the_local_official_bundle_and_reports_failure', async () => {
  let script;
  const doc = { createElement: () => (script = {}), head: { append(element) { assert.equal(element, script); } } };
  const scope = {};
  const result = loadLocalAuthClient({ document: doc, scope });
  assert.match(script.src, /\/src\/vendor\/supabase\.js$/);
  scope.supabase = { createClient };
  script.onload();
  assert.equal(await result, createClient);
  const failure = loadLocalAuthClient({ document: doc, scope: {} });
  script.onerror();
  await assert.rejects(failure, /load/i);
});

// Breaks caught: omitted timeout/abort wiring, stale in-flight email responses,
// concurrency bypassing cooldown, and SDK error callbacks accepting old identity.
test('network_timeout_aborts_at_ten_seconds', async () => {
  const f = fixture();
  await f.auth.ready;
  const oldFetch = globalThis.fetch;
  const oldSetTimeout = globalThis.setTimeout;
  const oldClearTimeout = globalThis.clearTimeout;
  // Construct a fresh client while fetch is intercepted; timers stay local.
  const timers = [];
  globalThis.fetch = async (_input, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  globalThis.setTimeout = (fn, delay) => { timers.push({ fn, delay }); return timers.length; };
  globalThis.clearTimeout = () => {};
  try {
    const g = fixture();
    await g.auth.ready;
    const pending = g.calls.options.global.fetch('https://fixture.supabase.co/auth/v1/otp');
    assert.equal(timers[0].delay, 10000);
    timers[0].fn();
    await assert.rejects(pending, { name: 'TimeoutError' });
    await g.auth.signOut();
  } finally { globalThis.fetch = oldFetch; globalThis.setTimeout = oldSetTimeout; globalThis.clearTimeout = oldClearTimeout; }
  await f.auth.signOut();
});
test('signout_during_email_request_cannot_restore_sent_state', async () => {
  const f = fixture();
  await f.auth.ready;
  let release;
  f.auth.getClient().auth.signInWithOtp = async (value) => { f.calls.sends.push(value); return new Promise((resolve) => { release = resolve; }); };
  const pending = f.auth.sendLink('person@example.com');
  while (!release) await Promise.resolve();
  await f.auth.sendLink('person@example.com');
  assert.equal(f.calls.sends.length, 1);
  await f.auth.signOut();
  release({ data: { user: null, session: null }, error: null });
  await pending;
  assert.equal(f.auth.state.phase, 'guest');
  assert.equal(f.auth.state.userId, null);
});
test('old_signout_completion_preserves_a_new_links_verifier', async () => {
  const f = fixture();
  await f.auth.ready;
  f.emit('SIGNED_IN', session);
  let release;
  f.auth.getClient().auth.signOut = async () => new Promise((resolve) => { release = resolve; });
  f.auth.getClient().auth.signInWithOtp = async () => {
    f.calls.options.auth.storage.setItem(`${key}-code-verifier`, 'new-verifier');
    return { data: { user: null, session: null }, error: null };
  };
  const pending = f.auth.signOut();
  while (!release) await Promise.resolve();
  await f.auth.sendLink('person@example.com');
  assert.equal(f.kv.getItem(`${key}-code-verifier`), 'new-verifier');
  release({ error: new Error('offline') });
  await pending;
  assert.equal(f.kv.getItem(`${key}-code-verifier`), 'new-verifier');
});
test('late_initial_guest_event_preserves_email_request_feedback', async () => {
  const f = fixture();
  await f.auth.ready;
  await f.auth.sendLink('person@example.com');
  f.emit('INITIAL_SESSION', null);
  assert.equal(f.auth.state.phase, 'sent');
  f.emit('SIGNED_OUT', null);
  assert.equal(f.auth.state.phase, 'guest');
});
test('signout_attempts_remote_revocation_with_the_old_session_only', async () => {
  const { kv } = storage();
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `e30.${Buffer.from(JSON.stringify({ sub: session.user.id, exp: expires, role: 'authenticated' })).toString('base64url')}.fixture`;
  kv.setItem(key, JSON.stringify({ ...session, access_token: jwt, expires_at: expires, expires_in: 3600, token_type: 'bearer' }));
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    const url = new URL(input);
    requests.push(`${url.pathname}${url.search}`);
    return new Response(JSON.stringify({ message: 'fixture outage' }), { status: 403 });
  };
  try {
    const auth = createAuthController({ config, storage: kv, loadClient: async () => createClient });
    await auth.ready;
    assert.equal(auth.state.userId, session.user.id);
    await auth.signOut();
    assert.deepEqual(requests, ['/auth/v1/logout?scope=local']);
    assert.equal(kv.getItem(key), null);
    assert.equal(auth.state.userId, null);
    assert.equal(auth.getClient(), null);
  } finally { globalThis.fetch = oldFetch; }
});
