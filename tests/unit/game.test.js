import test from 'node:test';
import assert from 'node:assert/strict';
import { ncToday, archiveDates, validateProgress, scoreSummary, formatShareResult } from '../../src/game.js';

// These fixtures catch timezone drift, trusted saved flags, stale streaks,
// forged points, and private data accidentally entering shared text.
const schoolIds = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
const context = { schoolIds, answerId: 'a' };
const guess = (schoolId) => ({ schoolId, correct: schoolId === 'a' });
const result = (date, status = 'solved', guesses = 1, extra = {}) =>
  ({ date, status, guesses, answerSchoolId: 'a', points: 999, ...extra });

test('NC daily date changes at local midnight rather than UTC midnight', () => {
  assert.equal(ncToday(new Date('2026-10-15T03:59:59Z')), '2026-10-14');
  assert.equal(ncToday(new Date('2026-10-15T04:00:00Z')), '2026-10-15');
});

test('NC dates survive both DST transitions and shifted midnight offsets', () => {
  for (const [instant, date] of [
    ['2026-03-08T04:59:59Z', '2026-03-07'], ['2026-03-08T05:00:00Z', '2026-03-08'],
    ['2026-03-08T06:59:59Z', '2026-03-08'], ['2026-03-08T07:00:00Z', '2026-03-08'],
    ['2026-03-09T04:00:00Z', '2026-03-09'], ['2026-11-01T05:30:00Z', '2026-11-01'],
    ['2026-11-01T06:30:00Z', '2026-11-01'], ['2026-11-02T04:59:59Z', '2026-11-01'],
    ['2026-11-02T05:00:00Z', '2026-11-02'],
  ]) assert.equal(ncToday(new Date(instant)), date);
});

test('archive contains sorted distinct real ISO dates strictly before today', () => {
  assert.deepEqual(archiveDates([{date:'2026-10-14'},{date:'2028-10-03'}], '2026-10-15'), ['2026-10-14']);
  assert.deepEqual(archiveDates([
    {date:'2026-10-15'}, {date:'2026-10-14'}, {date:'2026-10-13'}, {date:'2026-10-14'},
    {date:'2026-02-30'}, {date:'2025-02-29'}, {date:'2024-02-29'}, {date:'2026-2-03'},
    {date:'2026-10-12T00:00:00Z'}, {date:'2026-00-01'}, null,
  ], '2026-10-15'), ['2024-02-29', '2026-10-13', '2026-10-14']);
  assert.deepEqual(archiveDates([{date:'2026-10-14'}], '2026-02-30'), []);
});

test('progress rejects malformed, unknown, duplicate, seventh, and post-answer guesses', () => {
  assert.equal(validateProgress({guesses:[{schoolId:'unknown'}]}, {schoolIds:new Set(['a']),answerId:'a'}), null);
  for (const value of [null, {}, {guesses:'a'}, {guesses:[null]}, {guesses:[{}]},
    {guesses:[guess('b'), guess('b')]}, {guesses:['b']},
    {guesses:['b','c','d','e','f','g','a'].map(guess)},
    {guesses:[guess('a'),guess('b')]},
  ]) assert.equal(validateProgress(value, context), null);
});

test('progress derives correctness and completion from school IDs instead of stored flags', () => {
  assert.deepEqual(validateProgress({guesses:[{schoolId:'b',correct:true}],solved:true,lost:true},context), {
    guesses:[{schoolId:'b',correct:false}], revealedClues:2, solved:false, lost:false,
  });
  assert.deepEqual(validateProgress({guesses:[{schoolId:'a',correct:false}],solved:false,lost:true},context), {
    guesses:[{schoolId:'a',correct:true}], revealedClues:2, solved:true, lost:false,
  });
  const lost = validateProgress({guesses:['b','c','d','e','f','g'].map(guess)},context);
  assert.equal(lost.lost,true);
  assert.equal(lost.solved,false);
  assert.equal(lost.revealedClues,6);
  const lastWin = validateProgress({guesses:['b','c','d','e','f','a'].map(guess)},context);
  assert.equal(lastWin.solved,true);
  assert.equal(lastWin.lost,false);
});

test('progress normalizes revealed clues while preserving a valid saved reveal', () => {
  assert.deepEqual(validateProgress({guesses:[],revealedClues:0},context), {
    guesses:[],revealedClues:1,solved:false,lost:false,
  });
  assert.equal(validateProgress({guesses:[guess('b')],revealedClues:5},context).revealedClues,5);
  assert.equal(validateProgress({guesses:[guess('b')],revealedClues:100},context).revealedClues,6);
  assert.equal(validateProgress({guesses:[guess('b')],revealedClues:'bad'},context).revealedClues,2);
});

