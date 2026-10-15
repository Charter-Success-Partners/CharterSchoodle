# Protected Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public-name identity with optional email-authenticated ownership and safe public rankings.

**Architecture:** Version the Supabase tables alongside the legacy archive, enforce ownership and immutable completions in PostgreSQL, and publish only aggregate pages. Wrap the official SDK and isolate queued writes by verified account. Keep activation off until the production checks pass.

**Tech Stack:** Supabase JS 2.118.0, PostgreSQL SQL/PLpgSQL, PGlite, Node >=22, Playwright.

**Spec:** [Approved design](../specs/2026-10-15-public-launch-design.md).

## Global Constraints

Read the [parent contracts](2026-10-15-public-launch.md) and complete Tasks 1–5 first. Enforce `auth.uid() = user_id`. Display names are 1–60 characters, schools 0–80, and public UI pages contain five rows. Preserve legacy records, exclude private fields from public responses, and keep production untouched during implementation.

## Review Focus

- Policy tests run as actual non-superuser roles; Task 6 proves the harness cannot bypass row authorization.
- An expired/reused link or a link opened in another browser must leave guest play available; Task 8 tests these responses and recovery.
- A failed network sign-out must still clear local identity and invalidate stale callbacks; Tasks 8–9 test this.
- Conflicting results from two devices must preserve the first terminal result; Tasks 6 and 9 test the database rule and UI recovery.
- More than 5,000 raw results, ties, hidden profiles, and empty/out-of-range pages must produce correct public ranks without private fields; Task 7 tests all five.

### Task 6: Enforce owned records and preserve legacy data

**Files:** Create `docs/supabase-leaderboard-v2.sql`, `tests/database/helpers.js`, `tests/database/ownership.test.js`; retire unsafe setup in `docs/supabase-leaderboard.sql`; update package/lock files with an exact resolved PGlite dev version and `test:db`.

**Interfaces:** Produces tables `charterschoodle_profiles_v2`, `charterschoodle_results_v2`, and `charterschoodle_settings_v2`. Define columns using snake_case: profiles `user_id`, immutable `public_id`, `display_name`, `school`, `listed`, `created_at`, `updated_at`; results `user_id`, `puzzle_date`, `answer_school_id`, `guessed_school_ids`, `status`, generated `guesses`, generated `points`, and server timestamps. Settings has a singleton key and `cutover_date` initialized once to the migration's NC date. `user_id` references `auth.users`; result owners must have a profile.

The test helper exports `makeDatabase(): Promise<{db, userA, userB}>` and `asRole(db, {role, userId}, sql, params=[]): Promise<QueryResult>`. It creates Supabase-compatible fixture roles/auth schema, runs the real migration, executes each role query in a transaction with a local claim, and restores context even on error. Use a separate database per test or serialize access; role contexts must not interleave.

- [ ] **Step 1:** Write `harness_enforces_non_superuser_roles`, `anonymous_cannot_read_or_write_raw_tables`, `owner_cannot_read_or_mutate_other_owner`, `cannot_transfer_ownership`, `public_name_match_does_not_merge_accounts`, `legacy_rows_survive_and_become_private`, `migration_rerun_keeps_cutover_and_rows`, `terminal_results_are_immutable`, and `attempts_must_extend_the_existing_prefix`. Include these outcomes:

```js
assert.equal(ownerBReadOfA.rows.length, 0);
assert.equal(adminReadOfA.rows[0].user_id, userA);
assert.equal(legacyCountAfter, legacyCountBefore);
assert.equal(cutoverAfterRerun, cutoverBefore);
assert.deepEqual(terminalResultAfterConflict, terminalResultBefore);
```

Also reject blank/overlong profile fields (including a whitespace-only name), null/empty/duplicate/over-six guess arrays and null array elements, invalid status/count combinations, dates before cutover or after NC today, client-supplied generated points, and client attempts to mutate cutover settings. Test that supplying an Auth UUID as `public_id` cannot control the public identifier. Test anonymous and authenticated legacy access after applying a fixture with custom-named permissive legacy policies. A same-terminal-result retry must succeed without changing its completion timestamp.

