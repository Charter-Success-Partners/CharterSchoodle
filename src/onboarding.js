import { JOIN_LIFETIME_MS, JOIN_CLOCK_SKEW_MS } from './auth.js?v=20261015-join-r2';
import { ncToday } from './game.js';

const localLocks = new WeakMap();
export const JOIN_INTENT_KEY = 'charterschoodle-join:v1';
const KEY = JOIN_INTENT_KEY;
const LIFETIME = JOIN_LIFETIME_MS;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const emailFrom = value => typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
const abort = () => new DOMException('Account or prepared join changed', 'AbortError');

/** A short-lived, token-free public opt-in. Auth alone verifies identity and PKCE.
 * A bound owner permits retry/reload after a successful callback, never crossover.
 */
export function createOnboardingController({ storage, auth, leaderboard, guestStore, ownerStore = () => null, now = Date.now, today = ncToday }) {
  let running = null;
  function exclusive(work) {
    // Auth broadcasts SIGNED_IN to the requesting tab while the callback tab is
    // also completing. Web Locks serialize their entire create/import sequence.
    if (globalThis.navigator?.locks?.request) return navigator.locks.request(KEY, work);
    const previous = localLocks.get(storage) || Promise.resolve();
    const next = previous.catch(() => {}).then(work);
    localLocks.set(storage, next);
    void next.finally(() => { if (localLocks.get(storage) === next) localLocks.delete(storage); }).catch(() => {});
    return next;
  }
  function discard(id) {
    const raw = storage.getItem(KEY);
    let current;
    try { current = JSON.parse(raw); } catch { /* Corrupt drafts are disposable. */ }
    if (!id || current?.id === id) storage.removeItem(KEY);
    auth.clearJoinRequest(id);
  }
  function read() {
    let draft;
    try { draft = JSON.parse(storage.getItem(KEY)); } catch { /* Invalid draft. */ }
    if (!draft) return null;
    if (draft.version !== 1 || !uuid(draft.id) || !emailFrom(draft.email) || draft.email !== emailFrom(draft.email)
      || typeof draft.displayName !== 'string' || !draft.displayName.trim() || [...draft.displayName].length > 60
      || typeof draft.school !== 'string' || [...draft.school].length > 80 || !Number.isFinite(draft.at)
      || draft.at > now() + JOIN_CLOCK_SKEW_MS || now() - draft.at > LIFETIME || (draft.owner !== null && !uuid(draft.owner))
      || typeof draft.profileSaved !== 'boolean' || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      discard(draft.id); return null;
    }
    return draft;
  }
  function write(draft) {
    storage.setItem(KEY, JSON.stringify(draft));
    if (!storage.persistent) throw new Error('Joining needs available browser storage to retain your details. You can keep playing as a guest.');
  }
  function prepare({ email, displayName, school = '' }, { active = false } = {}) {
    const identity = auth.getVerifiedIdentity();
    email = emailFrom(active ? identity?.email : email);
    displayName = typeof displayName === 'string' ? displayName.trim() : '';
    school = typeof school === 'string' ? school.trim() : '';
    if (!email || !displayName || [...displayName].length > 60 || [...school].length > 80 || (active && !uuid(identity?.userId))) {
      throw new Error('Enter a valid email, a display name of 1–60 characters, and an optional school of up to 80 characters.');
    }
    const draft = { version: 1, id: crypto.randomUUID(), email, displayName, school, at: now(), date: today(), owner: active ? identity.userId : null, profileSaved: false };
    write(draft);
    return draft;
  }
  function matches(draft, identity) {
    return identity && identity.email === draft.email && uuid(identity.userId)
      && (draft.owner ? draft.owner === identity.userId : identity.requestId === draft.id);
  }
  function check(draft, owner) {
    const current = read(), identity = auth.getVerifiedIdentity();
    if (current?.id !== draft.id || current.owner !== owner || !matches(current, identity)) throw abort();
  }
  async function complete(draft, owner) {
    draft = { ...draft, owner };
    write(draft); // Claim only after both verified email and request identity match.
    let profile = await leaderboard.readProfile();
    check(draft, owner);
    let existing = Boolean(profile && !draft.profileSaved);
    if (!profile) {
      const result = await leaderboard.createProfile(draft);
      check(draft, owner);
      profile = result.profile;
      existing = !result.created;
      if (!profile) throw new Error('Could not restore the existing profile. Try account sync again.');
    }
    // Profile preservation and today's explicit carryover consent are separate.
    // A lost insert response or concurrent profile never discards that consent.
    draft = { ...draft, profileSaved: true };
    write(draft);
    // Keep already-owned daily progress ahead of any guest import. Archives have
    // separate storage and cannot become queue sources here.
    const owned = ownerStore();
    if (owned?.subject === owner) {
      const entry = owned.readResults().find(result => result.date === today());
      if (entry?.guessedSchoolIds?.length) leaderboard.queueDailyResult({ date: entry.date, progress: { guesses: entry.guessedSchoolIds.map(schoolId => ({ schoolId })) }, answerSchoolId: entry.answerSchoolId, mode: 'daily' });
    }
    // A draft from yesterday must never import a different day's guest game.
    await leaderboard.adoptTodayGuest({ confirmed: draft.date === today(), guestStore, date: draft.date, assertCurrent: () => check(draft, owner) });
    check(draft, owner);
    await leaderboard.flush();
    check(draft, owner);
    discard(draft.id);
    return { status: existing ? 'existing' : 'joined', profile };
  }
  return {
    get pending() { return read(); },
    prepare,
    async request(fields) {
      const draft = prepare(fields);
      await auth.sendLink(draft.email, { requestId: draft.id });
    },
    cancel() { discard(); },
    finish() {
      const draft = read(), identity = auth.getVerifiedIdentity();
      if (!draft || !matches(draft, identity)) return Promise.resolve({ status: 'none', profile: null });
      if (running?.id === draft.id && running.owner === identity.userId) return running.work;
      const work = exclusive(() => {
        const latest = read();
        if (latest?.id !== draft.id || !matches(latest, auth.getVerifiedIdentity())) return { status: 'none', profile: null };
        return complete(latest, identity.userId);
      });
      const task = { id: draft.id, owner: identity.userId, work };
      running = task;
      void work.finally(() => { if (running === task) running = null; }).catch(() => {});
      return work;
    },
  };
}
