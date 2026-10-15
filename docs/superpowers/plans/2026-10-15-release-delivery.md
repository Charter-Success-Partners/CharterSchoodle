# Puzzle and Release Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve published puzzles, improve future clue selection, and deliver one verifiable public release path with explicit activation requirements.

**Architecture:** Keep the existing deterministic school rotation and static hosting. Isolate clue selection and published-calendar preservation, stage a strict set of public assets, and call the same Pages workflow for ordinary and scheduled updates. Record production-only blockers separately from passing local checks.

**Tech Stack:** Node >=22, Node test runner, existing GitHub Pages workflows, Playwright for the static social preview and final browser checks.

**Spec:** [Approved design](../specs/2026-10-15-public-launch-design.md).

## Global Constraints

Read the [parent contracts](2026-10-15-public-launch.md) and complete Tasks 1–9 first. Preserve published dates/answers/clues through the current NC date, all 212 roster schools, six clues, the final letter hint, original supplied assets, and all legacy scores. Keep the static deployment and production activation flag disabled until its required checks pass.

## Review Focus

- A school with only five usable clues must keep its calendar place even if redundancy cannot be eliminated; Task 10 tests fallback plus a diagnostic.
- Generator reruns must retain historical/live puzzle objects verbatim, including existing dates absent from a regenerated draft; Task 10 tests merge preservation.
- A deployment run must omit research, documentation, node_modules, and original untracked files; Task 11 tests the staged allowlist.
- A refresh commit must deploy that exact revision through the sole Pages workflow; Task 11 checks the reusable-workflow contract.
- Missing migration/email/domain evidence remains a release blocker after all local tests pass; Task 12 tests both code-only and full readiness evaluation.

### Task 10: Improve future clues without changing published games

**Files:** Create `scripts/clue-selection.mjs`, `tests/unit/puzzle-generation.test.js`; modify `scripts/generate-daily-puzzles.mjs`, `data/puzzle-source.json`, and `data/puzzles.json` only through the verified generator.

**Interfaces:** Export `selectClues({schoolId, officialName, usablePool, date, config, categoryWeights}): {clues, diagnostics}` and `mergePublishedCalendar(existing, generated, today): Puzzle[]`. Existing filtering supplies `usablePool`, avoiding duplication of gameplay-feedback exclusions. Keep the current seed `CharterSchoodle-v1`, school-order algorithm, launch date `2026-05-07`, and 730-day horizon. Use `ncToday()` for the default date; preserve the existing `CHARTERSCHOODLE_TODAY` override for deterministic tests and validate it.

- [ ] **Step 1:** Write `same_name_token_prefers_alternative_sourced_clue`, `curated_difficulties_do_not_increase`, `sparse_pool_keeps_six_clues_and_reports_redundancy`, `published_objects_remain_identical`, `published_dates_missing_from_draft_are_kept`, and `same_inputs_have_identical_puzzles`. Use a Riverside-like fixture with two differently worded hints revealing the same token plus an alternative sourced slogan. Add assertions:

```js
assert.deepEqual(merged.filter(p => p.date <= today), existing.filter(p => p.date <= today));
assert.equal(output.clues.length, 6); // assembled five curated + letter hint
assert.equal(new Set(generated.map(p => p.date)).size, generated.length);
assert.equal(generated.every(p => schoolIds.has(p.answerSchoolId)), true);
```

- [ ] **Step 2:** Run `node --test tests/unit/puzzle-generation.test.js`; confirm new helpers/behavior are absent.
- [ ] **Step 3:** Extract only the changed selection logic. Recognize the two existing name-hint templates by normalized revealed token; prefer a remaining sourced clue when that token has already appeared. Use existing deterministic scores/tie-breakers for other choices. Sort the curated five by descending difficulty with a stable tie-breaker. If the pool cannot avoid redundancy, retain five curated clues and emit a structured `{schoolId, date, reason}` diagnostic. Append the unchanged first-letter hint. Merge existing records for dates through NC today and generated future records by date, then sort chronologically.
- [ ] **Step 4:** Run unit tests, snapshot current published records to a temporary file, run the generator, and compare published objects to the snapshot. Validate six clues, school IDs, and date uniqueness across the full calendar; sample the next 30 days for repeated hints and diagnostics. Run the same deterministic inputs again and require identical puzzle arrays, ignoring metadata timestamps. Inspect the data diff before committing.
- [ ] **Step 5:** Commit as `fix: preserve published puzzles and improve future clue order`.

### Task 11: Package public assets and consolidate deployment

**Files:** Create `scripts/stage-site.mjs`, `scripts/render-social-card.mjs`, `scripts/social-card.html`, `assets/social-card.png`, `tests/unit/deployment.test.js`; modify `index.html`, `.github/workflows/deploy-pages.yml`, `.github/workflows/refresh-puzzles.yml`, package/lock files, and deployment documentation in `README.md`; remove `.github/workflows/static.yml`.

**Interfaces:** Export `stageSite({root, outputDir}): Promise<string[]>` returning staged relative file paths. The CLI stages to `_site`. Export `renderSocialCard({baseUrl, outputPath, executablePath?})` for one 1200×630 PNG from a code-native brand template and the existing local logo. New metadata and share links use the same configured public URL; no callback query is copied.

