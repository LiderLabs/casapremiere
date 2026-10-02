# CMS runbook — moving Turso and R2 to new accounts

**Status: planned, not executed.** Both accounts are created by hand in dashboards, so this is not
fully scriptable. The whole content is 3 properties and 22 media rows.

The two tracks — database (§5) and bucket (§3) — are independent, and a new database with the old
bucket is a harmless intermediate state: images resolve through `/api/media/<key>` either way (spec
§22.1). The one dangerous state is a *half-updated deployment* — new credentials in Vercel, old build
still serving (§4). Nothing in a row records an account id, bucket name or database host, so a move is
a copy plus two environment changes, never a code change, and `git revert` is not part of a rollback.

## 1. The steps, in order

1. Create the two new accounts by hand (Turso, Cloudflare R2).
2. **Fix production's migration drift** — §5 · T1. Worth doing whether or not the move happens.
3. **The database**: create → migrate → copy → verify → switch (§5 · T2–T6).
4. **Prove it in a browser** before deleting anything (§5 · T7).
5. **The bucket**, whenever convenient — it does not depend on step 3 (§3).
6. **Delete the old database and bucket last** (§5 · T8, §3 · B5).

## 2. Database structure

Eight tables in one SQLite database — `.local/cms.db` locally, Turso in production. The same
migrations run in both, so the structures are identical: `lib/cms/schema.ts` is the authoritative
definition, `drizzle/0000…0002` are the migrations.

| Group | Table | Rows today | Travels | Note |
|---|---|---|---|---|
| Content | `properties` | 3 | yes | the catalogue; `slug` is the primary key and immutable after create |
| Content | `property_media` | 22 | yes | `slug` → `properties.slug`; `r2_key` is an object key, or a legacy `/images/…` path |
| Content | `settings` | 0 | yes | business details as key/value pairs |
| Auth | `users` | 3 | yes | `password_hash` is argon2id — portable between databases |
| Auth | `sessions` | 25 | **no** | `token_hash` is a sha256 of the cookie, meaningless elsewhere; everyone signs in again |
| Auth | `rate_limits` | 3 | **no** | transient sign-in throttling counters |
| Auth | `audit_log` | 530 | **no** | the development work history; the new database starts its own |
| Bookkeeping | `__drizzle_migrations` | 3 | **no** | the target's bookkeeping must be its own |

- Columns are snake_case, timestamps are ISO-8601 `TEXT`, and `intro`, `highlights`, `specs` and
  `amenities` are the four JSON columns, validated by zod.
- Booleans are 0/1 `INTEGER` (`published`, `show_on_home`, `show_on_listing`,
  `must_change_password`). **Production's drift is exactly the second pair**: it has `0001` but not
  `0002_property_placements.sql`, which added them as `NOT NULL DEFAULT true`, so today's code cannot
  read that database — the property list query selects them.
- CHECK constraints mirror spec §4 (`properties.status`, `property_media.role`), so a bad row cannot
  be written even by a script or pasted SQL.

**Acceptance numbers** (development file, 2 Oct 2026): migrations 3 · tables 8 · 22 media rows
(`1/5/1`, `1/5/1`, `1/6/1` card/hero/gallery) · `settings 0` · `R2 objects 0`.

## 3. R2 — moving the bucket

**B1. Create the bucket.**

```bash
npx wrangler r2 bucket create casa-premier-media
```

Then in the dashboard: enable public access, attach the custom domain, and add CORS allowing
`PUT` / `GET` / `HEAD` from `APP_ORIGIN`. `.local/set-cors.ts` already does this for the current
bucket — point it at the new one rather than writing the policy again.

**B2. Create the credentials.** An R2 API token with **Object Read & Write**, scoped to that bucket.

| Variable | Where it comes from |
|---|---|
| `R2_ACCOUNT_ID` | the **new** account's id — the one value that encodes which account is in play |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | the token |
| `R2_BUCKET` | `casa-premier-media` |
| `R2_PUBLIC_BASE_URL` | the custom domain, or leave it unset to keep reads proxied through `/api/media/<key>` (spec §22.1) |

**B3. Move the objects.** There is nothing to move today: `npm run cms:r2` reports `objects: 0`,
because all 22 media rows point at legacy `/images/…` paths served from `public/images`, and
`scripts/r2-status.ts` skips keys beginning with `/` by design. If uploads happen before the move,
sync them — keys are content hashes and bucket-relative, so no row needs rewriting:

