# Launch verification evidence — October 15, 2026

This directory is durable evidence outside the static deployment allowlist. The readiness record is [../../release-readiness.json](../../release-readiness.json); the owner procedure is [../../public-launch-runbook.md](../../public-launch-runbook.md). Local fixture success does not establish live authorization or email delivery. No production writes, user creation, email, push or deployment occurred.

## Automated evidence

Node 22.23.3; Playwright 1.64.1 using `/home/space/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`. Commands ran with `PATH=/tmp/node-v22.23.3-linux-x64/bin:$PATH` exported as a shell assignment. Browser commands used `env -u NO_COLOR` to remove the inherited NO_COLOR/FORCE_COLOR conflict. Saved logs normalize CRLF/trailing whitespace only; results are unchanged. Tests block production Supabase requests; account endpoints are intercepted exact fixtures.

| Evidence | Command / observation |
| --- | --- |
| [readiness-red-missing.log](readiness-red-missing.log) | `node --test tests/unit/release-readiness.test.js`: expected missing module before implementation. |
| [readiness-red-behavior.log](readiness-red-behavior.log) | Same command with nonfunctional export: 7 assertion failures, 1 pass. |
| [readiness-green.log](readiness-green.log) | Same command after implementation: 8/8 pass, including actual CLI exit codes and safe flag parsing. |
| [tests.log](tests.log) | `npm test`: 111 unit and 25 database tests pass; zero failures/skips. Actual migration executed under non-superuser PGlite roles. |
| [vendor.log](vendor.log) | `npm run vendor:check`: exact official 2.118.0 bundle, license and hash provenance. |
| [staging-final.log](staging-final.log), [manifest-proof.log](manifest-proof.log) | `npm run stage`: 18 allowlisted files, independently byte-compared to source; evidence/docs/tests excluded. |
| [browser-root-final.log](browser-root-final.log) | `npm run test:browser` after the typography fix: 60/60 pass. |
| [browser-staged.log](browser-staged.log) | `CHARTERSCHOODLE_TEST_ROOT=_site npm run test:browser`: 60/60 pass. |
| [browser-prefix.log](browser-prefix.log) | `CHARTERSCHOODLE_TEST_ROOT=_site CHARTERSCHOODLE_TEST_PREFIX=/CharterSchoodle/ npm run test:browser`: 60/60 pass. |
| [domain-observation.log](domain-observation.log) | `curl -I --max-time 20 https://charterschoodle.chartersuccesspartners.com/`: exit 0, HTTP/2 200, GitHub server, TLS verification enabled; observed 2026-10-15 16:04 UTC. This is the existing deployment (Last-Modified June 12), not the candidate release. |
| [release-code.log](release-code.log), [release-public.log](release-public.log) | Separate local/public readiness gate results. |

## One bounded visual inspection and one confirmation

The original design context/audit remains the authority: Operate surface, CSP green/sage/stone/white, Open Sans, six rounds and the existing NC map. No redesign. [impeccable.json](impeccable.json) is the **single** detector run across `index.html`, `scripts/social-card.html`, and `src/app.js` (linked CSS included). It returned 14 findings, exit 2. No second detector run or polishing loop followed.

Initial capture batch: guest/guessed at 320×900; help/win at 390×900 with reduced motion; loss/map at 768×1000; guest/leaderboard at 1440×1000; profile at 390×900; email dialog at 320×900; desktop 200% layout-equivalent reflow at 720×500. The 200% check halves both CSS viewport dimensions from a 1440×1000 desktop viewport, matching browser zoom reflow; it does **not** use deviceScaleFactor as zoom. This covers reflow, not browser chrome or operating-system text scaling.

All game captures use real checked-in schools/puzzles at a fixed October 15 NC date. Account/profile/ranking data are explicitly synthetic intercepted fixtures; they do not attest to live RLS. Open Sans loaded in all 11 captures. The actual 1200×630 [social PNG](../../../assets/social-card.png) was opened and inspected: complete logo, title, tagline, six squares and canonical hostname; no clipping or placeholder. Its SHA-256 is in manifest-proof.log.

[visual-batch.log](visual-batch.log) records 5/6 initial harness scenarios passing. The map capture initially timed out because the harness attempted Map while the loss dialog was open. Dismissing it with Escape completed only the missing map capture ([visual-batch-map-completion.log](visual-batch-map-completion.log)); this was a capture-harness correction, not an application defect or additional polish round. The archived [capture harness](visual-capture.spec.js.txt) can be copied to `tests/browser/task12-visual.spec.js` for reproduction; its relative fixture import assumes that location. Remove it afterward to keep diagnostic captures out of routine suites.

