# Task 1 — Unified joining implementation

Worktree: `/home/space/.codex/worktrees/0b66/CharterSchoodle`
Base: `a61350db47d9e95342fa24941c85a39f37d3c801`
Initial commit: `7f1cadc` — Finish leaderboard joining on verified email confirmation.
Review-fix commit: `dbd7595` — Preserve verified join consent and enforce callback authority.

## Delivered behavior

- Guest Join leaderboard collects public display name, optional affiliation, and email in one form before email confirmation. Joining is explicit public opt-in; the form explains public aggregate stats, private email/guesses, today's guest-game inclusion, older/archive exclusions, existing-account priority, and later hiding.
- Check-email state displays the entered address with textContent, retains details, asks for the same browser, provides a live resend countdown, and supports editing details/address before requesting a replacement link.
- Fresh official-SDK PKCE callback verifies the server user/email and automatically creates the public profile, adopts only today's eligible guest game, flushes owner-scoped pending results, and reports joined/ready. No post-callback profile form is required.
- Failed profile/result saves keep the owner-bound intent and details across reload; Retry account sync finishes without retyping or a new email. The retry control is hidden when no account problem exists.
- Secondary Sign in collects email only and restores existing profile/privacy. Existing profiles win over guest drafts, including insert conflicts. Verified profileless accounts can join directly with the same form, without another link.
- Existing Edit profile, hiding, captured consent, serialized privacy writes, sign out, immutable-result conflicts, owner queues, and guest gameplay remain covered.

## Identity / concurrency design

`src/auth.js` now exposes `getVerifiedIdentity()` containing only server-verified `{userId,email,requestId}`; tokens remain SDK-private. `sendLink(email,{requestId})` binds request metadata to the SHA-256 digest of the SDK's PKCE verifier at the actual OTP fetch boundary. A fresh callback accepts the request ID only when that stored binding, normalized verified email, and lifetime match. Cached session data alone cannot consume a guest draft. `clearJoinRequest(id)` clears matching metadata.

`src/onboarding.js` owns a versioned, token-free pending intent. It validates fields, normalized email, UUID request/owner identities, request time, current NC date, and saved-profile phase. Auth and onboarding share a 24-hour lifetime and 60-second allowance for small clock corrections. A successfully verified request binds the intent to its actual Auth subject before any owner read can fail. Every asynchronous continuation rechecks identity and current intent, so cancellation, replacement, and account switching cannot continue work for another owner.

Completion uses origin Web Locks to serialize requesting/callback tabs, re-reading persisted intent inside the lock. Same-process fallback serializes controllers sharing the same SafeStorage instance. The app reads/restores the owner profile after join completion so a waiting tab does not retain a pre-lock null profile snapshot. Insert-only `leaderboard.createProfile()` avoids overwriting an existing profile on races; existing fields/privacy win.

Profile-save phase is persisted separately from result completion, allowing result retry without duplicate profile creation. Existing per-owner import receipts, pending result queues, RLS scope, and terminal/conflict handling remain authoritative. Current owned daily progress takes priority over guest adoption. A request from an earlier NC day never imports a new day's game.

## Changed files / interfaces

- `index.html`: necessary join/check-email/sign-in form markup and notices; existing profile settings remain.
- `src/app.js`: form modes, callback auto-completion, retry states, account restoration ordering, and current-owner integration.
- `src/auth.js`: verified identity getter, request binding, request cleanup, shared lifetime/skew constants.
- `src/leaderboard.js`: insert-only `createProfile({displayName,school}) -> {profile,created}`.
- `src/onboarding.js`: new `createOnboardingController({storage,auth,leaderboard,guestStore,ownerStore?,now?,today?})`; methods `prepare`, `request`, `finish`, `cancel`, and getter `pending`.
- `scripts/stage-site.mjs` and `tests/unit/deployment.test.js`: reviewed runtime allowlist now contains 19 files, including onboarding.
- `tests/unit/auth.test.js`, `tests/unit/onboarding.test.js`: ownership, PKCE binding, retention, validation, retry, conflict, account/draft replacement, concurrent completion, and date guards.
- `tests/browser/accounts.spec.js`, `tests/browser/fixtures.js`: intercepted OTP/token callbacks, unified consent, retry/reload, privacy, storage, two-tab, and correction/resend regressions.

Changed runtime imports use consistent `?v=20261015-join-r2` release queries for app's auth/leaderboard/onboarding and onboarding's auth import. Staging copies source bytes unchanged. Task 2 should refresh index app/style entry tags with its final UI release.

## Red / green evidence

Logs: `/tmp/charterschoodle-signup-evidence/`.

Observed pre-implementation failures:

- `red-auth.log`: verified-email getter absent.
- `red-browser.log`: guest form lacks pre-confirmation display-name field.
- `red-onboarding.log`: persistent onboarding behavior absent.
- `first-helper.log`: expanded staging contract fails until the new module is allowlisted.
- `red-owned-game.log`: guest adoption replaces already-owned local daily progress.
- `red-two-controllers.log`: concurrent controllers clear an in-progress import.
- `red-clock-skew.log`: small backward clock adjustment drops valid details.

Development checks also exposed a stale pre-lock profile snapshot in the callback tab; fixed by completing/binding the join before restoring the profile. Some initial save-failure fixtures incorrectly failed GETs (causing SDK retry delay), and a second-tab fixture reset its clock before the draft timestamp. Corrected test boundaries to fail save POSTs and synchronize simulated clocks. Diagnostic logs contain only synthetic fixture data; temporary diagnostic code was removed.

Initial implementation verification (all exit 0; superseded by the review-fix verification below):

1. `PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH npm test`
   - `npm-test-final.log`: 130 unit tests passed; 25 local database tests passed; zero failures.
