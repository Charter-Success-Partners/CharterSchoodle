import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeDatabase, asRole, migrate } from './helpers.js';

const profiles = 'public.charterschoodle_profiles_v2';
const results = 'public.charterschoodle_results_v2';
const settings = 'public.charterschoodle_settings_v2';
const owner = (db, userId, sql, params) => asRole(db, { role: 'authenticated', userId }, sql, params);
const anon = (db, sql, params) => asRole(db, { role: 'anon' }, sql, params);
async function fixture(t) {
  const data = await makeDatabase();
  t.after(() => data.db.close());
  return data;
}
async function profile(db, userId, name = 'Same Name') {
  return owner(db, userId, `insert into ${profiles} (user_id, display_name, school) values ($1, $2, 'Same School') returning *`, [userId, name]);
}
async function today(db) {
  return (await db.query("select (current_timestamp at time zone 'America/New_York')::date::text as today")).rows[0].today;
}
async function result(db, userId, guesses = ['wrong'], status = 'attempted', date = null, answer = 'answer') {
  return owner(db, userId, `insert into ${results} (user_id,puzzle_date,answer_school_id,guessed_school_ids,status)
    values ($1,$2,$3,$4,$5) returning *`, [userId, date ?? await today(db), answer, guesses, status]);
}

// This must pass before any migration authorization assertions are trusted.
test('harness_enforces_non_superuser_roles', async (t) => {
  const { db, userA } = await fixture(t);
  await db.exec(`create table public.rls_probe (value text); insert into public.rls_probe values ('private');
    alter table public.rls_probe enable row level security;
    grant select,insert on public.rls_probe to anon,authenticated;
    create policy deliberately_deny on public.rls_probe using (false) with check (false);`);
  for (const role of ['anon', 'authenticated']) {
    const context = await asRole(db, { role, userId: userA }, `select current_user as role, auth.uid() as uid,
      rolsuper,rolbypassrls from pg_roles where rolname=current_user`);
    assert.deepEqual(context.rows, [{ role, uid: userA, rolsuper: false, rolbypassrls: false }]);
    assert.equal((await asRole(db, { role, userId: userA }, 'select * from public.rls_probe')).rows.length, 0);
    await assert.rejects(asRole(db, { role, userId: userA }, "insert into public.rls_probe values ('attack')"), /row-level security/i);
  }
  assert.deepEqual((await db.query('select * from public.rls_probe')).rows, [{ value: 'private' }]);
  const context = (await db.query("select current_user as role, nullif(current_setting('request.jwt.claim.sub',true),'') as claim")).rows[0];
  assert.notEqual(context.role, 'authenticated');
  assert.notEqual(context.role, 'anon');
  assert.equal(context.claim, null);
});

test('anonymous_cannot_read_or_write_raw_tables', async (t) => {
  const { db, userA } = await fixture(t);
  await profile(db, userA);
  await result(db, userA);
  for (const table of [profiles, results, settings]) {
    await assert.rejects(anon(db, `select * from ${table}`), /permission denied/i);
    await assert.rejects(anon(db, `insert into ${table} default values`), /permission denied/i);
    await assert.rejects(anon(db, `delete from ${table}`), /permission denied/i);
  }
  await assert.rejects(asRole(db, { role: 'authenticated' }, `insert into ${profiles} (user_id,display_name) values ($1,'Attack')`, [userA]));
  assert.equal((await asRole(db, { role: 'authenticated' }, `select * from ${profiles}`)).rows.length, 0);
  await assert.rejects(anon(db, `update ${profiles} set display_name='Attack'`), /permission denied/i);
  await assert.rejects(anon(db, `update ${results} set status='lost'`), /permission denied/i);
});

