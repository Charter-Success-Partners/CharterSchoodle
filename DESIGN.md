---
name: "CharterSchoodle"
description: "A compact daily school game in the established Charter Success Partners identity."
colors:
  csp-green: "#8fd169"
  csp-green-deep: "#2e7c01"
  csp-sage: "#4c6970"
  csp-slate: "#365b5e"
  csp-stone: "#585551"
  csp-stone-soft: "#b5b1a9"
  csp-cream: "#f7f8f4"
  csp-white: "#fff"
  csp-sun: "#e8e6a6"
  surface-secondary: "#eef2ed"
  line: "#dce2d8"
  text-strong: "#303e35"
  error: "#903b2b"
  primary-hover: "#245f05"
  primary-active: "#1c4a03"
  navigation-active: "#e6ece8"
  feedback-good: "#e3f1db"
  feedback-bad: "#f8e9e4"
  feedback-warn: "#f4efdb"
  feedback-warn-ink: "#716018"
  selection-ink: "#234d18"
  selection-ground: "#caeab7"
typography:
  display:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.3
  headline-mobile:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  clue:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: ".875rem"
    fontWeight: 600
    lineHeight: 1.4
  support:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: ".875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Open Sans, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
rounded:
  icon: "4px"
  navigation: "6px"
  control: "8px"
  md: "12px"
  lg: "16px"
spacing:
  "4": "4px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "18": "18px"
  "20": "20px"
  "22": "22px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
  "48": "48px"
components:
  button-primary:
    backgroundColor: "{colors.csp-green-deep}"
    textColor: "{colors.csp-white}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-secondary:
    backgroundColor: "{colors.csp-white}"
    textColor: "{colors.csp-slate}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-secondary}"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.csp-sage}"
    typography: "{typography.label}"
    rounded: "{rounded.navigation}"
    padding: "10px 14px"
  navigation-active:
    backgroundColor: "{colors.navigation-active}"
    textColor: "{colors.csp-slate}"
  sort-chip:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.csp-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  sort-chip-active:
    backgroundColor: "{colors.csp-sage}"
    textColor: "{colors.csp-white}"
  input:
    backgroundColor: "{colors.csp-white}"
    textColor: "{colors.text-strong}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.csp-white}"
    rounded: "{rounded.lg}"
    padding: "28px"
  panel-mobile:
    padding: "16px"
  status:
    backgroundColor: "{colors.surface-secondary}"
    rounded: "{rounded.md}"
    padding: "14px 16px"
  dialog:
    backgroundColor: "{colors.csp-white}"
    textColor: "{colors.csp-stone}"
    rounded: "{rounded.lg}"
    padding: "28px"
    width: "min(540px, calc(100% - 24px))"
  feedback-good:
    backgroundColor: "{colors.feedback-good}"
    textColor: "{colors.primary-hover}"
    rounded: "{rounded.icon}"
    size: "1.5em"
  feedback-bad:
    backgroundColor: "{colors.feedback-bad}"
    textColor: "{colors.error}"
    rounded: "{rounded.icon}"
    size: "1.5em"
  feedback-warn:
    backgroundColor: "{colors.feedback-warn}"
    textColor: "{colors.feedback-warn-ink}"
    rounded: "{rounded.icon}"
    size: "1.5em"
---

# Design System: CharterSchoodle

## Overview

**Creative North Star: "The CSP Daily Game"**

The CSP Daily Game carries the supplied Charter Success Partners logo, Open Sans, and the established green, sage, stone, cream, and white palette into a compact, practical interface. Quiet surfaces and a clear size-and-weight hierarchy give real school content and the next action priority.

The system is flat at rest: one main white panel, tonal state surfaces, and thin dividers organize the work. Small authored SVGs explain controls and feedback alongside readable labels. The brand comes from its existing identity assets, color, and type; it does not require a new illustrative world.

**Key Characteristics:**

