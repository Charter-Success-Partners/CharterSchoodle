# Assessment A — independent design review

Target: CharterSchoodle, `/home/space/.codex/worktrees/0b66/CharterSchoodle`, HEAD `b16d773` (application bytes supplied as identical to deployed `bfdc42d`). Canonical site: https://charterschoodle.chartersuccesspartners.com/. Mode: Operate, with a playful daily-game purpose. This assessment used no prior critique or detector output.

## Design specificity verdict

The subject is specific; the composition is generic. The NC charter-school clues, recognizable school names, six-guess limit, and CSP green/sage identity give CharterSchoodle a sound product foundation. The screen expresses that foundation as a large administrative board: rounded white panels, equal-weight pill buttons, repeated statuses, and six nearly identical data-entry sections. Replace the school text with any other category and most of the interface would survive unchanged. It feels like a reporting tool for a game rather than a game for a community.

The strongest direction is a compact daily puzzle with one active clue, an immediately adjacent school picker, and a readable history of completed guesses. Keep CSP colors, Open Sans, and the school/community subject. Spend the visual emphasis on today's challenge, useful feedback, and the player's achievement. Simplifying the layout would create more character than additional decoration.

## Overall impression

The core loop is understandable once reached, but the screen makes the player work to reach it. The first guess input starts at document y=1,138 on a 1440×1000 desktop, y=2,093 on a 390×900 phone, and y=2,186 at 320×900. Five locked future rounds consume the space between the first clue and its action. Joining has a second structural problem: the promise is “Join leaderboard,” while the visible journey is sign in first and set up a profile later. These are task-design problems that color and spacing polish will not solve.

## Nielsen heuristic scores

All ten heuristics apply. Higher is better; 4 means excellent.

| # | Heuristic | Score / 4 | Main evidence |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Guess feedback and sync text exist, but email-sent keeps the original CTA and gives no complete joining progress; account repair is always exposed after sign-in. |
| 2 | Match system / real world | 2 | School-language clues work; “Company score,” “Daily leaderboard,” lifetime totals, and “Your Score” containing “212 pins” contradict the audience and task. |
| 3 | User control and freedom | 3 | Guest play, Close/Escape exits, private default, and result reopening are good. Draft joining is not presented as a continuous recoverable task. |
| 4 | Consistency and standards | 2 | A coherent color/control family is undercut by Join → Sign in → Create profile and competing green actions in the result dialog. |
| 5 | Error prevention | 3 | School selection constraints, duplicate-guess removal, and unchecked public consent are strong. The publication consent does not explicitly enumerate school/organization. |
| 6 | Recognition rather than recall | 2 | Feedback has text labels and autocomplete; clue and picker are separated by long unrevealed content, and completion crosses email and a later profile form. |
| 7 | Flexibility and efficiency | 1 | Keyboard support exists, but long mobile travel, a second setup form, and fragmented mobile rankings slow routine use. |
| 8 | Aesthetic and minimalist design | 2 | Consistent restrained palette and readable body text; inactive rounds, repeated headings, and system text dominate the active task. |
| 9 | Error recognition and recovery | 3 | Plain-language retry instructions and preserved profile inputs are positive. Email delivery/expiry recovery is not a distinct, reassuring UI state. |
| 10 | Help and documentation | 2 | A concise How to play dialog explains symbols; points, streak rules, enrollment bands, and leaderboard scope are not explained where needed. |
| **Total** | | **22/40** | **Acceptable band: significant improvements needed.** |

## What's working

1. **Guest play is immediate and optional identity is respected.** A new visitor can play without surrendering an email, public listing defaults off, and the copy says email and guesses stay private. Preserve this trust foundation.
2. **Feedback combines labels and symbols.** “Wrong school,” direction plus distance, and grade-span descriptions support learning without requiring color interpretation. The game has the ingredients for useful deduction.
3. **The existing identity is coherent enough to keep.** CSP green, sage, stone, Open Sans, the sponsor logo, and the simple six-clue proposition make a credible community game. Dialogs have labeled fields, explicit exits, and visible focus treatment; the reviewed states reflow without document-level horizontal overflow.

## Priority issues

### [P1] Joining is split into authentication and a surprise second setup

