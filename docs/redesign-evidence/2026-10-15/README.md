# UI/UX redesign verification — October 15, 2026

The owner approved publication and PR #3 is merged. **The redesign is live** at revision `e343ac808ab2168480755f7b5c87f12cf2db85a8`, deployed by [Pages run 38813004723](https://github.com/Charter-Success-Partners/CharterSchoodle/actions/runs/38813004723). Its tree matches the reviewed candidate; runtime source is `2557b3116e5cca6decc51cbf95a3459c3fd0d1ff`. All 19 served files match that build. See [current deployed evidence and limits](deployment/README.md).

## Delivered behavior

[Product facts](../../../PRODUCT.md) and the [recorded direction](approved-direction.md) retain CSP branding and the existing static stack. The current clue, six compact attempts, and school picker are together; played guesses and labeled feedback follow below. Community rankings show readable names, optional affiliations, rank and the selected metric, with native details for other stats. The proportionate NC map has a keyboard-accessible school finder and selected facts.

Joining collects display name, optional affiliation and email in one form, with explicit public-data and today's-guest-game notice. The matching verified email callback finishes setup automatically. Existing profile/privacy and owned games win; returning email-only Sign in imports nothing. Retry/response loss, cancellation/replacement, account switching, retention, and two-tab completion have targeted coverage. Cross-tab completion was verified with modern Chromium Web Locks; the fallback only serializes one JavaScript environment.

## Final automated evidence

All final local commands exited 0 on the corrected runtime source, except the prepublication public gate recorded below. Node 22.23.3; Playwright 1.64.1/Chromium 1228. These local browser tests use exact synthetic Auth/REST interception and block production Supabase. Production publication and scoped operator smoke checks happened afterward and are recorded separately in [deployment evidence](deployment/README.md); no backend schema or provider configuration changed.

| Check | Final evidence |
| --- | --- |
| Unit + database | [final-tests.log](final-tests.log): `npm test`, **135 unit + 25 database passed**, no failures/skips |
| Browser source | [final-browser-root.log](final-browser-root.log): `npm run test:browser`, **96/96 passed** |
| Browser staged root | [final-browser-staged.log](final-browser-staged.log): `CHARTERSCHOODLE_TEST_ROOT=_site npm run test:browser`, **96/96 passed** |
| Browser staged prefix | [final-browser-prefix.log](final-browser-prefix.log): same staged root with `CHARTERSCHOODLE_TEST_PREFIX=/CharterSchoodle/`, **96/96 passed** |
| Vendor | [vendor.log](vendor.log): official Supabase 2.118.0 bundle, license and provenance byte-identical |
| Static bundle | [final-stage.log](final-stage.log), [staged-manifest.json](staged-manifest.json): **19 allowlisted files**, every staged byte matches source; docs/research/tests/captures excluded |
| Focused review regressions | [RED](final-regressions-red.log), [GREEN](final-regressions-green.log): five reported defects fail before fixes, two existing-behavior controls pass; final **54 affected browser tests pass** |

Browser commands use `CHARTERSCHOODLE_CHROMIUM_PATH` for the installed Chromium, `env -u NO_COLOR`, and separate localhost ports. The complete commands are in the [implementation report](visual-implementation.md) and [final fix report](final-fix-report.md). The fresh full suites above supersede their narrower passing counts.

## Independent review and bounded visual confirmation

The [original full critique](../../../.impeccable/critique/2026-10-15T19-32-03Z__index-html.md) established the baseline. The [whole-branch code/spec review](code-review.md) found one Minor stale-ranking path; its [scoped re-review](code-rereview.md) passed after the fix. The [fresh design review](design-review.md) found three material issues: increased-text reflow, joined-player empty guidance, and missing font glyphs. Its [scoped verdict](design-verdict.md) is **ship: all three listed fixes resolved**. The verdict scores those fixes; it is not a second whole-surface audit.

One grouped product fix pass and one final confirmation followed. There was one changed-UI [mechanical detector](detector.json), with two contextual warnings: retained approved Open Sans and a compact mobile type scale. The design reviewer found the ordinary rendered hierarchy adequate; no second detector ran. Before-fix comparisons for the material findings are retained in [before-final-fix/](before-final-fix/).