Confirmed defects and the one fix batch: `.eyebrow/.panel__eyebrow` rendered at 10.88px and leaderboard `th` at 10.56px. Both rules now use 0.75rem (12px). [visual-confirmation.log](visual-confirmation.log): all 6 scenarios passed in the **only confirmation round**, producing the 11 final PNGs and metrics under [confirmation/](confirmation/). Computed labels/headers are 12px and page scroll width equals viewport width in every capture. Initial artifacts remain available for comparison; no further visual edits followed.

| Required state | Final capture |
| --- | --- |
| Fresh guest, smallest phone | [guest-320.png](confirmation/guest-320.png) |
| Guessed round, keyboard focus | [guessed-320.png](confirmation/guessed-320.png) |
| Help, trapped focus | [help-390.png](confirmation/help-390.png) |
| Win, reduced motion | [win-390-reduced.png](confirmation/win-390-reduced.png) |
| Six-guess loss | [loss-768.png](confirmation/loss-768.png) |
| Full 212-school map with focused pin | [map-768.png](confirmation/map-768.png) |
| Desktop guest | [guest-1440.png](confirmation/guest-1440.png) |
| Desktop 200% equivalent reflow | [reflow-200-percent.png](confirmation/reflow-200-percent.png) |
| Profile/privacy consent | [profile-390.png](confirmation/profile-390.png) |
| Five-row ranking fixture | [leaderboard-1440.png](confirmation/leaderboard-1440.png) |
| Email entry, no email sent | [email-320.png](confirmation/email-320.png) |

The full-page screenshots of dialogs show the backdrop over the current viewport; the page beyond that viewport remains in the full-page image. This is screenshot composition, not a focus escape. Some navigation pixels capture the brief 160ms color transition; saved computed metrics record the settled active/inactive colors.

## Accessibility measurements and contextual findings

[measurements.json](measurements.json) derives contrast from rendered RGB values using WCAG relative luminance and alpha-composited backgrounds. Corresponding raw metrics sit beside each PNG. Key settled-state values: white on primary green `#2e7c01` **5.25:1**; white on active sage `#4c6970` **5.90:1**; sage on white **5.90:1**; stone `#585551` on white **7.41:1**; stone on pale navigation surface **6.55:1**; sage table headings on their tinted surface **5.49:1**. Sample minimum was 5.25:1. Gradients were visually inspected separately: pale hero/panel backgrounds preserve contrast; the numeric calculation uses composited solid backgrounds, not a claim to pixel-sample every gradient/transitional frame.

All visible primary buttons, guess/email/profile text inputs, help, pagination and map zoom controls measured at least 44px high; primary buttons at least 44px wide. Text inputs measured at least 16px. Profile checkboxes themselves are 24px, with clickable `.account-choice` labels at least 44px high. Geographic pins retain the existing dense 18px spatial targets, with keyboard focus/Enter/Escape selection and map zoom controls; this is a documented secondary map limitation, not a claim that every target is 44px. Map overlap near cities remains inherent to the existing map.

Help traps Tab/Shift+Tab and restores opener focus; account close/Escape and combobox keyboard/touch behavior pass the automated browser suite. Focus rings are visible on captured input, help and selected map pin; slate `#365b5e` against white is approximately 7.5:1. Reduced-motion win retains textual outcome and shows zero confetti; transitions/animations are disabled by the existing reduced-motion media rule. No page-level horizontal overflow at any captured width, including 200% equivalent reflow. The leaderboard intentionally has a contained horizontal scroller at phone widths, preserving table columns rather than expanding the page (covered in prior responsive implementation and current CSS).

Detector dispositions: ten undersized-text occurrences fixed by the two rules; one short uppercase brand credit retained as a brand label, not a prose passage; Open Sans retained by the explicit brand brief; table-wrapper cramped-padding finding is a false positive because each cell has 10px×12px padding; social-template missing-image finding is a false positive because the renderer injects and decodes the actual logo before emitting the inspected PNG. Existing contextual eyebrows, rounded panels, gradients and display treatment remain authorized brand exceptions under the refinement scope.

This is a bounded Chromium inspection and behavioral test record, not a screen-reader certification, physical-device test, or exhaustive WCAG audit. No unresolved confirmed blocking visual defect remained after the single fix/confirmation batch.

## Observed production blockers

No live database administrator connection or management credentials were supplied: backup/restoration, migration, live policy inspection and real A/B authorization remain unperformed. No authenticated Auth settings access was supplied: actual callback allowlisting/SMTP settings remain unobserved. No recipient was designated, and real email/user creation is outside implementation authorization. Push/deployment was prohibited, so this revision has no deployed smoke result. Activation remains false. Existing HTTPS reachability is observed and passed; it does not remove these other blockers. Follow the owner runbook and append actual dated evidence after execution.
