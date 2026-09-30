# CASA Premiere — Single Next.js App

One Next.js 16 application serving **two complete websites** with their original designs, fonts, and animations fully preserved:

| Route | Site | Title | Fonts |
|---|---|---|---|
| `/` | **EVASION** (CASA main site) | EVASION | Inter (self-hosted via `next/font`) |
| `/interior` | **Hously** (interior site) | Hously — Modern Architecture Experience | Geist Mono + system fallback |

Both sites were merged from two separate apps into one, verified **pixel-identical** against the originals (full-page screenshot diffs at 1440px and 390px viewports).

## Project structure

```
repo root/                     ← the single app (repository root)
  app/
    (site)/                    ← main site (route group, no URL segment)
      layout.tsx  globals.css  page.tsx        → "/"
    (interior)/                ← interior site (separate root layout + CSS)
      layout.tsx  globals.css
      fonts/                   ← Satoshi woff2 (intentionally unreferenced, kept for reference)
      interior/page.tsx                        → "/interior"
  components/
    sections/ header.tsx ...   ← main-site components
    interior-header.tsx footer.tsx hero.tsx philosophy.tsx projects.tsx ... ← interior-site components
  lib/site-links.ts            ← cross-site link constants: SISTER_SITE_URL="/interior", MAIN_SITE_URL=""
  public/images/               ← all assets from both original apps (names kept)
```

