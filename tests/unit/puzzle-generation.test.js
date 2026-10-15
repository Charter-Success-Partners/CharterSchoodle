import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { selectClues, mergePublishedCalendar } from '../../scripts/clue-selection.mjs';

const config = {
  seed: 'CharterSchoodle-v1', requiredCuratedClues: 5,
  targetClueDifficulties: [8, 7, 5, 4, 2],
};
const categoryWeights = { mission: 9, program: 8, focus: 6, identity: 5 };
const clue = (text, difficulty, category) => ({ text, difficulty, category, sourceRefs: ['home'] });
const pool = [
  clue('Its mission develops confident community leaders.', 8, 'mission'),
  clue('Its academic model pairs projects with reading science.', 6, 'program'),
  clue('Leadership development shapes its identity.', 5, 'focus'),
  clue('One distinctive word in its official name is "Riverside".', 5, 'identity'),
  clue('Its official name begins with the word "RIVERSIDE".', 4, 'identity'),
  clue('Its public-facing slogan is "Leading the quest for student success."', 7, 'identity'),
];
const input = { schoolId: 'riverside', officialName: 'Riverside Leadership Academy',
  usablePool: pool, date: '2026-10-16', config, categoryWeights };
const puzzle = (date, answerSchoolId = 'riverside', text = 'Published clue') => ({
  date, answerSchoolId, clues: [{ text, difficulty: 8 }],
});

// Removing token normalization/preference would retain both differently worded name hints.
test('same_name_token_prefers_alternative_sourced_clue', () => {
  const output = selectClues(input);
  assert.equal(output.clues.length, 6);
  assert.equal(output.clues.filter(c => /word.*riverside/i.test(c.text)).length, 1);
  assert.equal(output.clues.some(c => c.text === pool[5].text), true);
  assert.deepEqual(output.clues.at(-1), { difficulty: 1, text: 'The answer begins with the letter R.' });
  assert.deepEqual(output.diagnostics, []);
  assert.deepEqual(selectClues({ ...input, usablePool: [...pool].reverse() }), output);
  assert.equal(pool.length, 6);
});

// Slot scoring alone can place a harder clue after an easier clue.
test('curated_difficulties_do_not_increase', () => {
  const usablePool = [clue('A', 2, 'mission'), clue('B', 8, 'identity'),
    clue('C', 4, 'program'), clue('D', 7, 'focus'), clue('E', 5, 'identity')];
  const output = selectClues({ ...input, usablePool });
  assert.deepEqual(output.clues.slice(0, 5).map(c => c.difficulty), [8, 7, 5, 4, 2]);
  assert.deepEqual(selectClues({ ...input, usablePool: [...usablePool].reverse() }), output);
});

// Dropping a duplicate with no replacement would shorten the six-clue game.
test('sparse_pool_keeps_six_clues_and_reports_redundancy', () => {
  const output = selectClues({ ...input, usablePool: pool.slice(0, 5) });
  assert.equal(output.clues.length, 6); // assembled five curated + letter hint
  assert.equal(output.clues.filter(c => /word.*riverside/i.test(c.text)).length, 2);
  assert.deepEqual(output.diagnostics, [{ schoolId: 'riverside', date: '2026-10-16', reason: 'repeated-name-token' }]);
});

// Generated drafts must never replace a published object, including extra fields.
test('published_objects_remain_identical', () => {
  const today = '2026-10-15';
  const existing = [{ ...puzzle('2026-10-14'), editorial: { approved: true } }, puzzle(today), puzzle('2026-10-16')];
  const generated = [puzzle('2026-10-14', 'other'), puzzle(today, 'other'), puzzle('2026-10-16', 'other')];
  const merged = mergePublishedCalendar(existing, generated, today);
  assert.deepEqual(merged.filter(p => p.date <= today), existing.filter(p => p.date <= today));
  assert.deepEqual(merged.at(-1), generated.at(-1));
});

