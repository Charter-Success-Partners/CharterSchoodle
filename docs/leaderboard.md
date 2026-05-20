# Leaderboard

CharterSchoodle uses a Supabase-backed leaderboard for company-wide daily scores. The app still keeps local puzzle progress and a local scorebook in `localStorage`, so play continues to work if the leaderboard request is temporarily unavailable.

## Player Profile

Players enter a name and school. If either field is missing, the app opens a profile modal on page load.

The profile is stored locally under `charterschoodle-player:v1`. Once saved, the same browser remembers the player for future visits.

Leaderboard identity is derived from normalized `name + school`, not a random device id. This lets a player enter the same name and school on a new device and join the same leaderboard row. Normalization lowercases text, removes accents, collapses whitespace, and strips punctuation.

## Scoring

Only daily puzzles count toward leaderboard scoring. Archive puzzles are playable but do not affect scores.

Daily result records use one of three statuses:

- `attempted`: the player made at least one guess but has not solved or lost yet
- `solved`: the player found the answer
- `lost`: the player used all guesses

Points are awarded only for solved puzzles:

- 1st guess: 6 points
- 2nd guess: 5 points
- 3rd guess: 4 points
- 4th guess: 3 points
- 5th guess: 2 points
- 6th guess: 1 point
- Loss or unfinished attempt: 0 points

The attempt streak counts consecutive daily puzzles with any result, including unfinished attempts. The win streak counts consecutive solved daily puzzles. An unfinished current-day attempt does not break the win streak until it becomes a loss.

## Supabase

Production config lives in `src/supabase-config.js`.

Current table: `public.charterschoodle_results`

Bootstrap SQL lives in `docs/supabase-leaderboard.sql`. It creates the table, enables row-level security, grants `anon` read/insert/update privileges, and installs casual internal leaderboard policies.

The publishable key in `src/supabase-config.js` is intentionally public. Do not commit a Supabase service-role key or Management API token.

## Verification

Useful smoke checks:

```sh
node --check src/app.js
curl -s -H apikey:<publishable-key> \
  https://<project-ref>.supabase.co/rest/v1/charterschoodle_results?select=id\&limit=1
```
