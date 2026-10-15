# Unified Join — scoped re-review

**Verdict: Pass. Task Quality Approved for this scope.** All three Important findings from the initial review are resolved. No remaining Critical, Important, or Minor finding identified in the fixes or their direct regressions. The held visual task can proceed.

Reviewed immutable fix diff `7f1cadcaf3b24ee859f7896563fdf028641c15f6..dbd7595e8da95d1f3ed297aae7f228abee873060`, the scoped requirements, updated implementation report, focused regression source, and existing focused execution/probe logs. This was not a renewed broad audit.

## Finding dispositions

1. **Explicit Join carryover after existing-profile restoration or response loss — resolved.** `src/onboarding.js:76–98` preserves an existing profile instead of rewriting it, persists completion of the profile phase, and continues the separately consented adoption/flush before consuming the intent. This covers both finding a previously existing profile and an insert conflict. The response-loss retry retains the same behavior after reload. Updated helper/browser tests cover preserved hidden-profile fields and visibility, existing owner-result priority, and a committed insert whose response is lost. `src/app.js:1512–1514` also describes the retained privacy state correctly.

2. **Requesting-controller cached session acquiring Join authority without PKCE — resolved.** `src/auth.js:144` attaches a request ID only to the token recorded by a successful matching PKCE exchange. At `src/auth.js:237–243`, that exchange must match the callback code, decoded verifier, and request candidate; sending OTP no longer grants authority. Server `getUser` and same-recipient checks remain required. A callback candidate without an exchange and a requesting controller recovering a raw cached session are explicitly covered. Tokens/verifiers remain internal to auth.js. The filtered storage listener at `src/app.js:1663` lets the requesting tab restore/resume an intent only after the genuine callback binds or completes it; the existing two-tab browser regression passes.

3. **Cancellation/replacement during the owner-result read mutating the import — resolved.** `src/onboarding.js:96` supplies the current-intent/owner assertion to adoption. `src/leaderboard.js:195` invokes it after the asynchronous owner read and before the first queue, receipt, or owner-progress mutation. There is no intervening await between this assertion and those mutations. The preexisting owner epoch check remains, and a new date check prevents midnight rollover imports. Both cancellation and replacement regressions assert empty owner pending/results/progress, no import receipt, and preservation of the replacement draft where applicable.

## Evidence assessed

I inspected the recorded outcomes directly rather than relying only on the implementation report:

- `review-original-probes-green.log`: lost-response retry now has one profile and **one result**; cancellation leaves `ownerPending:[]` and `importMarked:false`.
- `review-original-auth-probe-green.log`: raw cached recovery has `requestId:null`; observed requests remain only `/otp` and `/user`, with no PKCE exchange.
- `review-green-focused-final.log`: **63 passed, zero failed**, including matching-callback authority, requesting-controller cached recovery, response-loss retry, existing owner result priority, and cancel/replace during adoption read.
- `review-browser-focused.log`: **5 passed**, covering automatic fresh callback completion, explicit Join with a hidden existing profile, email-only returning Sign in without guest import, two-tab completion, and committed-profile response-loss reload.

No additional test execution was needed: the original probes and targeted regressions directly cover the reported failures, and their final recorded outcomes agree with the fix diff. No broad suites were rerun, repository files changed, or production/network/email actions taken during this re-review.

The previously disclosed lack of cross-tab serialization in the non-Web-Locks fallback is unchanged and remains a supported-browser limitation, not a newly introduced regression. Broad UI/layout and final entry cache tags remain the next task’s scope.