- [ ] **Step 2:** Run `npm run test:db`; first prove the fixture role cannot bypass a deliberately denying RLS table, then confirm missing v2 schema causes the intended failures. Do not substitute JavaScript ownership filtering if the SQL harness fails.
- [ ] **Step 3:** Implement the transactionally rerunnable migration. Enable RLS, grant only required owner SELECT/INSERT/UPDATE operations, and use both USING and WITH CHECK ownership policies. Default public listing to false and deny deletes to client roles. Use database triggers for date/cutover validation, server-assigned public UUIDs on insert, immutable public/owner IDs on update, append-only attempted guesses, unchanged terminal outcomes, and server-managed timestamps even if a caller supplies timestamps. Enforce ID lengths of 1–120 characters and array cardinality 1–6; derive points as `7-cardinality(guessed_school_ids)` for solved rows. Preserve identical terminal retries. Lock down the exact legacy table if it exists: remove all its policies, revoke PUBLIC/anon/authenticated access, and retain every row for administrators. Retire the old bootstrap script so rerunning it cannot restore permissive grants.
- [ ] **Step 4:** Run all database and unit tests; require zero failures, preserved legacy rows, and unchanged cutover on migration rerun. Do not run either migration against production.
- [ ] **Step 5:** Commit as `feat: enforce authenticated ownership of leaderboard records`.

### Task 7: Produce complete, private aggregate leaderboard pages

**Files:** Extend `docs/supabase-leaderboard-v2.sql`; create `tests/database/leaderboard.test.js`.

**Interfaces:** Produces `charterschoodle_leaderboard_page_v2(p_sort text='points', p_page integer=1, p_page_size integer=5) RETURNS jsonb`, with the `Page` and row contract from the parent. Validate sort against `points|winStreak|attemptStreak`, require positive page/size, and cap size at 50. Out-of-range pages return no rows and the correct total. Rank is a stable ordinal across the entire sorted set.

- [ ] **Step 1:** Seed accounts relative to the database NC date and test `aggregates_more_than_5000_results`, `all_sort_modes_have_stable_ties`, `current_streaks_stop_after_missed_days`, `today_attempt_is_neutral_for_win_streak`, `past_attempt_breaks_win_streak`, `hidden_profiles_are_absent`, `empty_and_out_of_range_pages_are_valid`, and `rpc_contains_only_public_fields`. Set an earlier cutover only through the administrator fixture for historical samples. Assert a large fixture's final participant and all results contribute to totals, not just the first 5,000 rows.

```js
assert.equal(page.pageSize, 5);
assert.equal(page.rows[0].rank, (page.page - 1) * 5 + 1);
assert.deepEqual(Object.keys(page.rows[0]).sort(), publicRowKeys.sort());
assert.equal(JSON.stringify(page).includes(privateEmail), false);
assert.equal(JSON.stringify(page).includes(authUserId), false);
```

- [ ] **Step 2:** Run the aggregate test file; confirm the RPC is missing before implementing it.
- [ ] **Step 3:** Implement the read-only SECURITY DEFINER function with a fixed empty search path and fully qualified object references. Explicitly grant execution to anon/authenticated and revoke default PUBLIC execution. Aggregate all eligible result rows for listed profiles, with the parent contract's tie-breakers and NC-anchored streak rules. Average uses solved games only. Do not grant public raw-table access to make the function work.
- [ ] **Step 4:** Run all database and unit tests. Compare server summaries to the pure helper on common fixture results, while keeping independent hand-calculated expected totals/streaks. Require zero failures and rerunnable migration behavior.
- [ ] **Step 5:** Commit as `feat: serve private and complete leaderboard rankings`.

### Task 8: Add an optional, locally served email authentication client

**Files:** Create `src/auth.js`, `scripts/vendor-supabase.mjs`, `src/vendor/supabase.js`, `src/vendor/LICENSE.supabase`, `src/vendor/supabase-manifest.json`, `tests/unit/auth.test.js`; update package/lock files and the existing public config with `leaderboardEnabled:false` and trusted `publicUrl`.

**Interfaces:** Produces the parent `AuthController`. The injected `loadClient(): Promise<createClient>` loads the local official UMD script and returns its `createClient` factory. Keep DOM script loading in a small adapter exported by `src/auth.js`; controller tests inject the factory. Client construction sets PKCE, URL session detection, safe persistent storage under `charterschoodle-auth:v2`, and a 10-second network timeout. Require `config.leaderboardEnabled === true` and valid URL/key/publicUrl before authentication can initialize.

