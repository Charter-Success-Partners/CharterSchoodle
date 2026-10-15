# Final whole-branch code review and Task 2 specification review

Reviewed source: `42fa03b630ea7a96398f4243ff355d8765652f6d` in `/home/space/.codex/worktrees/0b66/CharterSchoodle`, against `b16d773`, using the immutable `/tmp/charterschoodle-redesign-code-review.diff` and adjacent final source. HEAD matched the supplied SHA. This review is read-only on the checkout.

**Verdict: Task 2 code quality/specification approved. Whole-branch code review approved with one non-blocking Minor finding. No Critical or Important findings.** Final visual approval and publication remain separate.

## Strengths

- The game implementation actually replaces the expanded future-round board: only the current clue and played history render, compact attempt indicators retain six-guess context, and incorrect submissions retain labeled feedback and return focus to the picker. Existing completion, archive scoring exclusion, result text, sharing, and owner-restoration paths remain integrated.
- Rankings retain the public aggregate API, five-row pages, three sorts, intact escaped identities, native expandable details, and separate personal statistics. Own-entry identification uses public ID rather than matching a name. Zero-game public profiles receive accurate first-score guidance.
- Map pins and the outline share the same normalized coordinate projection and fixed physical aspect ratio. The native school finder searches actual name/city/county data, starts with five results, provides progressive expansion and keyboard selection, and updates selected school facts. Existing zoom/pan remains connected.
- The Join orchestration keeps public consent, PKCE authority, server-verified email, owner binding, profile preservation, and guest carryover separate. Insert-only creation preserves concurrent/existing profiles and privacy. Intent checks cover asynchronous boundaries; the adoption check precedes import mutations. Web Locks cover requesting/callback tabs, and bound intents support retry after response loss without a second email or form.
- Existing SDK loading, public/owner client separation, serialized profile mutations, HTML escaping, safe storage behavior, and static staging remain intact. The onboarding module is explicitly allowlisted, changed account imports have coherent version queries, and app/style entry tags are updated.
- Regressions exercise actual app/controller interactions rather than only asserting CSS: real clue content plus wrong-guess progression, narrow ranking layout plus keyboard details, keyboard map selection, intercepted SDK confirmation, two-tab completion, retry, privacy, and cancellation boundaries.

## Issues

### Critical

None identified.

### Important

None identified.

### Minor

1. **A direct Join can leave an already-open leaderboard stale.** `src/app.js:1799–1802`.

   Reproduction path: a verified player without a profile has an eligible daily game, opens Leaderboard, waits for its public rankings to load, then uses Join leaderboard and submits the new profile. `finishJoin()` creates the profile and flushes the daily result, but this branch only calls `refreshOwnerSessions()`. That method rerenders the existing `state.leaderboard.records`; neither it nor onboarding completion fetches a new ranking page. The player therefore continues seeing the pre-join list (possibly the “No public scores yet” message), even though their profile and daily result have been saved. Selecting the view or a sort reloads the list and resolves the display.

   Evidence is the direct source path: `src/onboarding.js:96–101` flushes and completes without fetching rankings; `src/app.js:1631` rerenders cached state; the active Join submission has no `refreshRankings()` call. Existing Edit profile completion already refreshes rankings when this view is active. This is a presentation issue, not a persistence/privacy failure, and does not concern profiles with zero games.

   Suggested fix: after a successful direct Join, refresh rankings if the same account revision still owns the completion and Leaderboard remains active. A focused regression should start with an empty loaded board and return the newly saved public result from the subsequent RPC. No extra verification email or profile collection is needed.

## Evidence and scope

Read the approved direction, Task 2 brief, PRODUCT.md, original critique, Task 1 report and scoped re-review, Task 2 final report, runtime/test diff, final CSS/markup and adjacent integration code. Independently inspected the final recorded test results:

- `/tmp/charterschoodle-visual-evidence/npm-test.log`: 135 unit tests and 25 local database tests passed; zero failures.
- `/tmp/charterschoodle-visual-evidence/browser-full.log`: 89 browser tests passed.
- `/tmp/charterschoodle-visual-evidence/green-focused.log`: 20 focused browser tests passed.

Ran `git diff --check b16d773 42fa03b630ea7a96398f4243ff355d8765652f6d`; no whitespace errors. No test suite was rerun. The minor finding above is a deterministic source-traced call-path finding, not a claimed browser reproduction. No product/repository edits, screenshots, detector calls, production requests, emails, subagents, pushes, or deployment were performed. Only this report was written under `/tmp`.

Parent also requested adjudication of a capture showing zero guesses after successful carryover. Inspection of `/tmp/charterschoodle-redesign-capture.mjs:42–52` confirms that its synthetic owner-history GET ignores pagination and returns the same nonempty results on every page. `readOwnerResults()` therefore cannot finish its paging loop and reach account-progress restoration. This explains the capture observation without a product defect; parent independently reached the same conclusion and is correcting that capture fixture. This observation does not change the source verdict or add a carryover finding.

## Declined to judge

- Final visual composition, screenshot-based appearance, 200% text inspection, and changed-UI detector disposition: assigned to the separate final design reviewer and parent.
- Production email/provider delivery and live deployment readiness: outside the explicitly local review scope; existing launch evidence was not re-audited.
- Cross-tab serialization without Web Locks: the previously disclosed fallback limitation remains unchanged; this pass did not expand the approved browser support contract.
- Logo/image optimization and source dataset reduction: the supplied logo and published facts/puzzles were explicitly retained; no performance target required changing them.

## Assessment

**Ready to merge from the reviewed code/spec perspective: Yes, with the minor presentation issue recorded.** The approved functional redesign is implemented and integrated with the verified Join flow, and the supplied final test evidence is green. The minor stale-ranking path is recoverable through existing navigation and does not block the separate design handoff.
