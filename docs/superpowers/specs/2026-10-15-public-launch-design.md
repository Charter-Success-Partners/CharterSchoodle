# CharterSchoodle public-release design

Date: October 15, 2026. Status: written for owner review; implementation has not started.

## Approved brief

Prepare the existing daily North Carolina charter-school guessing game for the wider NC charter-school community. Preserve its CSP identity, six-clue/six-guess game, school map, archive, daily scoring, and shared leaderboard. Let people play immediately as guests. Make leaderboard participation optional and protect player ownership through email sign-in and database authorization.

The owner approved this direction in conversation. This document makes the behavior and technical boundaries concrete for the next review. Baseline evidence is in [the launch audit](../../launch-readiness-audit.md).

Success means a first-time visitor can understand and play on a phone, return to saved progress, share a spoiler-free result, and deliberately join a leaderboard where another player cannot claim or overwrite their entries by matching their public name and school.

## Chosen approach and limits

Keep GitHub Pages and the static HTML/CSS/JavaScript application. Extend the existing Supabase project with passwordless authentication and owner-scoped data. Use the official Supabase JavaScript client as a version-pinned, locally served browser bundle; the shipped site remains static and requires no application server. Development tooling may prepare that bundle and run tests.

Browser-only anonymous accounts were considered: they reduce sign-in steps but do not reliably recover identity across devices. Password-based accounts add password management without improving the intended game flow. Email links provide the recovery the existing name-and-school scheme attempted to provide, while verifying control of an account.

This is a casual leaderboard. Protecting account ownership does not prove that a player's own guesses are honest: puzzle answers are present in the static calendar. Prize-grade anti-cheat, a server-hosted puzzle engine, social sign-in, a visual rebrand, and expanded school research are outside this release.

## Player experience

### First visit and guest play

Open the current North Carolina daily puzzle directly, without a profile modal. Show the date, guesses used, first clue, school input, and a short explanation of how wrong guesses reveal more clues. Keep Daily Puzzle, Past Puzzles, Leaderboard, Map, and How to play available.

Replace the always-visible name-and-school form in the game header with a compact score summary and a Join leaderboard action. The leaderboard itself is publicly readable without signing in. Explain that guest progress stays on the current browser and that public participation is optional.

Game-data loading has a readable loading state, timeout, and Retry action. A leaderboard or authentication failure does not prevent guest play. When persistent storage is unavailable, continue in memory and state that progress will last for the current session.

### Joining and returning

Join leaderboard opens a dismissible account dialog. Ask for email and send a sign-in link only after the player submits the form. Provide sending, check-your-email, resend cooldown, expired-link, and retry states. Keep the game available when the dialog is closed.

Use SDK-managed PKCE authentication with a callback to the site's existing index route. The redirect URL comes from trusted application configuration and the Supabase allowlist. Successful or failed callback handling removes authentication parameters from the visible URL. A link opened without its initiating browser session offers a new sign-in request in that browser. The same account can sign in independently on another device. If durable authentication storage is unavailable, explain that browser storage is required for email-link sign-in and retain guest play instead of sending a link whose verification state cannot survive navigation.

After authentication, a new participant chooses a display name and an optional school or organization, then explicitly selects Join leaderboard. Explain that those fields and game statistics are public and email is private. Pre-fill locally saved legacy profile fields as editable suggestions; they confer no ownership of historical records.

Offer to include today's guest game when joining, with an explicit choice. Older guest history remains local. Returning players restore their own profile and game state. Profile controls allow editing public fields, hiding the leaderboard entry, and signing out. Signing out does not automatically hide an already published entry; the hide control explains this distinction.

### Completion and sharing

Use a consistent result presentation for wins and six-guess losses. Show the answer, result, guesses used, and daily points where applicable. Offer Share result, Copy result, and an archive action. Keep a result action available after closing the dialog or returning to a completed puzzle.

