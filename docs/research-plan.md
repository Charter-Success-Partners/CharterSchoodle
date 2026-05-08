# CharterSchoodle Research Plan

## Goal

Compile a playable clue bank covering all current North Carolina charter schools using the latest publicly available information, while avoiding fragile clue wording where possible.

## Output Structure Per School

Each school should eventually have:

- Core identity metadata
- Official full name
- City
- County
- Latitude and longitude
- Enrollment band
- Grade band
- Source links
- A clue bank of at least 8 to 12 candidate clues
- Difficulty score per clue from 1 to 10
- Notes about clue freshness risk

## Source Priority

1. Official school website
2. NC DPI or state report-card pages
3. Governing-board pages or posted board documents
4. School athletics pages or conference sites
5. Reputable local coverage when official sources do not cover a clue category

## Current Canonical Source Stack

- NC DPI charter schools page and linked charter map for the current statewide operating roster
- NC School Report Cards researcher dataset for school metadata and ADM counts
- Official school websites for higher-quality school-specific clue authoring

## Clue Categories

Use flexible categories based on availability:

- Mission, focus, or specialty
- Founding year or years in operation
- Principal, executive director, or school leader
- Board member wording framed historically when needed
- Athletics, awards, or championships
- Campus structure or grade span
- City, county, or regional identity
- Mascot, house system, theme, or signature program

## Freshness Rules

- Prefer stable clues when two options are equally good.
- For volatile facts, frame clues historically when possible.
- Record the source URL and access date for every clue.
- Exclude schools from the playable set until there is enough verified data.

## Clue Exclusions

- Do not write clues that reveal enrollment size or enrollment band.
- Do not write clues that reveal grade span or school configuration.
- Do not write clues that reveal directional or proximity information that overlaps with compass feedback.
- Treat size, grades, and direction as gameplay feedback channels, not clue categories.

## Batch Execution Plan

1. Build the canonical statewide school list.
2. Add baseline metadata for every school.
3. Add coordinates and compute compass-ready geography.
4. Generate baseline statewide clues from authoritative statewide fields where direct school-site research is not yet complete.
5. Research richer clue candidates in county or region batches.
6. Score clue difficulty and flag stale categories.
7. Review clue quality for ambiguity and duplicate patterns.
8. Promote vetted schools into the daily-puzzle pool.

## Suggested Batch Size

- 15 to 25 schools per research pass
- One region or county cluster at a time

## Validation Checklist

- Official full name matches source documents
- Enrollment band is present
- Grade band is present
- Coordinates are present
- At least 6 publishable clues exist
- At least 3 clues are relatively stable
- Puzzle clue wording does not directly reveal the answer too early