```bash
rclone sync old:old-bucket new:new-bucket          # or
aws s3 sync s3://old-bucket s3://new-bucket --endpoint-url https://<new-account>.r2.cloudflarestorage.com
```

→ **Gate:** `npm run cms:r2` shows `objects: N · orphans: 0`, and N matches the new bucket.

**B4. Switch.** Update the five `R2_*` variables in Vercel, then redeploy (§4).

**B5. Verify, then retire.** `npm run cms:r2` → `objects: N · orphans: 0 · rows with no object: 0`.
Upload one image in the admin, confirm it lands in the new bucket and renders, then delete the old
bucket.

## 4. Local and production

| | Database | R2 | Run with |
|---|---|---|---|
| `npm run dev` | `file:./.local/cms.db`, no variable needed | optional — only uploads need it | `npm run dev` → :3000 |
| Local production build | the two Turso variables, required **at build time** | as configured in `.env.local` | `npm run build` → `npm start` |
| Vercel | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | the five `R2_*` | push to `main` |

- **Local development needs no configuration.** `lib/cms/env.ts` falls back to `file:./.local/cms.db`
  and a development salt whenever `NODE_ENV !== "production"`, and `.env.local` deliberately holds no
  `TURSO_DATABASE_URL`, so local work never touches the live catalogue.
- **A production build does need the Turso pair**, because `/`, `/properties` and `/interior` are
  prerendered from the database. A deploy that fails while collecting a public route's page data is
  this pair, missing — see README §Local development.
- **Variables in a deployment:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_ORIGIN`,
  `IP_HASH_SALT`, `NEXT_PUBLIC_SISTER_SITE_URL`, the five `R2_*`, and `SESSION_TTL_HOURS` if the
  8-hour default is wrong. `lib/cms/env.ts` is the schema; spec §10 is the annotated table.
- **Any environment change needs a redeploy.** Values are baked into a build, and a promoted
  deployment still holding the old credentials is the only genuinely dangerous state in this
  document — half the requests succeed and half fail, depending on which instance answers.
- **Maintenance commands** are `cms:migrate`, `cms:status`, `cms:r2` and `cms:copy` — `--turso` reads
  `.env.turso.local`, and the process environment wins over both env files (`scripts/cli-utils.ts`).

## 5. Turso — moving the database

**T1. Bring the source up to date first.** Production has `0001` but not `0002`, so its `properties`
table has no `show_on_home` / `show_on_listing`. Fix that before copying: the current code cannot read
it, and otherwise the new database inherits the migration's defaults (`1`, "shown everywhere") rather
than deliberate values.

```powershell
cmd /c "set TURSO_DATABASE_URL=& npm run cms:migrate -- --turso"
cmd /c "set TURSO_DATABASE_URL=& npm run cms:status -- --turso"
```

The `cmd /c "set VAR=&"` wrapper clears a stale variable so `.env.turso.local` wins; without it, a
variable already set in the terminal silently redirects the command.

→ **Gate:** `migrations applied: 3`, and the three properties are listed.

**T2. Create the target database.**

```bash
turso db create casa-premier --location <region>   # or the dashboard
turso db locations                                 # what is actually offered
```

Region is fixed at creation and is the biggest latency decision in the move — production sits in
`aws-us-west-2`, the audience in South Africa — so check the list rather than assuming it.

**T3. Collect the credentials.**

```bash
turso db show casa-premier --url
turso db tokens create casa-premier
```

Put them in `.env.turso.new.local` (`.env*` is gitignored), and keep that file and `.env.turso.local`
distinct until T8 so no command can write to the wrong database.

**T4. Migrate the target.** The environment wins over both env files, so a one-off run needs no file:

```powershell
$env:TURSO_DATABASE_URL="libsql://casa-premier-<org>.turso.io"; $env:TURSO_AUTH_TOKEN="<new token>"; npm run cms:migrate; npm run cms:status
```

→ **Gate:** `migrations applied: 3`, all 8 tables, and every row count 0.

**T5. Copy the content.** Dry run first — it reports every row count it would move and touches
nothing:

```powershell
cmd /c "set TURSO_DATABASE_URL=& npm run cms:copy -- --turso --to libsql://casa-premier-<org>.turso.io --to-token ""<new token>"""
```

→ **Gate:** `left behind: __drizzle_migrations 3 · audit_log 530 · rate_limits 3 · sessions 25`, then
`source 3 → target 0` for the content tables. **No `would skip:` line** — if one appears, the target
is behind on migrations and T4 needs repeating.

Then the real run, adding `--write`. → **Gate:** exactly this, with no `MISMATCH`:

```
[copy]   users           copied 3/3
[copy]   properties      copied 3/3
[copy]   property_media  copied 22/22
[copy]   settings        copied 0/0
[copy] verify (target/source): users 3/3 · properties 3/3 · property_media 22/22 · settings 0/0
[copy] ok
```

`cms:copy` refuses rather than guesses: a target behind on migrations (it names the missing column
instead of dropping it silently — precisely the trap production is in), a target that already holds
rows without `--force`, and `--from` equal to `--to`.

**T6. Switch the deployment.** Update `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in Vercel, then
**redeploy** — environment changes do not apply to an existing deployment, and the old one must not
be left serving traffic.

