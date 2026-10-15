# Release activation — October 15, 2026

The owner explicitly approved enabling the leaderboard, merging PR #1, and deploying to the existing canonical domain. The activation change sets `leaderboardEnabled:true`; previously reviewed application behavior is unchanged.

Pre-activation head: `9776ca6e51d0bf3f719b304c17d27df07502b555`. Operator: Codex on behalf of the owner. Target: `https://charterschoodle.chartersuccesspartners.com/`. Supabase cutover date: `2026-10-15`. The scheduled puzzle refresh is at 09:05 UTC; this release is outside that window.

Verification and deployment observations will be recorded here. Inbox callback completion and deployed browser smoke remain pending.

Release verification: 115 unit tests and 25 database tests passed; all 74 browser tests passed at each of the development root, staged root and staged `/CharterSchoodle/` mount. The official SDK byte/provenance check passed. The staged manifest contains exactly 18 assets, all byte-identical to source, with the activation flag true.

The guest browser fixture now loads the actual configuration and overrides only its backend activation flag; account fixtures retain their explicit enabled configuration. This preserves real metadata checks and the strict block on production network requests during automated fixture tests. The three directly affected tests passed before the final full browser runs.

## Deployed observations

PR #1 merged at `bfdc42d6d94bdb3d2e5b9f6b1ce47860ae6438fa`. [Pages run 38784885858](https://github.com/Charter-Success-Partners/CharterSchoodle/actions/runs/38784885858) succeeded. Every one of the 18 public files fetched over certificate-verified HTTPS matches the staged SHA-256 manifest exactly.

The live site passed 34 guest checks across 10 scenarios, including actual win/loss, archive scoring isolation, persistence, responsive layouts, stale sharing/clipboard completions, and storage/config fault survival. Thirteen deployed account checks passed, including distinct owner histories, real ranking retrieval, serialized public-save/hide behavior, explicit guest import, pending-upload account switching, second-device restore, and sign-out. Two additional expired/invalid callback scenarios returned to playable guest mode with clean URLs.

All three synthetic test profiles and results remain private and unlisted. Legacy rows remain 67 and the scoring cutover date remains October 15. No real-player profile was created by the operator.

The agreed email request returned HTTP 200, retained its requesting-browser PKCE verifier, and enforced the resend cooldown. Inbox delivery and successful sign-in completion have not yet been observed. The connected mailbox did not locate the designated message. The owner was asked to request a fresh link from their own browser and complete that link in the same browser; the earlier automated link belongs to the operator browser. This is the only remaining public-readiness gate.
