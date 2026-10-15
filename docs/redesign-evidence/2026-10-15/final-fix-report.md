# Single final review fix batch

Baseline: `42fa03b630ea7a96398f4243ff355d8765652f6d`
Final commit: `2557b3116e5cca6decc51cbf95a3459c3fd0d1ff`
Worktree: `/home/space/.codex/worktrees/0b66/CharterSchoodle`

Applied only the three material finish-review items and one Minor code-review item from the parent-approved reports.

## Fixes

1. **Increased-text reflow.** Branding can wrap at the Charter/Schoodle boundary; brand/navigation/header flex layouts wrap at intrinsic content limits, six-attempt progress scales/wraps with text, and feedback columns adapt to text-relative widths. At 320px with 200% root text, document width is no greater than 320 and all measured visible brand/navigation/header/progress/feedback text fits its own layout box without intersecting navigation buttons. Ordinary 320/390 first-real-clue, picker and Submit remain inside the 800px initial viewport. No overflow clipping or font shrinking masks the failure.
2. **Account-aware empty ranking guidance.** Existing public profile receives first-score play guidance without another Join instruction. Existing private profile receives Edit profile/public visibility guidance. Guest and verified-profileless accounts retain Join guidance. Loading/error messages remain independent.
3. **Authored SVG vocabulary.** One inline `iconMarkup()` helper draws consistent result, equality, grade-span, eight compass-direction, location, help and map-control marks with a shared 24-unit viewBox and 1.8 stroke. Help-key markers and feedback use the same geometry; no glyph-font rendering dependency remains in those icons. SVGs are decorative, focusable=false and aria-hidden=true. Adjacent explanatory text and native button names remain. Native details markers remain native. No new runtime file, raster asset, dependency or allowlist change.
4. **Direct Join ranking refresh.** The verified-profileless direct-submit branch captures the account revision, awaits successful joining, exits if the account revision changed, restores owner sessions, and refreshes rankings when the same completion still owns an active Leaderboard view. A newly saved eligible guest result therefore appears without navigation, sorting, another form or another email.

`index.html` app/style entry versions are now `20261015-ui-r2`; reviewed auth/leaderboard/onboarding imports remain `20261015-join-r2`. Source data, published puzzles, original logo, backend, account modules, staging and dependencies are unchanged.

## Files committed

- `index.html`
- `src/app.js`
- `style.css`
- `tests/browser/final-review.spec.js`

Parent-owned `.impeccable/review/` and `docs/redesign-evidence/` remain untracked and were not staged or edited by this task.

## Reproduction and verification

Evidence directory: `/tmp/charterschoodle-final-fix-evidence/`.

`red.log`: 5 expected failing regressions, 2 existing-behavior controls passed:
- `enlarged_text_reflows_brand_navigation_header_and_feedback_at_320`: measured **459px document width at 320px** in the network-blocked fallback-font fixture.
- `empty_rankings_guidance_matches_public_account`: already-public account incorrectly told to join again.
- `empty_rankings_guidance_matches_private_account`: missing visibility/Edit profile guidance.
- `direct_verified_join_refreshes_the_open_rankings_after_guest_import`: intercepted profile and result save completed but no visible ranking entry appeared.
- `feedback_help_and_map_use_drawn_decorative_icons_with_text_labels`: feedback had font glyphs, no decorative drawn SVG.
- Guest/profileless empty-guidance cases already passed, guarding their retention.

The intermediate affected-browser run (`green-browser.log`) passed 51/54 and caught an ordinary-320 initial Submit bottom at 816.5px after the first wrapping change. Reducing the header's intrinsic title basis retained ordinary side-by-side space and permits enlarged text to wrap. Two test-boundary corrections were also necessary: exclude intentionally clipped `.sr-only` text from painted-text geometry, and calculate the synthetic ranking RPC points from its saved guessed-school IDs instead of an absent POST `points` field. No product scoring or carryover change was made. These cases all pass in the final run.

Final commands/results, all exit 0:

- `env -u NO_COLOR "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" CHARTERSCHOODLE_CHROMIUM_PATH=/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome npx playwright test tests/browser/final-review.spec.js tests/browser/redesign.spec.js tests/browser/accessibility.spec.js tests/browser/accounts.spec.js`
  - `green-browser-final.log`: **54/54 passed**, including all 27 reviewed account scenarios, new seven review regressions, original phone/map/ranking geometry and keyboard cases.
- `env "PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH" npm run test:unit`
  - `green-unit.log`: **135/135 passed**.
- `node --check src/app.js`: passed.
- `git diff --check`: passed before staging/commit.

Database code is unchanged and the parent explicitly owns final full-bundle checks, so the database/full-root browser suites were not rerun in this scoped batch. No unresolved test failures remain in the requested affected scope.

## Confirmation handoff

All previous capture hooks remain. Help equality marks can be found through `#how-to-play [data-ui-icon="equal"] svg`; other decorative SVGs use `.ui-icon`. Native disclosure controls are unchanged. Parent can perform the single confirmation batch and scoped reviewer verdicts now.

No screenshots, detector/context calls, image generation, production requests, emails, backend/data mutations, other agents, push, merge, deployment, or new polish exploration occurred in this task.
