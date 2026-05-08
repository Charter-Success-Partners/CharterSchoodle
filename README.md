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
- A statewide current-school master list built from official NC sources
- A statewide baseline clue bank generated from official NC sources
- Hand-authored validated clue batches for selected schools

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

GitHub Pages can serve this repo directly without a build tool.

## GitHub Pages Deployment

This project is set up to deploy as a public static site through GitHub Pages.

Files added for deployment:

- `.github/workflows/deploy-pages.yml`
- `.nojekyll`

To publish it:

1. Create a new public GitHub repository.
2. Push this project to the repository on the `main` branch.
3. In GitHub, open `Settings` -> `Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Pushes to `main` will deploy the site automatically.

The site URL will be:

- `https://<your-github-username>.github.io/<repo-name>/`

If you later want a custom domain, add a `CNAME` file at the repo root and configure the DNS in GitHub Pages settings.

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
3. Each puzzle uses five curated clues plus a final first-letter hint.
4. The scheduled GitHub Action runs every day and extends the published calendar forward.
5. The app loads the puzzle matching the visitor's current date from `data/puzzles.json`.

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
python3 scripts/merge_clue_banks.py
```

## Research Workflow

The statewide clue corpus is now complete. See [docs/research-plan.md](/home/caleb/projects/charterschooldle/docs/research-plan.md) for the research rules and batch structure used to build it.
