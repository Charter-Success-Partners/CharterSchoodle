import test from 'node:test';
import assert from 'node:assert/strict';
import { createSafeStorage, createGameStore, loadLegacyProfile } from '../../src/storage.js';

// Breaks caught: stale disk values after failures/removals, trusting corrupt saved
// state, guessed score IDs invented from counts, and crossing account boundaries.
const schools = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }));
const puzzles = [
  { date: '2026-10-14', answerSchoolId: 'b', clues: [] },
  { date: '2026-10-15', answerSchoolId: 'a', clues: [] },
];
const day = '2026-10-15';
const prefix = (subject) => `charterschoodle:v2:${subject}:`;
const progress = { guesses: [{ schoolId: 'b', correct: false }], revealedClues: 2, solved: false, lost: false };
const solved = { date: day, answerSchoolId: 'a', guessedSchoolIds: ['b', 'a'], status: 'solved' };
function disk(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}
function setup(entries = {}) {
  const backing = disk(entries);
  const kv = createSafeStorage(() => backing);
  return { backing, kv, storeFor: (subject = 'guest') => createGameStore({ kv, subject, schools, puzzles }) };
}

test('falls_back_when_storage_getter_throws', () => {
  const kv = createSafeStorage(() => { throw new DOMException('Blocked', 'SecurityError'); });
  kv.setItem('key', 'new');
  assert.equal(kv.getItem('key'), 'new');
  assert.equal(kv.persistent, false);
});

test('keeps_latest_write_after_quota_failure', () => {
  const backing = disk({ key: 'old', observed: 'cached' });
  const kv = createSafeStorage(() => backing);
  assert.equal(kv.getItem('observed'), 'cached');
  backing.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  kv.setItem('key', 'new');
  assert.equal(backing.getItem('key'), 'old'); // The fixture really leaves stale disk data behind.
  assert.equal(kv.getItem('key'), 'new');
  assert.equal(kv.getItem('observed'), 'cached');
  kv.setItem('key', 'latest');
  assert.equal(kv.getItem('key'), 'latest');
  assert.equal(kv.persistent, false);
});

test('retains_memory_deletions', () => {
  const backing = disk({ key: 'old' });
  const kv = createSafeStorage(() => backing);
  assert.equal(kv.getItem('key'), 'old');
  backing.removeItem = () => { throw new Error('blocked'); };
  kv.removeItem('key');
  assert.equal(backing.getItem('key'), 'old');
  assert.equal(kv.getItem('key'), null);
  kv.setItem('other', 'value');
  assert.equal(kv.getItem('key'), null);
});

test('handles_read_failures_and_unavailable_storage', () => {
  const backing = disk();
  const kv = createSafeStorage(() => backing);
  kv.setItem('saved', 'kept');
  backing.getItem = () => { throw new Error('blocked'); };
  assert.equal(kv.getItem('unread'), null);
  assert.equal(kv.getItem('saved'), 'kept');
  assert.equal(kv.persistent, false);
  const unavailable = createSafeStorage(() => undefined);
  unavailable.setItem('key', 'session');
  assert.equal(unavailable.getItem('key'), 'session');
  assert.equal(unavailable.persistent, false);
});

test('persists_healthy_writes_and_deletions_across_adapters', () => {
  const backing = disk();
  const first = createSafeStorage(() => backing);
  first.setItem('key', 'stored');
  const second = createSafeStorage(() => backing);
  assert.equal(second.getItem('key'), 'stored');
  first.removeItem('key');
  assert.equal(second.getItem('key'), null);
  assert.equal(first.persistent, true);
  assert.throws(() => { first.persistent = false; }, TypeError);
});

test('keeps_v1_keys', () => {
  const entries = {
    [`charterschoodle-progress:${day}`]: JSON.stringify(progress),
    'charterschoodle-scorebook:v1': JSON.stringify({ results: { [day]: { date: day, answerSchoolId: 'a', status: 'solved', guesses: 2, points: 900 } } }),
    'charterschoodle-player:v1': JSON.stringify({ id: 'old-anonymous-id', name: ' Player ', school: ' School ' }),
  };
  const { backing, kv, storeFor } = setup(entries);
  storeFor().readProgress(day);
  storeFor().readResults();
  assert.deepEqual(loadLegacyProfile(kv), { displayName: 'Player', school: 'School' });
  storeFor().writeProgress(day, { guesses: [], revealedClues: 1 });
  for (const [key, original] of Object.entries(entries)) assert.equal(backing.getItem(key), original);
});