test('owner_cannot_read_or_mutate_other_owner', async (t) => {
  const { db, userA, userB } = await fixture(t);
  await profile(db, userA);
  await profile(db, userB);
  await result(db, userA);
  const ownerBReadOfA = await owner(db, userB, `select * from ${profiles} where user_id=$1`, [userA]);
  assert.equal(ownerBReadOfA.rows.length, 0);
  const adminReadOfA = await db.query(`select * from ${profiles} where user_id=$1`, [userA]);
  assert.equal(adminReadOfA.rows[0].user_id, userA);
  assert.equal((await owner(db, userB, `select * from ${results} where user_id=$1`, [userA])).rows.length, 0);
  assert.equal((await owner(db, userB, `update ${profiles} set display_name='Attack' where user_id=$1 returning *`, [userA])).rows.length, 0);
  assert.equal((await owner(db, userB, `update ${results} set guessed_school_ids=ARRAY['wrong','answer'],status='solved' where user_id=$1 returning *`, [userA])).rows.length, 0);
  await assert.rejects(owner(db, userB, `insert into ${profiles} (user_id,display_name) values ($1,'Attack')`, [userA]));
  await result(db, userB, ['answer'], 'solved');
  await assert.rejects(owner(db, userB,
    `insert into ${results} (user_id,puzzle_date,answer_school_id,guessed_school_ids,status) values ($1,(current_timestamp at time zone 'America/New_York')::date,'answer',ARRAY['answer'],'solved')`, [userA]));
  assert.equal((await db.query(`select status from ${results} where user_id=$1`, [userA])).rows[0].status, 'attempted');
  for (const table of [profiles, results]) await assert.rejects(owner(db, userA, `delete from ${table}`), /permission denied/i);
});

test('cannot_transfer_ownership', async (t) => {
  const { db, userA, userB } = await fixture(t);
  await profile(db, userA);
  await result(db, userA);
  for (const table of [profiles, results]) {
    await assert.rejects(owner(db, userA, `update ${table} set user_id=$1 where user_id=$2`, [userB, userA]));
    assert.equal((await db.query(`select user_id from ${table}`)).rows[0].user_id, userA);
  }
});

test('public_name_match_does_not_merge_accounts', async (t) => {
  const { db, userA, userB } = await fixture(t);
  const a = (await profile(db, userA)).rows[0];
  const b = (await profile(db, userB)).rows[0];
  assert.notEqual(a.public_id, b.public_id);
  assert.equal((await owner(db, userB, `select * from ${profiles}`)).rows.length, 1);
  assert.equal((await db.query(`select count(*)::int as count from ${results}`)).rows[0].count, 0);
});

test('legacy_rows_survive_and_become_private', async (t) => {
  const { db, legacyRowsBefore } = await fixture(t);
  const legacyCountBefore = legacyRowsBefore.length;
  const rows = (await db.query('select * from public.charterschoodle_results order by client_player_id')).rows;
  const legacyCountAfter = rows.length;
  assert.equal(legacyCountAfter, legacyCountBefore);
  assert.deepEqual(rows, legacyRowsBefore);
  // Rerunning the retired bootstrap must never reopen custom legacy policies.
  await db.exec(await readFile(new URL('../../docs/supabase-leaderboard.sql', import.meta.url), 'utf8'));
  for (const role of ['anon', 'authenticated']) {
    for (const sql of ['select * from public.charterschoodle_results', 'select player_name from public.charterschoodle_results',
      'insert into public.charterschoodle_results default values',
      "update public.charterschoodle_results set player_name='Attack'", 'delete from public.charterschoodle_results']) {
      await assert.rejects(asRole(db, { role }, sql), /permission denied/i);
    }
  }
  assert.equal((await db.query("select count(*)::int as count from pg_policies where schemaname='public' and tablename='charterschoodle_results'")).rows[0].count, 0);
  assert.deepEqual((await db.query('select * from public.charterschoodle_results order by client_player_id')).rows, legacyRowsBefore);
});

