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

> Use `package-lock.json` (npm). The leftover `pnpm-lock.yaml` was removed.

## Deployment (Vercel)

The app is a standard Next.js 16 project — no env vars, no custom server, no external font/image CDNs (fonts are self-hosted; `images.unoptimized: true`).

### Step by step

1. **Commit & push** the `merge-sites` branch to `main` on GitHub (`LiderLabs/casapremiere`).
2. In Vercel: **Add New → Project → Import** `LiderLabs/casapremiere`.
3. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: leave blank (repository root)
   - **Build Command / Install Command**: leave defaults
   - **Environment Variables**: none needed
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

- Main site → interior: `SISTER_SITE_URL` from `lib/site-links.ts` (resolves to `/interior/`)
- Interior → main: `MAIN_SITE_URL` (resolves to `/`)
- These are relative paths, so they work on any domain without configuration.

## Appointment booking

Both sites share one booking flow that is **UI-complete but not yet wired to a
delivery channel** — deliberately, so the site never claims to have received a
request it cannot deliver.

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

**Current behaviour:** `BOOKING_SUBMISSION_ENABLED` is `false`, so
`Request Appointment` is disabled and the modal's primary action is a **WhatsApp
hand-off** — `bookingWhatsAppHref()` URL-encodes whatever the visitor has typed
into `wa.me/233555287488`. Nothing is sent or stored by the site; the visitor's own
app sends it. Phone (`tel:`) and email (`mailto:`) links are also available.

**To enable real submissions later:** add the delivery call (API route + email)
inside `onSubmit` in `booking-modal.tsx` and flip
`BOOKING_SUBMISSION_ENABLED` to `true` in `lib/booking.ts`. Validation, the
calendar rules, the loading/success states and the empty-honeypot guard are
already in place.

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

## History note

The original two apps were `apps/interior` (Hously) and `apps/main-app`. `apps/interior` was removed after the merge was verified; it remains fully recoverable from git history (`git log --oneline -- apps/interior`, `git checkout <commit> -- apps/interior`).