test('migrates_legacy_only_to_guest', () => {
  const { backing, storeFor } = setup({
    [`charterschoodle-progress:${day}`]: JSON.stringify(progress),
    'charterschoodle-scorebook:v1': JSON.stringify({ results: { [day]: { date: day, answerSchoolId: 'a', status: 'solved', guesses: 2, points: 999 } } }),
  });
  const account = storeFor('account-a');
  assert.equal(account.readProgress(day), null);
  assert.deepEqual(account.readResults(), []);
  const guest = storeFor();
  assert.deepEqual(guest.readProgress(day), progress);
  assert.deepEqual(guest.readResults(), [{ date: day, answerSchoolId: 'a', status: 'solved', guesses: 2, points: 5 }]);
  assert.ok(backing.getItem(`${prefix('guest')}progress:${day}`));
  assert.ok(backing.getItem(`${prefix('guest')}results`));
  assert.deepEqual(guest.readPending(), []);
});

test('prefers_existing_v2_data_over_legacy', () => {
  const { storeFor } = setup({
    [`charterschoodle-progress:${day}`]: JSON.stringify(progress),
    [`${prefix('guest')}progress:${day}`]: JSON.stringify({ guesses: [{ schoolId: 'a' }], revealedClues: 3 }),
    'charterschoodle-scorebook:v1': JSON.stringify({ results: { [day]: { date: day, answerSchoolId: 'a', status: 'solved', guesses: 1 } } }),
    [`${prefix('guest')}results`]: '[]',
  });
  assert.deepEqual(storeFor().readProgress(day), { guesses: [{ schoolId: 'a', correct: true }], revealedClues: 3, solved: true, lost: false });
  assert.deepEqual(storeFor().readResults(), []);
});

test('rejects_corrupt_progress', () => {
  for (const raw of ['{bad', 'null', '[]', JSON.stringify({ guesses: [{ schoolId: 'b' }, { schoolId: 'b' }] }), JSON.stringify({ guesses: [{ schoolId: 'a' }, { schoolId: 'b' }] })]) {
    const { storeFor } = setup({ [`charterschoodle-progress:${day}`]: raw });
    assert.equal(storeFor().readProgress(day), null, raw);
  }
});

test('ignores_unknown_school_ids', () => {
  const { storeFor } = setup({
    [`charterschoodle-progress:${day}`]: JSON.stringify({ guesses: [{ schoolId: 'removed-school' }] }),
    'charterschoodle-scorebook:v1': JSON.stringify({ results: {
      [day]: { date: day, answerSchoolId: 'removed-school', status: 'solved', guesses: 2 },
      '2026-10-14': { date: '2026-10-14', answerSchoolId: 'b', status: 'solved', guesses: 3 },
    } }),
  });
  assert.equal(storeFor().readProgress(day), null);
  assert.deepEqual(storeFor().readResults(), [{ date: '2026-10-14', answerSchoolId: 'b', status: 'solved', guesses: 3, points: 4 }]);
});

test('normalizes_progress_on_write_and_partitions_progress', () => {
  const { storeFor } = setup();
  const guest = storeFor();
  guest.writeProgress(day, { guesses: [{ schoolId: 'a', correct: false }], revealedClues: 99, solved: false, lost: true });
  assert.deepEqual(storeFor().readProgress(day), { guesses: [{ schoolId: 'a', correct: true }], revealedClues: 6, solved: true, lost: false });
  assert.equal(storeFor('account-a').readProgress(day), null);
  guest.writeProgress(day, { guesses: [{ schoolId: 'missing' }] });
  assert.equal(guest.readProgress(day).solved, true);
  guest.writeProgress('2026-02-30', progress);
  assert.equal(guest.readProgress('2026-02-30'), null);
});