- Compact task-first composition with readable supporting text.
- Deep green primary actions; sage secondary actions and navigation.
- Restrained curved corners, tonal feedback, and divider-led lists.
- Native controls, visible focus, and deliberate mobile reflow.

## Colors

The established CSP palette combines a decisive green action color with cool sage/slate navigation and warm stone text on cream and white.

### Primary

- **CSP deep green** (`csp-green-deep`): primary buttons, links, input carets, current attempts, correct attempts, and map dots. Hover and pressed shades deepen the same action.
- **CSP fresh green** (`csp-green`): retained brand accent and result celebration; it is not the body-text color.

### Secondary

- **CSP sage** (`csp-sage`): navigation, section labels, selected sort controls, and secondary outlines.
- **CSP slate** (`csp-slate`): secondary button text, focused outlines, selected map dots, and neutral feedback.

### Tertiary

- **CSP sun** (`csp-sun`): a retained celebration accent.
- **Error clay** (`error`): failed account actions and incorrect comparison ink. Good, bad, and warning feedback have separate pale grounds and explicit labels.

### Neutral

- **Cream / white** (`csp-cream`, `csp-white`): page ground and primary surface.
- **Stone / soft stone** (`csp-stone`, `csp-stone-soft`): body text and input borders.
- **Strong text** (`text-strong`): headings, school names, input values, and primary figures.
- **Secondary surface / line** (`surface-secondary`, `line`): status grounds, selected finder rows, dividers, and panel borders.
- **Navigation active** (`navigation-active`): active and hovered view tabs and played attempts.
- **Selection ink / ground** (`selection-ink`, `selection-ground`): native text selection. Keep the caret and scrollbar visible as authored.

**The Task Green Rule.** Use deep CSP green for the primary action and current or successful game state; keep secondary actions in sage or slate.

## Typography

**Display Font:** Open Sans, with Arial and sans-serif fallbacks.
**Body Font:** The same family. The page requests weights 400, 600, and 700.

**Character:** Familiar, readable, and restrained. Sentence-case labels and a small hierarchy serve play and community identity rather than a large marketing headline.

### Hierarchy

- **Display:** the app name uses `display`; at the mobile breakpoint its size becomes the headline size while retaining the display line height and tracking.
- **Headline:** panel and dialog titles use `headline`; mobile h2 uses `headline-mobile`.
- **Title:** clue and section headings use `title`. History subheadings use the support size and bold weight.
- **Clue:** the active clue uses `clue`, limited to 68ch; on mobile its font size becomes the body size while retaining its generous line height.
- **Body:** `body` is the default for page text, fields, and inherited button text. Shared action buttons use weight 600 and line height 1.4.
- **Label / support:** `label` serves compact controls; `support` serves explanatory text, affiliations, statuses, and metric captions. Mobile sort controls use .8125rem. The small “You” annotation uses .75rem.
- **Figures:** counters, ranking metrics, score totals, pagination, map zoom, and definition values use tabular numerals. Ranking figures use 1.25rem, reducing to 1.125rem on mobile; personal totals use 1.375rem.

**The One Family Rule.** Use Open Sans throughout the interface; establish hierarchy with size, weight, and spacing.

## Layout

The outer shell is centered at a maximum width of 1100px with 20px side gutters. The main task column is capped at 840px. The header arranges logo/name and direct navigation side by side; at 1000px and below it wraps and gives navigation a full row. The supplied logo is contained at 66 × 50px, becoming 50 × 42px on mobile.

At 600px and below the shell uses 12px side gutters, the panel uses the mobile padding token, navigation wraps, and the guess field stacks above a full-width submit button. Account status takes a full row. Clue, identity, and feedback text wrap rather than truncate. Reused spacing steps in frontmatter describe the actual gaps and margins; they are extracted values rather than a new imposed scale.

