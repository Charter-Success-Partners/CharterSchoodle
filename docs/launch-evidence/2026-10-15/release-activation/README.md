# Release activation — October 15, 2026

The owner explicitly approved enabling the leaderboard, merging PR #1, and deploying to the existing canonical domain. The activation change sets `leaderboardEnabled:true`; previously reviewed application behavior is unchanged.

Pre-activation head: `9776ca6e51d0bf3f719b304c17d27df07502b555`. Operator: Codex on behalf of the owner. Target: `https://charterschoodle.chartersuccesspartners.com/`. Supabase cutover date: `2026-10-15`. The scheduled puzzle refresh is at 09:05 UTC; this release is outside that window.

Deployment, live guest/account checks, and callback-recovery checks passed as recorded below. The owner confirmed email receipt and successful browser sign-in; production Auth corroborates a verified non-operator sign-in. See [email-completion-redacted.json](email-completion-redacted.json) for the final email observation.

Release verification: 115 unit tests and 25 database tests passed; all 74 browser tests passed at each of the development root, staged root and staged `/CharterSchoodle/` mount. The official SDK byte/provenance check passed. The staged manifest contains exactly 18 assets, all byte-identical to source, with the activation flag true.

The guest browser fixture now loads the actual configuration and overrides only its backend activation flag; account fixtures retain their explicit enabled configuration. This preserves real metadata checks and the strict block on production network requests during automated fixture tests. The three directly affected tests passed before the final full browser runs.

## Deployed observations

PR #1 merged at `bfdc42d6d94bdb3d2e5b9f6b1ce47860ae6438fa`. [Pages run 38784885858](https://github.com/Charter-Success-Partners/CharterSchoodle/actions/runs/38784885858) succeeded. Every one of the 18 public files fetched over certificate-verified HTTPS matches the staged SHA-256 manifest exactly.

The live site passed 34 guest checks across 10 scenarios, including actual win/loss, archive scoring isolation, persistence, responsive layouts, stale sharing/clipboard completions, and storage/config fault survival. Thirteen deployed account checks passed, including distinct owner histories, real ranking retrieval, serialized public-save/hide behavior, explicit guest import, pending-upload account switching, second-device restore, and sign-out. Two additional expired/invalid callback scenarios returned to playable guest mode with clean URLs.

All three synthetic test profiles and results remain private and unlisted. Legacy rows remain 67 and the scoring cutover date remains October 15. No real-player profile was created by the operator.

The agreed email request returned HTTP 200, retained its requesting-browser PKCE verifier, and enforced the resend cooldown. The owner subsequently confirmed email receipt and then explicitly confirmed successful browser sign-in. A read-only production Auth check at 19:15 UTC found one verified sign-in at 19:06 UTC after excluding all three synthetic operator accounts. That sign-in uses a different address from the original delivery-test recipient; the original address remains unconfirmed, explaining the earlier mismatch. Browser completion is owner-confirmed, independently corroborated by Auth metadata; the operator did not observe the owner browser directly. [email-completion-redacted.json](email-completion-redacted.json) supersedes the pending completion state in the earlier [delivery observation](email-delivery-redacted.json). No additional email was sent and no account records were modified for this follow-up.

Historical follow-up readiness verification before the explicit sign-in confirmation: `npm run check:release -- --code` returned `code readiness: READY` (exit 0); `npm run check:release` returned `public readiness: BLOCKED` (exit 2), with only `externalRecipientEmail` awaiting requesting-browser completion. `git diff --check` passed. This follow-up changes verification documentation only.

Final verification after the owner confirmed successful sign-in: `npm run check:release` returned `public readiness: READY` (exit 0); see [release-public-ready.log](release-public-ready.log). All recorded launch checks pass. The redacted sign-in proof was validated, `git diff --check` passed, and all changes since the deployed revision are documentation only. No additional deployment is needed.