- [ ] **Step 1:** Test `disabled_auth_performs_no_network_request`, `email_submission_is_explicit`, `unavailable_storage_does_not_send_link`, `link_request_has_resend_cooldown`, `expired_or_reused_callback_can_retry`, `missing_pkce_verifier_returns_to_guest`, `callback_params_are_removed`, `sdk_load_failure_keeps_guest`, and `failed_signout_clears_local_identity`. Assert the UI-facing state never contains access/refresh tokens, and a late old-client callback cannot reauthenticate after sign-out. Use the server's resend cooldown when supplied, otherwise 60 seconds; never promise email delivery on an error response.
- [ ] **Step 2:** Run the auth unit file; inspect the missing-controller failure.
- [ ] **Step 3:** Install exact `@supabase/supabase-js@2.118.0` under Node >=22. Make `vendor:sync` copy the official package's `dist/umd/supabase.js` and license, recording version and SHA-256 in the manifest; `vendor:check` compares checked-in artifacts against the locked dependency without rewriting files. Implement the controller and local SDK loading. Clear local session state and dispose the old client even when remote sign-out fails; invalidate its subscriptions and refresh loop. Use only trusted configured callback URLs and remove handled auth URL parameters on success and failure.
- [ ] **Step 4:** Run unit tests and `npm run vendor:check`; require zero failures and byte-identical vendor artifacts. A callback/storage failure leaves the player in usable guest mode. Do not invoke the real sign-in endpoint.
- [ ] **Step 5:** Commit as `feat: add optional passwordless leaderboard authentication`.

### Task 9: Integrate account-safe synchronization and leaderboard UI

**Files:** Create `src/leaderboard.js`, `tests/unit/leaderboard.test.js`, `tests/browser/accounts.spec.js`; modify `src/app.js`, `index.html`, `style.css`, `tests/browser/fixtures.js`, `docs/leaderboard.md`, and the leaderboard section of `README.md`.

**Interfaces:** Consumes Tasks 1–8 and produces the parent `LeaderboardController`. `getClient()` returns the authenticated SDK client or an anonymous client only for the public RPC; owner operations require the verified subject. `storeFor(subject)` comes from Task 3; `getPuzzle(date)` and `schoolIds` validate restored progress. `now()` returns a Date. `adoptTodayGuest` returns true only when an explicit current-day import was accepted locally and queued; false means declined, empty, previously imported, or blocked by an existing remote result.

- [ ] **Step 1:** Test `guest_cannot_queue_remote_results`, `archive_never_queues`, `joining_does_not_import_old_guest_history`, `matching_public_name_never_claims_history`, `guest_import_requires_confirmation`, `same_date_import_has_one_receipt_per_account`, `account_switch_drops_stale_responses`, `pending_a_never_dispatches_as_b`, `conflicting_terminal_result_restores_remote`, `bad_remote_progress_cannot_crash`, `outage_retains_pending_results`, `unlisted_profile_stays_private`, `personal_history_reads_all_server_pages`, and `sort_race_cannot_overwrite_latest_page`. Use a multi-page owner-history fixture to verify a second device restores lifetime personal totals, including for an unlisted account. A deferred-promise fake client must capture the actual dispatched `user_id`, not merely the currently selected store.

```js
assert.equal(sentToServer.user_id, userA);
assert.equal(storeFor(userB).readResults().length, 0);
assert.equal(storeFor(userA).readPending().length, 1); // failed write retained
assert.equal(controllerLastPage.rows[0].publicId, latestRequestedPlayer);
```

- [ ] **Step 2:** Run the leaderboard unit file and accounts browser file; confirm absent account flows fail. Browser fixtures must intercept the exact v2 table/RPC/Auth endpoints and fail the test on any unexpected production request.
- [ ] **Step 3:** Implement the controller with subject/request epochs and SDK-managed bearer tokens. Set `user_id` from the verified subject, serialize flushes per owner, acknowledge only successful writes, and keep failed/conflicting records tied to the original owner. `readOwnerResults()` reads owner-scoped raw results in date order, advancing the range by the number actually returned until no rows remain, so server response limits cannot silently truncate personal totals. Validate/cache those entries in the account store. Restore valid owner progress on return; don't overwrite a more advanced pending local prefix with an older remote attempt. If prefixes conflict, show remote progress and retain local evidence for the session. Detect actual HTTP 409/constraint conflicts separately from network errors.
- [ ] **Step 4:** Integrate dismissible email/profile dialogs, explicit public consent, display-name and optional school editing, hide-entry control, sign-out, include-today choice, five-row server pagination, and public-only error/empty states. Escape/close returns to the game. Remove normalized-name identity, legacy upserts, raw public record fetching, and the first-5,000-record aggregation. Read Impeccable craft-floor/harden/clarify guidance before these UI edits.
- [ ] **Step 5:** Run all unit/database/browser suites and vendor checks. Include browser return-on-second-device fixtures, two accounts using the same display name, failed email/session/leaderboard requests, sign-out failure, and editing/hiding without changing account identity. Keep activation false. Commit as `feat: integrate protected leaderboard profiles and score sync`.
