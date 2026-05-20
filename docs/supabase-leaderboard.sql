create table if not exists public.charterschoodle_results (
  id uuid primary key default gen_random_uuid(),
  client_player_id text not null,
  player_name text not null,
  school_name text not null,
  puzzle_date date not null,
  answer_school_id text not null,
  status text not null check (status in ('attempted', 'solved', 'lost')),
  guesses integer not null check (guesses between 1 and 6),
  points integer not null check (points between 0 and 6),
  completed_at timestamptz not null default now(),
  unique (client_player_id, puzzle_date)
);

alter table public.charterschoodle_results enable row level security;

grant select, insert, update on public.charterschoodle_results to anon;

drop policy if exists "Anyone can read CharterSchoodle scores"
  on public.charterschoodle_results;
create policy "Anyone can read CharterSchoodle scores"
  on public.charterschoodle_results
  for select
  to anon
  using (true);

drop policy if exists "Anyone can submit CharterSchoodle scores"
  on public.charterschoodle_results;
create policy "Anyone can submit CharterSchoodle scores"
  on public.charterschoodle_results
  for insert
  to anon
  with check (
    length(client_player_id) between 8 and 120
    and length(player_name) between 1 and 80
    and length(school_name) between 1 and 120
    and points between 0 and 6
    and guesses between 1 and 6
  );

drop policy if exists "Anyone can update CharterSchoodle scores"
  on public.charterschoodle_results;
create policy "Anyone can update CharterSchoodle scores"
  on public.charterschoodle_results
  for update
  to anon
  using (true)
  with check (
    length(client_player_id) between 8 and 120
    and length(player_name) between 1 and 80
    and length(school_name) between 1 and 120
    and points between 0 and 6
    and guesses between 1 and 6
  );