**Evidence:** `index.html:275` defines an email-only dialog. `index.html:288` defines a separate display-name/school/public-consent form. `src/app.js:1438` changes the same action from Join leaderboard to Create profile to Edit profile. `src/app.js:1494` automatically opens the profile form only when the email dialog is still open in that page. In the intercepted signed-in/new-user state, the page displays Create profile, Sign out, and Retry account sync above the puzzle, with “Create a profile to save your daily scores.” Screenshots: `join-320.png`, `join-email-sent-390.png`, `signed-in-no-profile-390.png`, `profile-390.png`.

**Why it matters:** The visitor expects joining to finish after confirming email. Instead, they must discover another action and supply identity/visibility preferences after leaving and returning. “Join leaderboard” can also end with a private account that does not appear on the board. The product's task boundary and the user's task boundary differ.

**Fix:** Use one “Join CharterSchoodle” form containing email, chosen display name, optional school/organization, and explicit unchecked public consent. Make the consent say “Show my display name, school or organization (if entered), and daily scores on the public leaderboard”; explain next to it that email and guesses stay private. Show the actual public preview. If today's guest result exists, offer a contextual “Save today's result with my account” choice; omit the irrelevant import block when no result exists. Submit with “Create account and send confirmation.” Change the panel to “Check your email” with the entered address, edit-address action, resend state/countdown, and reassurance that details are saved. Email confirmation should finalize the prepared profile and return directly to “You're ready” plus the saved result/leaderboard. A returning-player sign-in link can be secondary within this entry point. Preserve the same-browser confirmation restriction unless the authentication design is intentionally changed; explain it clearly and retain the draft safely through confirmation. No public listing or guest-result adoption may occur without the choices collected in the form.

**Suggested command:** `$impeccable onboard`, followed by `$impeccable clarify`.

### [P1] The active clue and guess action are separated by five empty rounds

**Evidence:** `src/app.js:459` always renders six complete round blocks, including “Clue locked until the next round,” “Guess Not played yet,” and four unplayed-feedback fields. `index.html:247` places the guess form after the whole board. `style.css:550` gives each future round full grid layout and padding. `guest-1440.png`, `guest-390.png`, `wrong-320.png`; measured first input section begins at y=1,138 / 2,093 / 2,186 on desktop / 390 / 320.

**Why it matters:** The largest part of the first screen communicates work that cannot be done yet. The phone user reads a clue, scrolls over five irrelevant sections, then guesses from memory. After an incorrect answer they must return to the next clue and repeat the travel. This damages the central daily habit more than any visual detail.

**Fix:** Put one active clue, “Guess 1 of 6,” school picker, and primary Guess button together in the first viewport. Render completed rounds as compact history with readable feedback. Represent future opportunities as a small six-step progress indicator or one “Five clues remaining” line. After a guess, reveal the next clue beside the same picker and announce the update; keep the most recent feedback visible. Keep all previous clues available without expanding future placeholders.

**Suggested command:** `$impeccable distill`, `$impeccable layout`.

### [P1] Mobile rankings sacrifice player identity to an eight-column table

**Evidence:** `index.html:202` uses eight columns; `style.css:730` wraps a full table in a horizontal scroller, and `style.css:1183` applies `overflow-wrap:anywhere` to every cell. In `leaderboard-390.png`, ordinary synthetic names break into fragments such as “Comm / unity / Membe / r,” school names wrap through many lines, and Win/Attempt/Avg sit outside the visible table. This does not require a maximum-length edge case.

**Why it matters:** Recognizing people and schools is the point of a community leaderboard. The current phone layout makes the most meaningful content the hardest to read, while empty personal stat cards and duplicate headings occupy the first screen above it.

**Fix:** On phones show rank, display name, school/organization, and the selected ranking metric in a readable list. Put other statistics in an expandable player detail or second line. Keep player and school text intact. On desktop retain a table with generous identity columns. Separate “Your stats” from “Community rankings”; make the ranking period and scoring rules explicit. Default to points with two secondary sorts; show the user's own place when available.

**Suggested command:** `$impeccable adapt`, `$impeccable layout`.

### [P2] The shell repeats status and decoration instead of establishing a game hierarchy

