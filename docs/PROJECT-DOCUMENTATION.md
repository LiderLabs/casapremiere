# CASA Premiere — Project Documentation

The canonical reference for this repository: what it is, how it is put together, how to run it,
what every route and environment variable means, and how to move its database and image bucket to
new accounts.

It is the single place to look first. Where a subject has a deeper document — the numbered build
spec, the phase evidence, the runbook — this file names the file and summarises the part that
matters here instead of restating it at length.

**Contents**

1. [Overview](#1-overview)
2. [Routes](#2-routes)
3. [Project structure](#3-project-structure)
4. [Local development](#4-local-development)
5. [Production build](#5-production-build)
6. [Deployment (Vercel)](#6-deployment-vercel)
7. [Environment variables](#7-environment-variables)
8. [Cross-site links](#8-cross-site-links)
9. [Contact form and email delivery (Formspree)](#9-contact-form-and-email-delivery-formspree)
10. [Appointment booking](#10-appointment-booking)
11. [Property quick-view drawer](#11-property-quick-view-drawer)
12. [CMS features and user flow](#12-cms-features-and-user-flow)
13. [CMS user creation](#13-cms-user-creation)
14. [Database structure](#14-database-structure)
15. [Image storage (Cloudflare R2)](#15-image-storage-cloudflare-r2)
16. [Authentication and structure](#16-authentication-and-structure)
17. [Runbook — moving Turso and R2 to new accounts](#17-runbook--moving-turso-and-r2-to-new-accounts)
18. [Related documents](#18-related-documents)

---

## 1. Overview

**One Next.js application serving three surfaces.** There is no monorepo, no custom server and no
external CDN for fonts or images: the repository root *is* the app.

| Surface | URL | Route group | Own root layout + CSS |
|---|---|---|---|
| Estate site (CASA Premier) | `/` and `/properties` | `app/(site)/**` | `app/(site)/layout.tsx`, `app/(site)/globals.css` |
| Interior site (CASA Premier Interiors) | `/interior` | `app/(interior)/**` | `app/(interior)/layout.tsx`, `app/(interior)/globals.css` |
| Admin CMS | `/admin/**` | `app/(admin)/**` | `app/(admin)/layout.tsx`, `app/(admin)/globals.css` |

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix UI primitives
  wrapped in `components/ui/*` · Drizzle ORM over libSQL/SQLite · Cloudflare R2 for images ·
  Formspree for form delivery · Vercel for hosting and analytics.
- **Content lives in a database, not in the code.** The estate grid, the catalogue and the interiors
  band all read published rows from a libSQL database (`lib/cms/public.ts`). The array in
  `lib/properties.ts` is retained only as the seed for `npm run migrate:properties` and as the pixel
  gate's baseline; nothing in the running app reads it.
- **One command, no configuration, locally.** `npm run dev` runs against `file:./.local/cms.db`, so
  local work never touches the production catalogue.
- **Editors publish without a deploy.** Every content write revalidates the public routes
  (`lib/cms/revalidate.ts`), so a change is live in seconds.

The two public sites were merged from two separate apps (`apps/main-app` and `apps/interior`) and
verified pixel-identical; `apps/interior` was removed after verification and remains recoverable from
git history.

## 2. Routes

### Public pages

| Route | File | Notes |
|---|---|---|
| `/` | `app/(site)/page.tsx` | Estate landing page. Prerendered from the database; reads `listPublicProperties("home")`. |
| `/properties` | `app/(site)/properties/page.tsx` | Full catalogue with status filters. Reads `listPublicProperties("listing")`. |
| `/interior` | `app/(interior)/interior/page.tsx` | Interiors page. Reads `listPublicProperties("all")`. |
| `/robots.txt` | `app/robots.ts` | Generated. |

All three public routes are in `PUBLISHED_PATHS` (`lib/cms/revalidate.ts`) and are revalidated by
every content write.

### Admin pages

| Route | File | Access |
|---|---|---|
| `/admin/signin` | `app/(admin)/admin/signin/page.tsx` | Public — the sign-in form. |
| `/admin/password` | `app/(admin)/admin/password/page.tsx` | Any signed-in user who must change their password. |
| `/admin` | `app/(admin)/admin/(dashboard)/page.tsx` | Dashboard: live / pending / draft counts, last 10 audit rows. |
| `/admin/properties` | `app/(admin)/admin/(dashboard)/properties/page.tsx` | Catalogue list, thumbnails, badges, publish/unpublish, reorder, delete. |
| `/admin/properties/[slug]` | `app/(admin)/admin/(dashboard)/properties/[slug]/page.tsx` | Section editor, media manager, publishing card, preview. |
| `/admin/users` | `app/(admin)/admin/(dashboard)/users/page.tsx` | **Admin only.** Manage accounts. |
| `/admin/settings` | `app/(admin)/admin/(dashboard)/settings/page.tsx` | **Admin only.** Business details. |
| `/admin/audit` | `app/(admin)/admin/(dashboard)/audit/page.tsx` | Full history of changes and sign-in events. |

> The sign-in page is **`/admin/signin`**. Some older prose (including the runbook's T7 checklist)
> says `/admin/login`; the deployed route has always been `/admin/signin`.

### API routes

| Route | Methods | Auth | Purpose |
|---|---|---|---|
| `/api/public/properties` | `GET` | public | Published catalogue as `Property[]`. Discovered by scripts and the pixel gate. |
| `/api/media/[...key]` | `GET` | public | R2 proxy, used while `R2_PUBLIC_BASE_URL` is unset. |
| `/api/admin/auth/login` | `POST` | public | Sign in. Same-origin check, per-IP and per-username throttling. |
| `/api/admin/auth/logout` | `POST` | session | Sign out and delete the session row. |
| `/api/admin/auth/me` | `GET` | session | Current user (allows a pending password change). |
| `/api/admin/auth/password` | `POST` | session | Change / set one's own password. |
| `/api/admin/properties` | `GET`, `POST` | session | List; create (draft or publish-now). |
| `/api/admin/properties/[slug]` | `PATCH`, `DELETE` | session (delete: admin) | Save with revision check; delete + remove media. |
| `/api/admin/properties/[slug]/publish` | `POST` | session | Publish, with destinations. |
| `/api/admin/properties/[slug]/unpublish` | `POST` | session | Unpublish. |
| `/api/admin/properties/reorder` | `POST` | **admin** | Rewrite every `position` in one batch. |
| `/api/admin/settings` | `GET`, `PUT` | **admin** | Read / save business settings. |
| `/api/admin/uploads/sign` | `POST` | session | 5-minute presigned `PUT` for one image. |
| `/api/admin/uploads/confirm` | `POST` | session | Record an uploaded object into `property_media`. |
| `/api/admin/media/[id]` | `PATCH`, `DELETE` | session | Set an image's role / position; delete row + object. |
| `/api/admin/users` | `GET`, `POST` | **admin** | List / create accounts. |
| `/api/admin/users/[id]` | `PATCH`, `DELETE` | **admin** | Change role, enable/disable, rename; delete. |
| `/api/admin/users/[id]/reset-password` | `POST` | **admin** | Reset to a forced-change password. |
| `/api/admin/users/[id]/sign-out` | `POST` | **admin** | Sign one user out everywhere. |
| `/api/admin/audit` | `GET` | session | Paged audit history. |

## 3. Project structure

```
repo root/                       ← the single app (repository root)
  app/
    (site)/                      ← main estate site (route group, no URL segment)
      layout.tsx  globals.css  page.tsx        → "/"
      properties/page.tsx                      → "/properties"
    (interior)/                  ← interior site (separate root layout + CSS)
      layout.tsx  globals.css
      fonts/                     ← Satoshi woff2 (intentionally unreferenced, kept for reference)
      interior/page.tsx                        → "/interior"
    (admin)/                     ← admin CMS (separate root layout + CSS)
      layout.tsx  globals.css
      admin/
        signin/  password/                       → "/admin/signin", "/admin/password"
        (dashboard)/                             ← the signed-in shell
          page.tsx  properties/  users/  settings/  audit/
    api/
      public/properties/route.ts                 → GET /api/public/properties
      media/[...key]/route.ts                    → GET /api/media/<key> (R2 proxy)
      admin/…                                    ← properties, media, uploads, users, settings, audit, auth
    robots.ts
  components/
    sections/                    ← estate-site sections (header, contact, collection, explorer, …)
    booking/  property/  mortgage/  admin/  ui/
    interior-*.tsx  footer.tsx  before-after.tsx  cross-site-link.tsx  site-providers.tsx  …
  lib/
    cms/                         ← admin data layer (schema, queries, public read, r2, env, audit, …)
    admin/                       ← auth core, password hashing, user helpers, session cookie name
    properties.ts  booking.ts  forms.ts  cross-sell.ts  site-links.ts  mortgage.ts
  scripts/                       ← tsx CLI scripts (cms:migrate, cms:status, cms:copy, cms:r2, admin:*)
  drizzle/                       ← numbered SQL migrations (0000…0002)
  proxy.ts                       ← Next.js middleware/proxy: session-cookie gate for /admin/**
  public/images/                 ← all assets from both original apps (names kept)
```

Each route group ships its **own** root layout and `globals.css`, so the three design systems
(palettes, radii, animation keyframes) can never bleed into each other.

**Key modules**

| Module | Responsibility |
|---|---|
| `lib/cms/schema.ts` | The authoritative table definitions (Drizzle). |
| `lib/cms/queries.ts` | Every admin read/write that touches a content table. Server-only. |
| `lib/cms/public.ts` | `listPublicProperties(surface)` + the `Property[]` mapper — the public read. |
| `lib/cms/env.ts` | The environment schema and its development defaults; lazy validation. |
| `lib/cms/r2.ts` | S3-compatible client for Cloudflare R2 (sign, read, delete). |
| `lib/cms/revalidate.ts` | `PUBLISHED_PATHS` and `revalidatePublishedPages()`. |
| `lib/cms/validation.ts` | Zod schemas for every write path; `SETTING_KEYS`. |
| `lib/cms/audit.ts` | `writeAudit()` and `listRecentAudit()` — the audit trail. |
| `lib/cms/errors.ts`, `lib/cms/placement.ts` | Error type; the human wording for show-on-home/listing. |
| `lib/admin/auth.ts` | Sessions, cookies, throttling, CSRF origin check, `requireUserPage()`. |
| `lib/admin/password.ts` / `password-policy.ts` | Argon2id hashing (server) / pure policy rules (client-safe). |
| `lib/admin/users.ts` | Account management helpers. |
| `lib/admin/session-cookie.ts` | The cookie name, shared by the proxy and the auth core. |
| `proxy.ts` | Redirects `/admin/**` to sign-in when no session cookie is present. |

## 4. Local development

```bash
npm install
npm run dev            # http://localhost:3000  (/, /properties, /interior and /admin)
```

Use **npm** (`package-lock.json`); the leftover `pnpm-lock.yaml` was removed. Two extra scripts exist
for convenience: `npm run dev:3001` (a second instance) and `npm run lint` (`eslint`).

**Nothing has to be configured.** Outside production, `lib/cms/env.ts` falls back to
`TURSO_DATABASE_URL=file:./.local/cms.db` and a development `IP_HASH_SALT`, and `.env.local`
deliberately holds **no** `TURSO_DATABASE_URL`, so local work never touches the live catalogue. The
file database is created by the migration script:

```bash
npm run cms:migrate                                     # creates/updates ./.local/cms.db (gitignored)
npm run admin:create-user -- --username casa --role admin
npm run cms:status                                      # migrations, tables, row counts, accounts
npm run cms:copy -- --to .local/backup.db               # export content (dry run until --write)
npm run cms:r2                                          # image objects, used vs orphan (needs R2_* in .env.local)
npm run admin:reset-password -- --username casa         # break-glass: unlocks + resets, forces a change
```

Then sign in at **`http://localhost:3000/admin/signin`**.

> `.local/**` is gitignored. `npm run cms:copy` is a dry run unless `--write` is passed — it reports
> every row count it would move and touches nothing.

## 5. Production build

```bash
npm run build          # compiles every public route as a static page
npm start              # serves on :3000
```

Since the public read flip, `/`, `/properties` and `/interior` are **prerendered from the content
database**, so a production build needs the two Turso variables — `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` — **at build time**. A deploy that fails while collecting a public route's page
data is almost always this pair, missing. `npm run dev` needs neither.

Other build notes:

- `images.unoptimized: true`; fonts are self-hosted via `next/font`/`next/font/local`. No external CDN.
- The third migration (`0002_property_placements`, the two `show_on_*` columns) must be applied to a
  database **before** code that reads those columns is deployed, or the build fails at `/` collection.

## 6. Deployment (Vercel)

A standard Next.js 16 project — no custom server, no external font/image CDNs. Import the GitHub
repository (`LiderLabs/casapremiere`) into Vercel.

### Step by step

1. **Commit & push** to `main` on GitHub.
2. In Vercel: **Add New → Project → Import** the repository.
3. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: leave blank (repository root)
   - **Build Command / Install Command**: leave defaults
   - **Environment Variables**: at minimum `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` (required at
     **build** time). Add `APP_ORIGIN`, `IP_HASH_SALT` and the five `R2_*` values the admin needs —
     see §7 and `docs/cms-build-spec.md` §10.
4. **Deploy.** Then sign in at `/admin/signin` to confirm the admin came up.

### Rules that matter

- **Any environment change needs a redeploy.** Values are baked into a build. A promoted deployment
  still holding old credentials is the only genuinely dangerous state in this project — half the
  requests succeed and half fail, depending on which instance answers.
- **Migrations before code.** Apply `npm run cms:migrate -- --turso` (with the target credentials)
  before deploying code that depends on the new columns.
- **Moving accounts is a copy plus two environment changes**, never a code change — nothing in a row
  records an account id, bucket name or database host. See §17.

## 7. Environment variables

`lib/cms/env.ts` is the schema; it is **server-only** (there is no `NEXT_PUBLIC_` prefix anywhere in
it, and no client component may import it). Validation is lazy — `getEnv()` runs on first use, so a
half-configured environment fails the request that needs it rather than breaking `next build` route
collection.

| Variable | Required | Default / notes |
|---|---|---|
| `TURSO_DATABASE_URL` | production | `file:./.local/cms.db` in development. `libsql://<db>.<org>.turso.io` in production. |
| `TURSO_AUTH_TOKEN` | when the DB is remote | Not needed for a local file; required for Turso. |
| `APP_ORIGIN` | recommended | Exact origin the admin is served from; used by the CSRF origin check. |
| `IP_HASH_SALT` | production | Salt for hashing client IPs. Dev fallback is `casa-dev-salt-not-a-secret`. Min 16 chars. |
| `SESSION_TTL_HOURS` | no | Sliding session lifetime; default `8` (min 1, max 720). |
| `R2_ACCOUNT_ID` | for uploads | R2 account id; also derives the S3 endpoint used for signing. |
| `R2_ACCESS_KEY_ID` | for uploads | R2 API token. |
| `R2_SECRET_ACCESS_KEY` | for uploads | R2 API token secret. |
| `R2_BUCKET` | for uploads | Bucket name (e.g. `casa-premier-media`). |
| `R2_PUBLIC_BASE_URL` | no | Public serving base. Without it, images are read through `GET /api/media/<key>`. |
| `NODE_ENV` | — | Set by Next (`development` / `test` / `production`). |

**The names are exact.** A pair named `TURSO_DB_URL` / `TURSO_DB_TOKEN`, or anything else, is
silently ignored. `isR2Configured()` is true only when all four of `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET` are present; `requireR2()` throws
otherwise and the upload routes use it.

**Local files.** `.env.local` documents the shape (and, by design, contains **no** `TURSO_*` values).
`.env.turso.local` holds the production Turso credentials and is what the `--turso` flag reads. Both
are gitignored. The process environment wins over both env files (`scripts/cli-utils.ts`).

> **Stale variable — `NEXT_PUBLIC_SISTER_SITE_URL`.** `.env.local` still contains
> `NEXT_PUBLIC_SISTER_SITE_URL=` (empty), a leftover from when the two sites were separate
> deployments that linked to each other by absolute URL. Nothing in this repository reads it:
> `lib/site-links.ts` hard-codes `/interior` and `""` as in-app paths. It is safe to delete, and it
> must **not** be reintroduced as a way to point the two sites at each other, because they now share
> one origin.

## 8. Cross-site links

The two public sites live in one app, so "cross-site" means *between route groups*, not between
origins. Every crossing link goes through one component, so the click can be attributed.

| Piece | Where |
|---|---|
| Path constants | `lib/site-links.ts` — `SISTER_SITE_URL = "/interior"`, `MAIN_SITE_URL = ""`, `INTERIOR_HOME = "/interior"` |
| Href builder, surface vocabulary, analytics props | `lib/cross-sell.ts` |
| The link component (renders a `<Link>` and fires the event) | `components/cross-site-link.tsx` |

**Two constants, one meaning each.** `MAIN_SITE_URL` (`""`) and `SISTER_SITE_URL` (`"/interior"`) mean
*the other site*; usage sites append `/`. `INTERIOR_HOME` exists because both original apps used to
answer on `/`: inside the interiors pages, a bare `href="/"` silently became a link to the estate (the
interiors footer logo did exactly that). Use `INTERIOR_HOME` for a logo or "back to the top of this
site". The estate side has no equivalent, because its own logos already point at its `#hero` anchor.

**What is linked.** Estate → interiors: header (desktop + mobile), footer (Explore and Services
columns), the "The Interior" band, the property drawer, and the home cards in the interiors page's
estate band. Interiors → estate: header (desktop + mobile), footer, the "The Exterior" band, the FAQ
answer about the estate, and each card in "The homes we design for".

**Landing context.** A cross-site link can arrive with `?service=`, `?location=`, `?property=` and
`?book=1`, which `BookingProvider` / `PropertyProvider` read on load and pass to the modal or the
drawer — so `/interior/?book=1&service=Interior+design` opens the appointment form already filled in.
`service` is validated against `BOOKING_SERVICES` before it reaches the form, because the value comes
from a URL.

**In-place hand-offs.** Three estate surfaces offer the interiors service without navigating at all —
the property drawer, the shortlist panel and the affordability dialog. Those open the appointment
modal preset to `Interior design` (with the property or the whole shortlist in the notes) and report
the `cross_sell_booking` event, which is what shows whether someone looking at a home actually asked
us to fit it out. A navigating link reports `cross_site_click` instead; both are defined in
`lib/cross-sell.ts` and sent with `@vercel/analytics`.

**The surface vocabulary is closed.** `CrossSellSurface` is a union in `lib/cross-sell.ts`, not free
text, because the point of `?src=` is to rank surfaces against each other — `estate-drawer` and
`estate-footer` only compare if they are spelled the same way every time. Adding a link means adding
its surface there first.

**Only a real navigation counts.** `CrossSiteLink` ignores `preventDefault`ed clicks, non-left
buttons, and any click carrying cmd/ctrl/shift/alt — those open a background or new tab, and inflated
numbers are worse than no numbers.

## 9. Contact form and email delivery (Formspree)

The estate site's contact section is a working form: validation in the browser, delivery over
[Formspree](https://formspree.io), and success shown only once the endpoint has accepted the post.
Both public forms share one configuration module.

| Piece | Where |
|---|---|
| Form id, payload builders, public email address | `lib/forms.ts` |
| The enquiry form (validation, submit, success view) | `components/sections/contact-form-panel.tsx` |
| The section shell that renders it | `components/sections/contact-section.tsx` |
| Appointment payload | `buildBookingSubmission()` in `lib/booking.ts` |

**The form id.**  in `lib/forms.ts`; the endpoint is
`https://formspree.io/f/<id>`. `FORMSPREE_BOOKING_FORM_ID` re-exports the same form by default, which
keeps both streams in one inbox and one Formspree table — create a second form in the Formspree
dashboard and put its id there to separate them.

**Email address.** `CONTACT_EMAIL` (`info@liderlabs.com`) is the single source for every `mailto:` —
the contact section, both footers, the interiors call-to-action, and the property drawer (which reads
`BOOKING_EMAIL`, re-exported from the same constant). `CONTACT_EMAIL_HREF` is the ready-made
`mailto:`.

**What is sent.** The submitted fields plus `_subject` (so the notification reads "New enquiry —
Interior design" instead of "Form submission"), `source` (`estate-contact-form` /
`appointment-modal`) and `page` (the URL the visitor was on). Empty optional fields are left out
because `JSON.stringify` drops `undefined`. Formspree uses the `email` field as the reply-to address.

**Spam.** Both forms carry a `_gotcha` honeypot, which Formspree discards server-side. The contact
form's hidden field is read straight off the DOM at submit time, so a bot that fills it is dropped
even though the payload is built by hand; the appointment modal's existing empty-`company` zod rule
feeds the same field.

**Failures are visible.** A failed request, a blocked form or a form id that no longer exists comes
back as a form-level error and is rendered next to the submit button with the phone/email fallback —
the success view is never shown for a submission that did not reach Formspree. Field-level errors
Formspree returns are rendered under the field they belong to.

**Why the form is its own chunk.** `contact-section.tsx` renders the details column and loads the
form with `next/dynamic`, so react-hook-form, zod, the Radix select and the Formspree client stay off
the landing page's critical path — the same treatment the booking modal, the property drawer and the
affordability dialog get. `ssr` is left at its default, so the empty form is still part of the
prerendered HTML: no blank card while the chunk arrives, and no layout shift.

## 10. Appointment booking

Both sites share one booking flow that validates in the browser, delivers the request over Formspree,
and shows its success view only once the endpoint has accepted it — so the modal can never claim a
request was received when it was not.

| Piece | Where |
|---|---|
| Modal (form, calendar, slots, success view) | `components/booking/booking-modal.tsx` |
| Provider + `useBooking()` hook, single `<Dialog>` instance | `components/booking/booking-provider.tsx` |
| Rules, formatters and message builder | `lib/booking.ts` |

**Triggers:** the header pill (`Book a Visit`, desktop + mobile menu), the contact section's
`Prefer to book a visit?` button, the footer's `Consultation` / `Book an appointment` entries (which
open the modal instead of navigating), the interior page's call-to-action button, and the deep links
`/#book` and `/?book=1`.

The provider is mounted in **every** public route (`app/(site)/**` and `app/(interior)/layout.tsx`),
so the same modal opens from either site. The modal inherits each route group's own design tokens, so
it renders in CASA's black-and-white on `/` and Hously's warm neutrals on `/interior`. The interior
CTA opens it with `openBooking({ service: "Interior design" })`, which presets the service field via
`BookingPrefill` without wiping anything already typed.

**Availability is configuration, not code** — edit `lib/booking.ts`:

```ts
export const BOOKING_SLOTS = ["09:00","10:00","11:00","13:00","14:00","15:00","16:00"]; // 12:00 left out
export const BOOKING_WEEKDAYS = [1, 2, 3, 4, 5];  // Mon–Fri (0 = Sunday)
export const BOOKING_MIN_LEAD_DAYS = 1;           // earliest = tomorrow
export const BOOKING_HORIZON_DAYS = 90;           // calendar range
export const BOOKING_BLACKOUT_DATES = [];         // e.g. ["2026-12-25"]
export const BOOKING_SERVICES = ["Site visit","Buy a property","Interior design","Renovation","Property development"];
```

`isDateAvailable()` is used by both the calendar (as `disabled`) and the zod schema, so a stale modal
cannot submit a past date, a weekend or a blackout day. The time zone is `Africa/Accra`
(`BOOKING_TIME_ZONE`), i.e. GMT year-round.

**Delivery.** `Request Appointment` posts the validated request to Formspree from `onSubmit` in
`booking-modal.tsx`; the button reads `Sending...` while the request is in flight, the success view
appears only when the endpoint reports success, and a failure shows a form-level message above the
buttons. The payload is `buildBookingSubmission()` — name, email, phone, service, location, the date
and slot formatted for a human, notes, and the honeypot.

**Emergency off-switch.** `BOOKING_SUBMISSION_ENABLED` in `lib/booking.ts` is `true`. Set it to
`false` and the modal returns to the WhatsApp-only hand-off: `Request Appointment` disabled, and
`bookingWhatsAppHref()` URL-encoding whatever the visitor has typed into `wa.me/233555287488` for the
visitor's own app to send. Phone (`tel:`) and email (`mailto:`) links are available in both modes, and
a blocked or offline submission falls back to them.

**Business details** used by the booking fallbacks live in `lib/booking.ts`: `BOOKING_PHONE_DISPLAY`
(`+233 555 287 488`), `BOOKING_PHONE_HREF`, `BOOKING_WHATSAPP_NUMBER` (`233555287488`), `BOOKING_EMAIL`
(re-exported from `lib/forms.ts`), and `BOOKING_HOURS_LABEL` (`Mon-Fri - 09:00-17:00 GMT`).

The modal is loaded with `next/dynamic` on first open, so Radix Dialog, react-day-picker,
react-hook-form and zod stay out of the initial page bundle.

## 11. Property quick-view drawer

The "Featured Properties" cards open a **drawer** instead of navigating — a quick view that keeps the
page (and the other homes) visible behind it.

| Piece | Where |
|---|---|
| Property types + pure helpers (single source of truth for the shape) | `lib/properties.ts` |
| Provider + `useProperty()` hook, lazy-mounts the drawer | `components/property/property-provider.tsx` |
| The drawer: gallery, specs, amenities, host, pager | `components/property/property-drawer.tsx` |
| Card markup (server-rendered) | `components/property/property-card-view.tsx` |
| Trigger (client: drawer open + shortlist heart) | `components/property/property-card.tsx` |
| Provider stack | `components/site-providers.tsx` — Booking › Mortgage › Property › Shortlist |
| Mounted in | `app/(site)/page.tsx` and `app/(site)/properties/page.tsx`, through `site-providers.tsx` |

**Presentation:** a right-hand `Sheet` at ≥768px (page dimmed but visible behind — the "quick view"
feel) and a full-screen bottom sheet on mobile. Both sit at `z-[60]` so they cover the fixed pill
header.

**Behaviour**

- Loaded with `next/dynamic` on first open, so the drawer markup, gallery and spec tables stay out of
  the initial page bundle.
- **Deep link:** opening writes `?property=<slug>` with `history.replaceState`, and the slug is read on
  load — so a quick view can be shared or reloaded. Other params (e.g. `?book=1`, `?status=…`) and the
  current hash are preserved.
- **Book a viewing** closes the drawer, then opens the appointment modal prefilled with
  `service: "Buy a property"` and `location: "<name>, <location>"`. The delay matches the sheet's
  300ms close transition so the two overlays never fight for focus.
- The gallery's **Expand** button opens an in-panel viewer (arrows + close) rather than a nested
  dialog, so only one overlay is ever open.
- The drawer footer's pager walks between the properties without closing it.
- The pager reads the whole catalogue from `useProperty()`, not a filtered subset — the `/properties`
  status chips narrow the grid, not the browse experience.

**Authoring rules** (they live in `lib/properties.ts`, shared with the admin preview):

- A `meta` or `price` string **with no digits** counts as unfinished: the drawer hides it instead of
  showing a stray dash. `getPropertyPriceValue()` follows the same rule, so the affordability
  calculator opens empty rather than from a guess, and a shorthand such as `"GH₵ 2.4M"` is refused
  rather than interpreted.
- Spec rows with an empty `value` are grouped into one "On request: …" line; fill one in and it
  becomes its own row.
- `image` is the card image, `hero` is the drawer's opening image, `gallery` is the rest. The role →
  position → image mapping is `toPropertyImages()` in `lib/properties.ts`; the public read supplies
  the resolved `src` (`mediaSrc()` in `lib/cms/public.ts`) and a fallback alt (`"<name>, <location>"`).

**Deliberately not included:** per-property URLs, metadata, sitemap entries and detail pages — this is
a quick view, not a listing page. (The catalogue as a whole has its own route, `/properties`.) The card
grid stays server-rendered, so each home's name, location, spec line and price are still in the initial
HTML.

## 12. CMS features and user flow

The admin lives at `/admin` in this repo and is a complete content workflow: sign in, edit homes,
upload images, publish, and see who changed what. Everything below is **built and verified** — the
phase-by-phase evidence tables are in `docs/cms-build-spec.md` §17–§24.

**Roles.** Two.

| Role | Can | Cannot |
|---|---|---|
| `admin` | everything: create/edit/delete homes, reorder the catalogue, manage media, publish/unpublish, business settings, manage users | — |
| `editor` | create and edit homes, manage media, **publish or unpublish** them | delete a home, reorder the catalogue, manage users, change settings |

An editor's un-published edit is invisible to visitors and shows as *Pending changes* in the admin
list. The API enforces this matrix (an editor gets `403` for delete, reorder, users and settings) and
the UI hides what the role cannot do.

**The shell.** `app/(admin)/layout.tsx` is the admin's own root layout (its own `globals.css`, so
neither public site's CSS can bleed in). `app/(admin)/admin/(dashboard)/layout.tsx` is the signed-in
shell with a sidebar: Dashboard, Properties, Users (admin only), Settings (admin only), History, plus
quick links to the two sites (`Estate site` → `/`, `Interior site` → `/interior`). Admin pages are
`export const dynamic = "force-dynamic"` — never prerendered, never cached, because they sit behind a
session.

**The sign-in redirect chain.** `/admin/**` is gated twice: `proxy.ts` redirects to `/admin/signin`
when no session cookie is present, and each page/route additionally calls `requireUserPage()` /
`requireApiUser()`. A user who still has to choose a password is sent to `/admin/password` instead.

### The user flow, end to end

1. **Sign in** at `/admin/signin`. A brand-new account (created by admin or by `admin:create-user`)
   has `must_change_password = 1`, so the first sign-in lands on `/admin/password`; the account reaches
   nothing else until it changes its password.
2. **Dashboard** (`/admin`) — three counts (*Live*, *Pending changes*, *Drafts*), a **Publish pending**
   shortcut when any live home was edited since it was last published, and the last 10 audit rows.
3. **Properties** (`/admin/properties`) — every home with a thumbnail, a badge (*Live* / *Pending* /
   *Draft*) and a **placement** label (which surface it is on, from `lib/cms/placement.ts`). *New
   property* offers **Publish now** or **Save as draft** — an explicit choice, never a default; either
   one opens the new editor at its media section (`#media`). Admin-only: reorder (drag) and
   slug-typed delete.
4. **Editor** (`/admin/properties/[slug]`) — one page, sectioned saves (each carries the `updatedAt`
   revision it was based on, so two editors cannot silently overwrite each other — a `409` names who
   saved first). Sections: details, intro, **repeatable typed rows** for highlights, specs and
   amenities, and a **Publishing card** with the two destinations (`show_on_home` / `show_on_listing`)
   and a **Preview** button that renders the unsaved state through the grid's own card and the drawer's
   own detail rules.
5. **Media** (`#media` on the editor) — three grids: **card** (single by construction), **hero**, and
   **gallery**. Uploads are resized in the browser (see §15), sent straight to R2 with a presigned
   `PUT`, and confirmed into `property_media`.
6. **Publish / Unpublish** — from the list or the editor's Publishing card, with destinations. Every
   write (publish, save, reorder, delete, media change) calls `revalidatePublishedPages()`, so `/`,
   `/properties` and `/interior` are refreshed within seconds — no commit, no redeploy.
7. **History** (`/admin/audit`) — every mutation and every sign-in event, most recent first, with the
   actor and a small JSON payload (never a password, never a session token).

### Feature map

| Piece | Where |
|---|---|
| Full build spec (scope, schema, API, auth, effort, risks, evidence per phase) | `docs/cms-build-spec.md` |
| Admin route group | `app/(admin)/**` — its own root layout, so neither site's CSS can bleed in |
| Content store | **Turso (libSQL)** via `@libsql/client` + Drizzle — dev uses `file:./.local/cms.db`, production a `libsql://` URL, so both run the same SQL and the same migrations |
| Data layer | `lib/cms/queries.ts` (admin reads/writes), `lib/cms/public.ts` (public read), `lib/cms/schema.ts` (tables) |
| Users (`/admin/users`) | create, change role, disable/enable, reset password, "sign out everywhere". Admin-only, audited, and unable to remove the last admin or yourself |
| Properties API | `/api/admin/properties**`, `/api/admin/settings`, `/api/public/properties`. One zod schema per write path, real `400 / 404 / 409 / 422` behaviour, everything audited |
| Media API | `POST /api/admin/uploads/sign`, `POST /api/admin/uploads/confirm`, `PATCH`/`DELETE /api/admin/media/[id]`. Deleting a property deletes its R2 objects |
| Images | **Cloudflare R2** — resized in the browser, uploaded with a presigned `PUT`, confirmed into `property_media`. See §15 |
| Publish | `revalidatePublishedPages()` (`lib/cms/revalidate.ts`) invalidates `PUBLISHED_PATHS` on every content write |

### Behaviours worth knowing

- **Publish vs save is explicit.** Creating a home requires an `intent` (`publish` or `draft`) — there
  is no default, so a new home cannot go live by accident.
- **Placement is set by publishing, not by editing.** `show_on_home` / `show_on_listing` are written
  when a home is published (or via the Publishing card), so moving a home between surfaces never
  raises a phantom *Pending changes* badge.
- **Pending changes.** A live home edited since its last publish is flagged `pendingChanges`, which is
  what the dashboard's *Pending changes* count and the list's *Pending* badge show.
- **Optimistic saves.** An update carries the revision it was based on; a stale write returns `409`
  naming who saved first.
- **Publish refusal.** Publishing refuses a property the public card could not render (`422`) — the
  check is `publishBlockers`, the same rule the preview uses.
- **Delete keeps the row in the audit trail**, including the media keys, because the row itself is gone.
- **Reorder rewrites every `position` in one batch**, so the grid can never end up half-sorted.
- **Settings are admin-only and fall back to code.** `getSettings()` returns only keys that have been
  saved, so an unset key falls back to the value still hard-coded in `lib/booking.ts` / `lib/forms.ts`
  rather than to a blank.
- **Audit writes are non-fatal.** A failure to record history must not fail the action it describes;
  errors are logged and swallowed.

## 13. CMS user creation

Two ways to create an account — a script for the CLI and a screen in the admin.

### From the CLI

```bash
# Local (.local/cms.db) — the first admin
npm run admin:create-user -- --username casa --role admin

# An editor with a preset password, not forced to change it
npm run admin:create-user -- --username ama --role editor --name "Ama" --password "…" --no-force-change

# Production (reads .env.turso.local)
npm run admin:create-user -- --username casa --role admin --turso
```

| Flag | Meaning |
|---|---|
| `--username <name>` | **Required.** 3–32 chars: `a-z 0-9 . _ -` |
| `--role <role>` | `admin` or `editor` (default: `editor`) |
| `--name "<display>"` | Shown in the admin |
| `--email <address>` | Optional |
| `--password <value>` | Skips the hidden prompt (for scripted runs) |
| `--no-force-change` | Do not require a password change at first sign-in |
| `--turso` | Write to the production database (`.env.turso.local`) |

Without `--password` the script prompts with hidden input. New accounts require a password change at
first sign-in unless `--no-force-change` is passed.

**Related scripts.** `npm run admin:reset-password -- --username <name> [--password <value>] [--turso]`
is the break-glass reset (it unlocks and forces a change). `npx tsx scripts/admin-delete-user.ts
(--username <name> | --all) [--turso]` deletes an account and all of its sessions.

### From the admin

`/admin/users` (admin only) can create an account, change a role, disable/enable, reset a password
(forced change) and "sign out everywhere". It is audited, and it will not let you remove the last
admin or yourself.

## 14. Database structure

Eight tables in one SQLite database — `.local/cms.db` locally, Turso in production. The same
migrations run in both, so the structures are identical: `lib/cms/schema.ts` is the authoritative
definition, `drizzle/0000…0002` are the migrations.

| Group | Table | Rows today | Travels in a move | Note |
|---|---|---|---|---|
| Content | `properties` | 3 | yes | the catalogue; `slug` is the primary key and immutable after create |
| Content | `property_media` | 22 | yes | `slug` → `properties.slug` (cascade delete); `r2_key` is an object key, or a legacy `/images/…` path |
| Content | `settings` | 0 | yes | business details as key/value pairs |
| Auth | `users` | 3 | yes | `password_hash` is argon2id — portable between databases |
| Auth | `sessions` | 25 | **no** | `token_hash` is a sha256 of the cookie, meaningless elsewhere; everyone signs in again |
| Auth | `rate_limits` | 3 | **no** | transient sign-in throttling counters |
| Auth | `audit_log` | 530 | **no** | the development work history; the new database starts its own |
| Bookkeeping | `__drizzle_migrations` | 3 | **no** | the target's bookkeeping must be its own |

- Columns are snake_case, timestamps are ISO-8601 `TEXT`, and `intro`, `highlights`, `specs` and
  `amenities` are the four JSON columns on `properties`, validated by zod against the shapes in
  `lib/properties.ts`.
- Booleans are `0`/`1` `INTEGER` (`published`, `show_on_home`, `show_on_listing`,
  `must_change_password`).
- **CHECK constraints mirror the spec**: `properties_status_check` accepts only the four
  `PROPERTY_STATUSES` strings (`Available`, `Under construction`, `Sold`, `Coming soon`) and
  `property_media_role_check` only `card`, `hero`, `gallery` — so a bad row cannot be written even by
  a script or pasted SQL. `PROPERTY_STATUSES` (`lib/properties.ts`) is the one runtime list the zod
  schemas and the CHECK constraint both read.
- **Indexes:** `properties_position_idx` (grid order), `property_media_slug_idx(slug, role, position)`,
  `sessions_user_idx`, `audit_log_at_idx`.
- **The placement columns are destinations, not a second live switch.** `published` is still the one
  draft/live flag; `show_on_home` / `show_on_listing` say *where a live home appears*. Keeping them
  off `published` is what lets Unpublish → Publish return a home to where it was, and a home with both
  set to `0` cannot be published (`publishBlockers`).

**The three migrations**

| File | Adds |
|---|---|
| `drizzle/0000_init_auth.sql` | `users`, `sessions`, `rate_limits`, `audit_log` |
| `drizzle/0001_content_tables.sql` | `properties`, `property_media`, `settings` |
| `drizzle/0002_property_placements.sql` | `show_on_home`, `show_on_listing` (`NOT NULL DEFAULT true`) |

> **Migration order matters.** A database that has `0001` but not `0002` cannot be read by today's
> code — the property list query selects the two `show_on_*` columns. Production was in exactly this
> state; apply `0002` (i.e. `npm run cms:migrate -- --turso`) **before** deploying code that reads it,
> or the build fails at `/` collection.

**Acceptance numbers** (development file, 2 Oct 2026): migrations 3 · tables 8 · 22 media rows
(`1/5/1`, `1/5/1`, `1/6/1` card/hero/gallery) · `settings 0` · `R2 objects 0`.

## 15. Image storage (Cloudflare R2)

Property images live in **Cloudflare R2**, uploaded straight from the browser with a presigned `PUT`
so bytes never pass through Vercel. The database stores only the object **key** (`property_media.r2_key`).

| Piece | Where |
|---|---|
| S3-compatible client, signing, key naming, delete | `lib/cms/r2.ts` |
| Environment and `requireR2()` | `lib/cms/env.ts` |
| Browser resize + the three media grids | `app/(admin)/admin/(dashboard)/properties/[slug]/media-manager.tsx` |
| Sign / confirm / delete endpoints | `app/api/admin/uploads/sign`, `.../confirm`, `app/api/admin/media/[id]` |
| Public read (URL resolution) | `mediaSrc()` in `lib/cms/public.ts` |
| Proxy for reads without a public domain | `app/api/media/[...key]/route.ts` |

**The pipeline**

1. The browser resizes/converts the file locally — `<canvas>` → WebP, longest edge ≤ **2000px**,
   quality **0.8**, ≤ **1.5 MB** (`MAX_EDGE`, `MAX_BYTES` in `media-manager.tsx`). No paid image
   service, and uploads never hit a function body limit.
2. `POST /api/admin/uploads/sign` returns a presigned `PUT` (5-minute expiry,
   `UPLOAD_URL_TTL_SECONDS`) and the object key.
3. The browser `PUT`s the bytes **directly to R2**.
4. `POST /api/admin/uploads/confirm` records the object into `property_media` (role, position, alt,
   width, height, bytes).
5. `PATCH`/`DELETE /api/admin/media/[id]` set a row's role or position, or delete the row **and** its
   R2 object. Deleting a property deletes its objects too.

**Keys are content-addressed** — `properties/<slug>/<hash>.<ext>` (`uploadKey()`), so a retry never
duplicates an object, and nothing in a row records a bucket name or account id (which is why moving
buckets is a copy, never a code change — §17).

**Server-side validation.** `UPLOAD_CONTENT_TYPES` allows only `image/jpeg`, `image/png`,
`image/webp`, `image/avif`, and `MAX_UPLOAD_BYTES` (`1_500_000`) is re-checked server-side — the
client enforces both too, but the server does not trust it. `requireR2()` throws if the four signing
values are absent, so the upload routes fail loudly rather than silently.

**Reading images.** `R2_PUBLIC_BASE_URL` is optional:

- **Unset (today's state):** the app proxies the bytes itself at `GET /api/media/<key>`; uploads still
  render with only S3 API access.
- **Set:** every `src` flips to direct (`<base>/<key>`) — same keys, no row change.

A key that is already a public path (`/images/…`, the three original homes) or a full URL passes
through untouched.

**Operational command.** `npm run cms:r2` reports used and orphan objects (it needs the `R2_*` values
in `.env.local`). It **skips keys beginning with `/`** by design, so the 22 legacy `/images/…` rows are
not counted — which is why it reports `objects: 0` today.

**Bucket setup (dashboard, one-off):** create the bucket, enable public access, attach the custom
domain, and add CORS allowing `PUT` / `GET` / `HEAD` from `APP_ORIGIN`. `.local/set-cors.ts` already
does the CORS step for the current bucket.

## 16. Authentication and structure

Design notes live in `docs/cms-build-spec.md` §5. The pieces:

| Concern | Where |
|---|---|
| Sessions, cookies, throttling, CSRF check, guards | `lib/admin/auth.ts` |
| Argon2id hashing + pure password policy | `lib/admin/password.ts` / `lib/admin/password-policy.ts` |
| The cookie name | `lib/admin/session-cookie.ts` (`SESSION_COOKIE = "casa_admin_session"`) |
| The edge gate | `proxy.ts` |
| Sign-in / sign-out / me / password routes | `app/api/admin/auth/*` |

**Sessions are opaque and database-backed.** The cookie holds a random token; only its **sha256**
(`sessions.token_hash`) is stored, so a dump of the table cannot be replayed and revocation is
immediate — a disabled user is signed out at once, which a JWT would not give. The session slides:
`last_seen_at` is touched at most every `SESSION_TOUCH_MINUTES` (5), and lifetime is
`SESSION_TTL_HOURS` (default 8).

**Cookie options** (`sessionCookieOptions()`): `HttpOnly`, `SameSite=Lax`,
`Secure` outside development (the dev server is plain http, where a `Secure` cookie would never be
stored), `path=/`.

**Passwords are argon2id** (`@node-rs/argon2`). Policy (`checkPasswordPolicy`, length over
composition, NIST-style): at least `PASSWORD_MIN_LENGTH` (**8**) characters; must not contain your
username or your name; must not contain anything in the short `PASSWORD_DENY_LIST`. The pure policy
lives in `password-policy.ts` because `password.ts` pulls in argon2, whose browser build exports
nothing — a client component importing it would fail the production build.

**Throttling and lockout.**

- **Per IP:** `IP_ATTEMPT_LIMIT = 20` attempts per `IP_ATTEMPT_WINDOW_MINUTES = 15`, covering every
  attempt, so a scanner cannot keep probing.
- **Per username:** `USER_ATTEMPT_LIMIT = 5` **failures** (`MAX_FAILED_ATTEMPTS`), and the counter is
  only touched on a failure — so a real user signing in and out never throttles themselves. The
  window equals `LOCKOUT_MINUTES = 5`, so the counter and the lock expire together.
- **Account lock:** five wrong passwords set `locked_until`; a success clears the counter and the
  lock.
- Both are fixed-window counters in `rate_limits` — no extra service required. A race at a window
  boundary can cost one extra attempt, which is an acceptable trade for a three-person admin.

**Indistinguishability.** Every failure mode returns the same message
(`Invalid username or password`), and an unknown username still costs an argon2 verification against a
throwaway hash (`burnDummyPasswordCheck`), so "no such user" and "wrong password" cannot be told
apart by response or by timing. A *locked* account does say it is locked (the user caused it, and it
saves a support call); a *disabled* account stays generic. Every attempt is audited
(`auth.login`, `auth.login_failed`, `auth.login_throttled`).

**CSRF.** `assertSameOrigin()` guards every state-changing admin route: a browser always sends
`Origin` on a cross-site POST, so a mismatched origin is refused; `APP_ORIGIN` is the expected value
(or the request's own host/proto when it is unset). A request with neither `Origin` nor `Referer` is
not a browser (curl, a script), so it is allowed.

**Guards.**

- `proxy.ts` — the cheap, dependency-light gate: `/admin/**` with no session cookie is redirected to
  `/admin/signin` before any page runs.
- `requireUserPage()` — pages: signed-out → `/admin/signin`; `mustChangePassword` → `/admin/password`.
- `requireApiUser()` — route handlers: returns a `401`/`403` response instead of redirecting, with an
  `allowPendingPasswordChange` option for the password screen itself.
- `hasRole(user, "admin")` — the role check for admin-only routes.

**Structure.** The admin is its own route group with its own root layout, so neither public site's CSS
can reach it, and the auth core is imported only by server code (`auth.ts` is explicitly server-only —
no client component may import it).

## 17. Runbook — moving Turso and R2 to new accounts

> **Status: planned, not executed.** Both accounts are created by hand in dashboards, so this is not
> fully scriptable. The whole content is 3 properties and 22 media rows. A copy of this material also
> lives at `docs/cms-runbook.md`.

The two tracks — database (§17.5, T-steps) and bucket (§17.3, B-steps) — are **independent**, and a
new database with the old bucket is a harmless intermediate state: images resolve through
`/api/media/<key>` either way. The one dangerous state is a *half-updated deployment* — new credentials
in Vercel, old build still serving (§17.4).

**Nothing in a row records an account id, bucket name or database host**, so a move is a **copy plus
two environment changes — never a code change** — and `git revert` is not part of a rollback.

### 17.1 The steps, in order

1. Create the two new accounts by hand (Turso, Cloudflare R2).
2. **Fix production's migration drift** — §17.5 · T1. Worth doing whether or not the move happens.
3. **The database**: create → migrate → copy → verify → switch (§17.5 · T2–T6).
4. **Prove it in a browser** before deleting anything (§17.5 · T7).
5. **The bucket**, whenever convenient — it does not depend on step 3 (§17.3).
6. **Delete the old database and bucket last** (§17.5 · T8, §17.3 · B5).

### 17.2 Database structure

Eight tables in one SQLite database (`.local/cms.db` locally, Turso in production), identical on both
sides because the same migrations run in both. `lib/cms/schema.ts` is the authoritative definition;
`drizzle/0000…0002` are the migrations. **The full table-by-table breakdown and the exact numbers are
in §14.**

The two facts that matter for this move:

- **Sessions, rate-limit counters, audit history and `__drizzle_migrations` do not travel.** Sessions
  are meaningless elsewhere (everyone signs in again), counters are transient, and the audit trail is
  the *development* history — the new database starts its own.
- **Production's drift is exactly the `0002` pair.** It has `0001` but not
  `0002_property_placements.sql`, which added `show_on_home` / `show_on_listing` as
  `NOT NULL DEFAULT true`, so today's code cannot read that database (the property list query selects
  them). Fix it in T1.

### 17.3 The bucket (R2)

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
| `R2_PUBLIC_BASE_URL` | the custom domain, or leave it unset to keep reads proxied through `/api/media/<key>` (§15) |

**B3. Move the objects.** There is nothing to move today: `npm run cms:r2` reports `objects: 0`,
because all 22 media rows point at legacy `/images/…` paths served from `public/images`, and
`scripts/r2-status.ts` skips keys beginning with `/` by design. If uploads happen before the move,
sync them — keys are content hashes and bucket-relative, so no row needs rewriting:

```bash
rclone sync old:old-bucket new:new-bucket          # or
aws s3 sync s3://old-bucket s3://new-bucket --endpoint-url https://<new-account>.r2.cloudflarestorage.com
```

→ **Gate:** `npm run cms:r2` shows `objects: N · orphans: 0`, and N matches the new bucket.

**B4. Switch.** Update the five `R2_*` variables in Vercel, then redeploy (§17.4).

**B5. Verify, then retire.** `npm run cms:r2` → `objects: N · orphans: 0 · rows with no object: 0`.
Upload one image in the admin, confirm it lands in the new bucket and renders, then delete the old
bucket.

### 17.4 Local and production

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
  this pair, missing — see §5.
- **Variables in a deployment:** `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `APP_ORIGIN`, `IP_HASH_SALT`,
  the five `R2_*`, and `SESSION_TTL_HOURS` if the 8-hour default is wrong. `lib/cms/env.ts` is the
  schema; §7 is the annotated table.
- **Any environment change needs a redeploy.** Values are baked into a build, and a promoted
  deployment still holding the old credentials is the only genuinely dangerous state in this
  document — half the requests succeed and half fail, depending on which instance answers.
- **Maintenance commands** are `cms:migrate`, `cms:status`, `cms:r2` and `cms:copy` — `--turso` reads
  `.env.turso.local`, and the process environment wins over both env files (`scripts/cli-utils.ts`).

### 17.5 Turso — moving the database

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

**T7. Accept it, in a browser.** (Sign in at **`/admin/signin`** — the runbook's older prose says
`/admin/login`.)

1. Sign in at `/admin/signin` as `casa`. The password is unchanged: argon2id hashes are portable.
2. `/admin/properties` lists 3 properties, all published.
3. Edit one and **Publish** it — the editor returns to `#media`.
4. `npm run cms:status` (with the new credentials) shows a new `audit_log` row for that edit, proving
   writes and the audit trail both landed in the new database.
5. `GET /api/public/properties` returns 3 properties.
6. Home and listing pages render — the check that `show_on_home` / `show_on_listing` are populated,
   the exact columns production is missing today.

**T8. Retire the old database.** Keep it read-only for a few days; delete it only once T7 has passed
and no content is missing.

### 17.6 Safety, rollback and open decisions

- **One track at a time** — each is independently verifiable, and every intermediate state is fine.
- **Redeploy on any environment change**, then confirm the promoted deployment is the new one.
- **Delete nothing until T7 and B5 have passed.** Every `--turso` command prints its target first, and
  the two env files stay separate until T8; sessions do not survive the move, by design.
- **Decisions before T2:** the region (fixed at creation — the one latency win available); the bucket
  name (`casa-premier-media`, cosmetic — it reaches the app only through `R2_BUCKET`); whether Vercel
  *Preview* points at the new database or fails loudly by leaving `TURSO_DATABASE_URL` unset — it must
  not still point at the **old** one after cutover, or a preview write is invisible in production; and
  whether the app's host or domain also moves, which would change `APP_ORIGIN` (the CSRF origin check)
  and require the new origin in the bucket's CORS policy.
- **Rollback is a variable change, not a restore.** Put the old `TURSO_*` back and redeploy, losing
  content written after cutover; or put the five old `R2_*` back and redeploy, re-uploading anything
  added to the new bucket — keys are content hashes, so no row changes.
- **`NEXT_PUBLIC_SISTER_SITE_URL` is not part of a move.** It is stale and unread (§7); do not use it
  to keep the two sites pointing at each other.

### 17.7 Appendix — how `cms:copy` was tested

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

## 18. Related documents

| Document | What it holds |
|---|---|
| `docs/cms-build-spec.md` | The numbered build spec: scope, schema, API design, auth design, effort, risks, and the per-phase **evidence tables** (§17–§24). Authoritative where this document and the spec overlap on design intent. |
| `docs/cms-runbook.md` | The runbook on its own — the steps in order, the schema, local vs production, exact expected output per step, rollback, and `cms:copy`. Reproduced in §17 here. |
| `README.md` | The short overview at the repository root, pointing back to this file. |
| `lib/cms/schema.ts` | The authoritative table definitions, ahead of any prose. |
| `package.json` | The authoritative list of scripts (`cms:*`, `admin:*`) and dependencies. |
