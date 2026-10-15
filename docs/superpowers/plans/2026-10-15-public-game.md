# Public Guest Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing game usable immediately on phones and keyboards, resilient to local failures, and easy to share.

**Architecture:** Retain the entry point and stable school-feedback/map logic. Extract pure game rules, safe storage, and native-dialog focus handling; render each round once with responsive CSS. Keep remote writes disabled until Plan 2 and the activation review.

**Tech Stack:** Static HTML/CSS/JS, Node >=22 test runner, Playwright.

**Spec:** [Approved design](../specs/2026-10-15-public-launch-design.md).

## Global Constraints

Read the [parent plan's contracts and constraints](2026-10-15-public-launch.md) first. Preserve six guesses, six clues, CSP branding, map behavior, and v1 data. Use `America/New_York`, 16px inputs, 44px controls, and 4.5:1 normal-text contrast.

## Review Focus

- A storage getter or quota error must not make the game unavailable; Task 2 tests both.
- An open tab crossing NC midnight retains its original game date; Task 3 tests explicit switching.
- A missing daily puzzle and an empty archive must expose a usable next action; Task 3 tests both.
- A school/profile containing markup or an unusually long name renders as text without layout overflow; Task 4 tests both.
- Cancelling native Share must not unexpectedly copy text; Task 5 distinguishes AbortError from unavailable sharing.

### Task 1: Define and test the date, progress, score, and share rules

**Files:** Create `src/game.js`, `tests/unit/game.test.js`, `package.json`, `package-lock.json`, `.nvmrc`; modify `.gitignore` for developer dependencies and test artifacts.

**Interfaces:** Produces the five `src/game.js` exports and types in the parent contract. `formatShareResult` uses six cells: wrong `🟥`, correct `🟩`, unused `⬜`; headings are `Daily` or `Archive`; result is `N/6` or `X/6`; dates stay ISO.

- [ ] **Step 1:** Set up Node >=22 and the minimal package/test scripts, then write named behavioral tests with these assertions:

```js
assert.equal(ncToday(new Date('2026-10-15T03:59:59Z')), '2026-10-14');
assert.equal(ncToday(new Date('2026-10-15T04:00:00Z')), '2026-10-15');
assert.equal(ncToday(new Date('2026-11-01T06:30:00Z')), '2026-11-01');
assert.deepEqual(archiveDates([{date:'2026-10-14'},{date:'2028-10-03'}], '2026-10-15'), ['2026-10-14']);
assert.equal(validateProgress({guesses:[{schoolId:'unknown'}]}, {schoolIds:new Set(['a']),answerId:'a'}), null);
```

Also assert spring DST boundaries, exact-date validation, duplicate guesses, seventh guesses, a guess after the answer, recomputed solved/lost flags, six-to-one points, no solved-average division by zero, stale/missed-day streaks, and an unfinished current versus prior day. Share assertions must exclude the answer, school names, email, and callback parameters while including `Archive` for archive games.

- [ ] **Step 2:** Run `npm run test:unit`; confirm missing exports/module failures, not a broken test harness.
- [ ] **Step 3:** Implement the contract in `src/game.js`; use `Intl.DateTimeFormat(..., {timeZone:'America/New_York'})` parts for dates and calendar-day comparisons for streaks. Preserve existing scoring semantics except the approved stale-streak correction.
- [ ] **Step 4:** Run `npm run test:unit`; require zero failures. No browser or database dependency belongs in this module.
- [ ] **Step 5:** Commit the module, tests, package files, and ignores as `feat: define public game date and scoring rules`.

### Task 2: Make persistence safe and partitioned

**Files:** Create `src/storage.js`, `tests/unit/storage.test.js`.

**Interfaces:** Consumes Task 1 progress validation and score rules. Produces `SafeStorage`, `GameStore`, and `loadLegacyProfile` exactly as defined in the parent. Read existing `charterschoodle-progress:<date>`, `charterschoodle-scorebook:v1`, and `charterschoodle-player:v1` only for validated guest migration/prefill.

- [ ] **Step 1:** Write `falls_back_when_storage_getter_throws`, `keeps_latest_write_after_quota_failure`, `retains_memory_deletions`, `keeps_v1_keys`, `migrates_legacy_only_to_guest`, `rejects_corrupt_progress`, `ignores_unknown_school_ids`, `separates_account_queues`, and `binds_import_receipts_to_subject`. Representative assertions:

```js
const kv = createSafeStorage(() => { throw new DOMException('Blocked','SecurityError'); });
kv.setItem('key', 'new'); assert.equal(kv.getItem('key'), 'new');
assert.equal(kv.persistent, false);
assert.deepEqual(storeFor('account-b').readPending(), []);
assert.equal(legacyStorage.getItem(legacyKey), originalValue);
```

- [ ] **Step 2:** Run `node --test tests/unit/storage.test.js`; confirm missing module/export failures.
- [ ] **Step 3:** Implement the adapter and store with read-through memory and a tombstone for removed values. Catch storage acquisition, parsing, validation, and read/write errors. Validate legacy score entries separately from remotely publishable results; preserve historical numeric guest scores locally without fabricating guessed IDs.
- [ ] **Step 4:** Run `npm run test:unit`; require zero failures, including a quota fixture whose backing store still contains the old value.
- [ ] **Step 5:** Commit as `feat: preserve game progress when browser storage fails`.

### Task 3: Enable immediate guest play and correct date navigation

**Files:** Modify `src/app.js` (`loadData`, initialization, persistence calls, mode/date handling, daily recording, header); `index.html`; `src/supabase-config.js`. Create `playwright.config.js`, `tests/browser/guest.spec.js`, `tests/browser/fixtures.js`, `scripts/serve-test-site.mjs`; update package files with the exact resolved Playwright dev version and scripts.

**Interfaces:** Consumes Tasks 1–2. The app's active subject starts as `guest`; `storeFor(subject)` creates stores using the same safe storage and validated school/puzzle metadata. Add `leaderboardEnabled:false` to the existing public config global and remove any implicit legacy remote-write activation. The test server accepts `--root <directory>` and `--prefix <mount-path>`, binds only to localhost, and serves project-relative assets so Task 11 can exercise the packaged project-subpath deployment.

- [ ] **Step 1:** Add browser tests `first_visit_needs_no_profile`, `storage_blocked_still_plays`, `past_puzzles_excludes_today_and_future`, `no_past_puzzles_has_empty_state`, `missing_daily_offers_retry_and_archive`, `failed_json_fetch_can_retry`, `six_wrong_guesses_persist`, `correct_guess_persists`, and `midnight_requires_explicit_switch`. Assert a school input is usable on first visit, current puzzle dates remain unchanged across simulated midnight, and all production Supabase requests are blocked. Use Playwright's clock and route fixtures rather than changing production data files.
- [ ] **Step 2:** Run `npm run test:browser -- tests/browser/guest.spec.js`; record the original forced-modal/future-archive failure.
- [ ] **Step 3:** Wire safe stores and helpers into the app. Start the game without a profile prompt, use `response.ok` plus a 10-second abort for data loading, expose Retry, restrict date navigation in JS as well as input bounds, and recheck midnight on timer/visibility change without silently switching dates. Archive play never records a daily result. Keep a clear leaderboard-unavailable message while v2 is disabled.
- [ ] **Step 4:** Run the unit suite and the guest browser file; require zero failures. Assert no legacy POST/PATCH occurs, including after completing a daily game.
- [ ] **Step 5:** Commit as `fix: make guest play resilient and restrict the puzzle archive`.

### Task 4: Make rounds, help, suggestions, and dialogs accessible on phones

**Files:** Modify `index.html`, `style.css`, and `src/app.js` round/header/suggestion/help/modal rendering. Create `src/dialog.js`, `tests/browser/accessibility.spec.js`; copy the supplied original logo to `assets/csp-logo-2026.png` without altering the source.

**Interfaces:** Consumes the current `Progress` and stable feedback helpers; produces `openDialog`/`closeDialog` from the parent. Replace the table body with one ordered list `#board-rounds`; each item has one clue, guess, and labeled feedback group. Preserve existing map event handlers.

- [ ] **Step 1:** Write tests for `rounds_do_not_overflow_at_320`, `long_names_remain_readable`, `markup_is_rendered_as_text`, `dialog_traps_focus_and_restores_opener`, `escape_closes_help_and_profile`, `combobox_announces_selection`, `touch_selection_works`, `no_results_is_announced`, and `reduced_motion_has_static_feedback`. Assert `scrollWidth <= innerWidth`, exactly six round items, 44px primary/help/zoom controls, a 16px-or-larger school input, and correct `aria-expanded`/`aria-activedescendant` changes. Browser zoom/reflow inspection is part of Task 12, not a screenshot loop here.
- [ ] **Step 2:** Run `npm run test:browser -- tests/browser/accessibility.spec.js`; inspect the original overflow, focus, and ARIA failures.
- [ ] **Step 3:** Read Impeccable `reference/craft-floor.md`, `adapt.md`, `harden.md`, and `clarify.md` before UI editing. Implement native dialogs, click/touch help, one responsive round list, explicit feedback labels, polite status regions, darker semantic palette variants, visible focus, and reduced-motion static results. Use text nodes/escaping for all dynamic content. Keep input focus after a normal guess and restore a safe focus target after closing a result dialog.
- [ ] **Step 4:** Run both browser files and unit tests; require zero failures. Confirm map navigation and pin keyboard support still work. Defer the mechanical detector and batched screenshots until Task 12.
- [ ] **Step 5:** Commit as `feat: make game rounds and controls accessible on mobile`.

### Task 5: Share wins and losses without spoilers

**Files:** Modify `index.html`, `src/app.js` completion/result actions, and related CSS; create `tests/browser/sharing.spec.js`.

**Interfaces:** Consumes `formatShareResult` and native-dialog helpers. Both completed outcomes and a reloaded completed game expose Share result and Copy result. The public URL comes from trusted config, never `location.href`.

- [ ] **Step 1:** Test `win_share_contains_no_answer`, `loss_share_uses_x_of_six`, `archive_share_is_labeled`, `reloaded_result_can_be_shared`, `share_cancel_does_not_copy`, `share_failure_offers_copy`, and `clipboard_denial_offers_selectable_text`. Stub browser share/clipboard boundaries and assert emitted text, visible feedback, and focus recovery.
- [ ] **Step 2:** Run the sharing browser file; require failures from absent sharing behavior.
- [ ] **Step 3:** Implement native share, explicit copy, and selectable-text fallback. Treat `AbortError` as cancellation without copying or showing an error. Use the same result presentation for a win and loss, with an archive action and persistent result button.
- [ ] **Step 4:** Run `npm run test:unit` and all Plan 1 browser files; require zero failures. The game is now independently usable with remote writes disabled.
- [ ] **Step 5:** Commit as `feat: share spoiler-free daily and archive results`.