The two route groups each ship their **own** root layout and `globals.css`, so the two design systems (palettes, radii, animation keyframes) can never bleed into each other.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000  (/ and /interior)
```

Production build & run:

```bash
npm run build      # compiles both routes as static pages
npm start          # serves on :3000
```

Since the content flip (§ *Content management*) both public routes are prerendered **from the content
database**, so a production build needs the two Turso variables — `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN`. `npm run dev` needs nothing: outside production, `lib/cms/env.ts` falls back to
`file:./.local/cms.db`, so local work never touches the live catalogue. If a deploy ever fails while
collecting `/` page data, this is the missing pair.

> Use `package-lock.json` (npm). The leftover `pnpm-lock.yaml` was removed.

## Deployment (Vercel)

The app is a standard Next.js 16 project — no custom server, no external font/image CDNs (fonts are
self-hosted; `images.unoptimized: true`). Two environment variables are needed now: the two Turso
values, because the public routes read the database at build time.

### Step by step

1. **Commit & push** the `merge-sites` branch to `main` on GitHub (`LiderLabs/casapremiere`).
2. In Vercel: **Add New → Project → Import** `LiderLabs/casapremiere`.
3. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: leave blank (repository root)
   - **Build Command / Install Command**: leave defaults
   - **Environment Variables**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (plus `APP_ORIGIN`, `IP_HASH_SALT` and the `R2_*` values the admin CMS needs — see `docs/cms-build-spec.md` §10). The first two must be present at **build** time, because `/` and `/interior` are prerendered from the database
   - Node.js 20+ (default)
4. Deploy. The **preview URL** is a full production build — verify `/` and `/interior` there.
5. **Domains**: assign your production domain (e.g. `casapremiere.com`) to this project.
   - If the interior site previously lived on its own domain/URL, add a **redirect** in Vercel (Project → Settings → Domains, or a `redirects` entry in `next.config.mjs`) from the old interior URL → `/interior`.
6. Retire the two old projects (keep them paused as an instant fallback for the first week).

### Day-to-day after cutover

- One push to `main` = one production deploy (both sites included).
- Pull requests get automatic preview deployments.
- Rollback: Vercel dashboard → Deployments → **Rollback** (instant, immutable builds).

### Other platforms

Any Node 20+ host works with defaults: `npm run build && npm start` (single port). No reverse-proxy rules or rewrites required — `/interior` is just a route.

## Cross-site links

Both sites live in one app, so a "cross-site" link is just a route. Those links
are **not** hand-written any more — they go through one module so the paths stay
consistent, the visitor's context survives the jump, and every click is
countable.

| Piece | Where |
|---|---|
| Destination, attribution and the surface vocabulary | `lib/cross-sell.ts` |
| The link itself (renders the anchor, reports the click) | `components/cross-site-link.tsx` |
| Landing context read on arrival (`?book=1&service=…`) | `bookingPrefillFromSearch()` in `lib/booking.ts`, called by `components/booking/booking-provider.tsx` |

```ts
crossSiteHref("interior", { surface: "estate-drawer", service: "Interior design" });
// → /interior/?src=estate-drawer&service=Interior+design
```

**Why `?src=`.** Both sites answer on the same origin, so the referrer is
useless — `?src=<surface>` is the only signal that separates a cross-sell click
from an ordinary page view. `CrossSellSurface` is a closed union rather than
free text precisely so `estate-drawer` and `estate-footer` can be compared. The
same click also fires the Vercel Analytics event `cross_site_click` with
`{ surface, target }` (`?service`/`?property` where relevant).

**Where the links are.** Estate → interiors: header (desktop + mobile menu),
footer (Explore and Services columns), the "The Interior" band, the property
drawer, and the home cards in the interiors page's estate band. Interiors →
estate: header (desktop + mobile), footer, the "The Exterior" band, the FAQ
answer about the estate, and each card in "The homes we design for".

**Landing context.** A cross-site link can arrive with `?service=`,
`?location=` and `?notes=`, which `BookingProvider` reads on load and passes to
the modal — so `/interior/?book=1&service=Interior+design` opens the appointment
form already filled in. `service` is validated against `BOOKING_SERVICES` before
it reaches the form, because the value comes from a URL.

**In-place hand-offs.** Three estate surfaces offer the interiors service
without navigating at all — the property drawer, the shortlist panel and the
affordability dialog. Those open the appointment modal preset to
`Interior design` (with the property or the whole shortlist in the notes) and
report the `cross_sell_booking` event, which is what shows whether someone
looking at a home actually asked us to fit it out.

**A site's own logo is not a cross-site link.** `INTERIOR_HOME` in
`lib/site-links.ts` exists because both original apps answered on `/`: inside the
interiors pages, `href="/"` silently became a link to the estate (and the
interiors footer logo did exactly that). Use `INTERIOR_HOME` for a logo or "back
to the top of this site"; `SISTER_SITE_URL`/`MAIN_SITE_URL` mean the *other* site.

## The homes we design for (`/interior`)

The interior page carries one band — **The homes we design for** — that hands the
visitor to the estate side.

| Piece | Where |
|---|---|
| Section | `components/interior-homes.tsx` |
| Property data | `lib/properties.ts` — the same file the estate's grid and quick-view drawer read |
| Rendered by | `app/(interior)/interior/page.tsx`, between `InteriorSection` and `CallToAction` |

Each card lands on `/?property=<slug>`, which the estate's `PropertyProvider`
reads on load and opens directly, so the visitor arrives at the home itself
rather than at a hero with a scroll to find. Prices use the estate's own rule: a
price string with no digits is still a placeholder and stays hidden
(`getPropertyPriceValue()` in `lib/properties.ts`).

## Contact form and email delivery (Formspree)

The estate site's contact section is a working form: validation in the browser,
delivery over [Formspree](https://formspree.io), and success shown only once the
endpoint has accepted the post. Both forms share one configuration module.

| Piece | Where |
|---|---|
| Form id, payload builders, public email address | `lib/forms.ts` |
| The enquiry form (validation, submit, success view) | `components/sections/contact-form-panel.tsx` |
| The section shell that renders it | `components/sections/contact-section.tsx` |
| Appointment payload | `buildBookingSubmission()` in `lib/booking.ts` |



**Email address.** `CONTACT_EMAIL` (`info@liderlabs.com`) in `lib/forms.ts` is the
single source for every `mailto:` - the contact section, both footers, the
interiors call-to-action, and the property drawer (which reads `BOOKING_EMAIL`,
re-exported from the same constant).

**What is sent.** The submitted fields plus `_subject` (so the notification reads
"New enquiry - Interior design" instead of "Form submission"), `source`
(`estate-contact-form` / `appointment-modal`) and `page` (the URL the visitor was
on). Empty optional fields are left out. Formspree uses the `email` field as the
reply-to address.

**Spam.** Both forms carry a `_gotcha` honeypot, which Formspree discards
server-side. The contact form's field is hidden and read straight off the DOM at
submit time, so a bot that fills it is dropped even though the payload is built
by hand; the appointment modal's existing empty-`company` zod rule feeds the same
field.

**Failures are visible.** A failed request, a blocked form or a form id that no
longer exists comes back as a form-level error and is rendered next to the submit
button with the phone/email fallback - the success view is never shown for a
submission that did not reach Formspree. Field-level errors Formspree returns are
rendered under the field they belong to.

**Why the form is its own chunk.** `contact-section.tsx` renders the details
column and loads the form with `next/dynamic`, so react-hook-form, zod, the Radix
select and the Formspree client stay off the landing page's critical path - the
same treatment the booking modal, the property drawer and the affordability
dialog get. `ssr` is left at its default, so the empty form is still part of the
prerendered HTML: no blank card while the chunk arrives, and no layout shift.

## Appointment booking

Both sites share one booking flow that validates in the browser, delivers the
request over Formspree, and shows its success view only once the endpoint has
accepted it - so the modal can never claim a request was received when it was
not.

| Piece | Where |
|---|---|
| Modal (form, calendar, slots, success view) | `components/booking/booking-modal.tsx` |
| Provider + `useBooking()` hook, single `<Dialog>` instance | `components/booking/booking-provider.tsx` |
| Rules, formatters and message builder | `lib/booking.ts` |

**Triggers:** the header pill (`Book a Visit`, desktop + mobile menu), the contact
section's `Prefer to book a visit?` button, the footer's `Consultation` /
`Book an appointment` entries (which open the modal instead of navigating), the
interior page's call-to-action button, and the deep links `/#book` and `/?book=1`.