test('validates_numeric_guest_scores_without_fabricating_guesses', () => {
  const { storeFor } = setup({ 'charterschoodle-scorebook:v1': JSON.stringify({ results: {
    one: { date: day, answerSchoolId: 'a', status: 'solved', guesses: 0 },
    two: { date: day, answerSchoolId: 'a', status: 'attempted', guesses: 6 },
    three: { date: '2026-10-14', answerSchoolId: 'b', status: 'lost', guesses: 6, points: 999 },
    four: { date: '2026-10-16', answerSchoolId: 'a', status: 'solved', guesses: 2 },
    five: { date: day, answerSchoolId: 'b', status: 'solved', guesses: 2 },
  } }) });
  assert.deepEqual(storeFor().readResults(), [{ date: '2026-10-14', answerSchoolId: 'b', status: 'lost', guesses: 6, points: 0 }]);
});

test('stores_validated_results_and_replaces_the_same_date', () => {
  const { storeFor } = setup();
  const guest = storeFor();
  guest.writeResult({ ...solved, guesses: 99, points: 999, completedAt: '2026-10-15T12:00:00Z', privateField: 'discard' });
  assert.deepEqual(storeFor().readResults(), [{ ...solved, guesses: 2, points: 5, completedAt: '2026-10-15T12:00:00Z' }]);
  guest.writeResult({ date: day, answerSchoolId: 'a', status: 'solved', guesses: 1 });
  assert.deepEqual(guest.readResults(), [{ date: day, answerSchoolId: 'a', status: 'solved', guesses: 1, points: 6 }]);
  assert.deepEqual(storeFor('account-a').readResults(), []);
  guest.writeResult({ ...solved, guessedSchoolIds: ['unknown'] });
  assert.equal(guest.readResults()[0].points, 6);
});

test('separates_account_queues', () => {
  const { storeFor } = setup();
  const first = storeFor('account-a');
  first.queueResult(solved);
  assert.deepEqual(storeFor('account-a').readPending(), [solved]);
  assert.deepEqual(storeFor('account-b').readPending(), []);
  const next = { ...solved, guessedSchoolIds: ['a'] };
  first.queueResult(next);
  assert.deepEqual(first.readPending(), [next]);
  storeFor('account-b').queueResult({ ...solved, date: '2026-10-14', answerSchoolId: 'b', guessedSchoolIds: ['b'] });
  first.acknowledgeResult(day);
  assert.deepEqual(first.readPending(), []);
  assert.deepEqual(storeFor('account-b').readPending(), [{ date: '2026-10-14', answerSchoolId: 'b', guessedSchoolIds: ['b'], status: 'solved' }]);
  assert.throws(() => { first.subject = 'account-b'; }, TypeError);
});

test('binds_import_receipts_to_subject', () => {
  const { storeFor } = setup();
  storeFor('account-a').markGuestImport(day);
  assert.equal(storeFor('account-a').hasGuestImport(day), true);
  assert.equal(storeFor('account-b').hasGuestImport(day), false);
  assert.equal(storeFor('guest').hasGuestImport(day), false);
  storeFor('guest').markGuestImport(day);
  assert.equal(storeFor('guest').hasGuestImport(day), false);
  storeFor('account-a').markGuestImport('not-a-date');
  assert.equal(storeFor('account-a').hasGuestImport('not-a-date'), false);
});

test('rejects_guest_and_invalid_pending_results', () => {
  const { storeFor } = setup();
  storeFor().queueResult(solved);
  assert.deepEqual(storeFor().readPending(), []);
  const account = storeFor('account-a');
  for (const invalid of [
    { date: day, answerSchoolId: 'a', status: 'solved', guesses: 2 },
    { ...solved, guessedSchoolIds: ['unknown', 'a'] },
    { ...solved, guessedSchoolIds: ['b', 'b', 'a'] },
    { ...solved, guessedSchoolIds: ['a', 'b'] },
    { ...solved, answerSchoolId: 'b' },
    { ...solved, status: 'lost' },
    { ...solved, guessedSchoolIds: [] },
  ]) account.queueResult(invalid);
  assert.deepEqual(account.readPending(), []);
});

