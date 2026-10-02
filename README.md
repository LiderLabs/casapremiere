# CASA Premiere

One Next.js 16 application serving **two complete public websites and an admin CMS** from a single
repository. The content lives in a database, and editors publish without a deploy: every content write
revalidates the public routes, so a change is live in seconds.

> **📘 Full documentation: [`docs/PROJECT-DOCUMENTATION.md`](docs/PROJECT-DOCUMENTATION.md)**
>
> Routes, project structure, environment variables, cross-site links, the contact form, booking, the
> admin CMS, the database, image storage, authentication, and the runbook for moving Turso and R2 to
> new accounts — all in one place. This README is just the front door.

## Surfaces

| Route | Surface | Notes |
|---|---|---|
| `/` | **Estate site** (`app/(site)`) | Landing page, with the Featured Properties grid and the quick-view drawer. Reads `listPublicProperties("home")`. |
| `/properties` | **Estate site** | The full catalogue, filterable by status. Reads `listPublicProperties("listing")`. |
| `/interior` | **Interior site** (`app/(interior)`) | Its own root layout, fonts and CSS. Reads `listPublicProperties("all")`. |
| `/admin` | **Admin CMS** (`app/(admin)`) | Sign in at `/admin/signin`. Its own root layout, so neither site's CSS can bleed in. |

Each route group ships its own root layout and `globals.css`, so the three design systems can never
bleed into each other. The two public sites were merged from two separate apps and verified
pixel-identical (see [§1 of the documentation](docs/PROJECT-DOCUMENTATION.md#1-overview)).

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000  (/, /properties, /interior, /admin)
```

**Local development needs no configuration.** Outside production the app runs against
`file:./.local/cms.db` — no account, no environment variables, and no chance of touching the live
catalogue. Create it and an admin once:

```bash
npm run cms:migrate                                     # creates/updates ./.local/cms.db (gitignored)
npm run admin:create-user -- --username casa --role admin
```

Then sign in at **`http://localhost:3000/admin/signin`**.

Production build and run:

```bash
npm run build          # a production build does need TURSO_DATABASE_URL + TURSO_AUTH_TOKEN,
npm start              # because /, /properties and /interior are prerendered from the database
```

Use **npm** (`package-lock.json`); the leftover `pnpm-lock.yaml` was removed.

## Deployment

A standard Next.js project — no custom server, no external font/image CDNs
(`images.unoptimized: true`, fonts self-hosted). Import
[`LiderLabs/casapremiere`](https://github.com/LiderLabs/casapremiere) into Vercel, set
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (required at **build** time), plus `APP_ORIGIN`,
`IP_HASH_SALT` and the five `R2_*` values the admin needs.

**Any environment change needs a redeploy** — values are baked into a build, and a deployment still
holding old credentials is the only genuinely dangerous state here. See
[§6–§7 of the documentation](docs/PROJECT-DOCUMENTATION.md#6-deployment-vercel).

## Where things live

| Subsystem | Start here | Doc |
|---|---|---|
| Public catalogue read | `lib/cms/public.ts` | [§2](docs/PROJECT-DOCUMENTATION.md#2-routes), [§11](docs/PROJECT-DOCUMENTATION.md#11-property-quick-view-drawer) |
| Property quick-view drawer | `components/property/property-provider.tsx` | [§11](docs/PROJECT-DOCUMENTATION.md#11-property-quick-view-drawer) |
| Cross-site links | `lib/site-links.ts`, `lib/cross-sell.ts`, `components/cross-site-link.tsx` | [§8](docs/PROJECT-DOCUMENTATION.md#8-cross-site-links) |
| Contact form / email (Formspree) | `lib/forms.ts` | [§9](docs/PROJECT-DOCUMENTATION.md#9-contact-form-and-email-delivery-formspree) |
| Appointment booking | `lib/booking.ts` | [§10](docs/PROJECT-DOCUMENTATION.md#10-appointment-booking) |
| Admin CMS | `lib/cms/queries.ts`, `app/(admin)/**` | [§12](docs/PROJECT-DOCUMENTATION.md#12-cms-features-and-user-flow)–[§13](docs/PROJECT-DOCUMENTATION.md#13-cms-user-creation) |
| Database schema | `lib/cms/schema.ts`, `drizzle/` | [§14](docs/PROJECT-DOCUMENTATION.md#14-database-structure) |
| Image uploads (Cloudflare R2) | `lib/cms/r2.ts` | [§15](docs/PROJECT-DOCUMENTATION.md#15-image-storage-cloudflare-r2) |
| Authentication | `lib/admin/auth.ts`, `proxy.ts` | [§16](docs/PROJECT-DOCUMENTATION.md#16-authentication-and-structure) |
| Moving Turso / R2 accounts | `docs/cms-runbook.md` | [§17](docs/PROJECT-DOCUMENTATION.md#17-runbook--moving-turso-and-r2-to-new-accounts) |

## Deeper documents

| Document | What it holds |
|---|---|
| [`docs/PROJECT-DOCUMENTATION.md`](docs/PROJECT-DOCUMENTATION.md) | The canonical reference — everything above, including the runbook. |
| [`docs/cms-build-spec.md`](docs/cms-build-spec.md) | The numbered build spec: schema, API, auth design, risks, and per-phase evidence tables (§17–§24). |
| [`docs/cms-runbook.md`](docs/cms-runbook.md) | The database/bucket migration on its own, with exact expected output per step and rollback. |

## History note

The original two apps were `apps/interior` (Hously) and `apps/main-app`. `apps/interior` was removed
after the merge was verified; it remains fully recoverable from git history
(`git log --oneline -- apps/interior`, `git checkout <commit> -- apps/interior`).
