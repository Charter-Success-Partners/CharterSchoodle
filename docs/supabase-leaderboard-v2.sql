-- Reviewed local migration; production execution requires the release backup/smoke checks.
-- Run as the database administrator. No legacy rows are copied, claimed, or deleted.
begin;

create table if not exists public.charterschoodle_settings_v2 (
  singleton boolean primary key default true check (singleton),
  cutover_date date not null
);
insert into public.charterschoodle_settings_v2 (singleton, cutover_date)
values (true, (current_timestamp at time zone 'America/New_York')::date)
on conflict (singleton) do nothing;

create table if not exists public.charterschoodle_profiles_v2 (
  user_id uuid primary key references auth.users(id),
  public_id uuid not null unique default gen_random_uuid(),
  display_name text not null check (
    char_length(display_name) between 1 and 60 and display_name ~ '[^[:space:]]'
  ),
  school text not null default '' check (char_length(school) <= 80),
  listed boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

-- CHECK constraints cannot contain subqueries; keep array validation in this pure helper.
create or replace function public.charterschoodle_valid_guesses_v2(ids text[])
returns boolean language sql immutable strict set search_path = pg_catalog as $$
  select cardinality(ids) between 1 and 6
    and array_ndims(ids) = 1 and array_lower(ids, 1) = 1
    and not exists (
      select 1 from unnest(ids) as guess(id)
      where id is null or char_length(id) not between 1 and 120
    )
    and cardinality(ids) = (select count(distinct id) from unnest(ids) as guess(id));
$$;

create table if not exists public.charterschoodle_results_v2 (
  user_id uuid not null references auth.users(id)
    references public.charterschoodle_profiles_v2(user_id),
  puzzle_date date not null,
  answer_school_id text not null check (char_length(answer_school_id) between 1 and 120),
  guessed_school_ids text[] not null check (public.charterschoodle_valid_guesses_v2(guessed_school_ids)),
  status text not null check (status in ('attempted', 'solved', 'lost')),
  guesses integer generated always as (cardinality(guessed_school_ids)) stored,
  points integer generated always as (
    case when status = 'solved' then 7 - cardinality(guessed_school_ids) else 0 end
  ) stored,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  completed_at timestamptz,
  primary key (user_id, puzzle_date),
  check (
    (status = 'attempted' and cardinality(guessed_school_ids) < 6 and not (answer_school_id = any(guessed_school_ids)))
    or (status = 'solved' and guessed_school_ids[cardinality(guessed_school_ids)] = answer_school_id)
    or (status = 'lost' and cardinality(guessed_school_ids) = 6 and not (answer_school_id = any(guessed_school_ids)))
  )
);

create or replace function public.charterschoodle_profile_guard_v2()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    -- Ignore caller identifiers, including Auth UUIDs. Public IDs never confer ownership.
    new.public_id := gen_random_uuid();
    new.created_at := statement_timestamp();
  else
    if new.user_id is distinct from old.user_id or new.public_id is distinct from old.public_id then
      raise exception 'Profile identity is immutable' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
  end if;
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

-- SECURITY DEFINER permits reading private settings, never bypasses caller ownership RLS.
-- Pin the search path and qualify the one table read by this function.
create or replace function public.charterschoodle_result_guard_v2()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  cutover date;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.puzzle_date is distinct from old.puzzle_date
      or new.answer_school_id is distinct from old.answer_school_id then
      raise exception 'Result identity is immutable' using errcode = '23514';
    end if;
    if old.status in ('solved', 'lost') then
      if new.guessed_school_ids is distinct from old.guessed_school_ids or new.status is distinct from old.status then
        raise exception 'Terminal results are immutable' using errcode = '23514';
      end if;
      -- A retry succeeds with the original completion and update timestamps.
      return old;
    end if;
    if cardinality(new.guessed_school_ids) < cardinality(old.guessed_school_ids)
      or new.guessed_school_ids[1:cardinality(old.guessed_school_ids)] is distinct from old.guessed_school_ids then
      raise exception 'Guesses must extend the existing prefix' using errcode = '23514';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := statement_timestamp();
  end if;

  select cutover_date into strict cutover from public.charterschoodle_settings_v2 where singleton;
  if new.puzzle_date < cutover or new.puzzle_date > (current_timestamp at time zone 'America/New_York')::date then
    raise exception 'Puzzle date is outside the v2 scoring window' using errcode = '23514';
  end if;
  new.updated_at := statement_timestamp();
  new.completed_at := case when new.status in ('solved', 'lost') then statement_timestamp() else null end;
  return new;
end;
$$;

drop trigger if exists charterschoodle_profile_guard_v2 on public.charterschoodle_profiles_v2;
create trigger charterschoodle_profile_guard_v2 before insert or update on public.charterschoodle_profiles_v2
for each row execute function public.charterschoodle_profile_guard_v2();
drop trigger if exists charterschoodle_result_guard_v2 on public.charterschoodle_results_v2;
create trigger charterschoodle_result_guard_v2 before insert or update on public.charterschoodle_results_v2
for each row execute function public.charterschoodle_result_guard_v2();

alter table public.charterschoodle_profiles_v2 enable row level security;
alter table public.charterschoodle_results_v2 enable row level security;
alter table public.charterschoodle_settings_v2 enable row level security;
revoke all on public.charterschoodle_profiles_v2, public.charterschoodle_results_v2,
  public.charterschoodle_settings_v2 from public, anon, authenticated;
grant select, insert, update on public.charterschoodle_profiles_v2, public.charterschoodle_results_v2 to authenticated;
revoke all on function public.charterschoodle_valid_guesses_v2(text[]) from public, anon, authenticated;
grant execute on function public.charterschoodle_valid_guesses_v2(text[]) to authenticated;
revoke all on function public.charterschoodle_profile_guard_v2() from public, anon, authenticated;
revoke all on function public.charterschoodle_result_guard_v2() from public, anon, authenticated;

-- Separate policies make the allowed client operations explicit; no DELETE policy or grant.
drop policy if exists owner_select on public.charterschoodle_profiles_v2;
create policy owner_select on public.charterschoodle_profiles_v2 for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert on public.charterschoodle_profiles_v2;
create policy owner_insert on public.charterschoodle_profiles_v2 for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update on public.charterschoodle_profiles_v2;
create policy owner_update on public.charterschoodle_profiles_v2 for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists owner_select on public.charterschoodle_results_v2;
create policy owner_select on public.charterschoodle_results_v2 for select to authenticated using (auth.uid() = user_id);
drop policy if exists owner_insert on public.charterschoodle_results_v2;
create policy owner_insert on public.charterschoodle_results_v2 for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists owner_update on public.charterschoodle_results_v2;
create policy owner_update on public.charterschoodle_results_v2 for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Retain the exact legacy archive, even when prior policies used unexpected names.
do $$
declare
  legacy_policy record;
  legacy_column record;
begin
  if to_regclass('public.charterschoodle_results') is not null then
    alter table public.charterschoodle_results enable row level security;
    for legacy_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = 'charterschoodle_results'
    loop
      execute format('drop policy %I on public.charterschoodle_results', legacy_policy.policyname);
    end loop;
    revoke all on public.charterschoodle_results from public, anon, authenticated;
    -- Table-level REVOKE does not remove independently granted column privileges.
    for legacy_column in
      select attname from pg_attribute
      where attrelid = 'public.charterschoodle_results'::regclass and attnum > 0 and not attisdropped
    loop
      execute format('revoke all privileges (%I) on public.charterschoodle_results from public, anon, authenticated', legacy_column.attname);
    end loop;
  end if;
end;
$$;

commit;
