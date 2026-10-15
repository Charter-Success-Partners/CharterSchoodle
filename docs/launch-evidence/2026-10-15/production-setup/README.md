# Production setup observations — October 15, 2026

The existing `charterschoodle` Supabase project was reactivated and observed as `ACTIVE_HEALTHY`. The owner elected fresh rankings with no historical-score transfer and explicitly approved configuring Supabase Auth with the existing Resend sending credential.

## Database

- No v2 tables existed before installation. The affected legacy application table, its 67 rows, columns, constraints, grants, and policies were captured into restricted local storage. The snapshot and restore SQL were copied to `/home/space/.local/share/charterschoodle/activation/2026-10-15/`, verified against their recorded SHA-256 hashes, and excluded from this repository.
- The scoped restore reproduced all rows and three policies in isolated PGlite. The exact reviewed migration then passed against that restored schema, preserved every legacy row, and created empty v2 profile/result tables.
- The same migration (SHA-256 `d11986d6975e6157c654e60463bd8197bfe96c50fe9e38f3305779c8a60f6ecb`) was applied to the live project. The cutover date is `2026-10-15` in America/New_York. All four application tables have RLS enabled; v2 profile/result policies use authenticated owner identity; anonymous/authenticated legacy access is revoked, including column grants.
- This is an affected-table snapshot and restore verification, not a full Supabase/Auth backup. The migration does not modify Auth users. The two synthetic accounts described below were created afterward solely for the live smoke test.

## Auth and email

- The site URL and exact redirect allowlist are both `https://charterschoodle.chartersuccesspartners.com/`.
- Resend SMTP authentication returned 235. Supabase now uses `smtp.resend.com:465`, the existing `csp.team` sender, sender name `CharterSchoodle`, and a limit of 30 emails/hour. Email verification remains required; signups and the email provider are enabled.
- The existing credential is restricted to sending emails and is stored only in Supabase and its existing protected source. It is absent from frontend assets and this evidence.
- The owner designated an external test recipient. No sign-in email has been sent yet: the candidate callback UI must be deployed before requesting a usable link and completing the requesting-browser PKCE check.

## Live authorization checks

- Anonymous reads of profiles, results, settings, and legacy scores returned 401. All three public aggregate sorts returned an empty page with HTTP 200.
- 47 checks passed through real Auth and REST API sessions belonging to two uniquely named operator-created synthetic accounts at reserved `.invalid` addresses. Admin access was used for provisioning only; ownership tests used each account's own password-login bearer token and the publishable key. No provisioning emails were sent.
- Checks covered private profile creation; both directions of profile isolation; result isolation; forbidden cross-owner insert/update; immutable owner/date/answer/public ID; ordered guess prefixes; terminal-result retries/immutability; generated scores; legacy write denials; approved aggregate fields/sorts/pagination; explicit listing, hide, retained private history, and sign-out.
- Both test profiles/results remain private and unlisted. The final public page has zero rows. Browser queue switching and the actual email callback remain deployment checks.

## Hosting and remaining release work

GitHub Pages is configured for Actions, the canonical custom domain, HTTPS enforcement, and deployment from `main`. A certificate-verified HTTPS HEAD request at 17:34 UTC returned HTTP 200 from the existing site, whose last-modified header was June 12; it does not prove deployment of the candidate.

The frontend activation flag remains false. PR #1 remains open. Remaining work is the approved release deployment, designated-recipient inbox/link completion, and browser smoke checks on the exact deployed revision. Public readiness remains blocked until those observations are recorded.
