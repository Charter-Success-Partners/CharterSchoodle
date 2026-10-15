import { ncToday, validateProgress } from './game.js';

const PROFILES = 'charterschoodle_profiles_v2';
const RESULTS = 'charterschoodle_results_v2';
const abort = () => new DOMException('Account or request changed', 'AbortError');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const prefix = (a, b) => a.every((id, i) => id === b[i]);
const profileFrom = row => row ? { publicId: row.public_id, displayName: row.display_name, school: row.school, listed: row.listed === true } : null;

/** @typedef {{publicId: string, displayName: string, school: string, listed: boolean}} Profile */
/** @typedef {{rows: Array<{publicId: string, displayName: string, school: string, rank: number, points: number, played: number, solved: number, winStreak: number, attemptStreak: number, average: number|null}>, total: number, page: number, pageSize: number}} Page */
/**
 * @typedef {object} LeaderboardController
 * @property {(subject: string) => void} setSubject
 * @property {() => void} cancel
 * @property {() => Promise<Profile|null>} readProfile
 * @property {(profile: {displayName: string, school?: string, listed: boolean}) => Promise<Profile>} saveProfile
 * @property {() => Promise<import('./game.js').ScoreEntry[]>} readOwnerResults
 * @property {(date: string) => Promise<import('./game.js').Progress|null>} loadOwnerProgress
 * @property {(query: {sort: string, page: number}) => Promise<Page>} refresh
 * @property {(result: {date: string, progress: import('./game.js').Progress, answerSchoolId: string, mode: string}) => void} queueDailyResult
 * @property {() => Promise<void>} flush
 * @property {(choice: {confirmed: boolean, guestStore: import('./storage.js').GameStore, date: string}) => Promise<boolean>} adoptTodayGuest
 */

/**
 * Owner operations receive only the verified Auth UUID selected by the app.
 * SDK clients own bearer-token handling; public rankings use only the aggregate RPC.
 * @param {{getClient: Function, storeFor: Function, getPuzzle: Function, schoolIds: Set<string>, now?: () => Date}} options
 * @returns {LeaderboardController}
 */
