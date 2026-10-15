# CharterSchoodle public-launch audit

Reviewed October 15, 2026. Audience confirmed by the owner: the wider North Carolina charter-school community. The shared leaderboard should remain available with protected player identities.

This report records the current implementation and observed behavior. It is not an approved implementation design. No production data, authentication configuration, or database policies were changed.

## Assessment

The existing CSP identity and daily-game structure provide a coherent foundation. The core game works, but phone layout, first-visit behavior, accessibility, resilience, and leaderboard ownership need attention before public release.

| Dimension | Score | Evidence |
| --- | --- | --- |
| Accessibility | 1/4 | Modal focus escapes into the page; autocomplete lacks combobox semantics; several text colors fail normal-text contrast. |
| Performance | 3/4 | No frontend framework or build dependency; initial puzzle and school JSON total approximately 1.16 MB before compression. |
| Responsive design | 1/4 | A 390px phone emulation produces a 571px layout viewport; the score form overflows and the clue column becomes difficult to read. |
| Theming | 2/4 | CSP tokens establish a consistent palette, but component colors and transparency are repeated outside semantic tokens. A dark theme is not a launch requirement. |
| Implementation integrity | 3/4 | Product-specific game, map, and branding are present. Archive behavior contradicts its label, and two workflows independently deploy the site. |
| Total | 10/20 | Significant work needed before sharing publicly. |

Implementation integrity verdict: a coherent product with specific defects to address. Replacing its visual identity is unnecessary for this release.

## Checks performed

- Reviewed `index.html`, `style.css`, game and leaderboard logic, database bootstrap SQL, documentation, and deployment workflows.
- Inspected the rendered page at 1440px desktop and 390px phone dimensions in local headless Chromium.
- Verified correct-answer completion, six-guess loss, input locking after completion, and restoring a loss after reload.
- Tested keyboard focus through the first-visit profile dialog.
- Tested browser storage being unavailable.
- Validated all 212 school IDs and all 881 dated puzzles: unique dates, valid school references, and six clues per puzzle.
- Ran `node --check src/app.js` successfully.
- Ran the Impeccable detector once against `index.html`: 31 findings across eight rule categories.
- Blocked all Supabase requests in browser testing. No test scores were submitted.

The live Supabase policies, email delivery settings, deployed domain, assistive-technology output, and real-device behavior were not verified. Findings about database authorization below describe the checked-in SQL and client identity model.

## Findings by priority

Eight P1 findings and three P2 findings are recorded below. No P0 failure was observed in the normal-storage core-game walkthrough.

### P1: Phone layout overflows and makes clues hard to read

**Location:** `style.css`, `.header-score`, `.game-board`, and the 900px media query.

The score header retains grid columns with a minimum 360px profile form alongside the summary and guess counter. On phone emulation, a 342px score header has 547px of scrollable content; the page expands to 571px. The game table compresses the clue into a narrow column. This makes the primary task difficult on phones.

**Recommendation:** Reflow the score area at small widths, move profile editing out of the game header, and give each mobile round a readable clue and feedback arrangement. Maintain the existing desktop game flow and saved progress. Use Impeccable `adapt`, then `layout`.

### P1: A new visitor must provide a profile before playing

**Location:** `src/app.js`, `showProfilePromptIfNeeded`; `index.html`, `#profile-overlay`.

The first visit opens a required name-and-school dialog without a dismiss button. It does not explain that the information will identify public leaderboard entries. Visitors cannot try the game before providing information.

**Recommendation:** Let visitors play immediately and make joining the public leaderboard an explicit choice. Explain which profile fields are public. Keep email private. Use Impeccable `onboard` and `clarify` after the authentication design is approved.

### P1: Dialog and autocomplete accessibility are incomplete

**Location:** `index.html`, profile and win dialogs, `#school-guess`, `#autocomplete-list`; `src/app.js`, dialog and suggestion handlers.