The provider is mounted in **both** route groups (`app/(site)/page.tsx` and
`app/(interior)/layout.tsx`), so the same modal opens from either site. The modal
inherits each route group's own design tokens, so it renders in CASA's
black-and-white on `/` and Hously's warm neutrals on `/interior`. The interior CTA
opens it with `openBooking({ service: "Interior design" })`, which presets the
service field via `BookingPrefill` (`lib/booking.ts`) without wiping anything
already typed.

**Availability** is configuration, not code — edit `lib/booking.ts`:

```ts
export const BOOKING_SLOTS = [...];            // bookable times
export const BOOKING_WEEKDAYS = [1, 2, 3, 4, 5]; // Mon-Fri
export const BOOKING_MIN_LEAD_DAYS = 1;        // earliest = tomorrow
export const BOOKING_HORIZON_DAYS = 90;        // calendar range
export const BOOKING_BLACKOUT_DATES = [];      // e.g. ["2026-12-25"]
```

`isDateAvailable()` is used by both the calendar (`disabled`) and the zod schema,
so a stale modal cannot submit a past date, a weekend or a blackout day.

**Delivery.** `Request Appointment` posts the validated request to Formspree from
`onSubmit` in `booking-modal.tsx`; the button reads `Sending...` while the request
is in flight, the success view appears only when the endpoint reports success, and
a failure shows a form-level message above the buttons. The payload is
`buildBookingSubmission()` in `lib/booking.ts` - name, email, phone, service,
location, the date and slot formatted for a human, notes, and the honeypot.

**Emergency off-switch.** `BOOKING_SUBMISSION_ENABLED` in `lib/booking.ts` is
`true`. Set it back to `false` and the modal returns to the WhatsApp-only
hand-off: `Request Appointment` disabled, and `bookingWhatsAppHref()` URL-encoding
whatever the visitor has typed into `wa.me/233555287488` for the visitor's own app
to send. Phone (`tel:`) and email (`mailto:`) links are available in both modes,
and a blocked or offline submission falls back to them.

The modal is loaded with `next/dynamic` on first open, so Radix Dialog,
react-day-picker, react-hook-form and zod stay out of the initial page bundle.

## Property quick-view drawer

The "Featured Properties" cards open a **drawer** instead of navigating — a quick
view that keeps the page (and the other homes) visible behind it.

| Piece | Where |
|---|---|
| Property data (single source of truth) | `lib/properties.ts` |
| Provider + `useProperty()` hook, lazy-mounts the drawer | `components/property/property-provider.tsx` |
| The drawer: gallery, specs, amenities, host, pager | `components/property/property-drawer.tsx` |
| Trigger | `components/sections/collection-section.tsx` (`View Property`, `aria-haspopup="dialog"`) |
| Mounted in | `app/(site)/page.tsx`, inside `BookingProvider` |

