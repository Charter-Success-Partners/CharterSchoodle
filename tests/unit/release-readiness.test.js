import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { evaluateReadiness } from '../../scripts/check-release.mjs';

const local = ['unit', 'database', 'browser', 'vendor', 'staging', 'visual'];
const production = ['backupMigration', 'liveOwnershipSmoke', 'domainTls', 'allowedCallback', 'externalRecipientEmail', 'deployedSmoke'];
const report = (names = local) => ({ schemaVersion: 1, checks: Object.fromEntries(names.map(name => [name, { status: 'passed', evidence: `Observed ${name}: evidence/log.txt` }])) });

test('local_passes_do_not_imply_public_readiness', () => {
  assert.deepEqual(evaluateReadiness(report(), { mode: 'code', leaderboardEnabled: false }), { ready: true, blockers: [] });
  const result = evaluateReadiness(report(), { mode: 'public', leaderboardEnabled: true });
  assert.equal(result.ready, false);
  for (const name of production) assert.ok(result.blockers.some(value => value.includes(name)), name);
});
test('missing_production_evidence_stays_blocked', () => {
  const input = report([...local, ...production]);
  for (const name of ['backupMigration', 'domainTls', 'externalRecipientEmail']) input.checks[name] = { status: 'blocked', evidence: '', reason: 'Owner access unavailable' };
  const result = evaluateReadiness(input, { mode: 'public', leaderboardEnabled: true });
  assert.equal(result.ready, false);
  assert.equal(result.blockers.length, 3);
  assert.ok(result.blockers.every(value => value.includes('Owner access unavailable')));
});
test('disabled_leaderboard_cannot_be_public_ready', () => {
  const result = evaluateReadiness(report([...local, ...production]), { mode: 'public', leaderboardEnabled: false });
  assert.equal(result.ready, false);
  assert.match(result.blockers.join('\n'), /leaderboardEnabled/);
});
test('passed_without_evidence_is_rejected', () => {
  for (const evidence of ['', '   ']) {
    const input = report(); input.checks.visual.evidence = evidence;
    const result = evaluateReadiness(input, { mode: 'code', leaderboardEnabled: false });
    assert.equal(result.ready, false);
    assert.match(result.blockers.join('\n'), /visual.*evidence/);
  }
});
test('complete_observed_report_can_be_ready', () => {
  assert.deepEqual(evaluateReadiness(report([...local, ...production]), { mode: 'public', leaderboardEnabled: true }), { ready: true, blockers: [] });
});
test('failed_local_check_blocks_both_modes', () => {
  const input = report([...local, ...production]); input.checks.browser.status = 'failed';
  for (const mode of ['code', 'public']) assert.equal(evaluateReadiness(input, { mode, leaderboardEnabled: true }).ready, false);
});
test('malformed_reports_and_options_are_rejected', () => {
  for (const input of [null, [], {}, { schemaVersion: 9, checks: {} }, { schemaVersion: 1, checks: [] }, { schemaVersion: 1, checks: { unit: { status: 'ok', evidence: 'log' } } }, { schemaVersion: 1, checks: { unit: { status: 'passed', evidence: ['log'] } } }]) {
    assert.throws(() => evaluateReadiness(input, { mode: 'code', leaderboardEnabled: false }), /Invalid/);
  }
  assert.throws(() => evaluateReadiness(report(), { mode: 'typo', leaderboardEnabled: true }), /Invalid/);
  assert.throws(() => evaluateReadiness(report(), { mode: 'public', leaderboardEnabled: 'true' }), /Invalid/);
});
test('cli_defaults_public_reads_actual_flag_and_rejects_invalid_inputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'release-check-'));
  try {
    await Promise.all(['scripts', 'docs', 'src'].map(dir => mkdir(join(root, dir))));
    await copyFile(new URL('../../scripts/check-release.mjs', import.meta.url), join(root, 'scripts/check-release.mjs'));
    await writeFile(join(root, 'docs/release-readiness.json'), JSON.stringify(report([...local, ...production])));
    const config = value => writeFile(join(root, 'src/supabase-config.js'), `window.CHARTERSCHOOLDLE_SUPABASE = {leaderboardEnabled: ${value}, anonKey: "do-not-print-this"};`);
    const run = (...args) => spawnSync(process.execPath, [join(root, 'scripts/check-release.mjs'), ...args], { encoding: 'utf8' });
    await config('false');
    assert.equal(run('--code').status, 0);
    const blocked = run(); assert.equal(blocked.status, 2); assert.match(blocked.stdout, /leaderboardEnabled/);
    assert.doesNotMatch(blocked.stdout + blocked.stderr, /do-not-print-this/);
    await config('true'); assert.equal(run().status, 0);
    await config('(() => true)()'); assert.equal(run().status, 2);
    assert.equal(run('--unknown').status, 2);
    await writeFile(join(root, 'docs/release-readiness.json'), '{bad json');
    const malformed = run('--code'); assert.equal(malformed.status, 2); assert.match(malformed.stderr, /Invalid/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