Rankings use rank / flexible identity / selected-metric columns (28px / minmax(0, 1fr) / 90px), becoming 20px / minmax(0, 1fr) / 64px on mobile, with gaps reducing from 12px to 8px. Expanded stats reflow from three to two columns; personal totals reflow from four to two. Round feedback uses auto-fit columns with a minimum bounded by the available width and 8em. The help key changes from two columns to one.

The map keeps its geographic aspect ratio, calculated from longitude span, latitude span, and midpoint-latitude cosine. Outline and pins share the same projection and 4% padding. Zoom scales the shared canvas; pin scale is inversely adjusted so targets remain the same visual size. The finder remains directly below the map. Dialogs are bounded by the viewport with scrolling inside, a 540px maximum width, and 12px outer clearance; mobile padding is 22px vertically and 18px horizontally.

## Elevation & Depth

White panels, cream ground, pale state surfaces, and thin borders establish depth without raised cards. Dialogs use the sole ambient shadow (`0 24px 60px rgba(25,45,30,.24)`) and a dim backdrop (`rgba(30,44,36,.58)`). Sort hover uses a 1px inset sage outline rather than elevation. Autocomplete sits above the normal flow at z-index 5; map tooltips layer near the selected point.

**The Flat Surface Rule.** Keep page panels and list rows flat; reserve the ambient shadow for dialogs.

## Shapes

Use the extracted radius roles: broad panel/dialog corners (`lg`), status/map corners (`md`), control and tooltip corners (`control`), compact navigation corners (`navigation`), and feedback squares (`icon`). Borders and dividers are generally 1px; attempt underlines are 2px. Map dots are circles with white 1px borders. Finder rows are square-edged and separated by lines, not standalone cards. Confetti has small 3px corners as a celebration-specific detail, not a general surface token.

## Components

### Buttons

Primary actions are deep green with white type; secondary actions are white with slate type and a thin line-colored border. Shared action padding, hover, and pressed variants are in frontmatter. Buttons, inputs, and summaries have a 44px minimum height, and non-pin buttons have a 44px minimum width. Disabled buttons keep their place, use opacity .58, and lose the pointer cursor. Help and zoom buttons are 44px squares. View navigation is compact and lightly rounded, with sage text, a pale active ground, a sage bottom border, and `aria-pressed` state.

All interactive controls use a 3px slate `:focus-visible` outline with 3px offset. Normal button color transitions last 160ms with ease-out. Keep focus treatment alongside hover; do not substitute hover styling for keyboard feedback.

### Chips

Sort chips are buttons for Points, Win Streak, and Attempt Streak. Pale secondary ground becomes sage with white text when selected; hover adds an inset sage outline. The selected sort has `aria-pressed`, resets pagination to the first page, and determines the visible row metric. These are functional sort controls rather than decorative tags.

### Cards / Containers

The main white panel has a thin line border and the `panel` tokens; statuses use the secondary ground. History, ranking rows, map details, and personal statistics rely on spacing and dividers. Avoid multiplying panel shells around every content unit.

### Inputs / Fields

White inputs use strong text, a soft-stone border, the body size, deep-green caret, and the shared visible focus outline. Placeholders retain stone text at full opacity. Explicit labels remain visible above fields. Help text explains selection, privacy, validation, or recovery without replacing the label. Account forms use 12px grid gaps and 8px field-group gaps. Privacy checkboxes use 24px controls inside 44px-tall labeled rows with the green accent.

The school picker is a labeled combobox with a listbox, active descendant, selected option, and polite suggestion status. Options are at least 44px high, wrap names, and use a pale hover/active ground. The scrollable list is bounded by the smaller of 280px and 40dvh. Arrow keys move selection, Enter selects, and Escape closes; already-guessed schools are excluded.

### Navigation

Daily Puzzle, Past Puzzles, Leaderboard, and Map are direct view buttons beside findable help. Active state is communicated through pressed semantics, text, ground, and underline. Mobile navigation wraps into available space; account controls occupy a separate compact line below the header.

### Active game and history