export function createLeaderboardController({ getClient, storeFor, getPuzzle, schoolIds, now = () => new Date() }) {
  let subject = 'guest', epoch = 0, pageEpoch = 0;
  const profiles = new Map(), profileSaves = new Map(), flushes = new Map(), conflicts = new Set();
  function context() {
    if (subject === 'guest') throw new Error('Sign in to save your scores.');
    const client = getClient();
    if (!client) throw new Error('Accounts are unavailable.');
    return { subject, epoch, client, store: storeFor(subject) };
  }
  function check(ctx) { if (ctx.epoch !== epoch || ctx.subject !== subject) throw abort(); }
  function unwrap(response) {
    if (response.error) throw Object.assign(new Error(response.error.message || 'Request failed'), { code: response.error.code, status: response.status });
    return response.data;
  }
  function entryFrom(row, owner) {
    try {
      const puzzle = getPuzzle(row?.puzzle_date);
      if (!puzzle || row.user_id !== owner || row.answer_school_id !== puzzle.answerSchoolId || !Array.isArray(row.guessed_school_ids)) return null;
      const progress = validateProgress({ guesses: row.guessed_school_ids.map(schoolId => ({ schoolId })) }, { schoolIds, answerId: puzzle.answerSchoolId });
      if (!progress?.guesses.length) return null;
      const status = progress.solved ? 'solved' : progress.lost ? 'lost' : 'attempted';
      if (status !== row.status) return null;
      return { date: row.puzzle_date, answerSchoolId: puzzle.answerSchoolId, guessedSchoolIds: progress.guesses.map(g => g.schoolId), status, guesses: progress.guesses.length, points: progress.solved ? 7 - progress.guesses.length : 0, ...(row.completed_at ? { completedAt: row.completed_at } : {}) };
    } catch { return null; }
  }
  function accept(ctx, entry) {
    const pending = ctx.store.readPending().find(x => x.date === entry.date);
    // A remote attempt may lag this device's pending extension. Keep that work.
    if (pending && entry.status === 'attempted' && prefix(entry.guessedSchoolIds, pending.guessedSchoolIds)) {
      const progress = validateProgress({ guesses: pending.guessedSchoolIds.map(schoolId => ({ schoolId })) }, { schoolIds, answerId: entry.answerSchoolId });
      ctx.store.writeResult({ ...pending, guesses: pending.guessedSchoolIds.length });
      ctx.store.writeProgress(entry.date, progress);
      return progress;
    }
    if (pending && !same(entry.guessedSchoolIds, pending.guessedSchoolIds)) conflicts.add(`${ctx.subject}:${entry.date}`);
    const progress = validateProgress({ guesses: entry.guessedSchoolIds.map(schoolId => ({ schoolId })) }, { schoolIds, answerId: entry.answerSchoolId });
    ctx.store.writeResult(entry);
    ctx.store.writeProgress(entry.date, progress);
    return progress;
  }
  async function ownerRow(ctx, date) {
    const response = await ctx.client.from(RESULTS).select('*').eq('user_id', ctx.subject).eq('puzzle_date', date).maybeSingle();
    check(ctx);
    return unwrap(response);
  }
  const controller = {
    setSubject(value) {
      if (value !== 'guest' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new TypeError('A verified account UUID is required');
      subject = value; epoch++; pageEpoch++;
      profiles.delete(value);
    },
    cancel() { epoch++; pageEpoch++; },
    async readProfile() {
      if (subject === 'guest') return null;
      const ctx = context();
      const response = await ctx.client.from(PROFILES).select('*').eq('user_id', ctx.subject).maybeSingle();
      check(ctx);
      const profile = profileFrom(unwrap(response)); profiles.set(ctx.subject, profile);
      return profile;
    },
    async saveProfile({ displayName, school = '', listed = false }) {
      const ctx = context();
      displayName = typeof displayName === 'string' ? displayName.trim() : '';
      school = typeof school === 'string' ? school.trim() : '';
      if (!displayName || [...displayName].length > 60 || [...school].length > 80 || typeof listed !== 'boolean') throw new Error('Use a display name of 1–60 characters and a school of up to 80 characters.');
      // Preserve submission order at the server, including across dialog reopen.
      // A failed save releases the queue; an account change cancels unsent work.
      const previous = profileSaves.get(ctx.subject) || Promise.resolve();
      const work = previous.catch(() => {}).then(async () => {
        check(ctx);
        const response = await ctx.client.from(PROFILES).upsert({ user_id: ctx.subject, display_name: displayName, school, listed }, { onConflict: 'user_id' }).select('*').single();
        check(ctx);
        const profile = profileFrom(unwrap(response)); profiles.set(ctx.subject, profile);
        return profile;
      });
      profileSaves.set(ctx.subject, work);
      try { return await work; }
      finally { if (profileSaves.get(ctx.subject) === work) profileSaves.delete(ctx.subject); }
    },
    // Joining never upserts a stale guest draft over an existing owner profile.
    async createProfile({ displayName, school = '' }) {
      const ctx = context();
      displayName = typeof displayName === 'string' ? displayName.trim() : '';
      school = typeof school === 'string' ? school.trim() : '';
      if (!displayName || [...displayName].length > 60 || [...school].length > 80) throw new Error('Use a display name of 1–60 characters and a school of up to 80 characters.');
      const response = await ctx.client.from(PROFILES).insert({ user_id: ctx.subject, display_name: displayName, school, listed: true }).select('*').single();
      check(ctx);
      if (response.error && (response.status === 409 || response.error.code === '23505')) {
        return { profile: await controller.readProfile(), created: false };
      }
      const profile = profileFrom(unwrap(response));
      profiles.set(ctx.subject, profile);
      return { profile, created: true };
    },
    async readOwnerResults() {
      if (subject === 'guest') return [];
      const ctx = context(), entries = [];
      let offset = 0;
      while (true) {
        const response = await ctx.client.from(RESULTS).select('*').eq('user_id', ctx.subject).order('puzzle_date', { ascending: true }).range(offset, offset + 499);
        check(ctx);
        const rows = unwrap(response);
        if (!Array.isArray(rows)) throw new Error('Unable to read saved scores.');
        if (!rows.length) break;
        for (const row of rows) { const entry = entryFrom(row, ctx.subject); if (entry) entries.push(entry); }
        offset += rows.length;
      }
      check(ctx);
      for (const entry of entries) accept(ctx, entry);
      return entries;
    },
    async loadOwnerProgress(date) {
      if (subject === 'guest') return null;
      const ctx = context(), row = await ownerRow(ctx, date), entry = entryFrom(row, ctx.subject);
      return entry ? accept(ctx, entry) : null;
    },
    async refresh({ sort = 'points', page = 1 }) {
      const request = ++pageEpoch, selectedEpoch = epoch, client = getClient();
      if (!client) throw new Error('Public rankings are unavailable.');
      const response = await client.rpc('charterschoodle_leaderboard_page_v2', { p_sort: ['points', 'winStreak', 'attemptStreak'].includes(sort) ? sort : 'points', p_page: Math.max(1, Math.floor(page) || 1), p_page_size: 5 });
      if (request !== pageEpoch || selectedEpoch !== epoch) throw abort();
      const data = unwrap(response);
      if (!Array.isArray(data?.rows) || !Number.isFinite(data.total)) throw new Error('Public rankings are unavailable.');
      return data;
    },
    queueDailyResult({ date, progress, answerSchoolId, mode }) {
      if (subject === 'guest' || !profiles.get(subject) || mode !== 'daily' || date > ncToday(now()) || conflicts.has(`${subject}:${date}`)) return;
      storeFor(subject).queueResult({ date, answerSchoolId, guessedSchoolIds: progress?.guesses?.map(g => g.schoolId), status: progress?.guesses?.at(-1)?.schoolId === answerSchoolId ? 'solved' : progress?.guesses?.length === 6 ? 'lost' : 'attempted' });
    },
    async flush() {
      if (subject === 'guest' || !profiles.get(subject)) return;
      const ctx = context();
      if (flushes.has(ctx.subject)) return flushes.get(ctx.subject);
      const work = (async () => {
        for (const result of ctx.store.readPending()) {
          check(ctx);
          if (conflicts.has(`${ctx.subject}:${result.date}`)) continue;
          const response = await ctx.client.from(RESULTS).upsert({ user_id: ctx.subject, puzzle_date: result.date, answer_school_id: result.answerSchoolId, guessed_school_ids: result.guessedSchoolIds, status: result.status }, { onConflict: 'user_id,puzzle_date' });
          check(ctx);
          if (response.error && (response.status === 409 || ['23505', '23514'].includes(response.error.code))) {
            const entry = entryFrom(await ownerRow(ctx, result.date), ctx.subject);
            if (!entry) unwrap(response);
            accept(ctx, entry);
            continue;
          }
          unwrap(response);
          const pending = ctx.store.readPending().find(x => x.date === result.date);
          if (same(pending, result)) ctx.store.acknowledgeResult(result.date);
        }
      })();
      flushes.set(ctx.subject, work);
      try { await work; } finally { if (flushes.get(ctx.subject) === work) flushes.delete(ctx.subject); }
    },
    async adoptTodayGuest({ confirmed, guestStore, date, assertCurrent = () => {} }) {
      if (!confirmed || subject === 'guest' || !profiles.get(subject) || date !== ncToday(now()) || guestStore.subject !== 'guest') return false;
      const ctx = context();
      if (ctx.store.hasGuestImport(date)) return false;
      const entry = guestStore.readResults().find(x => x.date === date);
      if (!entry?.guessedSchoolIds?.length) return false;
      // Any existing raw owner row blocks import, including malformed data.
      const existing = await ownerRow(ctx, date);
      // An intent can be cancelled/replaced while the owner read is pending.
      // Recheck consent immediately before the first local import mutation.
      assertCurrent();
      if (existing || date !== ncToday(now())) return false;
      if (ctx.store.hasGuestImport(date) || ctx.store.readPending().some(x => x.date === date)) return false;
      ctx.store.queueResult(entry);
      if (!ctx.store.readPending().some(x => x.date === date)) return false;
      ctx.store.markGuestImport(date);
      accept(ctx, entry);
      return true;
    },
  };
  return controller;
}