Share only the game name, puzzle date, daily/archive label, a compact success/failure grid, guess count or X/6, and the configured public URL. Exclude answers, clues, guesses, names, emails, and authentication parameters. Prefer the platform share API when available, then clipboard, then selectable text. Announce success or provide a clear copy alternative on failure.

## Frontend responsibilities

Keep the existing app as the entry point, extracting only responsibilities that change or need independent verification.

| Boundary | Responsibility |
| --- | --- |
| `src/app.js` | Coordinate game state, modes, events, rendering, and the active guest/account subject. |
| Game/date/scoring helpers | NC dates and archive eligibility, progress validation, streak rules, and share text. Preserve stable feedback logic unless changes are needed for the new round rendering. |
| Storage adapter | Safe JSON reads/writes, schema validation, account namespaces, legacy reads, and in-memory fallback. |
| Authentication adapter | SDK setup, session restoration, email-link submission, callback handling, refresh, and sign-out. Expose account state without exposing tokens to UI rendering. |
| Leaderboard adapter | Owner-scoped result synchronization, public aggregate pages, retry/conflict handling, and ignoring responses for stale accounts or sort selections. |
| Dialog/autocomplete UI helpers | Focus and dismissal behavior, accessible suggestions, and announcements. |

Keep pure helpers independent of DOM and network access. The game must initialize even when the authentication SDK or remote configuration cannot load. Use a separate explicit readiness flag for the new leaderboard; an unconfigured backend shows a clear unavailable state and never falls back to anonymous legacy writes.

## Authenticated data and authorization

Add versioned tables alongside the existing `public.charterschoodle_results` table.

| Object | Required data and behavior |
| --- | --- |
| `charterschoodle_profiles_v2` | `user_id` linked to Supabase Auth, independent public profile UUID, display name (1–60 characters), school/organization (0–80 characters), public-listing consent, and server-managed timestamps. |
| `charterschoodle_results_v2` | Owner UUID, puzzle date, answer-school ID, ordered guessed-school IDs, attempted/solved/lost status, and server timestamps. One record per owner and date; 1–6 distinct nonempty school IDs. Guess count derives from the array and points derive from status/count. |
| Leaderboard settings | One server-owned cutover date, set to the NC calendar date when the migration is applied. Clients cannot modify it. |
| `charterschoodle_leaderboard_page_v2` RPC | Public aggregate statistics for listed profiles, validated sort, pagination, total count, and stable ranks. Exposes no email, tokens, private guess history, or Auth user UUIDs. |

Require `auth.uid() = user_id` for owner reads and writes on profiles and results. Anonymous callers cannot write or read raw v2 tables. A signed-in account cannot read, insert, update, delete, or transfer another account's rows. Public leaderboard access goes through a narrowly scoped read-only function with a fixed search path, explicit role grants, and an allowlist of sort values. Do not expose Auth tables or user metadata through it.

Restrict result dates to the server's cutover date through the current NC date. Validate attempted results as fewer than six guesses, lost results as six guesses, and solved results as one through six. Derived points are 7 minus guess count for solved results and zero otherwise. These constraints enforce consistency, not truthfulness of self-reported play.

For an existing result, updates must retain the previous guess prefix and advance attempted play. A terminal solved/lost result is immutable except for identical idempotent retries. A conflicting game from another device returns a conflict; reload the owner's remote state and explain that a result already exists rather than silently replacing it. Keep the local conflicting record private for the current session.

Raw guessed-school IDs are owner-readable so a returning player can restore an in-progress or completed board on another device. Public pages contain only display fields, aggregate statistics, and an independent public profile identifier.

Aggregate the full result set in the database, replacing the existing first-5,000-record client calculation. Retain points, solved/played, current win streak, current attempt streak, and average guesses for solved games. Current streaks must be anchored to today/yesterday: an unfinished current day is neutral for the win streak; an unfinished past day or a missed date breaks it. Sort by the selected metric, then points, solved count, average guesses, display name, and public profile UUID. Preserve five rows per UI page.