A six-step ordered attempt indicator precedes the real active clue and adjacent picker. The current attempt has an underlined green state and an accessible current-step label. Only completed guesses produce history rows. Each row repeats its actual clue and school, then labels Result, Size, Grades, and Direction feedback. Incorrect submission advances the clue, clears the picker, and returns focus to the input when play remains open. A polite status explains the outcome. Solved or six-used games hide the active clue and lock guessing; results remain reopenable. Archive dates are prior puzzles and clearly identified as practice without daily scoring.

The clue update uses a 220ms background fade with cubic-bezier(.16,1,.3,1); content is visible by default. Celebration confetti is decorative and contained in the result dialog; its authored fall has linear timing, with runtime durations of 1400–2600ms. Reduced-motion preference disables animations and transitions, restores automatic scroll behavior, and hides confetti.

### Feedback SVGs

Icons are authored inline SVG geometry with a 24 × 24 viewBox, currentColor stroke, 1.8 stroke width, and round caps/joins. Check, cross, equality, span, location, help, map controls, and rotated directional arrows share this vocabulary. Small dot geometry uses a currentColor fill. SVGs are `aria-hidden` and nonfocusable because visible adjacent text or the native button name supplies meaning. Feedback containers use pale semantic grounds and never rely on icon/color alone. Do not replace the SVG system with glyph-shaped text.

### Community rankings

An ordered list presents five public entries per page, with intact names, optional affiliations, rank, and the chosen metric. Native Score details disclosure reveals all allowed aggregates. A small “You” annotation identifies the player's listed public entry. Personal daily totals live in a separate collapsed disclosure. Loading sets `aria-busy`; empty, unavailable, guest, private/unlisted, first-score, and retry messages give state-specific guidance. Public ranking errors do not remove the game.

### Map and finder

The proportionate map supports zoom, reset, and drag while zoomed. Small 18px visual pin buttons have 10px dots and are removed from sequential tab order; they are supplemented by the keyboard-operable finder. Search matches school, city, or county, displays five results initially, and adds five with Show more schools; focus moves to the first new result. A selected finder row and pin share pressed state, and a details section shows the actual school facts. Escape clears selection. Empty map data and no search matches have explicit messages. Preserve the finder rather than treating dense pins as the only route to selection.

### Account and result dialogs

Native dialogs supply headings, close actions, focus handling, and scrollable bounded content. Joining collects a display name, optional affiliation, and email in one form. The initial notice explains public fields, private email/guesses, today's guest-game carryover from this browser, exclusion of older/archive games, and account-result priority. Check-email hides editable fields, retains details, exposes resend countdown and edit actions, and explains that confirmation finishes setup automatically. Verification leads through saving to ready; recoverable setup failures retain the details and offer account-sync retry. Returning sign-in restores existing profile/privacy choices. Profile settings expose public visibility and optional today-only guest import explicitly.

Results give one green Share result action, secondary Copy result, and a spoiler-free text fallback if needed. Daily points are the actual score (7 minus successful guess count, or zero after failure); archive results do not claim daily points. Native share/clipboard outcomes use polite status and restore meaningful focus. Keep browsing and Past Puzzles remain secondary actions.

## Do's and Don'ts

### Do:

- Do keep the supplied CSP logo and Open Sans with the established palette.
- Do pair feedback icons with visible text and keep state changes available to live announcements.
- Do let names, affiliations, clues, and field text wrap; preserve the selected ranking metric beside identity.
- Do retain keyboard focus, the school finder alternative, and reduced-motion behavior.
- Do expose public-listing and today-only guest carryover information before joining.

### Don't:

- Don't replace native controls or labeled SVGs with emoji or font-glyph icons.
- Don't add decorative gradients, repeated nested card shells, or pill navigation to this retained CSP system.
- Don't use color alone to explain result, comparison, or selection states.
- Don't compress rankings into a horizontally scrolling table or clip community names.
- Don't make account or ranking failures block guest play.
