# CharterSchoodle

Static GitHub Pages implementation for a daily North Carolina charter-school guessing game.

## Current State

This repo currently includes:

- A no-build frontend in `index.html`, `style.css`, and `src/app.js`
- Local puzzle progress persistence in `localStorage`
- Daily mode plus archive mode
- Official-name autocomplete
- Clue accumulation across six guesses
- Guess feedback for enrollment band, grade-band direction, and map direction
- Local scoring plus a Supabase-backed company leaderboard for points, win streaks, and attempt streaks
- Optional verified email accounts with private scores and explicit public leaderboard consent
- A statewide current-school master list built from official NC sources
- A statewide baseline clue bank generated from official NC sources
- Hand-authored validated clue batches for selected schools

## Leaderboard

The protected v2 leaderboard is prepared with activation disabled in `src/supabase-config.js`. See [leaderboard documentation](docs/leaderboard.md).

- Guest play works immediately; profiles and email sign-in are optional.
- Verified accounts keep daily scores across devices, including private personal totals.
- Display names do not establish identity. Players explicitly choose whether to appear publicly.
- Only today’s guest result can be imported, with confirmation; older guest history stays local.
- Daily results are queued per account; archive play never changes rankings.
- Public rankings use an aggregate RPC with five players per page. Raw account data remains owner-only.
- The publishable Supabase key is public by design. Activation follows the reviewed rollout.

## Data Model

`data/schools.json`

- `id`
- `schoolCode`
- `agencyCode`
- `officialName`
- `city`
- `county`
- `address`
- `zip`
- `url`
- `charterDirector`
- `boardChair`
- `effectiveDate`
- `effectiveYear`
- `gradeSpanRaw`
- `enrollmentBand`
- `gradeBand`
- `adm2024`
- `coordinates.lat`
- `coordinates.lng`

`data/puzzle-source.json`

- `generatedAt`
- `notes`
- `generatorConfig`
- `stats`
- `puzzles[]`
- `puzzles[].date`
- `puzzles[].answerSchoolId`
- `puzzles[].clues[]`
- `puzzles[].clues[].difficulty`
- `puzzles[].clues[].text`

`data/clue-bank-batch-001.json`

- `schoolId`
- `officialName`
- `status`
- `sourceLinks`
- `clues[]`
- `clues[].text`
- `clues[].difficulty`
- `clues[].category`
- `clues[].sourceRefs`

`data/clue-bank-batch-002.json`

- same structure as `clue-bank-batch-001.json`
- extends the manually validated school set with additional official-site and reputable-source clue research

`data/clue-bank-batch-003.json`

- same structure as `clue-bank-batch-001.json`
- adds another manual batch compiled from official school websites

`data/clue-bank-batch-004.json`

- same structure as `clue-bank-batch-001.json`
- continues manual validation for schools with richer official public source material

`data/clue-bank-batch-005.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning arts, PBL, Waldorf, and multicultural school models

`data/clue-bank-batch-006.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch focused on inquiry, Montessori, experiential, and place-based models

`data/clue-bank-batch-007.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch focused on child-centered PBL, expeditionary learning, and innovation models

`data/clue-bank-batch-008.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch covering college-prep, STEAM, and community-governed charter models

`data/clue-bank-batch-009.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch covering classical, college-prep, and character-focused charter models

`data/clue-bank-batch-010.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning arts, NHA, CSUSA, and locally governed charter models

`data/clue-bank-batch-011.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch focused on values-driven and international charter models

`data/clue-bank-batch-012.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch focused on National Heritage Academies campuses in Clayton, Apex, Wake Forest, Summerfield, and Rolesville

`data/clue-bank-batch-013.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning NHA campuses, a CSUSA school, and a Glasser-model charter

`data/clue-bank-batch-014.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning classical, STEAM, local-governance, and NHA schools