test('migration_rerun_keeps_cutover_and_rows', async (t) => {
  const { db, userA, legacyRowsBefore } = await fixture(t);
  // Simulate a later migration date by retaining a cutover one day in the past.
  await db.exec(`update ${settings} set cutover_date=cutover_date-1`);
  await profile(db, userA);
  await result(db, userA, ['answer'], 'solved');
  const cutoverBefore = (await db.query(`select cutover_date::text from ${settings}`)).rows[0].cutover_date;
  const before = (await db.query(`select * from ${results}`)).rows;
  await migrate(db);
  const cutoverAfterRerun = (await db.query(`select cutover_date::text from ${settings}`)).rows[0].cutover_date;
  assert.equal(cutoverAfterRerun, cutoverBefore);
  assert.deepEqual((await db.query(`select * from ${results}`)).rows, before);
  assert.deepEqual((await db.query('select * from public.charterschoodle_results order by client_player_id')).rows, legacyRowsBefore);
});

test('terminal_results_are_immutable', async (t) => {
  const { db, userA, userB } = await fixture(t);
  for (const [user, guesses, status] of [[userA, ['wrong','answer'], 'solved'], [userB, ['a','b','c','d','e','f'], 'lost']]) {
    await profile(db, user);
    await result(db, user, guesses, status);
    const terminalResultBefore = (await db.query(`select * from ${results} where user_id=$1`, [user])).rows[0];
    await assert.rejects(owner(db, user, `update ${results} set guessed_school_ids=ARRAY['new'],status='attempted' where user_id=$1`, [user]));
    const terminalResultAfterConflict = (await db.query(`select * from ${results} where user_id=$1`, [user])).rows[0];
    assert.deepEqual(terminalResultAfterConflict, terminalResultBefore);
    const retry = await owner(db, user, `insert into ${results} (user_id,puzzle_date,answer_school_id,guessed_school_ids,status,completed_at)
      values ($1,$2,'answer',$3,$4,'2000-01-01') on conflict (user_id,puzzle_date) do update
      set guessed_school_ids=excluded.guessed_school_ids,status=excluded.status,completed_at=excluded.completed_at returning *`,
      [user, await today(db), guesses, status]);
    assert.deepEqual(retry.rows[0], terminalResultBefore);
  }
});

test('attempts_must_extend_the_existing_prefix', async (t) => {
  const { db, userA } = await fixture(t);
  await profile(db, userA);
  await result(db, userA, ['a','b']);
  for (const ids of [['a'], ['b','a'], ['a','c','d']]) {
    await assert.rejects(owner(db, userA, `update ${results} set guessed_school_ids=$1`, [ids]));
  }
  const extended = await owner(db, userA, `update ${results} set guessed_school_ids=ARRAY['a','b','c'] returning guesses,points`);
  assert.deepEqual(extended.rows, [{ guesses: 3, points: 0 }]);
  const solved = await owner(db, userA, `update ${results} set guessed_school_ids=ARRAY['a','b','c','answer'],status='solved' returning guesses,points,completed_at`);
  assert.equal(solved.rows[0].points, 3);
  assert.ok(solved.rows[0].completed_at);
});

test('profile_validation_and_server_owned_identity_and_timestamps', async (t) => {
  const { db, userA, userB } = await fixture(t);
  for (const [name, school] of [['',''], [' \t\n',''], ['x'.repeat(61),''], ['Name','x'.repeat(81)], [null,''], ['Name',null]]) {
    await assert.rejects(owner(db, userA, `insert into ${profiles} (user_id,display_name,school) values ($1,$2,$3)`, [userA,name,school]));
  }
  const created = (await owner(db, userA, `insert into ${profiles} (user_id,public_id,display_name,school,created_at,updated_at)
    values ($1,$1,'Name','','2000-01-01','2000-01-01') returning *`, [userA])).rows[0];
  assert.notEqual(created.public_id, userA);
  assert.notEqual(created.public_id, userB);
  assert.equal(created.listed, false);
  assert.ok(created.created_at.getUTCFullYear() > 2020);
  await assert.rejects(owner(db, userA, `update ${profiles} set public_id=$1`, [userB]));
  const edited = (await owner(db, userA, `update ${profiles} set display_name=$1,school=$2,created_at='2000-01-01',updated_at='2000-01-01' returning *`, ['x'.repeat(60),'x'.repeat(80)])).rows[0];
  assert.equal(edited.public_id, created.public_id);
  assert.equal(edited.created_at.getTime(), created.created_at.getTime());
  assert.ok(edited.updated_at.getUTCFullYear() > 2020);
  await assert.rejects(owner(db, userA, `update ${profiles} set display_name='   '`));
  await assert.rejects(owner(db, userA, `update ${profiles} set school=$1`, ['x'.repeat(81)]));
});