test('summary recomputes six-to-one solved points and the solved-only average', () => {
  const results = [1,2,3,4,5,6].map((guesses,i) => result(`2026-10-${10+i}`, 'solved', guesses));
  assert.deepEqual(scoreSummary(results,'2026-10-15'), {
    points:21,played:6,solved:6,winStreak:6,attemptStreak:6,bestWinStreak:6,bestAttemptStreak:6,average:3.5,
  });
  assert.equal(scoreSummary([result('2026-10-14','lost',6),result('2026-10-15','attempted',2)],'2026-10-15').points,0);
});

test('summary has no average or division by zero without solved games', () => {
  assert.deepEqual(scoreSummary([],'2026-10-15'), {
    points:0,played:0,solved:0,winStreak:0,attemptStreak:0,bestWinStreak:0,bestAttemptStreak:0,average:null,
  });
  assert.equal(scoreSummary([result('2026-10-15','lost',6)],'2026-10-15').average,null);
});

test('stale and missed calendar dates break current streaks while retaining best runs', () => {
  const stale = scoreSummary([result('2026-10-12'),result('2026-10-13')],'2026-10-15');
  assert.equal(stale.winStreak,0);
  assert.equal(stale.attemptStreak,0);
  assert.equal(stale.bestWinStreak,2);
  assert.equal(stale.bestAttemptStreak,2);
  const missed = scoreSummary([result('2026-10-12'),result('2026-10-14'),result('2026-10-15')],'2026-10-15');
  assert.equal(missed.winStreak,2);
  assert.equal(missed.attemptStreak,2);
});

test('unfinished current day preserves yesterday wins while unfinished prior day breaks them', () => {
  const current = scoreSummary([result('2026-10-13'),result('2026-10-14'),result('2026-10-15','attempted',1)],'2026-10-15');
  assert.equal(current.winStreak,2);
  assert.equal(current.attemptStreak,3);
  const prior = scoreSummary([result('2026-10-13'),result('2026-10-14','attempted',1)],'2026-10-15');
  assert.equal(prior.winStreak,0);
  assert.equal(prior.attemptStreak,2);
  assert.equal(prior.bestWinStreak,1);
  assert.equal(scoreSummary([result('2026-10-14'),result('2026-10-15','lost',6)],'2026-10-15').winStreak,0);
});

test('streaks cross DST, month, year, and leap-day boundaries as calendar days', () => {
  for (const [previous,today] of [ ['2026-03-08','2026-03-09'], ['2026-11-01','2026-11-02'],
    ['2025-12-31','2026-01-01'], ['2024-02-28','2024-02-29'], ['2024-02-29','2024-03-01'] ]) {
    assert.equal(scoreSummary([result(previous),result(today)],today).winStreak,2);
  }
});

test('summary keeps the latest duplicate record and excludes impossible or future dates', () => {
  assert.deepEqual(scoreSummary([
    result('2026-10-15','solved',2,{completedAt:'2026-10-15T12:00:00Z'}),
    result('2026-10-15','attempted',1,{completedAt:'2026-10-15T11:00:00Z'}),
    result('2026-10-16'),result('2026-02-30'),
  ],'2026-10-15'), {
    points:5,played:1,solved:1,winStreak:1,attemptStreak:1,bestWinStreak:1,bestAttemptStreak:1,average:2,
  });
});

test('daily share has six spoiler-free cells and removes URL authentication parameters', () => {
  const text = formatShareResult({date:'2026-10-15',mode:'daily',progress:{
    guesses:[{schoolId:'Secret Academy',correct:false},{schoolId:'answer-school',correct:true}],solved:true,
    answer:'Secret Academy',email:'person@example.com',
  },publicUrl:'https://example.com/game?code=private-code&email=person%40example.com#access_token=private-token'});
  assert.equal(text,'CharterSchoodle Daily 2026-10-15\n🟥🟩⬜⬜⬜⬜ 2/6\nhttps://example.com/game');
  for (const secret of ['Secret Academy','answer-school','person@example.com','private-code','private-token','code=','access_token']) {
    assert.equal(text.includes(secret),false);
  }
});

test('archive loss share uses Archive and X/6 with six wrong cells', () => {
  assert.equal(formatShareResult({date:'2026-10-14',mode:'archive',progress:{guesses:['b','c','d','e','f','g'].map(guess),solved:false,lost:true},publicUrl:'https://example.com/'}),
    'CharterSchoodle Archive 2026-10-14\n🟥🟥🟥🟥🟥🟥 X/6\nhttps://example.com/');
});

test('share URL excludes embedded account credentials as well as callback data', () => {
  const text = formatShareResult({date:'2026-10-15',mode:'daily',progress:{guesses:[guess('a')],solved:true},
    publicUrl:'https://person%40example.com:private-password@example.com/game?code=secret#token=secret'});
  assert.equal(text,'CharterSchoodle Daily 2026-10-15\n🟩⬜⬜⬜⬜⬜ 1/6\nhttps://example.com/game');
});