**Evidence:** The mobile sponsor/brand/nav block fills roughly the first 350px, followed by join controls/status, date, score, in-progress banner, Board, then the first clue. `index.html:38–124`, `index.html:128–161`; `style.css:1035` stacks the desktop brand and increases the mobile logo to 108px. Leaderboard repeats its name in the page heading, banner, and section heading; `src/app.js:426` says “Company score.” The shared score component reports map pins under “Your Score” (`src/app.js:437`).

**Why it matters:** The product feels administrative and verbose before it feels playful. It gives sponsor identification, navigation, account mechanics, and placeholder statistics nearly equal weight to the puzzle. The corporate language is especially wrong for the wider charter-school community.

**Fix:** Use a compact brand strip and a clear Today / Past puzzles / Leaderboard navigation; place Map and Help with puzzle assistance. Reduce account status to a small contextual account control. Let the daily clue carry the main type and space. Remove generic in-progress banners when they add no new information. Label actual state where it belongs: “Guess 1 of 6,” “Your daily stats,” “Community rankings,” and a map-specific school count. Choose one primary action in the result dialog; use a lighter close/back action.

**Suggested command:** `$impeccable distill`, `$impeccable typeset`, `$impeccable clarify`.

### [P2] The reference map loses geographic truth on phones

**Evidence:** `map-1440.png` is recognizably wide NC; `map-390.png` stretches the same state into a tall shape with overlapping pins. `src/app.js:759` sets the outline SVG to `preserveAspectRatio="none"`; `style.css:306` gives the map a tall viewport-dependent frame. Individual pin buttons are 18×18 (`style.css:428`) and clusters are dense.

**Why it matters:** Players use direction feedback to reason about the answer. Distorted geography undermines that reasoning and makes it difficult to target schools in Charlotte/Raleigh clusters.

**Fix:** Keep a fixed geographic aspect ratio/projection shared by outline and pins. Use zoom and pan within a responsive frame, add clustering or a searchable school list, and give selection a readable school detail panel. A list alternative must support the same reference task without traversing 212 tiny map pins.

**Suggested command:** `$impeccable adapt`, `$impeccable harden`.

No P0 was demonstrated: task completion remained possible in the simulated reviewed states. These P1 issues nevertheless merit addressing before expanding the audience.

## Current signup journey, precisely traced

1. Guest clicks Join leaderboard. The dialog asks only for email and says the player will choose public visibility, without collecting that choice.
2. Send sign-in link requests OTP. In the intercepted success state, the same form/CTA remains, with “Sign-in link requested. Check your email and open the link in this browser.” It does not become a purposeful verification step.
3. The actual callback uses PKCE and verified account identity (`src/auth.js:199`). Real email delivery and callback exchange were not exercised.
4. A signed-in account without a profile lands in a separate incomplete state. Source auto-opens profile setup only if the existing page's email dialog remains open; a fresh loaded page exposes Create profile. The synthetic signed-in state demonstrates that screen, not a real callback test.
5. The visitor separately supplies display name, optional organization, public listing, and guest-result adoption, then Save profile. Publication defaults off. Saving a private profile is valid, but its success is not the same outcome as the original “Join leaderboard” promise.

Recommended experience: **enter details once → confirm email → completed account/profile**, with the public visibility choice explicit before confirmation. “You're on the leaderboard” should appear only for confirmed public participation; private completion should say scores are saved privately and offer an optional public-listing action later.

## Cognitive load

**7 of 8 checklist items fail in at least one primary reviewed state: high cognitive load.** Grouping passes: individual round, form, and metric groups have clear boundaries. Single focus, chunking, hierarchy, one thing at a time, minimal choices, working memory, and progressive disclosure fail. The important distinction is that this is not a visually chaotic palette; it is too much irrelevant structure and too many task boundaries.

Decisions exceeding four visible alternatives/information units:

- The header offers five peers: Daily Puzzle, Past Puzzles, Leaderboard, Map, and Help; joining is a sixth nearby action. After sign-in, Create/Edit profile, Sign out, and Retry account sync add three more account actions to the same shell.
- The board presents six round sections simultaneously, with five unavailable choices/states rather than progressive disclosure. These are information units, not clickable options.
- The ranking scan asks the visitor to interpret eight columns: Rank, Player, School, Pts, Solved, Win, Attempt, Avg. The three sort options themselves are within the limit.
- The public-profile form asks the visitor to reason about identity, optional affiliation, publication, and guest-import provenance after an email context switch. Those choices can fit one well-grouped form; the later surprise step is the problem, not simply the field count.

