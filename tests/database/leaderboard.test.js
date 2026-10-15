import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDatabase, asRole, migrate } from './helpers.js';
import { scoreSummary } from '../../src/game.js';

const profiles = 'public.charterschoodle_profiles_v2';
const results = 'public.charterschoodle_results_v2';
const settings = 'public.charterschoodle_settings_v2';
const rpc = 'public.charterschoodle_leaderboard_page_v2';
const publicRowKeys = ['publicId', 'displayName', 'school', 'rank', 'points', 'played', 'solved', 'winStreak', 'attemptStreak', 'average'];

// A shared database is reset between awaited subtests; role transactions never overlap.
test('private aggregate leaderboard', async (t) => {
  const { db, userA, userB } = await makeDatabase();
  t.after(() => db.close());
  await db.exec('alter table auth.users add column email text');
  const today = (await db.query("select (current_timestamp at time zone 'America/New_York')::date::text as date")).rows[0].date;
  const date = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  const owner = (userId, sql, params = []) => asRole(db, { role: 'authenticated', userId }, sql, params);
  const page = async (sort = 'points', number = 1, size = 5, role = 'anon', userId = null) =>
    (await asRole(db, { role, userId }, `select ${rpc}($1,$2,$3) as page`, [sort, number, size])).rows[0].page;
  async function reset() {
    await db.exec(`delete from ${results}; delete from ${profiles};
      update ${settings} set cutover_date=(current_timestamp at time zone 'America/New_York')::date-6000`);
  }
  async function profile(userId, name = 'Player', listed = true) {
    await db.query('insert into auth.users(id) values ($1) on conflict do nothing', [userId]);
    return (await owner(userId, `insert into ${profiles}(user_id,display_name,school,listed)
      values ($1,$2,'CSP', $3) returning public_id`, [userId, name, listed])).rows[0].public_id;
  }
  async function seed(userId, entries) {
    for (const [offset, status, guesses = 1] of entries) {
      const ids = Array.from({ length: guesses }, (_, i) => `private-guess-${i}`);
      if (status === 'solved') ids[guesses - 1] = 'private-answer';
      await owner(userId, `insert into ${results}(user_id,puzzle_date,answer_school_id,guessed_school_ids,status)
        values ($1,$2,'private-answer',$3,$4)`, [userId, date(offset), ids, status]);
    }
  }
  async function summaryMatches(userId, row) {
    const records = (await owner(userId, `select puzzle_date::text as date,status,guesses,points from ${results}`)).rows;
    const summary = scoreSummary(records, today);
    for (const key of ['points', 'played', 'solved', 'winStreak', 'attemptStreak', 'average']) {
      assert.equal(row[key], summary[key], key);
    }
  }

  await t.test('rpc_is_callable_with_default_arguments', async () => {
    const response = await asRole(db, { role: 'anon' }, `select ${rpc}() as page`);
    assert.deepEqual(response.rows[0].page, { rows: [], total: 0, page: 1, pageSize: 5 });
  });

  await t.test('aggregates_more_than_5000_results', async () => {
    await reset();
    const firstId = await profile(userA, 'All Results');
    const finalId = await profile(userB, 'Final Participant');
    // Administrator fixture backdates only the cutover; all result inserts obey owner RLS/guards.
    await owner(userA, `insert into ${results}(user_id,puzzle_date,answer_school_id,guessed_school_ids,status)
      select $1,(current_timestamp at time zone 'America/New_York')::date-day_offset,'answer',ARRAY['answer'],'solved'
      from generate_series(0,5000) as days(day_offset)`, [userA]);
    await seed(userB, [[0, 'solved', 2]]);
    const response = await page();
    assert.equal(response.total, 2);
    assert.equal(response.rows[0].publicId, firstId);
    assert.deepEqual(response.rows.map(({ points, played, solved }) => ({ points, played, solved })), [
      { points: 30006, played: 5001, solved: 5001 }, { points: 5, played: 1, solved: 1 },
    ]);
    assert.equal(response.rows[0].winStreak, 5001);
    assert.equal(response.rows[0].attemptStreak, 5001);
    assert.equal(response.rows[0].average, 1);
    assert.equal(response.rows[1].publicId, finalId);
    await summaryMatches(userA, response.rows[0]);
  });

  await t.test('all_sort_modes_have_stable_ties', async () => {
    await reset();
    const ids = Array.from({ length: 8 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`);
    const names = ['Winner', 'High Solves', 'Alpha', 'Same', 'Same', 'Zulu', 'Breaker', 'Loss'];
    const publicIds = [];
    for (let i = 0; i < ids.length; i++) publicIds.push(await profile(ids[i], names[i]));
    await seed(ids[0], [[-1, 'solved'], [0, 'solved']]);
    await seed(ids[1], [[-5, 'solved', 3], [-3, 'solved', 3], [0, 'solved', 3]]);
    for (const id of ids.slice(2, 6)) await seed(id, [[-2, 'solved', 4], [-1, 'solved', 4]]);
    await seed(ids[6], [[-2, 'solved'], [-1, 'attempted'], [0, 'attempted']]);
    await seed(ids[7], [[0, 'lost', 6]]);
    const tied = [publicIds[2], ...[publicIds[3], publicIds[4]].sort(), publicIds[5]];
    const expected = {
      points: [publicIds[1], publicIds[0], ...tied, publicIds[6], publicIds[7]],
      winStreak: [publicIds[0], ...tied, publicIds[1], publicIds[6], publicIds[7]],
      attemptStreak: [publicIds[6], publicIds[0], ...tied, publicIds[1], publicIds[7]],
    };
    for (const sort of Object.keys(expected)) {
      const first = await page(sort);
      const second = await page(sort, 2);
      assert.equal(first.pageSize, 5);
      assert.equal(first.total, 8);
      assert.equal(second.rows[0].rank, (second.page - 1) * 5 + 1);
      assert.deepEqual([...first.rows, ...second.rows].map((row) => row.publicId), expected[sort]);
      assert.deepEqual([...first.rows, ...second.rows].map((row) => row.rank), [1,2,3,4,5,6,7,8]);
      assert.deepEqual(await page(sort), first);
      assert.deepEqual(await page(sort, 1, 5, 'authenticated', ids[7]), first);
    }
  });

  for (const { name, entries, expected } of [
    { name: 'current_streaks_stop_after_missed_days', entries: [[-4,'solved'],[-3,'solved']], expected: [12,2,2,0,0,1] },
    { name: 'today_attempt_is_neutral_for_win_streak', entries: [[-2,'solved',2],[-1,'solved',3],[0,'attempted',3]], expected: [9,3,2,2,3,2.5] },
    { name: 'past_attempt_breaks_win_streak', entries: [[-2,'solved'],[-1,'attempted'],[0,'solved',3]], expected: [10,3,2,1,3,2] },
    { name: 'past_attempt_without_today_breaks_win_streak', entries: [[-2,'solved'],[-1,'attempted']], expected: [6,2,1,0,2,1] },
    { name: 'lost_today_breaks_win_streak', entries: [[-1,'solved'],[0,'lost',6]], expected: [6,2,1,0,2,1] },
    { name: 'only_today_attempt_has_null_average', entries: [[0,'attempted',2]], expected: [0,1,0,0,1,null] },
  ]) {
    await t.test(name, async () => {
      await reset();
      await profile(userA);
      await seed(userA, entries);
      const row = (await page()).rows[0];
      assert.deepEqual(['points','played','solved','winStreak','attemptStreak','average'].map((key) => row[key]), expected);
      await summaryMatches(userA, row);
    });
  }

  await t.test('hidden_profiles_are_absent', async () => {
    await reset();
    const visibleId = await profile(userA, 'Visible');
    await profile(userB, 'Hidden', false);
    await seed(userA, [[0,'attempted']]);
    await seed(userB, [[0,'solved']]);
    const response = await page();
    assert.equal(response.total, 1);
    assert.deepEqual(response.rows.map((row) => row.publicId), [visibleId]);
    await owner(userA, `update ${profiles} set listed=false`);
    assert.equal((await page()).total, 0);
    await owner(userB, `update ${profiles} set listed=true`);
    assert.equal((await page()).rows[0].displayName, 'Hidden');
  });

  await t.test('empty_and_out_of_range_pages_are_valid', async () => {
    await reset();
    assert.deepEqual(await page(), { rows: [], total: 0, page: 1, pageSize: 5 });
    await profile(userA, 'No Results');
    assert.equal((await page()).total, 0);
    await seed(userA, [[0,'solved']]);
    assert.deepEqual(await page('points', 2), { rows: [], total: 1, page: 2, pageSize: 5 });
    assert.deepEqual(await page('points', 2147483647, 2147483647), { rows: [], total: 1, page: 2147483647, pageSize: 50 });
    assert.equal((await page('points', 1, 51)).pageSize, 50);
    assert.equal((await page('points', 1, 1)).rows.length, 1);
    for (const args of [['invalid',1,5], [null,1,5], ['points',0,5], ['points',-1,5], ['points',null,5], ['points',1,0], ['points',1,-1], ['points',1,null]]) {
      await assert.rejects(page(...args), { code: '22023' });
    }
  });

  await t.test('rpc_contains_only_public_fields', async () => {
    await reset();
    const privateEmail = 'private-account@example.test';
    await db.query('update auth.users set email=$1 where id=$2', [privateEmail, userA]);
    await profile(userA, 'Public Player');
    await seed(userA, [[0,'solved',2]]);
    const response = await page();
    assert.deepEqual(Object.keys(response).sort(), ['page','pageSize','rows','total']);
    assert.deepEqual(Object.keys(response.rows[0]).sort(), [...publicRowKeys].sort());
    for (const privateValue of [privateEmail, userA, 'private-guess', 'private-answer', 'token', 'completed_at', 'user_id']) {
      assert.equal(JSON.stringify(response).includes(privateValue), false, privateValue);
    }
    for (const role of ['anon','authenticated']) {
      for (const table of [profiles,results,settings]) {
        const context = { role, userId: userB };
        if (role === 'authenticated' && table !== settings) {
          assert.equal((await asRole(db, context, `select * from ${table}`)).rows.length, 0);
        } else await assert.rejects(asRole(db, context, `select * from ${table}`), /permission denied/i);
      }
    }
    const metadata = (await db.query(`select prosecdef, provolatile, proconfig,
      has_function_privilege('anon', oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', oid, 'execute') as authenticated_execute,
      exists(select 1 from aclexplode(proacl) where grantee=0 and privilege_type='EXECUTE') as public_execute
      from pg_proc where oid='${rpc}(text,integer,integer)'::regprocedure`)).rows[0];
    assert.deepEqual(metadata, { prosecdef: true, provolatile: 's', proconfig: ['search_path=""'], anon_execute: true, authenticated_execute: true, public_execute: false });
    await migrate(db);
    assert.deepEqual(await page(), response);
  });
});
