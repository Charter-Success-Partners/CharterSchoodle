# Public launch runbook

Updated October 15, 2026 after production backend setup. **Code readiness and public readiness are separate gates.** The reviewed migration, Auth configuration, and 47 live API ownership checks are complete; see the [production setup evidence](launch-evidence/2026-10-15/production-setup/README.md). The owner approved activation, merge, and deployment. PR #1 is merged, `leaderboardEnabled` is `true`, and Pages deployed revision `bfdc42d6d94bdb3d2e5b9f6b1ce47860ae6438fa` successfully. All 18 live asset hashes and live guest/account checks passed. The first sign-in request was accepted and the owner confirmed email receipt; successful owner requesting-browser completion remains pending. See the [release observations](launch-evidence/2026-10-15/release-activation/README.md). The [readiness report](release-readiness.json) records the remaining email-completion gate.

## Release owner and stop conditions

Before execution, record the approving owner, operator, reviewed commit SHA, maintenance window, Supabase project identity, GitHub repository/Pages environment, backup location, and two consenting account holders A/B. The owner must explicitly designate the external email recipient and select/confirm the SMTP provider. For this release, the owner has designated the recipient and explicitly approved the existing Resend SMTP configuration; access and configuration were verified in the dated production setup evidence. Keep credentials, mailbox addresses, Auth UUIDs, backups, and raw session responses in restricted owner storage; commit only redacted observations and evidence references.

Keep the flag false until steps 1–5 pass. Stop on a missing backup, unexpected live schema/policy, mismatched legacy count, cross-owner access, email failure, or a callback/domain mismatch. Local PGlite and intercepted browser fixtures do not satisfy live checks. Do not run the historical `docs/supabase-leaderboard.sql`.

## First-installation scope recorded October 15

The owner selected fresh rankings with no historical-score transfer. Before installing v2, the operator inspected the live schema and verified that no v2 tables existed. A scoped backup captured the one affected legacy table, all 67 rows, and its schema/access policies; an isolated PGlite restore reproduced its rows and policies exactly. The reviewed migration also passed against that restored schema before live execution. This scoped backup satisfied the first-installation gate for changes limited to new v2 objects and the legacy table's access controls; it is not a full Supabase/Auth backup. Restricted backup storage and hashes are recorded in the production setup evidence. New rankings start from authenticated v2 results; the unused legacy table remains locked down.

Two synthetic operator-owned accounts were subsequently created without sending mail and signed in through normal Auth to run the live API checks. They remain unlisted. The subsequent deployed checks below verified browser account switching, and the owner confirmed email delivery; designated-recipient sign-in completion remains pending. The full-database backup procedure below remains the procedure for future migrations that change existing v2 or Auth records.

## 1. Inspect and back up the actual database

Use the owner-approved administrator connection through a local PostgreSQL service entry (`PGSERVICE`) or protected credential store, never a checked-in URL. Confirm the host/project before any write. Capture the existing schema, grants, policies, triggers, functions, RLS state, legacy row count, and any existing v2 cutover date. Inspect unexpected dependencies/custom policies with the owner before migration.

```sql
select current_database(), current_user;
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, policyname;
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' order by table_name, grantee, privilege_type;
select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges where table_schema = 'public';
select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'charterschoodle%';
select to_regclass('public.charterschoodle_results') as legacy_table,
       to_regclass('public.charterschoodle_settings_v2') as existing_settings;
```

If the legacy table exists, record `select count(*) from public.charterschoodle_results;`. If settings exist, record `select cutover_date from public.charterschoodle_settings_v2;`. Record exact counts, not estimates. Export schema and a complete restorable backup outside the repository/deploy directory:

```bash
# Set PGSERVICE to the owner-reviewed service and BACKUP_DIR to restricted storage first.
pg_dump --format=custom --file="$BACKUP_DIR/before-launch.dump"
pg_dump --schema-only --file="$BACKUP_DIR/before-launch-schema.sql"
pg_restore --list "$BACKUP_DIR/before-launch.dump" > "$BACKUP_DIR/backup-contents.txt"
sha256sum "$BACKUP_DIR/before-launch.dump" > "$BACKUP_DIR/backup-sha256.txt"
```

Have the owner verify backup retrieval and restoration in an isolated database, including legacy row counts and required Auth references. Never test a restore over production. Record backup identifier/checksum, restoration result, UTC time, and operator.