**Presentation:** a right-hand `Sheet` at ≥768px (page dimmed but visible behind —
the "quick view" feel) and a full-screen bottom sheet on mobile. Both sit at
`z-[60]` so they cover the fixed pill header.

**Behaviour**

- Loaded with `next/dynamic` on first open, so the drawer markup, gallery and
  spec tables stay out of the initial page bundle.
- **Deep link:** opening writes `?property=<slug>` with `history.replaceState`,
  and the slug is read on load — so a quick view can be shared or reloaded.
  Other params (e.g. `?book=1`) and the current hash are preserved.
- **Book a viewing** closes the drawer, then opens the appointment modal
  prefilled with `service: "Buy a property"` and `location: "<name>, <location>"`
  (see `BookingPrefill` in `lib/booking.ts`). The delay matches the sheet's
  300ms close transition so the two overlays never fight for focus.
- The gallery's **Expand** button opens an in-panel viewer (arrows + close)
  rather than a nested dialog, so only one overlay is ever open.
- The drawer footer's pager walks between the properties without closing it.

**Authoring content** — everything is in `lib/properties.ts`:

- A `meta` or `price` string **with no digits** counts as unfinished: the drawer
  hides it instead of showing a stray dash. Add the real figures and it appears.
- Spec rows with an empty `value` are grouped into one "On request: …" line;
  fill one in and it becomes its own row.
- `image` is the card image, `hero` is the drawer's opening image, `gallery` is
  the rest of the images.

**Deliberately not included:** per-property URLs, metadata, sitemap entries and
detail pages — this is a quick view, not a listing page. The card grid stays
server-rendered, so each home's name, location, spec line and price are still in
the initial HTML.

## Content management (admin CMS) — Phases 1–7 built

The admin lives at `/admin` in this repo. **Sign-in, sessions, throttling, the audit trail, the
`(admin)` shell (Phase 1)**, **the content schema — `properties`, `property_media`, `settings` —
applied through one migration folder that runs against the local file database or Turso (Phase 2)**,
**user management at `/admin/users` (Phase 3)**, **the properties API — drafts, optimistic saves,
publish/unpublish with instant revalidation, reorder, delete, business settings and a public
`Property[]` feed (Phase 4)**, **the screens — dashboard, property list, section editor,
settings form, history (Phase 5)**, **the image pipeline — browser resize → presigned `PUT` → R2
(Phase 6)** and **the public read flip — `/` and `/interior` render published rows from the database,
and every content write revalidates both routes (Phase 7)** are built and verified (evidence tables in
§17–§23 of `docs/cms-build-spec.md`). The array in `lib/properties.ts` is no longer what the sites
serve: it stays in the file as the seed source for `npm run migrate:properties` and as the pixel
gate's baseline, and nothing in the app reads it.