test('does_not_accept_pending_payloads_copied_from_another_subject', () => {
  const { backing, storeFor } = setup();
  storeFor('account-a').queueResult(solved);
  assert.deepEqual(storeFor('account-a').readPending(), [solved]);
  backing.setItem(`${prefix('account-b')}pending`, backing.getItem(`${prefix('account-a')}pending`));
  assert.deepEqual(storeFor('account-b').readPending(), []);
});

test('does_not_accept_import_receipts_copied_from_another_subject', () => {
  const { backing, storeFor } = setup();
  storeFor('account-a').markGuestImport(day);
  assert.equal(storeFor('account-a').hasGuestImport(day), true);
  backing.setItem(`${prefix('account-b')}guest-imports`, backing.getItem(`${prefix('account-a')}guest-imports`));
  assert.equal(storeFor('account-b').hasGuestImport(day), false);
});

test('ignores_corrupt_v2_data_and_does_not_replace_it_with_legacy', () => {
  const { storeFor } = setup({
    [`${prefix('guest')}progress:${day}`]: '{bad',
    [`charterschoodle-progress:${day}`]: JSON.stringify(progress),
    [`${prefix('guest')}results`]: '{bad',
    [`${prefix('account-a')}pending`]: '{bad',
    [`${prefix('account-a')}guest-imports`]: 'null',
  });
  assert.equal(storeFor().readProgress(day), null);
  assert.deepEqual(storeFor().readResults(), []);
  assert.deepEqual(storeFor('account-a').readPending(), []);
  assert.equal(storeFor('account-a').hasGuestImport(day), false);
});

test('returns_detached_data_so_mutation_cannot_change_saved_state', () => {
  const { storeFor } = setup();
  const account = storeFor('account-a');
  const input = structuredClone(solved);
  account.queueResult(input);
  input.guessedSchoolIds[0] = 'g';
  const pending = account.readPending();
  assert.deepEqual(pending, [solved]);
  pending[0].guessedSchoolIds[0] = 'f';
  assert.deepEqual(account.readPending(), [solved]);
});

test('legacy_profile_is_only_bounded_display_prefill', () => {
  const { kv } = setup({ 'charterschoodle-player:v1': JSON.stringify({ id: 'uuid', name: ' Ada ', team: ' Team ', email: 'private@example.com' }) });
  assert.deepEqual(loadLegacyProfile(kv), { displayName: 'Ada', school: 'Team' });
  for (const raw of ['{bad', 'null', JSON.stringify({ name: 'x'.repeat(61), school: 's'.repeat(81) }), JSON.stringify({ name: 12, school: {} })]) {
    assert.deepEqual(loadLegacyProfile(createSafeStorage(() => disk({ 'charterschoodle-player:v1': raw }))), { displayName: '', school: '' });
  }
});

// Account result caching must retain owner-readable IDs; numeric legacy scores
// must never be mistaken for verified account results.
test('account_result_cache_requires_and_retains_ordered_guesses', () => {
  const { storeFor } = setup();
  const account = storeFor('account-a');
  account.writeResult({ ...solved, guesses: 2, points: 999 });
  assert.deepEqual(storeFor('account-a').readResults(), [{ ...solved, guesses: 2, points: 5 }]);
  account.writeResult({ date: day, answerSchoolId: 'a', status: 'solved', guesses: 1 });
  assert.deepEqual(account.readResults(), [{ ...solved, guesses: 2, points: 5 }]);
  assert.deepEqual(storeFor('account-b').readResults(), []);
});

test('queues_in_progress_and_six_guess_lost_results', () => {
  const { storeFor } = setup();
  const account = storeFor('account-a');
  const attempted = { date: day, answerSchoolId: 'a', guessedSchoolIds: ['b'], status: 'attempted' };
  const lost = { date: day, answerSchoolId: 'a', guessedSchoolIds: ['b', 'c', 'd', 'e', 'f', 'g'], status: 'lost' };
  account.queueResult(attempted);
  assert.deepEqual(storeFor('account-a').readPending(), [attempted]);
  account.queueResult(lost);
  assert.deepEqual(account.readPending(), [lost]);
  account.writeResult({ ...lost, guesses: 6, points: 999 });
  assert.deepEqual(account.readResults(), [{ ...lost, guesses: 6, points: 0 }]);
});