## 2. Apply the tested migration and preserve legacy data

From the exact reviewed revision, run `psql -X -v ON_ERROR_STOP=1 -f docs/supabase-leaderboard-v2.sql` using the verified administrator connection. The migration owns its transaction and is rerunnable. Record the file SHA-256, exit status and redacted output. Inspect schema differences first if any v2 tables already exist: `CREATE TABLE IF NOT EXISTS` does not repair incompatible existing definitions.

Repeat the inspection queries. Confirm legacy row count is identical; no rows were claimed or copied by display name. Confirm all legacy policies and anonymous/authenticated table **and column** privileges are revoked. Confirm RLS on profiles/results/settings, owner policies on profiles/results, immutable identities and terminal results, private settings, and the explicit public aggregate function. Record the first cutover date in America/New_York; reruns must not move it. Stop if data or policy observations differ from the tested migration. Only after the backup, migration and preservation checks are observed may `backupMigration` pass.

## 3. Verify ownership through real API sessions

Use two owner-designated consenting accounts, approved for this smoke check. Obtain A/B sessions through normal Auth; use the publishable key and their own bearer tokens, never service-role credentials for authorization tests. Keep profiles unlisted unless testing public consent. Use today's NC puzzle and valid ordered school IDs from the reviewed deployed data. Record before/after results and row counts, not tokens.

| Caller / operation | Required observation |
| --- | --- |
| Anonymous select/insert/update on `charterschoodle_profiles_v2` and `charterschoodle_results_v2` | Raw access denied; no rows changed. |
| A inserts profile (`user_id`, `display_name`, `school`, `listed:false`) and today's valid result (`user_id`, `puzzle_date`, `answer_school_id`, `guessed_school_ids`, `status`) | A can read/update own profile and extend own unfinished ordered guess prefix. |
| B selects A rows with an explicit `user_id=eq.<A>` filter | No A rows returned; distinguish RLS-empty response from an error. |
| B attempts update of A and inserts with A's `user_id` | No A values/counts change; insert rejected. An HTTP 200 with zero affected rows is not a successful forbidden update. |
| A/B attempt changing public ID/owner/date/answer or a terminal result | Rejected; original identity/result persists. |
| Anonymous, A and B attempt legacy writes | All denied; administrator's legacy count stays unchanged. |
| Anonymous calls `charterschoodle_leaderboard_page_v2` with `p_sort:'points'`, `p_page:1`, `p_page_size:5` | Only listed aggregate rows; no email, Auth UUID, tokens or guess arrays. Test all three supported sorts and page 2 when available. |
| A opts in, then hides profile | Explicit public appearance, then removal from aggregate; own history remains readable. |

Also verify A cannot read B's private history and sign-out/account switching cannot dispatch another subject's queued results. Retain approved smoke records privately; do not delete production data to tidy the test. Record `liveOwnershipSmoke` only after all expected denials and allowed operations are observed. Local tests alone cannot pass it.

## 4. Configure Auth and test the designated recipient

In the correct Supabase project, inspect Auth URL configuration and existing SMTP settings. Reuse the configured provider or the owner's selected provider; configure verified sender/domain credentials there, never in frontend files. Record the provider and redacted delivery diagnostics. Set the site URL and explicitly allowed production redirect to `https://charterschoodle.chartersuccesspartners.com/`. Avoid wildcard callbacks. Only add a project-path callback if that mount is intentionally supported for real sign-in and approved by the owner. The `/CharterSchoodle/` local fixture test does not establish a production allowlist.

Confirm the app's configured `publicUrl`, canonical fallback in `src/game.js`, page canonical/Open Graph/Twitter URLs, and intended allowed callback agree. Guest result sharing uses the canonical fallback when backend configuration is missing or the URL is invalid; it never takes a URL from the current callback-bearing location. Record the actual allowed settings as `allowedCallback` evidence. With the owner's designated external recipient, request exactly the agreed sign-in link using the tested PKCE flow. Verify inbox delivery, sender, requesting-browser completion, cleaned URL, verified account, sign-out, resend cooldown, and expired/invalid-link recovery to guest play. Do not record link queries, codes or tokens. Delivery to an external recipient plus successful completion is required for `externalRecipientEmail`; a mocked OTP response is insufficient. If the new callback page is not yet deployed, record delivery as partial and finish completion immediately after step 6; keep the public gate blocked until then.