The final [26-state capture metadata](../../../.impeccable/review/evidence.json) uses real checked-in schools/puzzles, a fixed October 15 NC date, loaded Open Sans and reduced motion. Account/ranking identities and results are synthetic. Every required PNG was opened and validated by both parent and reviewer. All measured document widths fit the viewport, including **320px at 200% root text (320px document width)**. The map physical aspect ratio remains about 2.562 on desktop and phone. This is local Chromium/layout evidence, not physical-device, screen-reader, performance or production-auth certification.

The first capture harness required a pagination-fixture correction before the valid initial batch; it had returned the same owner row forever. This was independently confirmed as a fixture defect, not lost product progress. The final valid sequence retains the first wrong guess at 1/6 and solves in two guesses for five points. No additional product polish loop occurred. Capture browsers closed in `finally`; the localhost preview server exited 130 after Ctrl-C. Test servers/processes completed with exit 0.

| Screen or state | Final screenshot |
| --- | --- |
| Desktop game | [desktop](../../../.impeccable/review/desktop.png) |
| Tablet game | [768px](../../../.impeccable/review/guest-768.png) |
| Phone game | [390px](../../../.impeccable/review/mobile.png), [320px](../../../.impeccable/review/guest-320.png) |
| Incorrect guess and feedback | [history](../../../.impeccable/review/wrong-390.png) |
| Rankings | [desktop](../../../.impeccable/review/rankings-1440.png), [390px](../../../.impeccable/review/rankings-390.png), [320px](../../../.impeccable/review/rankings-320.png) |
| Ranking detail and selected metric | [details](../../../.impeccable/review/rankings-details-390.png), [streak](../../../.impeccable/review/rankings-streak-390.png) |
| Joining | [390px](../../../.impeccable/review/join-390.png), [320px](../../../.impeccable/review/join-320.png) |
| Email confirmation and automatic completion | [check email](../../../.impeccable/review/check-email-390.png), [ready with imported game](../../../.impeccable/review/join-ready-390.png) |
| Settings and retry | [profile/privacy](../../../.impeccable/review/profile-390.png), [retry](../../../.impeccable/review/join-retry-390.png) |
| Map and finder | [desktop](../../../.impeccable/review/map-1440.png), [phone](../../../.impeccable/review/map-390.png), [selection](../../../.impeccable/review/map-selected-390.png), [no results](../../../.impeccable/review/map-no-results-390.png) |
| Ranking empty/error | [joined empty](../../../.impeccable/review/rankings-empty-390.png), [unavailable](../../../.impeccable/review/rankings-unavailable-390.png) |
| Result, help and archive | [result](../../../.impeccable/review/result-390.png), [help](../../../.impeccable/review/help-390.png), [archive](../../../.impeccable/review/archive-390.png) |
| Increased text | [320px / 200% root text](../../../.impeccable/review/text-200-percent-320.png) |

The [capture harness](visual-capture.mjs) runs manually from the repository root with `RUN_CAPTURE=1` and `CAPTURE_OUT` set; start `scripts/serve-test-site.mjs --root . --prefix / --port 4293` first. It uses local assets and an intercepted invalid fixture origin. Its Chromium path is environment-specific. Final screenshots are committed evidence and excluded from deployment.

## Earlier task evidence and publication gate

The [signup implementation](signup-implementation.md), [initial review](signup-review.md), and [scoped re-review](signup-rereview.md) show all three Important recovery/authority/cancellation findings resolved before visual work. [Signup test logs](signup-tests.log), [account tests](signup-accounts.log), [recovery probes](signup-recovery-probes.log), and [cached-session authority probe](signup-auth-probe.log) document those boundaries. Pre-final-fix implementation logs are historical, not substitutes for the final checks above.

The [current readiness record](../../release-readiness.json) retains the original backend/email observations and records publication of this redesign. The prepublication [code gate](release-code.log) and [blocked public gate](release-public.log) are historical. Current observations and gate output are in [deployment evidence](deployment/README.md). The final public gate remains pending a fresh mailbox-to-PKCE completion through the redesigned join flow. No migration, score reset, or SMTP change was needed for this frontend release.

The completed [design system](../../../DESIGN.md) and [v2 sidecar](../../../.impeccable/design.json) were source-extracted by a separate documenter; [documentation report](design-documentation.md) and [independent local contract checks](design-validation.json) record 22 colors, 8 typography roles, 17 component token groups, and 10 previews. These files do not ship in the static bundle.