## Emotional journey

**Arrival:** credible CSP branding and a clear six-guesses proposition create curiosity. **First action:** curiosity drops while the player scrolls through unplayed rounds to reach the school picker. **Wrong guess:** plain feedback is useful, but the next clue and input remain distant; occasional unavailable enrollment feedback can feel like the game withholding help. **Win:** the congratulatory dialog, named answer, share-safe copy, and reduced-motion accommodation create a positive peak. Two green actions and a generic “Keep Browsing” ending dilute the next step. **Join:** the momentum falls during the mailbox switch and the new profile task; completion feels administrative. End the journey with the player's saved result and a clear confirmed account/public status.

## Persona red flags

**Jordan, first-timer:** Takes “Join leaderboard” literally, sees only an email form, then discovers Create profile. Reads “Company score” and cannot tell whether the game is intended for CSP employees. Must infer the score/streak rules and whether daily rankings reset or accumulate.

**Casey, distracted phone user:** Reads the first clue and must scroll over 1,400 additional document pixels to the input at 390px width. Switching to mail interrupts an already split joining journey. Rankings split community names into fragments; the school map becomes tall and crowded. This user needs the active clue, answer input, and most recent feedback together.

**Sam, keyboard/low-vision user:** Labeled feedback, visible focus, dialog exits, and keyboard autocomplete are strengths. The repeated unplayed states lengthen linear reading/navigation; a map with 212 individual tiny pin targets lacks an obvious searchable alternative. A good implementation should retain these accessibility positives while reducing structure, then validate the revised active-clue and confirmation announcements with assistive technology. No screen-reader conformance claim is made from screenshots alone.

## Minor observations

- Today's guest-result import block appears even when there is no result, burdening a new account with provenance/conflict copy that cannot help them yet.
- Retry account sync is shown for all signed-in states, even when there is no observed error. Place repair actions with a failure notice or account menu.
- Help explains the symbol vocabulary but not points per guess, streak definitions, or the precise meaning of size “band.” Add concise rules next to relevant scores/feedback.
- The email-submit button is disabled during resend cooldown without showing a countdown or a changed label; in the synthetic sent screenshot it still looks like the original green primary action.
- Heading typography uses a platform-dependent Century Gothic/Apple Gothic/Avant Garde stack while body text uses Open Sans. The current Linux rendering is a heavier generic sans; choose a deliberate dependable heading treatment within the approved identity.
- The result dialog is a stronger place to invite score saving than persistent pre-game account prose, provided guest play stays frictionless.

## Questions to consider

1. Should success mean “I played today's game,” “my result is saved,” or “I recognize my community on the board”? The screen should make those three moments distinct and support them in that order.
2. Can every first-time phone visitor see the current clue and submit a guess without passing an unrevealed round?
3. Can confirming email be the last required joining action, with the exact public name/school preview approved beforehand?

## Evidence and review limits

One bounded visual batch used fresh isolated Playwright contexts, real committed school/puzzle data for 2026-10-15, Open Sans successfully loaded, desktop 1440×1000, and phones 390×900 / 320×900. Account identity, rankings, OTP success, and profile persistence were synthetic intercepted responses at `fixture.supabase.invalid`. Production Supabase traffic was blocked by a catch-all external-host rule; no real mail, account writes, database edits, or Auth changes occurred. No uncaught browser exceptions occurred. All reviewed screenshots and measured geometry are in `/tmp/charterschoodle-impeccable-A/`; raw capture metadata is `evidence.json`. Browser was closed in a `finally` block. Static-server session `54254` on port 4291 was stopped with Ctrl-C and exited 130. Product files were not edited. No deterministic detector was run or read for Assessment A.

Selected captures: `guest-1440.png`, `guest-390.png`, `wrong-320.png`, `leaderboard-1440.png`, `leaderboard-390.png`, `join-320.png`, `join-email-sent-390.png`, `signed-in-no-profile-390.png`, `profile-390.png`, `profile-320.png`, `help-390.png`, `result-win-390.png`, `map-1440.png`, `map-390.png`, and `archive-390.png`.

Full-page captures of open dialogs include document space beyond the viewport; the backdrop ending at the viewport boundary is a capture artifact and is not reported as a product defect.