Tabbing from the required profile dialog reaches the page behind it. The dialog lacks Escape dismissal and focus restoration. The autocomplete supports arrow keys but does not expose combobox/listbox roles, expanded state, selected option, or active descendant. Status changes lack a live region. Help and map zoom buttons are also below the 44px touch-target quality target.

**Recommendation:** Implement consistent dialog focus handling, an accessible autocomplete interaction, announced status updates, visible focus, and comfortable touch targets. Verify the complete flow with keyboard input. Use Impeccable `harden` and `adapt`.

### P1: Past Puzzles opens a future answer

**Location:** `src/app.js`, `initializeArchiveBounds`, `setMode`.

The archive selects the final generated calendar date instead of the most recent eligible past date. On October 15, 2026, Past Puzzles opens October 3, 2028. Future puzzles are selectable in the date field.

**Recommendation:** Restrict archive selection to published past dates, validate the selected date in application logic, and define a consistent North Carolina daily rollover. Use Impeccable `harden` for the archive state and copy.

### P1: Unavailable browser storage prevents play

**Location:** `src/app.js`, profile, scorebook, and progress storage helpers.

Several storage reads and writes occur outside error handling. When access to `localStorage` throws, startup displays `App failed to load: Access blocked` and the game never becomes playable.

**Recommendation:** Make persistence best-effort with in-memory fallback. Tell players when progress will last only for the current session. Validate recovered data before using it. Use Impeccable `harden`.

### P1: Leaderboard identity does not establish ownership

**Location:** `src/app.js`, `profileIdForNameSchool`, `upsertRemoteLeaderboardRecords`; `docs/supabase-leaderboard.sql`, anonymous grants and update policy.

The client derives identity from the public name and school, so entering matching information claims the same identity. The checked-in SQL grants anonymous insert/update access and uses an unrestricted update `using (true)` policy. If deployed as written, callers are not limited to updating their own results.

**Recommendation:** Introduce authenticated player ownership and enforce it in database policies. Preserve historical records during migration; do not automatically transfer old entries solely because a public name and school match. Inspect the live schema before applying a migration. This is an architectural change requiring a reviewed design, not a CSS fix.