**T7. Accept it, in a browser.**

1. Sign in at `/admin/login` as `casa`. The password is unchanged: argon2id hashes are portable.
2. `/admin/properties` lists 3 properties, all published.
3. Edit one and **Publish** it — the editor returns to `#media`.
4. `npm run cms:status` (with the new credentials) shows a new `audit_log` row for that edit, proving
   writes and the audit trail both landed in the new database.
5. `GET /api/public/properties` returns 3 properties.
6. Home and listing pages render — the check that `show_on_home` / `show_on_listing` are populated,
   the exact columns production is missing today.

**T8. Retire the old database.** Keep it read-only for a few days; delete it only once T7 has passed
and no content is missing.

## 6. Safety, rollback and open decisions

- **One track at a time** — each is independently verifiable, and every intermediate state is fine.
- **Redeploy on any environment change**, then confirm the promoted deployment is the new one.
- **Delete nothing until T7 and B5 have passed.** Every `--turso` command prints its target first, and
  the two env files stay separate until T8; sessions do not survive the move, by design.
- **Decisions before T2:** the region (fixed at creation — the one latency win available); the bucket
  name (`casa-premier-media`, cosmetic — it reaches the app only through `R2_BUCKET`); whether Vercel
  *Preview* points at the new database or fails loudly by leaving `TURSO_DATABASE_URL` unset — it must
  not still point at the **old** one after cutover, or a preview write is invisible in production; and
  whether the app's host or domain also moves, which would change `APP_ORIGIN` (the CSRF origin check)
  and `NEXT_PUBLIC_SISTER_SITE_URL` and require the new origin in the bucket's CORS policy.
- **Rollback is a variable change, not a restore.** Put the old `TURSO_*` back and redeploy, losing
  content written after cutover; or put the five old `R2_*` back and redeploy, re-uploading anything
  added to the new bucket — keys are content hashes, so no row changes.

## Appendix — how `cms:copy` was tested

Recorded 2 Oct 2026, all against scratch files, so production and the development database were never
written to. A verified backup of the development content is at `.local/backups/cms-2026-10-02.db`.

1. **Dry run** into an empty target reported the `left behind:` line and `source 3 → target 0` per
   table, and wrote nothing.
2. **Write** into a freshly migrated scratch file: `users 3/3`, `properties 3/3`,
   `property_media 22/22`, `settings 0/0`, `verify …` and `ok`, exit 0.
3. **Value-level spot check**, not just counts: identical slugs, names, `status`, `published`,
   `published_at`, `published_by`, `position` and `updated_at`; `show_on_home` / `show_on_listing`
   both `1`, so the `0002` columns survived; the media distribution (`1/5/1`, `1/5/1`, `1/6/1` = 22);
   the three accounts with `role`, `status` and `must_change_password` intact; `audit rows: 0`.
4. **The guards**: a second `--write` refused with `target already holds: users 3 · properties 3 ·
   property_media 22` (exit 1), while `--force` produced identical counts; with the `0002` columns
   dropped from a scratch copy to reproduce production, the dry run refused and named `properties is
   missing show_on_home, show_on_listing`, and `--skip-unknown-columns` reported `would skip:
   show_on_home, show_on_listing` — visible rather than silent.
5. `npx tsc --noEmit` clean. (`npm run lint` cannot run: `eslint` is missing from `devDependencies` —
   pre-existing.)

To repeat test 4: copy `.local/cms.db` to a scratch file, migrate it, then
`alter table properties drop column show_on_home` (and `show_on_listing`) and dry-run a copy into it.

