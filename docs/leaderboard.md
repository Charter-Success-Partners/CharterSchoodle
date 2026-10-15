# Leaderboard

Guest play needs no profile or email. Guest progress stays in the browser; if browser storage is blocked, play continues for the current tab. Past Puzzles never contribute to daily rankings.

## Optional accounts

Choose **Join leaderboard** and enter a display name of 1–60 characters, an optional school or organization of up to 80 characters, and an email address in one form. The notice explains that joining makes the name, optional affiliation, and daily aggregate scores public; email and individual guesses stay private. Joining includes today's eligible guest game from that browser. An existing account game takes priority; older guest games, numeric-only legacy scores, and archives are not imported.

Open the confirmation link in the requesting browser. Your form details are retained for 24 hours. The pinned Supabase SDK completes PKCE and verifies the recipient; the prepared profile and eligible game are saved automatically. No second profile form is required. A signed-in player whose email is already verified can join directly. Interrupted setup retains the details for **Retry account sync** without another email; check-email controls allow resending or correcting details. Modern Chromium verifies cross-tab completion with Web Locks; cross-tab behavior in the non-Web-Locks fallback remains unverified.

Returning players choose **Already joined? Sign in** and enter only their email. Sign-in preserves existing profile fields and privacy and does not import a guest game. Display names never establish ownership, and two players can use the same name.

**Edit profile** changes the public name or affiliation and can hide the entry while retaining private scores and account identity. Its separate **Include today's guest result from this browser** checkbox is optional and unchecked for later imports; the same existing-game and date protections apply. Escape or the close button returns focus to the account control.

A new public profile appears in rankings after its first daily attempt, rather than as a zero-game row. Rankings show five entries per page with the selected metric; native Score details disclosures expose the remaining allowed statistics. Personal totals are in Your daily stats.

## Scores and synchronization

Daily solved games earn 6 points for one guess, decreasing to 1 point for six guesses. A loss or unfinished attempt earns 0 points. Win streaks count consecutive solved days; attempt streaks count consecutive days with any guess. An unfinished current day does not break the win streak; unfinished prior days and missed days do.

Joined accounts queue daily results in their own local storage namespace. Sign-out immediately returns to guest identity, even if the remote sign-out fails. Queued account A results can never dispatch with account B’s `user_id`. Failed requests retain the original account’s pending results; **Retry account sync** retries loading and saving. Successful writes acknowledge only the version sent, preserving newer guesses made during the request.

Returning on another device reads all owner-scoped result pages, including unlisted history, to restore lifetime personal totals and valid daily progress. A newer local pending extension is retained when the remote attempt is older. Conflicting or terminal remote results restore the saved game; conflicting local guesses remain in the owner’s pending store as evidence and are not retried during that session. Unknown or malformed guesses cannot break the game. Keep the same browser’s local data when investigating a conflict.

The public leaderboard reads only `charterschoodle_leaderboard_page_v2`, five players at a time. After sign-out, a separate anonymous SDK client keeps public rankings available; it has its own storage key and disables session persistence, refresh, and URL detection. Owner operations cannot use that client. Public results expose display names, optional schools, public profile IDs, and aggregate scores—not email, Auth UUIDs, tokens, or private guesses. A public leaderboard outage does not remove personal totals or prevent play. Sorting and pagination discard outdated responses.

## Configuration and release

`src/supabase-config.js` currently has `leaderboardEnabled: true` after the approved original rollout. The UI redesign uses that existing protected backend and awaits separate publication approval. The publishable key is intentionally public; never commit service-role keys or management tokens. Disabled or incomplete configuration cannot fall back to legacy writes.

`docs/supabase-leaderboard-v2.sql` defines the v2 profiles/results, owner RLS (`auth.uid() = user_id`), immutable public identity, result constraints, public aggregate RPC, and legacy write lockdown. The old `docs/supabase-leaderboard.sql` is historical; do not use it to activate v2. Existing legacy data remains recoverable and no names are claimed or migrated automatically.

Local checks: `npm test`, `npm run test:browser`, and `npm run vendor:check`. Browser fixtures intercept exact Auth/v2/RPC endpoints and reject unexpected production requests; tests never send real email or change production data. Production backup, migration, Auth redirect configuration, and staging smoke checks belong to the reviewed release process, not these local tests.

## Activation evidence

Use the [public launch runbook](public-launch-runbook.md) for the exact backup/migration,
real A/B ownership checks, SMTP/canonical callback setup, designated-recipient email test,
single deployment and deployed smoke sequence. The [readiness report](release-readiness.json)
records each observation; [original launch evidence](launch-evidence/2026-10-15/README.md) and [redesign evidence](redesign-evidence/2026-10-15/README.md) separate live checks from the new local candidate. `npm run check:release -- --code` checks local completion; the default
`npm run check:release` remains blocked until all production observations pass and the actual
frontend flag is true. The checker reads the public config without executing it or printing keys.

Rollback means deploying this protected frontend with the flag false, preserving both v2 and
legacy data and legacy write restrictions. Never restore anonymous legacy writes to recover accounts.
