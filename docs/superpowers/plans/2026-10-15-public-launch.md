# CharterSchoodle Public Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved public game and protected leaderboard, with recorded evidence of code readiness and remaining production activation requirements.

**Architecture:** Preserve the static application and CSP identity. Separate guest-game improvements, authenticated leaderboard ownership, and release delivery into three sequential plans; each produces independently verifiable software. Share the interfaces below instead of restructuring unrelated game/map code.

**Tech Stack:** HTML, CSS, JavaScript modules, Node 22 or newer for development, Node's test runner, Playwright, Supabase JS 2.118.0, PostgreSQL SQL/PLpgSQL, and PGlite for disposable database tests.

**Spec:** [Approved public-release design](../specs/2026-10-15-public-launch-design.md).

## Global Constraints

- Preserve the six-clue/six-guess game, CSP green/sage/stone/white identity, Open Sans, and existing map functionality.
- Use `America/New_York`; archive dates are strictly before the current NC date.
- Profile display names contain 1–60 characters; school/organization contains 0–80 characters; public pages contain five players.
- Inputs use at least 16px text; primary controls have at least 44px touch targets; normal text contrast is at least 4.5:1.
- Verify widths 320px, 390px, 768px, and 1440px, desktop 200% zoom, and reduced motion.
- Protect raw account data using `auth.uid() = user_id`; public aggregates expose no email, tokens, private guesses, or Auth UUID.
- Keep legacy data recoverable and write-protected. New rankings use v2 account data; public-name matching never grants ownership.
- Guest play works when storage, authentication, or the leaderboard is unavailable. Unready v2 configuration never enables legacy anonymous writes.
- Preserve published puzzles through the NC date of generation. Modify future clues only; retain six clues and final first-letter hints.
- Keep the site static. Commit a pinned local official SDK bundle; developer dependencies are excluded from deployment.
- Do not send real email, mutate production data/configuration, push, or deploy during implementation. Prepare the concrete rollout first; production activation follows review.
- Execute the three plans below in order; task numbers are global. The implementer reads this document and the relevant subplan before each task.

## Review Focus

1. Storage getters can throw before a read begins; a first visitor must still play. Pin in Task 2, `storage.test.js`.
2. Authentication can switch while a queued write is awaiting a response; the next account must not inherit it. Pin in Task 9, `leaderboard.test.js`.
3. Two devices can finish the same day differently; an existing terminal result must win without losing the conflicting local evidence. Pin in Tasks 6 and 9.
4. A bot's calendar commit does not necessarily trigger push workflows; refresh must call the shared deploy path at its exact commit. Pin in Task 11, `deployment.test.js`.
5. Missing production credentials must not become a false public-ready claim; local completion and activation evidence stay separate. Pin in Task 12, `release-readiness.test.js`.

## Plan order

| Plan | Tasks | Independently testable outcome |
| --- | --- | --- |
| [1. Public guest game](2026-10-15-public-game.md) | 1–5 | Readable, accessible, resilient guest play and spoiler-free sharing, with remote writes disabled. |
| [2. Protected leaderboard](2026-10-15-protected-leaderboard.md) | 6–9 | Tested database ownership, optional email authentication, safe account synchronization, and public rankings behind an explicit activation flag. |
| [3. Puzzle and release delivery](2026-10-15-release-delivery.md) | 10–12 | Stable published puzzles, a single deployment path, packaged assets, and a precise activation runbook. |

## Shared file and interface map

Use plain JavaScript with JSDoc for the following contracts; no TypeScript conversion is required.

| File | Responsibility and exported contract |
| --- | --- |
| `src/game.js` | Pure `ncToday(now = new Date()): string`, `archiveDates(puzzles, today): string[]`, `validateProgress(value, {schoolIds, answerId}): Progress|null`, `scoreSummary(results, today): Summary`, `formatShareResult({date, mode, progress, publicUrl}): string`. |
| `src/storage.js` | `createSafeStorage(getStorage): SafeStorage`; `createGameStore({kv, subject, schools, puzzles}): GameStore`; `loadLegacyProfile(kv): {displayName, school}`. |
| `src/dialog.js` | `openDialog(dialog, opener = document.activeElement): void`, `closeDialog(dialog): void`; native dialog behavior with focus restoration. |
| `src/auth.js` | `createAuthController({config, storage, loadClient, now = Date.now}): AuthController`. |
| `src/leaderboard.js` | `createLeaderboardController({getClient, storeFor, getPuzzle, schoolIds, now}): LeaderboardController`. |
| `src/app.js` | Existing entry point, event wiring, current subject/store, rendering, stable feedback and map logic. Remove replaced legacy identity and remote-write paths. |
| `src/vendor/supabase.js` | Exact official UMD distribution copied from locked `@supabase/supabase-js@2.118.0`, with adjacent license and provenance manifest. |
| `docs/supabase-leaderboard-v2.sql` | Transactional, rerunnable v2 schema, constraints, policies, aggregates, and legacy lockdown. |
| `scripts/clue-selection.mjs` | Pure future-clue selection and `mergePublishedCalendar(existing, generated, today)`. |
| `scripts/stage-site.mjs` | Explicit deploy-asset allowlist to `_site`; refuse missing required files. |

**Puzzle:** the existing `{date, answerSchoolId, clues}` object. `schools` and `puzzles` in store construction are the validated source arrays. `storeFor(subject): GameStore` in the app closes over those arrays and the shared safe-storage adapter.

