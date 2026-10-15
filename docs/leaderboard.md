# Leaderboard

Guest play needs no profile or email. Guest progress stays in the browser; if browser storage is blocked, play continues for the current tab. Past Puzzles never contribute to daily rankings.

## Optional accounts

Choose **Join leaderboard** to request an email sign-in link. Open the link in the requesting browser. The local, pinned Supabase SDK handles PKCE, session refresh, and bearer tokens. Account identity is accepted only after Auth verifies the user; display names never establish ownership.

After signing in, create a profile with a display name of 1–60 characters and an optional school or organization of up to 80 characters. Public participation is unchecked by default. Saving an unlisted profile keeps daily scores private. **Edit profile** can change the name or school and hide the public entry without changing the account identity. Escape or the close button returns focus to the game’s account control.

**Include today’s guest result from this browser** is optional and unchecked. Only a current North Carolina day result with actual ordered guesses can be imported, once per account/date. An existing remote result takes priority. Older guest history and numeric-only legacy scores are never imported. Signing in by itself imports nothing. Two players can safely use the same display name.

## Scores and synchronization

Daily solved games earn 6 points for one guess, decreasing to 1 point for six guesses. A loss or unfinished attempt earns 0 points. Win streaks count consecutive solved days; attempt streaks count consecutive days with any guess. An unfinished current day does not break the win streak; unfinished prior days and missed days do.

Joined accounts queue daily results in their own local storage namespace. Sign-out immediately returns to guest identity, even if the remote sign-out fails. Queued account A results can never dispatch with account B’s `user_id`. Failed requests retain the original account’s pending results; **Retry account sync** retries loading and saving. Successful writes acknowledge only the version sent, preserving newer guesses made during the request.

Returning on another device reads all owner-scoped result pages, including unlisted history, to restore lifetime personal totals and valid daily progress. A newer local pending extension is retained when the remote attempt is older. Conflicting or terminal remote results restore the saved game; conflicting local guesses remain in the owner’s pending store as evidence and are not retried during that session. Unknown or malformed guesses cannot break the game. Keep the same browser’s local data when investigating a conflict.

The public leaderboard reads only `charterschoodle_leaderboard_page_v2`, five players at a time. After sign-out, a separate anonymous SDK client keeps public rankings available; it has its own storage key and disables session persistence, refresh, and URL detection. Owner operations cannot use that client. Public results expose display names, optional schools, public profile IDs, and aggregate scores—not email, Auth UUIDs, tokens, or private guesses. A public leaderboard outage does not remove personal totals or prevent play. Sorting and pagination discard outdated responses.

## Configuration and release

`src/supabase-config.js` keeps `leaderboardEnabled: false` until the reviewed rollout. The publishable key is intentionally public; never commit service-role keys or management tokens. Disabled or incomplete configuration cannot fall back to legacy writes.

`docs/supabase-leaderboard-v2.sql` defines the v2 profiles/results, owner RLS (`auth.uid() = user_id`), immutable public identity, result constraints, public aggregate RPC, and legacy write lockdown. The old `docs/supabase-leaderboard.sql` is historical; do not use it to activate v2. Existing legacy data remains recoverable and no names are claimed or migrated automatically.

Local checks: `npm test`, `npm run test:browser`, and `npm run vendor:check`. Browser fixtures intercept exact Auth/v2/RPC endpoints and reject unexpected production requests; tests never send real email or change production data. Production backup, migration, Auth redirect configuration, and staging smoke checks belong to the reviewed release process, not these local tests.

## Activation evidence

Use the [public launch runbook](public-launch-runbook.md) for the exact backup/migration,
real A/B ownership checks, SMTP/canonical callback setup, designated-recipient email test,
single deployment and deployed smoke sequence. The [readiness report](release-readiness.json)
records each observation; [dated evidence](launch-evidence/2026-10-15/README.md) separates local fixtures
from live checks. `npm run check:release -- --code` checks local completion; the default
`npm run check:release` remains blocked until all production observations pass and the actual
frontend flag is true. The checker reads the public config without executing it or printing keys.

Rollback means deploying this protected frontend with the flag false, preserving both v2 and
legacy data and legacy write restrictions. Never restore anonymous legacy writes to recover accounts.
