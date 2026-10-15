import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const codeChecks = ['unit', 'database', 'browser', 'vendor', 'staging', 'visual'];
const productionChecks = ['backupMigration', 'liveOwnershipSmoke', 'domainTls', 'allowedCallback', 'externalRecipientEmail', 'deployedSmoke'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Evaluate recorded observations; never runs checks or treats local fixtures as production proof. */
export function evaluateReadiness(report, { mode = 'public', leaderboardEnabled = false } = {}) {
  if (!['code', 'public'].includes(mode) || typeof leaderboardEnabled !== 'boolean') throw new TypeError('Invalid readiness options');
  if (!isObject(report) || report.schemaVersion !== 1 || !isObject(report.checks)) throw new TypeError('Invalid readiness report');
  for (const [name, check] of Object.entries(report.checks)) {
    if (![...codeChecks, ...productionChecks].includes(name) || !isObject(check)
      || !['passed', 'blocked', 'failed', 'pending'].includes(check.status)
      || typeof check.evidence !== 'string' || (check.reason !== undefined && typeof check.reason !== 'string')) {
      throw new TypeError('Invalid readiness check');
    }
  }
  const blockers = [];
  for (const name of mode === 'code' ? codeChecks : [...codeChecks, ...productionChecks]) {
    const check = report.checks[name];
    if (!check) blockers.push(`${name}: missing observation and evidence`);
    else if (check.status !== 'passed') blockers.push(`${name}: ${check.status}${check.reason?.trim() ? ` — ${check.reason.trim()}` : ''}`);
    else if (!check.evidence.trim()) blockers.push(`${name}: passed without evidence`);
  }
  if (mode === 'public' && !leaderboardEnabled) blockers.push('leaderboardEnabled: actual frontend activation flag is false');
  return { ready: blockers.length === 0, blockers };
}

// Accept only the static JSON-compatible object used by this public config. Do not execute it.
async function readActivationFlag(url) {
  const source = await readFile(url, 'utf8');
  const match = source.match(/^\s*window\.CHARTERSCHOOLDLE_SUPABASE\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  if (!match) throw new Error('Invalid public configuration');
  const properties = /\s*([A-Za-z_$][\w$]*)\s*:\s*("(?:[^"\\]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?)\s*(,|(?=\}))/y;
  const object = match[1]; const values = new Map(); let position = 1;
  while (object.slice(position).trim() !== '}') {
    properties.lastIndex = position;
    const property = properties.exec(object);
    if (!property || values.has(property[1])) throw new Error('Invalid public configuration');
    values.set(property[1], JSON.parse(property[2])); position = properties.lastIndex;
  }
  if (typeof values.get('leaderboardEnabled') !== 'boolean') throw new Error('Invalid activation flag');
  return values.get('leaderboardEnabled');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--code')) throw new Error('Invalid arguments: use --code or no arguments');
  const mode = args[0] === '--code' ? 'code' : 'public';
  let report;
  try { report = JSON.parse(await readFile(new URL('../docs/release-readiness.json', import.meta.url), 'utf8')); }
  catch { throw new Error('Invalid or unreadable readiness report'); }
  const leaderboardEnabled = await readActivationFlag(new URL('../src/supabase-config.js', import.meta.url));
  const { ready, blockers } = evaluateReadiness(report, { mode, leaderboardEnabled });
  console.log(`${mode} readiness: ${ready ? 'READY' : 'BLOCKED'}`);
  for (const blocker of blockers) console.log(`- ${blocker}`);
  process.exitCode = ready ? 0 : 2;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message.startsWith('Invalid') ? error.message : 'Invalid or unreadable release inputs'); process.exitCode = 2; });
}