> **Turso is connected.** The production database carries the same schema as the local file — 2
> migrations, 7 tables — plus the first admin, `casa`, who must choose their own password at first
> sign-in. The credentials live in gitignored `.env.turso.local` and are what the `--turso` flag
> reads; Vercel needs the same two values when the admin is deployed. The names are exact —
> `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — and a pair under any other name is silently ignored.

| Piece | Where |
|---|---|
| Full build spec (scope, schema, API, auth, effort, risks, evidence per phase) | `docs/cms-build-spec.md` |
| Admin (Phase 1 built) | `app/(admin)/**` — its own route group with its own root layout, so neither site's CSS can bleed in |
| Content store (Phases 1–2) | **Turso (libSQL)** via `@libsql/client` + Drizzle — dev uses `file:./.local/cms.db`, production a `libsql://` URL, so both run the same SQL and the same migrations with no database server to manage |
| Users (Phase 3 built) | `/admin/users` — create, change role, disable/enable, reset password, "sign out everywhere". Admin-only, audited, and unable to remove the last admin or yourself |
| Properties API (Phase 4 built) | `/api/admin/properties**` (list, drafts, optimistic saves, publish/unpublish, reorder, delete), `/api/admin/settings`, `/api/public/properties`. One zod schema per write path, real `400/404/409/422` behaviour, everything audited. The screens arrived in Phase 5 |
| Properties screens (Phase 5 built) | `/admin` (live/draft/pending counts, pending shortcut, last-10 activity), `/admin/properties` (thumbnails, badges, create, publish/unpublish, admin-only reorder + slug-typed delete), `/admin/properties/[slug]` (section saves with `updatedAt` revision, publish dialog, media manager), `/admin/settings`, `/admin/audit` + `GET /api/admin/audit` |
| Media API (Phase 6 built) | `POST /api/admin/uploads/sign` (5-min presigned PUT, editor, rate-limited), `POST /api/admin/uploads/confirm`, `PATCH`/`DELETE /api/admin/media/[id]`. Deleting a property deletes its R2 objects |
| Images (Phase 6 built) | **Cloudflare R2** — resized in the browser to WebP (≤2000 px, q0.8, ≤1.5 MB), uploaded straight to R2 with a presigned `PUT`, confirmed into `property_media`. No public URL exists yet, so reads proxy through `GET /api/media/<key>` (spec §22.1); `R2_PUBLIC_BASE_URL` flips them to direct later. `npm run cms:r2` shows used and orphan keys |
| Public read path (Phase 7 built) | `lib/cms/public.ts` — `listPublishedProperties()` plus the `Property[]` mapper — is the single source of the public catalogue. `app/(site)/page.tsx` reads it, passes it to `components/property/property-provider.tsx`, which owns it for the grid, the drawer/pager and the shortlist (`useProperty()`); `components/interior-homes.tsx` reads the same rows server-side. `lib/properties.ts` keeps only types and pure helpers, and `findPropertyBySlug(list, slug)` takes the catalogue as an argument |
| Publish (built) | `revalidatePath("/")` + `revalidatePath("/interior")` on **every content write** — publish/unpublish, a save, a reorder, a delete, a media change — through `revalidatePublishedPages()` (`lib/cms/revalidate.ts`), so a change is live in seconds without a commit or redeploy |
| Editor guide (planned) | `docs/` alongside this README |

Local workflow:

```bash
npm run cms:migrate                                     # creates/updates ./.local/cms.db (gitignored)
npm run admin:create-user -- --username casa --role admin
npm run cms:status                                      # migrations, tables, row counts, accounts
npm run cms:r2                                          # image objects, used vs orphan (needs R2_* in .env.local)
npm run dev                                             # → http://localhost:3000/admin
npm run admin:reset-password -- --username casa         # break-glass: unlocks + resets, forces a change
```

Production data lives in Turso. Those two credentials sit in gitignored `.env.turso.local` (and in
Vercel's environment variables), which is what the `--turso` flag reads — so a plain `npm run dev`
never writes to the live catalogue:

```bash
npm run cms:migrate -- --turso                          # apply ./drizzle to Turso
npm run admin:create-user -- --username casa --role admin --turso
npm run cms:status -- --turso
```

**Roles.** Two. `admin` does everything, including delete, reorder, business settings and users.
`editor` can create and edit homes, manage media, and **publish or unpublish** them — but cannot
delete a home, reorder the catalogue, or manage users. An editor's un-published edit is invisible
to visitors and shows as *Pending changes* in the admin list.

**The public side reads the database (Phase 7, built).** The catalogue moved from a hard-coded array to
a server-side read, and the pieces that changed are —

`app/(site)/page.tsx` · `components/property/property-provider.tsx` · `components/sections/collection-section.tsx` ·
`components/property/property-drawer.tsx` · `components/property/shortlist-panel.tsx` ·
`components/interior-homes.tsx` · plus `components/property/shortlist-store.ts` and
`components/property/shortlist-float.tsx` (the shortlist keeps slugs, not homes) and
`lib/cms/public.ts` (the read) · `lib/cms/revalidate.ts` (one path list, called by every write route).

`lib/properties.ts` keeps its types, `PROPERTY_HOST` and `getPropertyPriceValue()` (client components import
them, so they stay free of server-only code), and its `PROPERTIES` array is now read by nothing but
`npm run migrate:properties` and the pixel gate. The gate itself: the pre-refactor captures live in `.local/baseline/`
and `node .local/verify/pixel-gate.mjs` fetches both routes from a local production build and compares the
rendered markup character for character — **identical today, 75,989 chars on `/` and 39,271 on `/interior`** —
while asserting every published home is still named and linked. `node .local/verify/revalidation-e2e.mjs`
then proves the writes reach the pages (rename → both routes `cache MISS` and updated; unpublish → gone;
publish → back; reorder → the grid follows), and puts everything back. `node .local/verify/auth-e2e.mjs`
closes the auth half of the checklist in one run — the sign-in failure modes (a foreign `Origin` refused
before a credential is read, an unknown username and a wrong password indistinguishable, five wrong guesses
locking the account, a disabled account, a temporary password that reaches nothing until it is changed)
and the authorization matrix (an editor may read, save and publish, and gets `403` for delete, reorder,
users and settings), plus a per-address throttle proof. It creates its own throwaway users each run,
removes them and restores the rows it touched, so two runs in a row give the same 82/82 PASS.
All three scripts are gitignored local artefacts; evidence table in `docs/cms-build-spec.md` §23.

## Before / after videos (`/interior`)

The interior page carries one section — **The Transformation** — holding the two clips
of the same rooms before and after the fit-out.

| Piece | Where |
|---|---|
| Section (markup, playback, crossfade) | `components/before-after.tsx` |
| Clip data — src, label, caption, optional poster | the `CLIPS` array in that file |
| Media | `public/images/before.mp4`, `public/images/after.mp4` |
| Rendered by | `app/(interior)/interior/page.tsx`, between `Projects` and `Expertise` |

**One pinned stage, every width.** The section pins for 200svh on phones and 280vh from
`lg` up. Nothing changes for the first 30% of the pinned scroll (the deliberate delay);
at that point the phase latches to "after" and the two cards crossfade over 1.1s as a
CSS transition — scroll *arms* the change, CSS performs it, which keeps it smooth on
momentum scrolling. Scrolling back only leaves "after" below 20% (hysteresis), so a
trackpad resting on the trigger cannot flicker between states. The rail is fed
continuously by `--p`, and the week ticks (`0 · 3 · 8 · 14`) follow the same landmarks —
week 8 sits exactly on the trigger, so the "after" clip reads as starting at week 8 and
running through to handover.

> The choreography is four constants at the top of `components/before-after.tsx`:
> `HOLD_UNTIL`, `DISARM_AT`, `SETTLE_UNTIL` and `CROSSFADE_MS` — the last of which must
> match the `duration-[1100ms]` class on the cards.

**Reduced motion.** Every layout and motion value is a `motion-safe:*` class, so visitors
who ask for less motion get the two cards stacked in normal flow at every width, with an
IntersectionObserver playing whichever one is on screen — no pin, rail, ticks or touch
toggle. The server-rendered HTML is already correct for both viewport and motion
preference: no flash, no layout shift, no hydration mismatch.

**Playback.** Both clips are muted, looping and `playsInline`. The "before" clip is
`preload="metadata"`; the 30MB "after" clip stays unloaded (`preload="none"` and no `src`
attribute at all) until the visitor is 15% into the pin, then switches to
`preload="auto"`, so its first frame is painted before the crossfade reaches it. Playback
stops when the section leaves the viewport or the tab is hidden, and every card has a
pause/play button — required by WCAG 2.2.2 for motion that runs longer than five seconds,
and the fallback when a browser blocks autoplay. A poster is optional: add
`poster: "/images/<frame>.jpg"` to a clip in `CLIPS` and it is used as the still until the
video paints.

**Details worth keeping.** The pin window is measured from the sticky wrapper rather than
`window.innerHeight`, because the mobile URL bar changing height would otherwise move the
trigger mid-scroll. Touch devices also get a `Before | After` toggle
(`motion-safe:pointer-coarse:flex`) that latches a phase and hands control back once the
visitor scrolls 8% against it. A reload part-way down the section is *placed* in the right
state instead of animating into it. The stage is full-bleed on phones and a height-driven
16:9 box from `lg` up, and both sources are 848px wide, so nothing is upscaled past ~1.2×.

**Asset note.** Both files are 848px-wide H.264 with the `moov` atom at the end of the
file. A `-movflags +faststart` remux plus a CRF ~26 re-encode would take the pair from
~45MB to ~15MB and let the first frame appear sooner; the section works as-is without it.

## History note

The original two apps were `apps/interior` (Hously) and `apps/main-app`. `apps/interior` was removed after the merge was verified; it remains fully recoverable from git history (`git log --oneline -- apps/interior`, `git checkout <commit> -- apps/interior`).
