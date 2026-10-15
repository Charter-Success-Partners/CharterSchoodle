# Unified signup review — Task 1

Reviewed immutable diff `a61350db47d9e95342fa24941c85a39f37d3c801..7f1cadcaf3b24ee859f7896563fdf028641c15f6` in `/home/space/.codex/worktrees/0b66/CharterSchoodle`, against `/tmp/charterschoodle-signup-task.md` and the parent’s clarified approved behavior. Read the implementation report and actual changes. Inspected unchanged leaderboard import/owner guards and the auth event/recovery integration only to resolve named risks.

**Spec Compliance: Needs fixes.** The primary workflow implements the requested one-form signup, but request binding, explicit-consent carryover after partial success, and cancellation invariants have reproducible gaps.

**Task Quality: Needs fixes.** Three Important findings; no Critical findings. The broad layout, map, CSS, and forthcoming index cache-tag update are outside this review.

## Strengths

- The Join form collects display name, optional affiliation, and email together, clearly describes public data and today’s game inclusion, and retains useful check-email, resend, and editing states.
- Callback completion is automatic, with a persisted owner-bound retry phase. New profiles are inserted rather than upserted; concurrent existing profile fields and visibility remain authoritative.
- Auth still verifies the user with `getUser`, and the new identity getter keeps SDK tokens private. A fresh page with only a cached session cannot claim an unbound draft through the initialization path.
- Current-owner daily progress is queued ahead of guest adoption; archive/older-game isolation and existing account results retain priority through the existing leaderboard guards.
- The changed tests exercise official-SDK callback navigation with intercepted HTTP boundaries, failure/reload retry, two-tab completion, ownership changes, and retained privacy serialization. The new module is included in the staging allowlist, and changed runtime module version queries are coherent.

## Important findings

### 1. Explicit verified Join loses its consented guest carryover when a profile already exists, including a lost insert response

**Sources:** `src/onboarding.js:75–77` and `src/onboarding.js:83–86`. Tests currently encode this incorrect outcome in `tests/unit/onboarding.test.js:62` and `tests/browser/accounts.spec.js:282`.

When a profile is found and `profileSaved` is false, completion discards the intent and returns `existing` before the guest-adoption and flush steps. The insert-conflict branch does the same. This conflates preserving an existing owner’s profile/privacy with dropping the separate, explicitly authorized inclusion of today’s guest game.

A particularly ordinary failure case is a profile insert that commits successfully but loses its response. The persisted draft still has `profileSaved:false`; on retry/reload the newly created profile is found, the intent is deleted, and today’s game never reaches the account. The user is told the account is restored and has no pending join to retry. This does not meet the approved carryover contract. The report acknowledges conservative profile restoration, but profile preservation does not require abandoning guest-game consent.

**Focused reproduction:** real onboarding, leaderboard, and stores with a synthetic database boundary; wrap `createProfile` so its real insert commits and then throws a response-loss error. Reload the onboarding controller and retry under the same verified owner. Observed `status:"existing"`, one profile, **zero results**, and `pendingIntent:null`.

**Fix direction:** preserve the existing profile’s fields and visibility, then continue the verified Join’s eligible daily-result adoption/flush. Respect existing owner local progress and remote result priority. Email-only Sign in must continue to have no such adoption consent. Cover a committed-but-response-lost insert and an explicit verified Join that finds an existing hidden profile; update the tests that currently require dropping the consented game.

### 2. The requesting tab grants request identity to a raw cached session without a matching PKCE exchange

**Sources:** `src/auth.js:210` and `src/auth.js:143–145`.

The OTP fetch boundary sets `current.joinRequest = bound` as soon as the link is requested. Later `acceptSession` assigns that request ID to any server-verified session with the same email. It does not establish that this session resulted from that request’s PKCE confirmation. Thus the requesting page’s live controller has a weaker rule than fresh callback initialization, which checks callback presence and the verifier hash.

**Focused reproduction:** with the official SDK and all HTTP stubbed, request a Join link, populate raw SDK session storage with a valid-shaped cached session for the matching verified email, and execute the SDK’s normal `_recoverAndRefresh` recovery path. Auth returns the pending `requestId`. The only HTTP paths were **`/auth/v1/otp` and `/auth/v1/user`**; no callback or `/token` exchange occurred. `onboarding.matches` therefore permits that cached session to claim the unbound draft.

This preserves server verification of the owner, but violates the explicit requirement that a cached raw session cannot claim a request-bound pending Join. The current cached-session regression tests a new controller and misses the requesting-controller path.

**Fix direction:** keep “link requested” metadata separate from “this request’s PKCE confirmation was completed” authority. Allow an unbound intent to be claimed only through proven callback completion; another tab may resume an intent after that callback has safely bound its owner. Preserve two-tab completion with regression coverage for a requesting tab recovering an unrelated cached session with the same verified email.

### 3. Cancelling while guest adoption awaits its owner read still imports and queues the cancelled game

**Sources:** `src/onboarding.js:99–100`, `src/onboarding.js:113`; unchanged mutation boundary `src/leaderboard.js:193–201`.

The onboarding intent check occurs only after `adoptTodayGuest` resolves. That method awaits the remote owner-result read, then queues the guest entry, writes the import receipt, and accepts it into owner progress. Cancellation removes the intent but does not invalidate that in-flight adoption, so its local mutations happen before onboarding notices cancellation and throws.

**Focused reproduction:** hold the result GET during real guest adoption, call `onboarding.cancel()`, release the GET, and observe the expected `AbortError`. Despite cancellation, the owner has the guest result in `readPending()` and `hasGuestImport(date) === true`; the intent is gone. Subsequent normal sync can upload this cancelled import. Replacing the draft during the same window has the same stale-consent problem. Account switching is separately guarded by the existing leaderboard epoch; that guard does not cover same-account draft cancellation/replacement.

**Fix direction:** carry a cancellation/current-intent guard into the import operation and check it after asynchronous reads, immediately before queue/receipt/progress mutations. Add a focused cancellation/replacement-during-import-read regression that asserts no owner queue, import receipt, or owner progress is created by stale work.

## Minor findings and scoped limitations

No separate Minor finding. The Web Locks implementation serializes whole completion operations in supported browsers. Its fallback is only per SafeStorage object within one realm, so it does not establish cross-tab mutual exclusion in browsers without Web Locks. The report accurately discloses this limitation; the existing concurrency test shares one SafeStorage object and does not validate a cross-tab fallback. This should remain an explicit supported-browser limitation or gain a real cross-tab strategy. It does not resolve the three findings above, which can occur even with Web Locks.

## Verification performed

No product, repository test, or Git changes; no production/network/email actions. Did not rerun the reported full suites or staged tests. Existing suite counts in the implementation report were not treated as proof of the missing cases.

Only narrow, local probes were added under `/tmp`:

- `/tmp/charterschoodle-signup-review-probes.mjs`: committed profile/response-loss retry and cancellation during the owner-result read, using real controllers/stores and a synthetic in-memory database boundary.
- `/tmp/charterschoodle-signup-auth-review-probe.mjs`: official SDK cached-session recovery in the requesting controller, with every HTTP call stubbed.

Both final probe commands exited 0 and printed the outcomes cited above. A preliminary auth probe had an invalid synthetic JWT signature and was corrected before the final cached-recovery check. No broad test reruns or changes were needed to establish the findings.