// Filtering only the draft would silently lose published dates absent from it.
test('published_dates_missing_from_draft_are_kept', () => {
  const existing = [puzzle('2026-10-14'), puzzle('2026-10-15'), puzzle('2026-10-18')];
  const generated = [puzzle('2026-10-17'), puzzle('2026-10-16'), puzzle('2026-10-16')];
  assert.deepEqual(mergePublishedCalendar(existing, generated, '2026-10-15').map(p => p.date),
    ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
});

test('same_inputs_have_identical_puzzles', () => {
  const build = () => ['2026-10-16', '2026-10-17', '2026-10-18'].map(date => ({
    date, answerSchoolId: input.schoolId, clues: selectClues({ ...input, date }).clues,
  }));
  const generated = build();
  const schoolIds = new Set(['riverside']);
  assert.equal(new Set(generated.map(p => p.date)).size, generated.length);
  assert.equal(generated.every(p => schoolIds.has(p.answerSchoolId)), true);
  assert.equal(generated.every(p => p.clues.length === 6), true);
  assert.deepEqual(build(), generated);
});

// Exercise the actual CLI in a temporary site: no repository calendar writes.
async function generatorFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'charterschoodle-generator-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'src', 'data']) await fs.mkdir(path.join(root, dir));
  for (const file of ['scripts/generate-daily-puzzles.mjs', 'scripts/clue-selection.mjs', 'src/game.js']) {
    await fs.copyFile(new URL(`../../${file}`, import.meta.url), path.join(root, file));
  }
  await fs.writeFile(path.join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(path.join(root, 'data/schools.json'), JSON.stringify([{ id: 'riverside' }]));
  await fs.writeFile(path.join(root, 'data/clue-bank-statewide.json'), JSON.stringify({ schools: [{
    schoolId: 'riverside', officialName: input.officialName, status: 'validated-batch-034', clues: pool,
  }] }));
  const existing = [puzzle('2026-05-07'), puzzle('2026-10-14'), puzzle('2026-10-15')];
  for (const file of ['puzzles.json', 'puzzle-source.json']) {
    await fs.writeFile(path.join(root, 'data', file), JSON.stringify({ puzzles: existing }));
  }
  return { root, existing, script: path.join(root, 'scripts/generate-daily-puzzles.mjs') };
}

test('generator_preserves_published_and_is_deterministic_with_validated_override', async t => {
  const { root, existing, script } = await generatorFixture(t);
  const env = { ...process.env, CHARTERSCHOODLE_TODAY: '2026-10-15' };
  execFileSync(process.execPath, [script], { env });
  const first = JSON.parse(await fs.readFile(path.join(root, 'data/puzzles.json'))).puzzles;
  assert.deepEqual(first.filter(p => p.date <= '2026-10-15'), existing);
  assert.equal(first.at(-1).date, '2028-10-14');
  assert.equal(first.filter(p => p.date > '2026-10-15').length, 730);
  execFileSync(process.execPath, [script], { env });
  const second = JSON.parse(await fs.readFile(path.join(root, 'data/puzzles.json'))).puzzles;
  assert.deepEqual(second, first);
  for (const bad of ['2026-02-30', '2026-2-03', '', 'garbage']) {
    const result = spawnSync(process.execPath, [script], { env: { ...env, CHARTERSCHOODLE_TODAY: bad }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CHARTERSCHOODLE_TODAY/);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'data/puzzles.json'))).puzzles, first);
  }
});

test('generator_default_uses_NC_date_before_UTC_midnight', async t => {
  const { root, existing, script } = await generatorFixture(t);
  const clock = path.join(root, 'clock.mjs');
  await fs.writeFile(clock, `const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : ['2026-10-15T02:00:00Z'])); }
    };`);
  const env = { ...process.env };
  delete env.CHARTERSCHOODLE_TODAY;
  execFileSync(process.execPath, ['--import', clock, script], { env });
  const generated = JSON.parse(await fs.readFile(path.join(root, 'data/puzzles.json'))).puzzles;
  assert.deepEqual(generated.filter(p => p.date <= '2026-10-14'), existing.filter(p => p.date <= '2026-10-14'));
  assert.notDeepEqual(generated.find(p => p.date === '2026-10-15'), existing.at(-1));
  assert.equal(generated.at(-1).date, '2028-10-13');
});