## Local state, synchronization, and historical scores

Version new local storage and partition progress, scorebooks, and pending writes by `guest` or verified account UUID. Read existing v1 progress and scorebook data into the guest namespace after validation. Retain original v1 values so migration is nondestructive. Changing a display name or school never changes the account UUID.

Each pending write records its account owner when created. Dispatch only under that same authenticated subject. On sign-out or account switch, cancel or ignore the old account's in-flight responses, load the new subject's storage, and keep pending records in their original namespace. Sign-out always clears the active local session and switches the UI to guest mode even if remote session revocation fails. Never relabel a generic device scorebook with the most recently entered profile. Validate remote progress against the school list and progress schema before restoring it; a malformed record must not crash the game.

Guest-to-account import applies only to today's explicitly selected guest game, once per account/date, and respects existing remote results. Historical local results and legacy remote scores are not imported automatically. Failed synchronization retains the owner's local result and offers retry; conflicts follow the immutable-result rule above.

Before production cutover, inspect the live schema and policies and take a recoverable backup. Preserve the original legacy score table and all rows as an administrator-readable archive. Revoke anonymous and authenticated writes and public reads to that table and remove permissive policies. New public rankings begin from authenticated v2 results. Do not claim or merge legacy identities through public name-and-school matching; any later historical transfer requires a separate ownership-verification process.

Rollback keeps the legacy archive and v2 data intact. The fallback frontend is guest play with the leaderboard disabled. Do not restore unrestricted legacy writes as a rollback mechanism.

## Daily puzzles, archive, and clue stability

Use `America/New_York` to determine the daily date independently of the visitor's timezone, including daylight-saving transitions. Archive dates are available generated dates strictly before that date; choose the latest eligible date initially. Validate mode and date in application logic, not only date-input bounds. If no prior puzzle exists, show an empty state. Missing today's puzzle offers retry and archive access without substituting a future puzzle.

When an open tab crosses NC midnight, preserve the displayed puzzle and its original date. Explain that a new daily puzzle is available and offer an explicit switch. Archive results never enter the daily sync queue. Prevent an old in-progress game from being silently reattributed to the new date.

Review clue selection for repeated name-token hints, duplicate information, and reveal ordering. Prefer an alternative sourced clue over a second hint that reveals the same name token, and order the five curated clues by nonincreasing difficulty. If a school's existing source pool cannot supply five nonredundant clues, retain six total clues and emit a quality diagnostic for that school rather than inventing facts or silently dropping it from the statewide rotation. Sample the next 30 days. Preserve dates, answers, and clues of puzzles already published through the NC date of the generation run; do not rewrite a live or historical puzzle during release work. Future output must keep valid school IDs, deterministic scheduling, and the final first-letter hint.

## Visual and accessibility design

This is a refinement of the existing CSP visual system. Preserve the green, sage, stone, and white palette and game identity. Use darker semantic variants where contrast requires it. Retain Open Sans and the established display treatment. Serve the supplied 2026 CSP logo locally with reserved dimensions; preserve the original supplied asset.

Use one semantic ordered list of six rounds. On desktop, use a grid with aligned clue, guess, and feedback fields. On phones, stack each round's clue above its guess and labeled feedback, avoiding duplicated desktop/mobile content. Keep unrevealed rounds compact. Clue text must remain readable at 320px and controls must not force horizontal page scrolling.

Use at least 16px input text, comfortable body leading, and adequately sized functional labels. Give navigation, submit, dialog, help, and map zoom controls at least 44px touch targets. Preserve the map's existing zoom/pan interaction and keyboard-accessible named school pins.

Use a consistent native-dialog-based pattern with a visible close/cancel action, Escape support, focus containment, focus restoration, and scrolling on short screens. How to play must work by click, touch, and keyboard. Autocomplete exposes combobox/listbox semantics, expansion, selected option, active descendant, and Arrow/Enter/Escape behavior, with mouse/touch selection and a useful no-results message. Dynamic errors and game status are announced. Do not depend on color or hover alone to communicate feedback.