- [ ] **Step 1:** Test `stage_contains_required_public_files`, `stage_excludes_private_and_research_artifacts`, `stage_fails_for_missing_required_asset`, `only_one_pages_workflow_exists`, and `refresh_calls_reusable_deploy_with_commit_sha`. Add an exact resolved YAML dev parser for semantic workflow tests rather than fragile text matching. Test staging in a temporary root containing deliberate decoy documents/untracked originals; assert none reach `_site`.
- [ ] **Step 2:** Run the deployment unit file; confirm the original duplicate workflows and absent staging helper fail.
- [ ] **Step 3:** Implement the allowlist: root `index.html`, `style.css`, `favicon.png`, `.nojekyll`; the known runtime `src/*.js` modules named in the parent contract and `src/supabase-config.js`; the three official vendor artifacts; `assets/csp-logo-2026.png` and `assets/social-card.png`; and only `data/schools.json` plus `data/puzzles.json`. Include `CNAME` only when present and verified for the intended domain. Exclude docs, tests, research clue banks, node_modules, `.git`, user originals, and temporary captures. Generate the preview once and add canonical/Open Graph/social metadata with correct image dimensions. Update entry-point and stylesheet cache versions so existing browsers receive the new release; visual review occurs in Task 12.
- [ ] **Step 4:** Retain `deploy-pages.yml` for main pushes, manual runs, and `workflow_call` with a revision input. Checkout `inputs.ref || github.sha`; run Node >=22 validation, vendor check, tests, and staging before Pages upload. Use one deployment concurrency group. Give the refresh job only the permissions it needs, emit the actual refreshed commit SHA after pushing, and call the same reusable deployment job with that SHA only when files changed. Grant Pages/id-token permissions to the calling deploy job as required; do not assume a bot push retriggers main deployment.
- [ ] **Step 5:** Run unit/database tests, `npm run vendor:check`, and `npm run stage`; inspect the returned manifest. Run the browser suite against `_site` as well as the development root, including a `/CharterSchoodle/` mount, to prove asset paths and callback entry work when packaged. Commit as `build: consolidate static release assets and Pages deployment`.

### Task 12: Verify the release and prepare activation

**Files:** Create `docs/public-launch-runbook.md`, `docs/release-readiness.json`, `scripts/check-release.mjs`, `tests/unit/release-readiness.test.js`; update `README.md`, `docs/leaderboard.md`, and the audit with final evidence and remaining blockers. Record artifacts outside the deploy bundle.

**Interfaces:** Export `evaluateReadiness(report, {mode, leaderboardEnabled}): {ready, blockers}` where mode is `code` or `public`. The CLI defaults to public; `--code` evaluates local completion only. Require status `passed` plus nonempty evidence for every required check. Code checks are unit, database, browser, vendor, staging, and visual. Production checks are backup/migration, live ownership smoke, domain/TLS, allowed callback, external-recipient email, and deployed smoke. Exit 0 when the requested mode is ready, 2 with named blockers otherwise; reject malformed reports. Public-ready also requires the actual frontend activation flag to be true. A report records observations, not assumed success.

- [ ] **Step 1:** Write `local_passes_do_not_imply_public_readiness`, `missing_production_evidence_stays_blocked`, `disabled_leaderboard_cannot_be_public_ready`, `passed_without_evidence_is_rejected`, and `complete_observed_report_can_be_ready`. Assert code mode can pass while public mode identifies missing email/database/domain evidence. These tests protect the distinction in the approved acceptance criteria.
- [ ] **Step 2:** Run the release-readiness unit file; inspect its expected missing-module failure, then implement the small evaluator/CLI with explicit field names above. Read the actual activation flag safely from the public config; never print keys or tokens.
- [ ] **Step 3:** Run final relevant automated suites and inspect results. Perform one batched visual/accessibility inspection at 320px, 390px, 768px, 1440px, desktop 200% zoom, reduced motion, and the social preview. Cover guest, a guessed round, win/loss, help/account dialogs, leaderboard, and map. Run Impeccable detect once against changed markup; verify findings in context and retain justified brand exceptions. Fix confirmed defects in one batch; perform at most one confirmation round. Do not start an open-ended polishing loop.
- [ ] **Step 4:** Write the concrete production runbook: inspect/backup live schema and policies; apply the tested migration; verify legacy counts and anonymous/owner-A/owner-B permissions; configure existing/owner-selected SMTP and allowed canonical callback URLs; test a link with an explicitly designated recipient; verify DNS/Pages/TLS; enable the flag; deploy once; smoke-test guest and account flows; record evidence. Include a guest-only rollback retaining both v2 and legacy data and never restoring unrestricted legacy writes. Mark unavailable production checks `blocked` with their observed reason; never fabricate access, test users, or email delivery.
- [ ] **Step 5:** Run `npm run check:release -- --code` and require exit 0 after recording actual local evidence. Run `npm run check:release`; expect exit 2 while production activation is unperformed and list the remaining blockers. Use Superpowers verification-before-completion and requesting-code-review before integration; the fresh reviewer examines the full diff against this plan/spec, including all three workstreams. Commit the release evidence/runbook as `docs: record launch verification and activation steps`. Report code readiness separately from public readiness, with the concrete rollout ready for owner review.