test('invalid_guesses_statuses_and_generated_points_are_rejected', async (t) => {
  const { db, userA } = await fixture(t);
  await profile(db, userA);
  const cases = [
    [null,'attempted'], [[], 'attempted'], [['a','a'],'attempted'], [['a',null],'attempted'],
    [['a','b','c','d','e','f','g'],'lost'], [[''],'attempted'], [['x'.repeat(121)],'attempted'],
    [['a'],'solved'], [['a'],'lost'], [['a','b','c','d','e','f'],'attempted'],
    [['answer'],'attempted'], [['answer','a'],'solved'], [['a','b','c','d','e','answer'],'lost'], [['a'],'bogus'],
  ];
  for (const [ids, status] of cases) await assert.rejects(result(db, userA, ids, status), `${JSON.stringify(ids)} / ${status}`);
  for (const answer of ['', 'x'.repeat(121), null]) await assert.rejects(result(db, userA, ['a'], 'attempted', null, answer));
  await assert.rejects(owner(db, userA, `insert into ${results} (user_id,puzzle_date,answer_school_id,guessed_school_ids,status,points)
    values ($1,$2,'answer',ARRAY['answer'],'solved',100)`, [userA, await today(db)]), { code: '428C9' });
  await result(db, userA);
  await assert.rejects(owner(db, userA, `update ${results} set points=6`), { code: '428C9' });
  await assert.rejects(owner(db, userA, `update ${results} set answer_school_id='changed'`));
});

test('dates_cutover_settings_and_required_profile_are_enforced', async (t) => {
  const { db, userA, userB } = await fixture(t);
  await assert.rejects(result(db, userB));
  await profile(db, userA);
  for (const delta of [-1, 1]) {
    const date = (await db.query("select ((current_timestamp at time zone 'America/New_York')::date + $1::int)::text as date", [delta])).rows[0].date;
    await assert.rejects(result(db, userA, ['a'], 'attempted', date));
  }
  assert.equal((await db.query(`select cutover_date::text from ${settings}`)).rows[0].cutover_date, await today(db));
  for (const sql of [`select * from ${settings}`, `update ${settings} set cutover_date='2000-01-01'`, `delete from ${settings}`, `insert into ${settings} default values`]) {
    await assert.rejects(owner(db, userA, sql), /permission denied/i);
  }
  const row = (await owner(db, userA, `insert into ${results} (user_id,puzzle_date,answer_school_id,guessed_school_ids,status,created_at,updated_at,completed_at)
    values ($1,$2,'answer',ARRAY['a'],'attempted','2000-01-01','2000-01-01','2000-01-01') returning *`, [userA, await today(db)])).rows[0];
  assert.equal(row.completed_at, null);
  assert.ok(row.created_at.getUTCFullYear() > 2020);
  const solved = (await owner(db, userA, `update ${results} set guessed_school_ids=ARRAY['a','answer'],status='solved',created_at='2000-01-01',updated_at='2000-01-01',completed_at='2000-01-01' returning *`)).rows[0];
  assert.equal(solved.created_at.getTime(), row.created_at.getTime());
  assert.ok(solved.updated_at.getUTCFullYear() > 2020);
  assert.ok(solved.completed_at.getUTCFullYear() > 2020);
  await assert.rejects(owner(db, userA, `update ${results} set puzzle_date=puzzle_date-1`));
});