`data/clue-bank-batch-015.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning NHA campuses and the Classical Charter Schools of America network

`data/clue-bank-batch-016.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning classical, leadership, IB, and project-based charter models

`data/clue-bank-batch-017.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning challenge-foundation, STREAM, and TMSA charter models

`data/clue-bank-batch-018.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning KIPP, nature-based, and CSUSA charter models

`data/clue-bank-batch-019.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning Movement Schools and TMSA charter models

`data/clue-bank-batch-020.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning innovation, college-prep, gifted, and character-education charter models

`data/clue-bank-batch-021.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning classical, leadership, mission-driven, and learner-centered charter models

`data/clue-bank-batch-022.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning accelerated-learning, STEM, and mission-driven charter models

`data/clue-bank-batch-023.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning immersion, experiential, community-rooted, and CSUSA charter models

`data/clue-bank-batch-024.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning Montessori, trade, arts-based, and community-driven charter models

`data/clue-bank-batch-025.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning college-prep, tribal, regional, and Montessori charter models

`data/clue-bank-batch-026.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning classical, prep, arts, and alternative-learning charter models

`data/clue-bank-batch-027.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning prep, STEM, classical, and community-centered charter models

`data/clue-bank-batch-028.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning community, classical, legacy, and college-prep charter models

`data/clue-bank-batch-029.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning rural, prep, leadership, and mission-driven charter models

`data/clue-bank-batch-030.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning legacy, Montessori, community, and college-prep charter models

`data/clue-bank-batch-031.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning college-prep, whole-child, rural, and mission-driven charter models

`data/clue-bank-batch-032.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning Montessori, arts-integration, place-based, and community-rooted charter models

`data/clue-bank-batch-033.json`

- same structure as `clue-bank-batch-001.json`
- adds another official-source manual batch spanning Montessori, classical, STEAM, and entrepreneurial charter models

`data/clue-bank-batch-034.json`

- same structure as `clue-bank-batch-001.json`
- completes the remaining statewide schools using official school websites where available and state-linked official roster metadata for sparse-site schools

`data/nc-charter-master-list.json`

- `generatedAt`
- `sourceSummary`
- `stats`
- `schools[]`

`data/geocoded-school-addresses.json`

- cached coordinates generated from official NC DPI school addresses
- used by `scripts/build_nc_charter_master.py` to populate `coordinates.lat` and `coordinates.lng`
- uses US Census Geocoder first and ArcGIS only for Census no-match addresses

`data/clue-bank-statewide-baseline.json`

- generated clue coverage for all schools in the current statewide roster
- uses state-linked charter map and SRC researcher files
- intended as a baseline, not the final quality target for every school

`data/clue-bank-statewide.json`

- merged statewide clue artifact
- baseline statewide clues plus curated manual batch overrides
- currently includes 212 manually validated schools from `batch-001` through `batch-034`
- includes a final completion batch for sparse-site schools so statewide coverage is complete

## Build Notes

Use Node 22 or newer and `npm ci`. Run `npm test`, `npm run vendor:check`, and
`npm run stage` before a release. Staging recreates `_site` and prints its exact
manifest. Only the explicit runtime allowlist ships: the HTML/CSS/favicon,
`.nojekyll`, seven application/config modules, three official vendor artifacts,
the local 2026 logo and social preview, and `schools.json`/`puzzles.json`.
Documentation, research, tests, dependencies, originals, and captures stay out.
A missing required asset fails staging before previous output is removed.

`npm run social:render` regenerates the committed 1200×630 preview using
`scripts/social-card.html`, the existing local logo, Open Sans from Google Fonts,
and `publicUrl` in `src/supabase-config.js`. It needs Playwright Chromium (or
`CHARTERSCHOODLE_CHROMIUM_PATH`) and font network access. The deployed site only
needs the committed PNG. Keep canonical, Open Graph, and Twitter metadata in
`index.html` aligned with that configured clean public URL; never copy callback
queries or tokens into metadata or result links.

