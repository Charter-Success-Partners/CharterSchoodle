# Task 2 — Approved visual redesign implementation

Worktree: `/home/space/.codex/worktrees/0b66/CharterSchoodle`
Reviewed signup baseline: `dbd7595e8da95d1f3ed297aae7f228abee873060`
Final implementation commit: `42fa03b630ea7a96398f4243ff355d8765652f6d`

## Delivered

- Replaced the legacy visual composition and CSS with a compact CSP/Open Sans interface, cream/white surfaces, restrained green primary action, sage navigation, comfortable support text, native controls, visible focus/selection/caret/scrollbar treatment, and reduced-motion support. Original logo asset retained unchanged.
- First active real clue, six compact attempt indicators, and usable school picker/Submit occur together in the initial phone viewport. Future clues do not appear in placeholders. Completed guesses retain their actual clues and labeled result/enrollment/grade/direction feedback below the current action. Incorrect guesses advance the clue and restore input focus. Completion, reload, archive, unavailable data, retry, and midnight behavior remain covered.
- Mode buttons expose `aria-pressed`, including initial markup. Headers use view-specific date/guess context, community rankings, or NC schools; no Company score or map pin count under Your Score.
- Community rankings now use a semantic list, five entries per page and the same three server sorts. Rank, full display name, optional affiliation, and selected metric appear together. Native details exposes all permitted aggregate stats. Own-entry labeling uses the actual public ID, never name matching. Personal daily stats live in a separate optional disclosure with guest/private/public context. Empty/ready copy explains that the first daily attempt is required for a new public entry.
- Map outline and pins share one equirectangular projection at NC's middle latitude and a fixed geographic canvas ratio on every viewport. Existing zoom/pan remains. Search finds actual schools by name/city/county; five results initially, Show more in five-school increments, 44px native result controls, keyboard selection and Escape, selected pin state, and a readable school-facts region. Dense map pins are removed from sequential tab order; the finder provides practical keyboard access to every mapped school.
- Account forms, check-email/resend/edit, saving/retry/success, profile settings, help and result dialogs use one visual system. Reviewed auth/onboarding/owner/import/cancellation logic remains unchanged. Presentation adds state styling and accurate zero-game ready copy. Share result is the sole primary result action; other actions stay available as secondary controls.
- Updated index app/style entry cache versions to `20261015-ui-r1`. Reviewed account-module import queries remain consistently `20261015-join-r2`.

## Changed files

- `index.html`: new shell/content composition, ranking list/personal disclosure, active clue/progress/history, native map search/list/facts, primary result treatment and entry cache tags.
- `style.css`: full replacement of overlapping legacy styles with the approved visual system and responsive layouts.
- `src/app.js`: active clue/history/progress rendering, mode state, contextual headers, ranking rendering, geographic sizing and school finder, scoped account presentation.
- `tests/browser/redesign.spec.js`: six new meaningful regressions using the real app/controllers with synthetic network boundaries.
- `tests/browser/accessibility.spec.js`: only the obsolete six-expanded-round expectation changed to six compact attempts, no unplayed history, and a visible active clue; all existing interaction guards retained.
- `tests/browser/accounts.spec.js`: two table-row locators changed to ranked-list entry locators; all account assertions and semantics retained.

No auth.js/onboarding.js/leaderboard.js, source datasets/published puzzles, backend/schema/config, runtime dependencies, logo/assets, product/review documents, or staging allowlists changed. Parent's `docs/redesign-evidence/` remains untracked and unstaged by this task.

## RED / GREEN evidence

Logs: `/tmp/charterschoodle-visual-evidence/`.

`red.log`: six expected pre-implementation failures, verified at the intended missing functionality:
- `first_guess_and_real_clue_share_phone_viewport_320`
- `first_guess_and_real_clue_share_phone_viewport_390`
- `current_mode_is_exposed_to_assistive_technology`
- `rankings_keep_identity_metric_and_keyboard_details_320`
- `rankings_keep_identity_metric_and_keyboard_details_390`
- `map_search_keyboard_selection_and_geography_survive_mobile_reflow`

The first-clue tests load the real October 15 clue with fixture school/network control and assert clue/input/Submit inside an 800px initial viewport, then actually submit a wrong guess and verify next clue/history/focus. The ranking tests use `North Carolina Charter School Community Member` plus a full affiliation, all three selected metrics, readable identity width, no page overflow, and keyboard-opened stats. Map testing actually searches/selects by keyboard, verifies selected facts/pin, checks consistent physical proportions at 320/390/1440, and exercises no results.

Commands and final outcomes:

1. `env -u NO_COLOR "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" CHARTERSCHOODLE_CHROMIUM_PATH=/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test tests/browser/redesign.spec.js tests/browser/accessibility.spec.js`
   - `green-focused.log`: **20/20 passed**, exit 0.
2. `env -u NO_COLOR "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" CHARTERSCHOODLE_CHROMIUM_PATH=/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test`
   - `browser-full.log`: **89/89 passed**, exit 0, including all 27 Task 1 accounts and deployment/sharing/guest/accessibility regressions.
3. `env "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" npm test`
   - `npm-test.log`: **135 unit + 25 local database tests passed**, zero failures, exit 0.
4. `node --check src/app.js`: passed.
5. `git diff --check`: passed before staging/commit. Post-commit status contains only parent's untracked evidence directory.

All browser traffic used local assets and synthetic intercepted Supabase fixtures; existing fixture guards assert no production Supabase requests. No real email, production writes, new screenshots, image generation, detector/context runs, deployment, push, merge, or subagents occurred in this task. Parent separately owns the sole detector and final batched visual inspection.

## Final stable capture hooks

- Game: `#active-clue`, `#active-clue-title`, `#active-clue-text`, `#attempt-progress > li`, `#guess-form`, `#guess-history`, `#board-rounds > .board-row--played`, `#game-status`.
- Ranking: `#leaderboard-body > .leaderboard-entry`, `.ranking-row`, `.ranking-identity`, `.ranking-metric`, `.ranking-details` (`details` with native `summary`), `.ranking-stats`, `#personal-scores` (`details`). Existing sort/page/status/retry hooks retained.
- Map: `#map-search` (native searchbox, accessible name Find a school), `#map-results button[data-map-result-id]`, `#map-result-status`, `#map-more`, `#map-selection`, `#map-selection-title`, `#map-selection-facts`. Existing `.nc-map-frame`, `.nc-map-pin[data-map-school-id]`, zoom button/status hooks retained.
- Accounts: all Task 1 IDs and accessible names retained, including `#join-fields`, `#join-name`, `#join-school`, `#join-notice`, `#email-fields`, `#email-edit`, `#email-mode`, `#email-intro`, statuses and dialogs. `#email-dialog[data-state]` and `#account-status[data-state]` expose presentation state.
- Result/help/archive: existing IDs/accessibility names retained, including Keep Browsing, Share result, Copy result, Past Puzzles and How to play.

## Handoff

Implementation and required automated checks are complete; no unresolved test failure. Final visual inspection, 200% text capture and any single grouped visual fix pass belong to the parent. This task makes no visual-inspection pass claim. The original 605KB supplied logo remains byte-identical by explicit scope; no asset optimization was attempted. The map uses a regional equirectangular projection, with the same coordinate transform for pins/outline and the same physical ratio at all widths.
