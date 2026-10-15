# Release activation — October 15, 2026

The owner explicitly approved enabling the leaderboard, merging PR #1, and deploying to the existing canonical domain. The activation change sets `leaderboardEnabled:true`; previously reviewed application behavior is unchanged.

Pre-activation head: `9776ca6e51d0bf3f719b304c17d27df07502b555`. Operator: Codex on behalf of the owner. Target: `https://charterschoodle.chartersuccesspartners.com/`. Supabase cutover date: `2026-10-15`. The scheduled puzzle refresh is at 09:05 UTC; this release is outside that window.

Verification and deployment observations will be recorded here. Inbox callback completion and deployed browser smoke remain pending.

Release verification: 115 unit tests and 25 database tests passed; all 74 browser tests passed at each of the development root, staged root and staged `/CharterSchoodle/` mount. The official SDK byte/provenance check passed. The staged manifest contains exactly 18 assets, all byte-identical to source, with the activation flag true.

The guest browser fixture now loads the actual configuration and overrides only its backend activation flag; account fixtures retain their explicit enabled configuration. This preserves real metadata checks and the strict block on production network requests during automated fixture tests. The three directly affected tests passed before the final full browser runs.