Respect reduced-motion preferences by replacing confetti/shake with a static result emphasis. Maintain visible keyboard focus and normal-text contrast of at least 4.5:1. Verify 320px, 390px, 768px, and 1440px layouts plus desktop 200% zoom.

## Sharing assets and delivery

Add truthful canonical, Open Graph, and social-card metadata with a local preview asset based on the existing brand and game name. Derive sharing links from trusted configured public URL, never the current URL containing an authentication callback. The domain log identifies `charterschoodle.chartersuccesspartners.com` as the intended domain; verify Pages/DNS/TLS and the actual canonical URL before activation. A failed attempt to access that URL through the research tool is inconclusive and is not evidence of a domain outage.

Retain one Pages deployment workflow with explicit static-asset staging, appropriate validation, and one deployment concurrency group. Include local brand, sharing, and vendor assets; exclude repository documents and research source artifacts from the deployed bundle. Make the daily refresh workflow explicitly call the same reusable Pages pipeline after a successful data update, checking out the refreshed revision. Do not rely on a push made with `GITHUB_TOKEN` to trigger another workflow.

Keep protected leaderboard activation disabled until v2 migration, authorization checks, configured email delivery, allowed callback URLs, and authentication smoke checks are complete. Prepare an executable migration and a precise setup/rollback runbook. The work produces a reviewable release; public deployment and production configuration changes follow the completed rollout review.

## Verification and acceptance

Behavioral tests must cover NC dates around midnight and daylight-saving boundaries, valid archive selection and future-date rejection, missing-puzzle states, corrupted/blocked/quota-limited storage, v1 guest migration, guest/account separation, account switching during sync, idempotent retries, and conflict handling. Exercise win/loss and persisted-progress restoration. Verify legacy data is preserved and not claimed by public profile matches.

Use disposable local database/Supabase fixtures to test actual row-level policies under anonymous, owner-A, and owner-B roles. Check cross-account reads/writes/deletes, owner transfer attempts, constraint failures, immutable terminal results, hidden profiles, aggregate accuracy, pagination, and a dataset exceeding 5,000 raw results. Static SQL inspection alone does not establish authorization correctness.

Browser verification covers first-visit guest play, accessible autocomplete, both completion results, result sharing fallbacks, joining and signing out, returning to a completed game, map/archive navigation, focus and dismissal, failed game-data and leaderboard requests, and account/session failure states. Never post test scores into the production leaderboard. Real email-delivery smoke testing uses an explicitly designated test recipient.

Follow Impeccable's bounded finish: implement fully, inspect desktop and phone states together, fix the findings in one batch, confirm once at most, and stop polishing. Run its detector on changed markup and verify findings in context, retaining justified incumbent-brand exceptions. Run appropriate automated checks and inspect their output before claiming completion.

Public-ready acceptance requires all of the following:

- A first visitor can play immediately on a phone without overflow or a mandatory profile.
- Winning, losing, returning, date rollover, and archive play behave consistently.
- Storage and remote-service failures have usable fallback or recovery states.
- A signed-in player can recover their own game across devices; another account cannot access or modify raw results.
- Public views and shared text reveal only the intended public fields.
- Legacy scores remain recoverable and write-protected.
- Authorization and browser checks pass with recorded evidence.
- One deployment path serves the intended assets, and scheduled refresh reaches that path.
- The production domain, authentication redirect, and external-recipient email delivery have been verified before public activation.

Code completion and public readiness are separate recorded statuses until the production-only acceptance checks are satisfied. An unavailable live database connection or email provider does not prevent implementation and local verification, but it remains an explicit release blocker rather than being presented as a completed launch.

## Official references

- [Supabase passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase production SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp)
- [GitHub workflow triggers and GITHUB_TOKEN behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