**Progress:** `{guesses: Array<{schoolId: string, correct: boolean}>, revealedClues: number, solved: boolean, lost: boolean}`. Derive feedback from current school data. Reject unknown/duplicate school IDs, more than six guesses, and guesses after a correct answer. Recompute completion from IDs; do not trust saved flags.

**ScoreEntry:** `{date, answerSchoolId, status, guesses, points, completedAt?, guessedSchoolIds?}`. `status` is `attempted|solved|lost`; `guesses` is a number and `points` is derived. Historical guest entries may lack guessed-school IDs and are never remotely imported. **DailyResult:** `{date, answerSchoolId, guessedSchoolIds, status}`; remote writes require the ordered IDs.

**Summary:** `{points, played, solved, winStreak, attemptStreak, bestWinStreak, bestAttemptStreak, average}`; average is `null` without solved games. An unfinished current day does not break the win streak; an unfinished prior day or missed date does.

**SafeStorage:** synchronous `getItem(key): string|null`, `setItem(key, value): void`, `removeItem(key): void`, and a read-only `persistent: boolean`. Catch errors obtaining storage as well as calling it. Once persistence fails, memory holds the latest values, including removals, so stale disk values cannot reappear.

**GameStore:** read-only `subject`, `readProgress(date): Progress|null`, `writeProgress(date, progress)`, `readResults(): ScoreEntry[]`, `writeResult(entry)`, `readPending(): DailyResult[]`, `queueResult(result)`, `acknowledgeResult(date)`, `hasGuestImport(date): boolean`, `markGuestImport(date)`. Prefix keys with `charterschoodle:v2:<guest-or-uuid>:`. Lazy v1 import is guest-only and retains original keys. Pending writes are accepted only by account stores and are bound to that store's subject.

**AuthController:** `ready: Promise<void>`, read-only `state`, `subscribe(listener): unsubscribe`, `sendLink(email): Promise<void>`, `signOut(): Promise<void>`, `getClient(): SupabaseClient|null`. State has `phase: unavailable|guest|sending|sent|signed-in|error`, `userId: string|null`, `message: string`, and `resendAt: number`. Do not expose session tokens in state. Auth storage uses `charterschoodle-auth:v2`; PKCE, URL cleanup, timeout, and SDK-managed refresh are required.

**LeaderboardController:** `setSubject(subject): void`, `cancel(): void`, `readProfile(): Promise<Profile|null>`, `saveProfile({displayName, school, listed}): Promise<Profile>`, `readOwnerResults(): Promise<ScoreEntry[]>`, `loadOwnerProgress(date): Promise<Progress|null>`, `refresh({sort, page}): Promise<Page>`, `queueDailyResult({date, progress, answerSchoolId, mode}): void`, `flush(): Promise<void>`, `adoptTodayGuest({confirmed, guestStore, date}): Promise<boolean>`. A subject is `guest` or the verified Auth UUID. Epoch-check every response after changing subjects; bind dispatches to the original UUID. Maintain separate subject and public-page request epochs; reject stale returned data with `AbortError`, which the UI ignores. Only joined accounts queue scores; unlisted existing accounts can save private results. Page through all owner result records for cross-device personal summaries, not just the active date or the first response page.

**Profile:** `{publicId, displayName, school, listed}`. **Page:** `{rows, total, page, pageSize}`; each row is `{publicId, displayName, school, rank, points, played, solved, winStreak, attemptStreak, average}`. Include listed profiles with at least one result. Server RPC parameters are `p_sort` (`points|winStreak|attemptStreak`), `p_page` (one-based), and `p_page_size` (default 5, maximum 50). No caller-supplied sort SQL.

## Tooling and test conventions

- The workspace currently has Node 20.20.0 and no installed PostgreSQL/Docker tooling. Use Node >=22 for the supported SDK; add `.nvmrc` and `package.json` engines. Obtain a temporary official Node runtime if a manager is unavailable; do not replace the user's system runtime.
- Add `type: module`, a lockfile, exact SDK 2.118.0, and exact resolved development versions of Playwright and PGlite. Resolve dev versions once, verify Node compatibility, and commit exact versions plus the lockfile. No floating runtime CDN import.
- Scripts: `test:unit` → `node --test tests/unit/*.test.js`; `test:db` → `node --test tests/database/*.test.js`; `test:browser` → `playwright test`; `vendor:sync`/`vendor:check` → the SDK copying/check script; `stage` → site staging; `check:release` → release evidence validation; `test` → unit then database tests. Add scripts with the task that implements them.
- Playwright serves the project locally, uses deterministic clocks, and blocks every production Supabase URL. Support `CHARTERSCHOODLE_CHROMIUM_PATH` for an existing Chromium binary, otherwise use Playwright's installed browser. Test email requests only against intercepted fixtures.
- PGlite fixtures execute the actual migration and create non-superuser `anon`/`authenticated` roles, an `auth.users` fixture table, and `auth.uid()` based on a per-test claim setting. Prove role enforcement before relying on it. Never emulate authorization with JavaScript filtering; retain a separate live/staging activation check.
- Create a failing behavioral test, run it and inspect the expected failure, implement the task, run its relevant checks, then commit only its files. Do not rerun full visual inspection after each task.

## Handoff

The approved spec is complete; these implementation plans require owner review and an execution-method selection before implementation. No method has yet been selected. Recommend subagent-driven execution because database ownership and account-switch synchronization benefit from independent task reviews; native execution remains available for lower coordination cost. Execute plans sequentially in one isolated implementation workspace, preserving the user's untracked original assets and domain log.
