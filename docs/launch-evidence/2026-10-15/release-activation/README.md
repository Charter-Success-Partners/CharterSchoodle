# Release activation — October 15, 2026

The owner explicitly approved enabling the leaderboard, merging PR #1, and deploying to the existing canonical domain. The activation change sets `leaderboardEnabled:true`; previously reviewed application behavior is unchanged.

Pre-activation head: `9776ca6e51d0bf3f719b304c17d27df07502b555`. Operator: Codex on behalf of the owner. Target: `https://charterschoodle.chartersuccesspartners.com/`. Supabase cutover date: `2026-10-15`. The scheduled puzzle refresh is at 09:05 UTC; this release is outside that window.

Deployment, live guest/account checks, and callback-recovery checks passed as recorded below. The owner confirmed email receipt; successful completion of the designated-recipient sign-in remains pending.

Release verification: 115 unit tests and 25 database tests passed; all 74 browser tests passed at each of the development root, staged root and staged `/CharterSchoodle/` mount. The official SDK byte/provenance check passed. The staged manifest contains exactly 18 assets, all byte-identical to source, with the activation flag true.

The guest browser fixture now loads the actual configuration and overrides only its backend activation flag; account fixtures retain their explicit enabled configuration. This preserves real metadata checks and the strict block on production network requests during automated fixture tests. The three directly affected tests passed before the final full browser runs.

## Deployed observations

PR #1 merged at `bfdc42d6d94bdb3d2e5b9f6b1ce47860ae6438fa`. [Pages run 38784885858](https://github.com/Charter-Success-Partners/CharterSchoodle/actions/runs/38784885858) succeeded. Every one of the 18 public files fetched over certificate-verified HTTPS matches the staged SHA-256 manifest exactly.

The live site passed 34 guest checks across 10 scenarios, including actual win/loss, archive scoring isolation, persistence, responsive layouts, stale sharing/clipboard completions, and storage/config fault survival. Thirteen deployed account checks passed, including distinct owner histories, real ranking retrieval, serialized public-save/hide behavior, explicit guest import, pending-upload account switching, second-device restore, and sign-out. Two additional expired/invalid callback scenarios returned to playable guest mode with clean URLs.

All three synthetic test profiles and results remain private and unlisted. Legacy rows remain 67 and the scoring cutover date remains October 15. No real-player profile was created by the operator.

The agreed email request returned HTTP 200, retained its requesting-browser PKCE verifier, and enforced the resend cooldown. The owner subsequently confirmed email receipt. A read-only Auth check at 19:11 UTC still showed no email confirmation or completed sign-in for the designated recipient; see [email-delivery-redacted.json](email-delivery-redacted.json). The owner was asked whether they also opened the newest link and saw themselves signed in. Successful requesting-browser completion is the only remaining public-readiness gate. No additional email was sent and no account records were modified for this follow-up.

Follow-up readiness verification after recording delivery: `npm run check:release -- --code` returned `code readiness: READY` (exit 0); `npm run check:release` returned `public readiness: BLOCKED` (exit 2), with only `externalRecipientEmail` awaiting requesting-browser completion. `git diff --check` passed. This follow-up changes verification documentation only.