## 5. Verify canonical domain, TLS and Pages settings

A read-only HTTPS request on October 15 returned 200 from GitHub with certificate verification enabled; this proves current reachability, not deployment of this revision. Recheck during rollout using `curl --fail --show-error --head https://charterschoodle.chartersuccesspartners.com/` without `-k`. Verify DNS records resolve to the intended Pages site, GitHub custom-domain verification, HTTPS enforcement and certificate hostname/expiry. Confirm Pages source is GitHub Actions and the `github-pages` environment is correct. Record the configuration and HTTP/TLS evidence.

No CNAME is currently committed. If the owner's verified Pages configuration needs one, add exactly `charterschoodle.chartersuccesspartners.com`; the stage script rejects a mismatch with `publicUrl`. Preserve the `/CharterSchoodle/` fallback mount in staging tests. Recheck metadata/share links at the final URL.

## 6. Enable and deploy the reviewed release once

After owner approval and the preceding prerequisites, change only `leaderboardEnabled` to `true` in `src/supabase-config.js`. Keep the publishable key public; never add service-role keys. Update observed readiness entries and evidence references. Run Node 22+ with the lockfile:

```bash
npm ci
npm test
npm run vendor:check
npm run stage
env -u NO_COLOR npm run test:browser
env -u NO_COLOR CHARTERSCHOODLE_TEST_ROOT=_site npm run test:browser
env -u NO_COLOR CHARTERSCHOODLE_TEST_ROOT=_site CHARTERSCHOODLE_TEST_PREFIX=/CharterSchoodle/ npm run test:browser
npm run check:release -- --code
```

Review the exact staged manifest (18 assets, plus CNAME only if approved) and activation diff. Select one deployment trigger: the approved merge/push to `main` already runs `deploy-pages.yml`, so do not also dispatch it manually. Coordinate outside the scheduled refresh window or have the owner pause/resume refresh scheduling for the release window. Record the exact commit and successful Pages workflow run/artifact; do not replace the pipeline with a repository-wide upload. Public check exit 2 is expected until deployed smoke and actual email completion are recorded.

## 7. Smoke-test the deployed revision and record public readiness

Confirm fetched config/style/app bytes match the approved artifact, metadata uses the canonical URL and social PNG loads. In a fresh browser verify guest startup, one guess, reload persistence, six-guess loss and win on approved test puzzles, archive bounds, map, help, narrow-screen controls and share links. With the designated accounts verify link completion, profile consent, today's optional guest import, daily score synchronization, second-device restore, five-row ranking pages, hide-profile, sign-out and account switching. Confirm guest play survives storage/Auth/leaderboard unavailability, including win/loss completion, reopening results and sharing when optional backend configuration cannot load. Confirm daily awards appear while archive results remain unscored. Hold a public-profile save, reopen the profile dialog and submit a hide choice: the requests must finish in submission order and the final profile must remain private. Close and reopen a result during pending share/copy, then verify the old completion cannot change the new dialog or move its focus. Avoid arbitrary score writes or unrelated recipients.

Finish email callback checks deferred from step 4. Record timestamp, exact deployed SHA, operator, browser, results and restricted/redacted evidence locations. Set each observation to `passed` only with nonempty evidence; retain `blocked`/`failed` and reason otherwise. Then `npm run check:release` must exit 0 with the actual checked-in flag true. This command validates the report; it cannot authenticate the truth or freshness of human evidence. A claim of public readiness requires both the recorded live observations and this successful gate. Store the completed signed-off report without triggering a redundant deployment solely to publish documentation.

## Guest-only rollback

If account/Auth/RLS problems appear, set `leaderboardEnabled:false` on the current reviewed frontend, stage and deploy that guest-only revision through the same pipeline. Verify the deployed config and guest play. Do not deploy an old client that resumes anonymous legacy writes. Preserve v2 tables, rows, cutover settings, legacy rows and the backup. Do not rerun historical SQL or grant unrestricted access.

If backend containment is needed while a deployment propagates, an authorized administrator can revoke `insert, update` on `public.charterschoodle_profiles_v2, public.charterschoodle_results_v2` from `authenticated`; keep owner RLS and legacy lockdown intact. Record the intervention and review before restoring tested grants. Never restore a pre-migration backup directly over production to roll back frontend functionality. Use an isolated restoration for recovery investigations. Keep the readiness report blocked until the incident and live checks are resolved.