The publishable Supabase key is intentionally public and is not itself this defect. Authorization must be enforced by the backend. See [Supabase row-level security documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

### P1: Small functional text has insufficient contrast

**Location:** `style.css`, sage-colored labels, table headers, active navigation, and button treatments.

The detector reports eight low-contrast occurrences. The solid sage/white pair is approximately 3.5:1, below the 4.5:1 normal-text target. Small labels and table headings compound the readability problem.

**Recommendation:** Preserve the CSP palette while introducing darker text and control variants, larger functional labels, and consistent focus treatments. Verify actual rendered states; gradient contrast requires visual confirmation. Use Impeccable `colorize`, `typeset`, and `polish`.

### P1: Two workflows deploy different site contents

**Location:** `.github/workflows/deploy-pages.yml`; `.github/workflows/static.yml`.

Both workflows run on pushes to `main`, use different concurrency groups, and publish to Pages. One stages explicit public assets; the other uploads the entire repository. This leaves competing deployment paths with different published contents.

**Recommendation:** Retain one deployment path that stages only intended site assets, includes any newly required branding/sharing assets, and runs appropriate validation. Verify the custom-domain configuration and scheduled puzzle-refresh deployment behavior before release.

### P2: Completion has no result-sharing action

**Location:** `index.html`, win dialog and document metadata; `src/app.js`, completion flow.

Winning provides a summary and Keep Browsing button, but no spoiler-free share action. The page has a basic description but no explicit social-preview metadata.

**Recommendation:** Add a shareable result for both wins and losses, with clipboard fallback and clear success/failure feedback, plus accurate social metadata. Use Impeccable `clarify` and `polish`.

### P2: Loading failures provide limited recovery

**Location:** `src/app.js`, `loadData`, `supabaseRequest`, and the final startup catch.

Game-data requests do not check HTTP status before parsing. Startup failures expose the underlying error string and provide no retry action. Remote sync errors do preserve locally saved results, which should be retained.

**Recommendation:** Add clear loading and retry states, preserve playable local state when leaderboard services fail, and prevent stale asynchronous responses from overwriting newer UI state. Use Impeccable `harden` and `clarify`.

### P2: Some clues repeat the same information

**Location:** `data/puzzles.json`, October 15, 2026 puzzle.

The fourth and fifth clues both reveal the word Riverside. All puzzles passed the exact-duplicate text check, but this example demonstrates that different wording can still repeat the same information. The fifth clue is also marked harder than the fourth.

**Recommendation:** Review generator selection for semantic redundancy and reveal order, then sample upcoming puzzles before broad sharing. Avoid rewriting sourced factual school claims without validating their sources.

## Detector interpretation

Counts: 8 low contrast, 15 undersized functional text, 3 tight leading, 2 cramped padding, and one each for all-caps body text, overused font, and nested cards.

These are leads, not 31 confirmed release blockers. Open Sans is part of the incumbent brand treatment; its popularity is not a defect here. Flush table wrappers and grouped score panels can be intentional. Short uppercase brand attribution is lower priority than the verified phone, ownership, and accessibility failures.

## Recommended order

1. Approve the public-play and protected-leaderboard design, including handling historical scores.
2. Implement and verify identity ownership, database policies, and authentication recovery.
3. Apply Impeccable `adapt`, `onboard`, `harden`, and `clarify` to the verified game flows.
4. Consolidate deployment and validate date, persistence, and data behavior.
5. Finish with Impeccable `polish` and one batched desktop/phone inspection followed by at most one confirmation pass.

Email-based sign-in additionally requires working production email delivery and approved redirect URLs. Supabase's built-in email service is not intended for public production use; inspect the current project configuration before selecting or changing a provider. See [passwordless authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

The next design checkpoint should distinguish player ownership from anti-cheat guarantees. The current static application publishes its answer calendar and calculates scores in the browser. Protecting other players' entries does not, by itself, prove that a player's own submitted score is honest.

## Final implementation verification — October 15, 2026

The findings above describe the original baseline. The candidate release now has optional account
entry, safe guest persistence, NC-day archive bounds, protected account ownership with legacy
lockdown, local official SDK assets, future-only clue refinement, and one explicit Pages artifact path.
The complete [dated evidence record](launch-evidence/2026-10-15/README.md) includes fresh automated
logs, the final visual batch/confirmation, measurements, detector dispositions and screenshots.

Fresh verification after final review fixes: 115 unit tests and 25 database tests passed; vendor bytes matched the official
pin; staging produced the independently byte-verified 18-file allowlist. Full browser suites exercise
development root, packaged root and `/CharterSchoodle/` (74/74 each); see the `final-fix-*` logs in the evidence record. The final fixes serialize same-account privacy saves, keep guest completion/sharing available without backend configuration, and show daily awards. Deferred share/clipboard completion tests protect a reopened dialog. Earlier automated evidence predates these regressions.
The final visual inspection covers 320/390/768/1440px, desktop 200% equivalent reflow, reduced motion,
guest/guessed/win/loss/help/account/ranking/map states and the actual social PNG. Two undersized font
rules were raised to 12px in one fix batch, followed by one confirmation. Primary targets meet 44px,
text inputs 16px, measured settled text pairs 5.25:1 or higher, and all captures avoid page overflow.
Dense map pins remain 18px secondary spatial targets with keyboard/zoom support; this is a documented
limitation, not an all-target accessibility certification. Brand typography and brief contextual
uppercase labels remain deliberate exceptions. No additional polishing loop occurred.

Public activation is **not complete**. A verified HTTPS HEAD returned HTTP 200 at the canonical
domain; this observes the existing GitHub-hosted site only. No production backup/migration, live
A/B ownership test, Auth callback/SMTP settings inspection, designated-recipient delivery, or deployed
smoke of this revision was performed. The actual activation flag remains false. See the machine-readable
[readiness record](release-readiness.json) and concrete [owner runbook](public-launch-runbook.md) for
remaining gates and data-preserving rollback. Local checks do not claim live authorization or delivery.