2. `env -u NO_COLOR "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" CHARTERSCHOODLE_CHROMIUM_PATH=/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test tests/browser/accounts.spec.js`
   - `accounts-verified.log`: all 26 account browser tests passed.
3. `PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH npm run stage`
   - `stage.log`: 19 reviewed runtime files staged successfully.
4. Same Chromium command with `CHARTERSCHOODLE_TEST_ROOT=_site CHARTERSCHOODLE_TEST_PREFIX=/CharterSchoodle/ CHARTERSCHOODLE_TEST_PORT=4174` and `-g 'guest_join_finishes|requesting_and_callback|check_email_countdown'`
   - `staged-prefix.log`: all 3 staged-prefix callback/two-tab/resend tests passed.
5. `git diff --check`: clean.

All browser fixtures intercept/block production Supabase traffic, including writes. No emails, remote API/database writes, secrets, dependency changes, screenshots, detector/context runs, branches, pushes, merges, or deployment occurred. PRODUCT.md and archived review artifacts were not modified.

## Handoff / concerns

- Broad layout, CSS, responsive polish, visual inspection, and final index entry cache tags belong to Task 2. New stable IDs include `join-fields`, `join-name`, `join-school`, `join-notice`, `email-fields`, `email-edit`, `email-mode`, and `email-intro`.
- Cross-tab mutual exclusion relies on the Web Locks API available in the tested modern Chromium environment. The non-Web-Locks fallback serializes controllers within the same JS environment; legacy browsers without Web Locks have not been verified for cross-tab completion.
- The review fixes below resolve the previously recorded lost-insert-response carryover limitation. Existing owner fields/privacy remain authoritative, while the separately consented eligible game still completes.


## Scoped review fixes — revision 2

All three Important findings in `/tmp/charterschoodle-signup-review.md` were reproduced with failing repository regressions before product changes and are now fixed:

1. **Keep separately consented carryover when an owner profile already exists.** Onboarding preserves the existing profile fields and visibility, marks the profile phase complete, then continues eligible adoption/flush. This includes existing hidden profiles, insert conflicts, and an insert that committed but lost its response. Existing owner local/remote game priority remains intact. The intent is consumed only after result completion succeeds. Email-only Sign in has no Join intent and still never imports guest progress. Tests that previously encoded dropped carryover were corrected.
2. **Require actual PKCE exchange authority.** OTP sending now persists request metadata without granting request identity. Callback initialization captures a candidate verifier binding, but an unbound Join is authorized only after the matching successful `/token?grant_type=pkce` exchange, with the callback code and the SDK-decoded verifier matched to that candidate. The request ID is attached only to that exact returned access token after `getUser` verifies the server identity/email. The private exchange token and verifier remain inside auth.js. A callback URL/verifier candidate alone, cached session in a fresh controller, or raw cached-session recovery in the live requesting controller cannot claim the request. The requesting tab refreshes safely when the real callback binds or completes the owner's persisted intent, preserving both-tab completion.
3. **Stop stale import mutations after pending reads.** `adoptTodayGuest` accepts optional `assertCurrent`; onboarding passes its current-intent/owner guard. The import checks it after the async owner-row read, immediately before any queue/receipt/progress mutations. It also rechecks NC date at that boundary. Cancel and replacement regressions assert no owner pending entry, import receipt, result, or restored progress survives stale work.

Additional revised interfaces: onboarding exports `JOIN_INTENT_KEY` for the app's filtered storage-event refresh; the existing `adoptTodayGuest` options now accept `assertCurrent?: () => void`. Existing callers retain their behavior via the no-op default. Runtime import version queries were refreshed together to `20261015-join-r2`. Changes are limited to auth/app/onboarding/leaderboard and relevant unit/browser test fixtures; no backend or visual-layout work.

### Review-fix RED evidence

- `review-red-unit.log`: six expected assertion failures for requesting-controller cached recovery, existing-profile carryover, insert-conflict carryover, lost insert response, and cancel/replace during adoption read.
- `review-red-exchange-authority.log`: callback candidate with cached session but no exchange incorrectly receives a request ID.
- An intermediate focused run correctly exposed the SDK storing its verifier as a JSON-encoded string while the exchange body contains the decoded verifier. The fix compares the exact decoded verifier internally while retaining the raw-storage digest binding. Final official-SDK tests pass.

### Review-fix final GREEN evidence

All commands exited 0 on final source:

- `PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH node --test tests/unit/auth.test.js tests/unit/onboarding.test.js tests/unit/leaderboard.test.js`: **63/63 passed**, `review-green-focused-final.log`.
- Browser focused filter `guest_join_finishes|requesting_and_callback|explicit_join_keeps|committed_profile_response|returning_signin`: **5/5 passed**, `review-browser-focused.log`.
- `PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH npm test`: **135 unit + 25 local database tests passed**, zero failures, `review-npm-final.log`.
- `env -u NO_COLOR "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" CHARTERSCHOODLE_CHROMIUM_PATH=/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test tests/browser/accounts.spec.js`: **27/27 passed**, `review-accounts-final.log`.
- Original reviewer probes rerun without modification: `review-original-probes-green.log` shows a committed/response-lost profile with **one result** after retry, and cancellation leaves `ownerPending:[]`, `importMarked:false`. `review-original-auth-probe-green.log` shows live cached recovery with `requestId:null`, with only `/otp` and `/user` requests and no exchange.
- `git diff --check`: clean.

The previously documented Web Locks fallback limitation remains unchanged. No additional exploratory audit, screenshots, context/detector runs, real email, remote API/database writes, dependencies, backend changes, pushes, or deployment occurred.