## GitHub Pages Deployment

`.github/workflows/deploy-pages.yml` is the single Pages pipeline for pushes to
`main`, manual runs, and reusable `workflow_call` runs. It checks out
`inputs.ref || github.sha`, installs the exact lockfile with Node 22, validates
the vendor bundle, runs unit/database tests, and stages the allowlisted site
before uploading `_site`. All deployment runs use the `github-pages` concurrency
group without cancelling an active deployment. Configure GitHub Settings → Pages
→ Source to use GitHub Actions when the release is approved.

The intended canonical address is
`https://charterschoodle.chartersuccesspartners.com/`. No `CNAME` is currently
committed. If supplied, staging accepts it only when it exactly matches the host
in configured `publicUrl` (with a root URL path). That check establishes intended
configuration; DNS, Pages custom-domain/TLS configuration, and Supabase callback
allowlisting still require live verification during approved rollout.

Puzzle refresh checks out current `main` and has only `contents: write`. After a
successful push it emits the actual new commit SHA. Only changed files trigger
the reusable deployment job, which explicitly grants `contents: read`,
`pages: write`, and `id-token: write` and passes that SHA. This does not depend on
a bot push triggering another workflow. The caller does not acquire the Pages
concurrency lock, avoiding self-cancellation or a nested lock wait. See
[GitHub's reusable-workflow permission and concurrency reference](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations).

Run the full browser suite against all supported mounts after staging:

```bash
npm run test:browser
CHARTERSCHOODLE_TEST_ROOT=_site npm run test:browser
CHARTERSCHOODLE_TEST_ROOT=_site CHARTERSCHOODLE_TEST_PREFIX=/CharterSchoodle/ npm run test:browser
```

The harness starts a fresh local server for each run; `CHARTERSCHOODLE_TEST_PORT`
can override 4173. Account fixtures use the selected local base URL and intercept
only known Auth/v2 endpoints. Production Supabase traffic stays blocked.

## Daily Puzzle Automation

Daily puzzles are now generated automatically from the statewide clue bank.

Files involved:

- `.github/workflows/refresh-puzzles.yml`
- `scripts/generate-daily-puzzles.mjs`
- `data/puzzle-source.json`
- `data/puzzles.json`

How it works:

1. The generator builds a deterministic daily puzzle calendar starting on `2026-05-07`.
2. It rotates through schools with enough validated clue coverage and enough strong non-generic clues.
3. The schedule is quality-weighted, so stronger clue pools are favored earlier in the archive and similar school names are spaced out when possible.
4. Each puzzle uses five curated clues plus a final first-letter hint, with clue selection biased toward category diversity and a harder-to-easier reveal ladder across the five clue slots.
5. The scheduled GitHub Action runs every day and extends the published calendar forward.
6. The app loads the puzzle matching the visitor's current date from `data/puzzles.json`.

Daily quality rule:

- the full statewide clue bank now covers all 212 schools
- the automatic daily rotation now uses the broader validated pool after the `batch-034` completion schools were upgraded with stronger clue sets
- the current published calendar includes all 212 schools in the validated clue corpus because they now meet the generator's strong-clue threshold

To regenerate the daily puzzle calendar locally, run:

```bash
node scripts/generate-daily-puzzles.mjs
```

The current generated calendar includes 732 dated puzzles covering `2026-05-07` through `2028-05-07`.

To rebuild the statewide school master list and baseline clue bank from official source files already downloaded into the repo, run:

```bash
python3 scripts/build_nc_charter_master.py
python3 scripts/geocode_school_addresses.py
python3 scripts/build_nc_charter_master.py
python3 scripts/merge_clue_banks.py
```

## Research Workflow

The statewide clue corpus is now complete. See [docs/research-plan.md](/home/caleb/projects/charterschooldle/docs/research-plan.md) for the research rules and batch structure used to build it.
