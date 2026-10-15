import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export async function migrate(db) {
  await db.exec(await readFile(new URL('../../docs/supabase-leaderboard-v2.sql', import.meta.url), 'utf8'));
}

/** Create a private, in-memory PostgreSQL fixture. Never contacts Supabase. */
export async function makeDatabase() {
  const db = new PGlite();
  const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  await db.exec(`
    create role anon nologin nosuperuser nobypassrls;
    create role authenticated nologin nosuperuser nobypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    insert into auth.users values ('${userA}'), ('${userB}');
    create table public.charterschoodle_results (
      id uuid primary key default gen_random_uuid(),
      client_player_id text, player_name text, school_name text,
      puzzle_date date, answer_school_id text, status text, guesses integer,
      points integer, completed_at timestamptz default now()
    );
    insert into public.charterschoodle_results
      (client_player_id, player_name, school_name, puzzle_date, answer_school_id, status, guesses, points)
      values ('legacy-a', 'Same Name', 'Same School', '2025-01-01', 'answer', 'solved', 1, 6),
             ('legacy-b', 'Other Name', '', '2025-01-02', 'answer', 'lost', 6, 0);
    alter table public.charterschoodle_results enable row level security;
    grant all on public.charterschoodle_results to public, anon, authenticated;
    grant select (player_name), update (player_name) on public.charterschoodle_results to public, anon, authenticated;
    create policy "unexpected old public read" on public.charterschoodle_results for select using (true);
    create policy "custom old write" on public.charterschoodle_results for all to anon, authenticated
      using (true) with check (true);
  `);
  const legacyRowsBefore = (await db.query('select * from public.charterschoodle_results order by client_player_id')).rows;
  try {
    await migrate(db);
    return { db, userA, userB, legacyRowsBefore };
  } catch (error) {
    await db.close();
    throw error;
  }
}

/** Use transaction-local context; PGlite serializes transactions on each db. */
export async function asRole(db, { role, userId = null }, sql, params = []) {
  if (!['anon', 'authenticated'].includes(role)) throw new Error('Unsupported fixture role');
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    return tx.query(sql, params);
  });
}
