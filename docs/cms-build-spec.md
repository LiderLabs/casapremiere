# CMS build spec — CASA Première admin (Turso + R2)

Status: approved for implementation · Owner: LiderLabs · Companion doc: `README.md` (site architecture).

One admin, inside this Next app, for the property catalogue that **both** public sites read. Content lives in
**Turso (libSQL)**, images in **Cloudflare R2**, and publishing makes `/` and `/interior` update in seconds.
Authentication is username + password with database-backed sessions, and admins manage users in-app. No
third-party CMS, no OAuth provider, no database server to run.

## 1. Purpose, scope, non-goals

**Purpose.** Let CASA staff manage property listings (later: business details, bookings) without a developer,
while `/` and `/interior` keep their current rendering, behaviour and appearance.

**In scope (v1).** Property CRUD · ordering · draft/publish · image upload, resize and alt text to R2 ·
username/password auth · admin-managed users · audit log · instant publish.

**Out of scope (v1).** Self-service password reset by email · per-field history/diff · public preview of drafts ·
bookings and shortlist tables · i18n.

**Non-goals.** Changing either site's design or bundle, adding a vendor CMS, adding SSR to the public pages
beyond what ISR needs.

## 2. Decisions (locked)

| # | Decision |
|---|---|
| D1 | Admin lives in this repo at `/admin` (new `app/(admin)` route group), deployed to Vercel alongside both sites |
| D2 | Content store: **Turso (libSQL)** — reachable natively from Vercel via `@libsql/client`; no bridge Worker |
| D3 | Images: **Cloudflare R2**, uploaded browser→R2 with a presigned `PUT`; public reads from a custom domain |
| D4 | Auth: **username + password**, DB-backed sessions; **admins manage users** (create, role, disable, reset password). No OAuth provider |
| D5 | Content is SQLite in both environments: dev = `file:./.local/cms.db`, prod = `libsql://…turso.io` (same driver, same SQL, no Docker) |
| D6 | Publish → `revalidatePath("/")` + `revalidatePath("/interior")`, so edits are live in seconds |
| D7 | Public read path refactor (six files) so pages fetch the catalogue server-side; `lib/properties.ts` keeps its types and pure helpers |
| D8 | Cloudflare Access is not used (it cannot protect a Vercel hostname) |
| D9 | **Editors may publish and unpublish.** Property **delete**, **reorder** (open question 1), **settings** and **user management** stay admin-only |

## 3. Architecture

```
editor ─► /admin   (Vercel · Node runtime · dynamic rendering · session cookie)
             │
             ├─ /api/admin/**  ──► @libsql/client ──► Turso
             │        (properties · property_media · users · sessions · settings · audit_log · rate_limits)
             │        └─ publish ──► revalidatePath("/") · revalidatePath("/interior")
             │
             ├─ /api/admin/uploads/sign ──► presigned PUT ──► R2   (bytes go browser → R2, never via a function)
             └─ images served from https://images.casapremiere.com/<key>

visitor ─► casapremiere.com (static + ISR)   ·   /interior   ── same catalogue, cross-sell unchanged
```

| Piece | Where |
|---|---|
| Admin pages | `app/(admin)/layout.tsx`, `app/(admin)/admin/**` |
| Sign-in / forced password change | `app/(admin)/admin/signin/page.tsx`, `app/(admin)/admin/password/page.tsx` |
| Admin API | `app/api/admin/**` (`export const dynamic = "force-dynamic"`) |
| Route gate (Next 16 proxy) | `proxy.ts` — cookie-presence check and redirect; never the authorization decision |
| Password policy (client-safe) | `lib/admin/password-policy.ts` — pure, no dependencies, the only file here a client component may import |
| Password hashing (server-only) | `lib/admin/password.ts` — `@node-rs/argon2`; importing this from a client component fails the build |
| Crawler rules | `app/robots.ts` — disallows `/admin` and `/api` |
| Public API | `app/api/public/properties/route.ts` |
| Auth core (server) | `lib/admin/auth.ts` — `hashPassword`, `verifyPassword`, `createSession`, `resolveSession`, `requireUser`, `requireRole`, `assertSameOrigin` |
| DB client / schema / migrations | `lib/cms/db.ts`, `lib/cms/schema.ts`, `drizzle.config.ts`, `drizzle/**` |
| Queries (no SQL in components) | `lib/cms/queries.ts` |
| Zod validation (shared with forms) | `lib/cms/validation.ts` |
| Media | `lib/cms/r2.ts` (presign + delete), `app/(admin)/admin/properties/[slug]/media-manager.tsx` |
| Public read → `Property[]` | `lib/cms/public.ts` |
| Types + pure helpers (client-safe, unchanged) | `lib/properties.ts` |
| Scripts | `scripts/admin-create-user.ts`, `scripts/admin-reset-password.ts`, `scripts/migrate-properties.ts`, `scripts/export-content.ts` |

Three rules keep the two public sites untouched:

1. **`app/(admin)/layout.tsx` is its own root layout** (it renders `<html>`/`<body>` and imports neither site's
   `globals.css`), exactly as `(site)` and `(interior)` do today — so no admin CSS or code reaches `/` or `/interior`.
2. The admin is **dynamic** (`force-dynamic`, never prerendered) while the public pages stay static + ISR.
3. The public read path is the only change to existing public code, and it is confined to the six files listed in
   §9 — types, helpers and every visual component keep their current contracts.

## 4. Data model (SQLite, via Drizzle)

```sql
CREATE TABLE properties (
  slug TEXT PRIMARY KEY,                 -- the ?property= deep-link value; immutable after create
  name TEXT NOT NULL, location TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Available','Under construction','Sold','Coming soon')),
  position INTEGER NOT NULL,             -- grid order AND drawer pager order (user-visible)
  meta TEXT NOT NULL DEFAULT '', price TEXT NOT NULL DEFAULT '',   -- "no digits = hidden" rule preserved
  description TEXT NOT NULL DEFAULT '',
  intro TEXT NOT NULL DEFAULT '[]',      -- JSON string[]
  highlights TEXT NOT NULL DEFAULT '[]', -- JSON {icon,title,description}[]
  specs TEXT NOT NULL DEFAULT '[]',      -- JSON {label,value}[]
  amenities TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT, published_by TEXT,  -- who put it live, shown in the admin list
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL DEFAULT ''
);
CREATE INDEX properties_position_idx ON properties(position);

CREATE TABLE property_media (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL REFERENCES properties(slug) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('card','hero','gallery')), position INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL, alt TEXT NOT NULL DEFAULT '',
  width INTEGER, height INTEGER, bytes INTEGER, created_at TEXT NOT NULL
);
CREATE INDEX property_media_slug_idx ON property_media(slug, role, position);

CREATE TABLE users (
  id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,     -- lowercased [a-z0-9._-]{3,32}
  email TEXT UNIQUE, name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin','editor')),
  password_hash TEXT NOT NULL,                           -- argon2id
  must_change_password INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_attempts INTEGER NOT NULL DEFAULT 0, locked_until TEXT, last_login_at TEXT,
  created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT NOT NULL, updated_by TEXT
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,            -- sha256(raw cookie token); the raw token is never stored
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
  ip_hash TEXT, user_agent TEXT, revoked_at TEXT
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE rate_limits (key TEXT PRIMARY KEY, window_start TEXT NOT NULL, count INTEGER NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL,
  updated_at TEXT NOT NULL, updated_by TEXT NOT NULL DEFAULT '');
CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, payload TEXT);
CREATE INDEX audit_log_at_idx ON audit_log(at DESC);
```

**Enforced in the API, not the schema:** `slug` is immutable (renaming it breaks shared `?property=` links and the
interior site's cards); `position` is rewritten transactionally on reorder; the four JSON columns are validated with
the zod shapes below, which mirror `lib/properties.ts` exactly — `intro: string[]`,
`highlights: { icon: 'space'|'light'|'joinery'|'outdoor'|'comfort'|'detail', title, description }[]`,
`specs: { label, value }[]`, `amenities: string[]`.

Timestamps are ISO-8601 `TEXT` in `GMT (Accra)`, matching the convention in `lib/booking.ts`.

**Phase 2 tables (not in v1):** `bookings` and `shortlist` — this is what makes
`BOOKING_SUBMISSION_ENABLED` (`lib/booking.ts`) real and moves the shortlist off `localStorage`.

## 5. Authentication and authorization

### 5.1 Model — username + password, database-backed sessions

Sessions are **opaque tokens in a cookie, with the session row in Turso** rather than JWTs, because users are
admin-managed in-app and revocation (disable a user, "sign out everywhere", password change) has to be immediate.

| Aspect | Choice | Why |
|---|---|---|
| Password hashing | **argon2id** via `@node-rs/argon2` (`memoryCost: 19456`, `timeCost: 2`, `parallelism: 1` — the OWASP baseline) on the Node runtime. `bcryptjs` (pure JS, cost 12) is the documented fallback if the native module is ever a problem on Vercel | A database leak never hands over passwords; both packages have prebuilt/zero-build paths |
| Session token | `crypto.getRandomValues(32)` → base64url in the cookie; only **`sha256(token)`** is stored (`sessions.token_hash`) | A leak of the session table cannot be replayed as a live session |
| Cookie | `casa_admin_session` · `HttpOnly` · `Secure` · `SameSite=Lax` · `Path=/` · `Max-Age=8h`, sliding (renewed after an hour of activity, hard-expired 8h after the last renewal) | Not readable by JavaScript, survives a normal working day, dies quickly if abandoned |
| Revocation | `revoked_at` on logout, password change, role/status change by an admin, and "sign out everywhere" | Immediate, unlike JWT expiry |
| Password policy | Minimum 8 characters, **no composition rules** (NIST guidance), plus a deny-list check (usernames ≥5 chars, `casapremiere`, `password`, `12345678`, the user's own name) | Length beats complexity theatre |
| First admin | `npm run admin:create-user` — prompts locally, writes the hash to Turso. **No default credentials are ever shipped or seeded** | The only safe bootstrap |
| Break-glass recovery | `npm run admin:reset-password -- --username <name>` (local, needs `TURSO_*` in `.env.local`) | A lost admin password is recoverable without a mail provider |
| Self-service reset | **Not in v1** (no mail provider). An admin resets, and the user must change it at next sign-in | Fewer vendors; limitation is stated in §14 |
| Where the DB credentials live | `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`, server-only environment variables | Never `NEXT_PUBLIC_*`; the browser never sees a database or R2 secret |

Timing-attack and enumeration defences: an unknown username is still verified against a throwaway hash, so
"user does not exist" and "wrong password" cost the same and return the same message.

### 5.2 Role matrix

| Capability | `admin` | `editor` |
|---|---|---|
| View dashboard, property list, media library, audit log | ✅ | ✅ |
| Create and edit properties, upload/replace/delete media | ✅ | ✅ |
| **Publish / unpublish** | ✅ | ✅ **(D9)** |
| Reorder properties | ✅ | ⚠️ admin-only in v1 — one-line change in `requireRole` (open question 1) |
| Delete a property | ✅ | ❌ |
| Business settings | ✅ | ❌ |
| Users: create, change role, disable, reset password | ✅ | ❌ |

Role checks live in exactly two places — `requireUser()` and `requireRole("admin")` in `lib/admin/auth.ts` — so
widening or narrowing a permission later is a one-line change, not a hunt through route handlers.

### 5.3 Sign-in flow

```
POST /api/admin/auth/login  { username, password }
  ├─ rate limit (rate_limits table, fixed window):
  │     key "login:ip:<sha256(ip+salt)>"  → 20 attempts / 15 min
  │     key "login:user:<username>"       →  5 attempts / 5 min (the per-username window is the same
  │                                            length as the lockout, so the counter that triggers a
  │                                            lock expires with it and the account recovers cleanly)
  ├─ look up the user (username lowercased); if absent → verify against a DUMMY hash anyway
  ├─ refuse if status = 'disabled', or locked_until > now
  ├─ argon2 verify
  │     fail → failed_attempts++ (lock 5 min at 5) · audit "auth.login_failed" · 401 generic message,
  │             and a 429 naming the lock when it fires
  │     ok   → failed_attempts = 0 · last_login_at = now
  ├─ insert sessions row (token_hash, expires_at = now + 8h, ip_hash, user_agent)
  ├─ audit "auth.login"
  └─ Set-Cookie casa_admin_session (HttpOnly · Secure · SameSite=Lax) → 200 { redirectTo, mustChangePassword }
```

The failure message is always *"Invalid username or password"* — it never distinguishes unknown user from wrong
password. Every attempt is audited with the actor (or `unknown:<username>` for a miss) and an IP hash, never a raw IP.

`must_change_password = 1` (a freshly created user, or after an admin reset) redirects every request to
`/admin/password` until the user sets their own password; that screen also offers "sign out everywhere else".

### 5.4 Request authorization

- `proxy.ts` (Next 16 renamed middleware to `proxy`; the file is `proxy.ts` and the export is
  `proxy()`) matches `/admin/:path*` and `/api/admin/:path*` and performs a **cheap cookie-presence check**:
  pages are redirected to `/admin/signin?next=…`, API calls receive JSON `401`. It deliberately does no
  database work.
- **Every** admin route handler and admin server component then calls `requireUser()` (or `requireRole("admin")`),
  which resolves the session in one indexed query (`sessions.token_hash` + `users.status = 'active'`) and attaches
  `{ id, username, role }` to the request. Middleware alone is never treated as authorization.
- Mutating handlers call `assertSameOrigin(request)` (the `Origin` header must equal `APP_ORIGIN`) and require
  `Content-Type: application/json`. Together with `SameSite=Lax` this closes the CSRF hole without a token dance.
- `GET /api/public/properties` is the only unauthenticated endpoint: read-only, `published = 1` only, no drafts,
  `s-maxage=60`.
- `/admin` and `/api` are disallowed in `robots`, and admin pages are `dynamic = "force-dynamic"` so no cached
  admin HTML can ever be served to a signed-out visitor.

### 5.5 Auth and user endpoints

| Method + path | Who | Behaviour |
|---|---|---|
| `POST /api/admin/auth/login` | public | §5.3 |
| `POST /api/admin/auth/logout` | any session | `revoked_at = now`, cookie cleared |
| `GET /api/admin/auth/me` | any session | `{ id, username, name, role, mustChangePassword }` |
| `POST /api/admin/auth/password` | any session | Needs the current password; writes the new hash, clears `must_change_password`, **revokes every other session** |
| `GET /api/admin/users` | admin | List (id, username, name, email, role, status, last_login_at). Hashes are never returned |
| `POST /api/admin/users` | admin | `{ username, name, email?, role, tempPassword? }` — forces a change at first sign-in; audited. Omit `tempPassword` and a 20-character one is generated and returned once |
| `PATCH /api/admin/users/[id]` | admin | Change `role`/`status`/`name`; disabling or demoting revokes all of that user's sessions; refuses a self change and the last active admin |
| `POST /api/admin/users/[id]/reset-password` | admin | Sets a temporary password (generated, returned once), clears any lockout, revokes sessions, forces a change |
| `POST /api/admin/users/[id]/sign-out` | admin | "Sign out everywhere": revokes every live session without touching the password |
| `DELETE /api/admin/users/[id]` | admin | Soft-disable (`status = 'disabled'`); refuses the last active admin and your own account |

Two rules sit in `lib/admin/users.ts` rather than in the route handlers, so no future caller can
forget them:

1. **Nobody can disable or demote themselves.** With one admin — the normal case here — the
   spec's "last active admin" rule would only ever fire against the actor, so this is the same
   guarantee stated where it is actually reachable.
2. **The last active admin can never be removed.** This stays as the backstop behind rule 1: it
   holds even for a caller that has no session (a script, a future route), and it is verified at
   the module level in §19.

### 5.6 Guarantees and the tests that prove them

The browser never receives a token, a hash, a token expiry, the database URL or an R2 secret — only public image
URLs and short-lived presigned upload URLs. Rate limiting and lockout are database-backed (no extra vendor), keyed
on `sha256(ip + IP_HASH_SALT)`.

Acceptance tests for this section:

| Test | Expected |
|---|---|
| Visit `/admin` signed out | Redirect to `/admin/signin?next=…` |
| Call `/api/admin/properties` with no cookie | `401` JSON, no data |
| Tampered / expired / revoked cookie | `401`, session row already gone |
| Wrong password ×5 | Account locked for 5 minutes, `auth.login_failed` audited |
| Unknown username | Same message and comparable latency as a wrong password |
| Editor calls publish | **Allowed** (D9) |
| Editor calls delete / reorder / users / settings | `403` |
| Editor's edit appears on the site | Only after they press Publish, and the row records `published_by` |
| Admin disables a signed-in user | That user's next request is `401` |
| `must_change_password` user opens any admin page | Forced to `/admin/password` first |
| Publish from the UI | `/` and `/interior` show the change within seconds; drafts stay invisible |

## 6. API contracts

| Method + path | Who | Notes |
|---|---|---|
| `GET /api/public/properties` | public | Published only, `position` order, mapped to `Property[]`, `s-maxage=60` |
| `GET /api/admin/properties` | editor | All rows including drafts, plus `pendingChanges` (`updated_at > published_at`) and `publishedBy` |
| `POST /api/admin/properties` | editor | Creates a draft; the slug is derived from the name, uniqueness-checked, then frozen |
| `PATCH /api/admin/properties/[slug]` | editor | Partial update, zod-validated, `updated_at` precondition → `409` with `{ changedBy, changedAt }` on conflict; refuses a slug change; revalidates both routes |
| `POST /api/admin/properties/reorder` | admin | `{ slugs: string[] }` → `position` rewritten in one batch; revalidates both routes |
| `POST /api/admin/properties/[slug]/publish` | editor | Sets `published = 1`, `published_at`, `published_by`; revalidates both routes; audits |
| `POST /api/admin/properties/[slug]/unpublish` | editor | `published = 0`; revalidates; audits (the self-undo path) |
| `DELETE /api/admin/properties/[slug]` | admin | Deletes row + media rows + R2 objects; revalidates both routes; the audit row keeps the full JSON for manual recovery |
| `POST /api/admin/uploads/sign` | editor | `{ contentType, bytes }` → presigned `PUT` (5 min, key prefix `properties/<slug>/`), rate-limited |
| `POST /api/admin/uploads/confirm` | editor | Writes the `property_media` row after a successful R2 `PUT`; revalidates both routes (a new card image is a visible change) |
| `PATCH /api/admin/media/[id]` | editor | Changes an image's `role` or alt text; revalidates both routes |
| `DELETE /api/admin/media/[id]` | editor | Removes the row and the R2 object; revalidates both routes |
| `GET` / `PUT /api/admin/settings` | admin | Business-details key/value pairs (table landed in phase 2; the API arrives with the properties API) |
| `GET /api/admin/audit?limit=50` | editor | Who changed what, when |

Conventions: JSON in, JSON out; `400` carries `{ error, fieldErrors? }` from zod; `401` unauthenticated; `403`
insufficient role; `409` conflict; `422` validation on publish preconditions (e.g. no card image yet). Every
mutation writes one `audit_log` row inside the same batch as the change.

**Revalidation is a property of the write, not of publishing.** Since both public routes render the
database (§9), any write a visitor can see must reach them: publish/unpublish did from Phase 4, and
Phase 7 extended it to every content mutation in the table above — a save, a reorder, a new card image,
an alt-text fix, a delete. They all call one helper (`revalidatePublishedPages()` in
`lib/cms/revalidate.ts`), which owns the path list — publish and unpublish echo it back as
`revalidated: ["/", "/interior"]`, so the two paths are visible in the response — and the routes
cannot drift apart: a missing path is a one-line fix rather than a hunt.

## 7. Admin features

| Route | Purpose | Key behaviours |
|---|---|---|
| `/admin` | Dashboard | Live / draft / pending counts · last 10 audit entries · "open public site" · **Publish pending** shortcut |
| `/admin/properties` | List | Thumbnail, name, location, status chip, price · Live / Draft / **Pending** badge · **Last published** (`published_at` + `published_by`) · drag handle (admin) · row actions: Edit · Preview · **Publish / Unpublish (editor and admin)** · Delete (admin only) |
| `/admin/properties/[slug]` | Editor | Sections: Basics · Intro · Highlights · Specs · Amenities · Media · actions Save draft / Publish / Unpublish / Delete (hidden for editors) |
| `/admin/media` *(v1.5)* | Library | Every R2 object, where it is used, orphan cleanup |
| `/admin/users` **(phase 3)** | Users (admin) | Create (username, display name, optional email, role, temporary password shown once) · change role · disable · reset password · "sign out everywhere". The last active admin cannot be removed, and nobody can disable or demote themselves |
| `/admin/settings` | Business details | Phone, email, WhatsApp, hours, address, footer links |
| `/admin/audit` | History | Filterable by actor, entity and date |
| `/admin/signin`, `/admin/password` | Auth | Sign-in; forced password change and session revocation |

### 7.1 The property editor, field by field

Mirrors the existing `Property` type (`lib/properties.ts`) so nothing downstream changes.

- **Basics:** name (slug derived on create, then immutable), location, status (`Available` · `Under construction` ·
  `Sold` · `Coming soon`), meta, price, description.
- **Price and meta carry the existing rule verbatim:** *"a value with no digits is treated as unfinished and hidden"*
  — the drawer's behaviour is preserved, not re-implemented.
- **Intro:** repeatable multiline text, add / remove / reorder.
- **Highlights:** repeatable `{ icon, title, description }`; the icon `select` renders the real lucide icon — the six
  keys already mapped by `HIGHLIGHT_ICONS` in `components/property/property-drawer.tsx`.
- **Specs:** repeatable `{ label, value }` with the hint that an empty value joins the "On request" line.
- **Amenities:** chip-style repeatable text.
- **Media:** card image (single, required to publish) · hero (image + **alt required**) · gallery (ordered, per-image
  alt, "make card image" / "make hero" shortcuts, replace, delete).
- **Order is not edited here** — the list's drag handle owns `position`, because it drives the grid
  (`components/sections/collection-section.tsx`), the drawer pager
  (`components/property/property-drawer.tsx`) and the shortlist sort (`components/property/shortlist-panel.tsx`).

### 7.2 Behaviour the client will notice

| Area | Requirement |
|---|---|
| Validation | One zod schema per write path, reused by the form (`react-hook-form` + `@hookform/resolvers` are already dependencies) and re-validated on the server |
| Saving | Dirty tracking, optimistic update, `sonner` toasts, unsaved-changes guard on navigation |
| Conflicts | `updated_at` precondition → *"changed by `<username>` at `<time>`"* panel with Reload / Overwrite |
| **Publishing** | Confirmation dialog summarising the change (*"3 fields changed, 1 image replaced"*) — now that editors can publish, this is the speed bump before something goes live. Editors keep **Unpublish** as the undo |
| Drafts | `published = 0` never appears publicly; the list flags a live row edited since its last publish as **Pending changes** |
| Deleting | Admin-only, requires typing the slug; the audit row keeps the full deleted JSON |
| Images | jpeg/png/webp/avif only · resized client-side to ≤2000 px WebP · ≤1.5 MB after resize · alt text required (it is the public site's accessibility) · type, size and extension re-checked server-side |
| Accessibility | Labelled fields, `aria-live` save status, keyboard-operable reordering with announcements, focus-trapped dialogs, visible focus rings — consistent with the existing components |
| Mobile | Usable at 390 px; the repo's `Sheet`/`Dialog` patterns are reused |
| Isolation | `app/(admin)/layout.tsx` is its own root layout, so no admin code or CSS reaches `/` or `/interior` |
| Timezone | All timestamps rendered as `GMT (Accra)`, matching `BOOKING_TIME_ZONE_LABEL` |

## 8. Media pipeline

1. The browser picks a file and **resizes/converts it locally** (`<canvas>` → WebP, ≤2000 px, quality ~0.8,
   ≤1.5 MB). This is why no paid image service is needed, and why uploads never hit a function body limit.
2. `POST /api/admin/uploads/sign` → presigned `PUT` (content-type, size and 5-minute expiry enforced).
3. The browser `PUT`s the bytes **straight to R2** — Vercel only ever signs.
4. `POST /api/admin/uploads/confirm` writes the `property_media` row (`r2_key`, `alt`, `width`, `height`, `bytes`).
5. Public serving: `https://images.casapremiere.com/properties/<slug>/<hash>.webp`, immutable cache headers,
   zero egress. `next.config.mjs` already sets `images.unoptimized: true`, so no `remotePatterns`
   allowlist is needed; if optimisation is ever turned on, it needs
   `images.remotePatterns: [{ protocol: "https", hostname: "images.casapremiere.com" }]`.
6. Replaced or deleted media removes the R2 object; `npm run cms:r2` lists used and orphan keys.

R2 bucket requirements: public access enabled, custom domain attached, and CORS allowing `PUT`/`GET`/`HEAD` from
the site origin. The R2 API token is scoped to this one bucket and lives only in Vercel's environment.

## 9. Public delivery, publish and rollback

**Read path (D7).** Six files change, and only in the way described here — the plan; §23 has the
delivered set and its evidence:

| File | Change |
|---|---|
| `app/(site)/page.tsx` | Becomes `async`; `const properties = await getProperties()`; passes them to `PropertyProvider` and `CollectionSection` |
| `components/property/property-provider.tsx` | Accepts `properties: Property[]`, exposes the catalogue and lookup through `useProperty()`; `getPropertyBySlug(slug)` → `findPropertyBySlug(properties, slug)` |
| `components/sections/collection-section.tsx` | Reads `properties` from `useProperty()` instead of importing `PROPERTIES` |
| `components/property/property-drawer.tsx` | Pager and "n of m" read the catalogue from `useProperty()` |
| `components/property/shortlist-panel.tsx` | Same catalogue source for the saved-slug lookup and ordering |
| `components/interior-homes.tsx` | Server component: reads the catalogue directly (the interior route has no `PropertyProvider`) |

`lib/properties.ts` keeps the `Property*` types, `PROPERTY_HOST` and `getPropertyPriceValue()` exactly as they are —
they are imported by client components and must stay free of server-only code. `getPropertyBySlug` becomes the pure
`findPropertyBySlug(list, slug)`. Its `PROPERTIES` array stays in the file as the seed source for
`npm run migrate:properties` and as the pixel baseline for the Phase 7 gate; nothing in the app reads it.

Two more files join that list once the catalogue is no longer a module constant: the shortlist keeps
only slug-shaped strings (`components/property/shortlist-store.ts` — nothing typed as a `Property`
survives in `localStorage`, or in an old visitor's browser), and `shortlist-float.tsx` resolves those
slugs against the catalogue the provider holds, so a saved home that has since been unpublished or
deleted quietly drops out instead of rendering a blank card.

**Publish.** `POST …/publish` writes `published = 1`, `published_at`, `published_by`, then revalidates
both public routes — the change is live in seconds with no git commit and no redeploy. Unpublish does
the reverse. Since Phase 7 the same revalidation runs after *every* content write (§6), because the
routes read the database rather than a build-time constant.

**Alternative (if you would rather not touch components).** Keep `PROPERTIES` fed by a `prebuild` snapshot
(`scripts/build-properties.mjs` → `lib/properties.generated.json`, gitignored) and trigger a Vercel Deploy Hook on
publish: zero component churn, at the cost of 1–2 minutes of latency. The two approaches are mutually exclusive
because a snapshot cannot be regenerated by a revalidation.

**Rollback.** Content → Turso point-in-time restore (**1 day** on the free plan) or `scripts/export-content.ts`
into R2; code/UI → Vercel instant rollback. Unpublish is the everyday undo.

## 10. Setup and environment

```bash
# 1. Turso
turso db create casapremiere-cms --location <closest to Accra>
turso db show casapremiere-cms --url          # → TURSO_DATABASE_URL
turso db tokens create casapremiere-cms       # → TURSO_AUTH_TOKEN (server-only)

# 2. Dependencies + schema
npm i @libsql/client @node-rs/argon2
npm i -D drizzle-kit
npx drizzle-kit generate
npm run cms:migrate -- --turso                # applies ./drizzle to Turso (drop --turso for the local file)

# 3. R2
npx wrangler r2 bucket create casapremiere-images
# public access + custom domain images.casapremiere.com + CORS: PUT/GET/HEAD from the site origin
# R2 API token (Object Read & Write, single bucket) → Vercel env

# 4. First admin — never a default password
npm run admin:create-user -- --username casa --role admin --turso
npm run cms:status -- --turso                 # confirm: migrations 2, tables, one admin
```

| Env var | Where | Notes |
|---|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Vercel + `.env.local` | Server-only; never `NEXT_PUBLIC_*`. Locally they live in `.env.turso.local` so `npm run dev` keeps writing to the file database |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Vercel + `.env.local` | Used only to sign uploads and delete objects. Absent → `/api/admin/uploads/*` answers `503` instead of failing oddly |
| `R2_PUBLIC_BASE_URL` | Vercel + `.env.local` | The public serving base (`https://images.casapremiere.com`, or the `r2.dev` URL). Unset → images are read through `GET /api/media/<key>` (§22.1), so it is optional, not required |
| `APP_ORIGIN` | Vercel + `.env.local` | Exact origin for the CSRF `Origin` check |
| `IP_HASH_SALT` | Vercel + `.env.local` | Salt for rate-limit keys (`sha256(ip + salt)`) |
| `CMS_EXPORT_TOKEN` | Vercel (optional) | Protects the scheduled export endpoint |

`.gitignore` already excludes `.env*`, so nothing here is committed. New npm scripts:
`admin:create-user`, `admin:delete-user`, `admin:reset-password`, `cms:migrate`, `cms:status`,
`cms:r2`, `migrate:properties`, `content:export`.

**Which database a command talks to.** Next loads `.env.local` for the app; a `tsx` script has no
environment loader, so `scripts/cli-utils.ts` reads `.env.local` itself and `.env.turso.local`
(with `--turso`). Nothing configured means the development default, `file:./.local/cms.db`, so
day-to-day work can never reach production by accident:

```bash
npm run cms:migrate                     # the local file
npm run cms:migrate -- --turso           # Turso
npm run cms:status                       # what is in there: migrations, tables, rows, accounts
npm run cms:status -- --turso
npm run admin:create-user -- --username casa --role admin --turso
```

A value already set in the shell wins over both files, which is how a one-off run is pointed
somewhere else without editing anything:

```bash
$env:TURSO_DATABASE_URL="file:./.local/cms.db"; npm run cms:migrate   # PowerShell
```

## 11. Migration of the existing three properties

`scripts/migrate-properties.ts` (run with `npx tsx --tsconfig tsconfig.json`, which honours the `@/*` alias):

1. Read the legacy array from `lib/properties.ts`.
2. Split each entry into a `properties` row and its `property_media` rows (`card`, `hero`, `gallery`), preserving
   `id`/order as `position` (1, 2, 3).
3. Upload the referenced files to R2 under `properties/<slug>/<basename>` and store the returned keys.
4. Write everything in a single `client.batch([...])`, then verify parity: same slugs, same order, same prices,
   same images, `published = 1`, `published_by = "migration"`.
5. Leave the other section images — hero, gallery, technology, editorial — in `public/images/` untouched. The
   `PROPERTIES` array itself stays in `lib/properties.ts`: nothing in the app reads it any more, but it is the
   seed source for a re-run of this script and the pixel baseline for the Phase 7 gate (§23).

Verification gate: the six-file read-path change (§9) plus this migration must leave `/` and `/interior`
pixel-identical at 1440 px and 390 px. That diff is the release gate for the whole phase. The markup half of it
was run in Phase 7 against a production build and a local file database (§23, 75,989 / 39,271 characters
identical); the two-width screenshot pass is the remaining item, and it happens against the deployed preview in
Phase 8, where the legacy `/images/…` paths and the resized WebP keys are both served for real.

## 12. Verification checklist

Local (dev server + local `file:` database):

- [x] `npm run dev` against `file:./.local/cms.db`: create → edit → reorder → upload → publish → unpublish → delete
- [x] Sign-in paths: wrong password, unknown username, lockout after 5, disabled user, forced password change
      (Phase 7 — §23; `node .local/verify/auth-e2e.mjs`, 82/82 checks against the production server)
- [x] Authorization: signed-out API → `401`; editor publish → allowed; editor delete/reorder/users/settings → `403`
      (Phase 7 — §23; the same run: one `403 Forbidden` body for all four, `401` JSON for a signed-out API read)
- [x] An editor's unpublished edit is invisible on `/` and `/interior`; publishing makes it appear
- [x] The same for every other content write: a save, a reorder, a media change and a delete all reach both routes
      (Phase 7 — §23; on the production server against `file:./.local/cms.db`, 21/21 checks)
- [x] `/` and `/interior` render the database: the markup diff against the pre-refactor captures is empty
      (`node .local/verify/pixel-gate.mjs`, §23)

Production (Vercel preview → production):

- [ ] `/` and `/interior` update within seconds of publishing; drafts never appear
- [ ] `/?property=<slug>` and the interior band's cards still open the right home; a slug rename is refused
- [ ] Placeholder rules preserved (`GH₵ --` hidden; empty spec value → the "On request" line)
- [ ] Images load from `images.casapremiere.com`; oversize/wrong-type uploads are rejected; alt text is required
- [ ] `npx tsc --noEmit` clean · `npm run build` + `npm start` · screenshot diff at 1440 px and 390 px shows no change
- [ ] Rollback rehearsed: Turso PITR restore, `content:export` output, Vercel rollback
- [ ] `robots` excludes `/admin`; a signed-out visitor can never fetch admin HTML

## 13. Effort

| Phase | Work | Days |
|---|---|---|
| 1 | `(admin)` route group, auth core (hashing, login/logout, middleware, `requireUser`/`requireRole`), env + zod layer | 1.5–2 |
| 2 | Schema + Drizzle + migrations (Turso and the local file DB) | 0.5–1 |
| 3 | Users screens + user API (create, role, disable, reset, last-admin guard) | 1 |
| 4 | Properties API (CRUD, reorder, publish/unpublish, settings, audit) | 1.5 |
| 5 | Admin UI (list, editor, media manager, dashboard) | 2–3 |
| 6 | R2 presign + CORS + client-side resize + cleanup | 0.5–1 |
| 7 | Public read refactor (six files) + revalidation | 0.5–1 |
| 8 | Migration, verification, editor guide, rollback drill, export job | 1 |
| **Total** | | **8–10.5** |

## 14. Risks

| Risk | Mitigation |
|---|---|
| An editor can now put a mistake live without review | Publish confirmation with a change summary · editors can **unpublish** (self-undo) · the audit row names the actor · `published_by`/`published_at` visible in the list · Turso PITR and periodic exports for deeper recovery |
| No self-service password reset (no mail provider) | In-app admin reset plus the local `admin:reset-password` break-glass script; documented in the editor guide |
| Turso free PITR is **1 day** | Scheduled `content:export` into R2 (weekly or daily) and the audit log for finer-grained history |
| Turso is reached over HTTP (~1 round trip per query) | Batch writes; reads happen at revalidation time, not per page view |
| Sessions cost one indexed query per admin request | Admin traffic is tiny; 8-hour sliding sessions; no edge DB work |
| Two extra dashboards (Turso, Cloudflare R2) | Setup is one-off and documented here; day-to-day work happens only in `/admin` |
| Vercel Hobby is non-commercial | Site and admin stay on **Vercel Pro ($20/mo)**; Turso and R2 remain $0 at this scale |
| Newest code lands in a pixel-verified repo | Admin lives in its own route group; the public change is six files; the screenshot diff is a release gate |
| Password hashing needs a native module on Vercel | `@node-rs/argon2` ships prebuilt Linux binaries; `bcryptjs` is the documented pure-JS fallback |

## 15. Open questions

1. **Reorder** — keep it admin-only (current spec) or let editors drag listings too?
2. **Export cadence** — weekly (current spec) or daily?
3. **`users.email`** — needed in v1, or drop the column until there is a mail provider?
4. **Admin location** — `casapremiere.com/admin` (current spec) or a separate hostname such as `admin.casapremiere.com`?
5. **Editor guide** — should `/admin` link to a short in-app "how to add a home" page, in addition to `docs/`?

## 16. Implementation order

1. Phase 1 — `(admin)` route group, session core, sign-in and forced password change. **Done — see §17.**
2. Phase 2 — Drizzle schema + migrations against the local file DB, then Turso. **Done — see §18.**
3. Phase 3 — users: create, disable, reset, last-admin guard. **Done — see §19.**
4. Phase 4 — properties API, including publish/unpublish + revalidation. **Done — see §20.**
5. Phase 5 — admin UI: list, editor, media manager, dashboard. **Done — see §21.**
6. Phase 6 — R2 presigning and the browser-side resize/WebP step. **Done — see §22.**
7. Phase 7 — the six-file public read refactor, plus revalidation on every content write. **Done — see §23.**
8. Phase 8 — verify the two-width screenshot diff against a deployed preview, write the editor guide,
   rehearse rollback.

**Turso is live.** The production database holds both migrations, all seven tables and one admin
account (`casa`), and the app has been exercised against it end to end — sign-in, the forced
password-change gate and revocation all read and write Turso (evidence in §18). Its credentials
live in gitignored `.env.turso.local` under the two names `lib/cms/env.ts` actually reads
(`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`), which is what `--turso` loads; `npm run dev` keeps
using `file:./.local/cms.db`, and Vercel will carry the same two values when the admin is deployed.

One lesson worth keeping: **a credential under any other name fails silently.** The first version of
this was `TURSO_DB_URL` / `TURSO_DB_TOKEN`, which the app never looked at, while an older token that
belonged to a different database produced a bare `401`. Both are now impossible to confuse: the
names are canonical, `npm run cms:status` prints the target before it queries, and a 401 is reported
with the command that fixes it.

## 17. Phase 1 — delivered (verified)

Built: the `(admin)` route group with its own root layout and tokens, the session core
(`lib/admin/auth.ts`), the password split (`password.ts` + `password-policy.ts`), sign-in and forced
password-change screens, the four auth endpoints, `proxy.ts`, `app/robots.ts`, the SQLite (Turso) schema for
`users`/`sessions`/`rate_limits`/`audit_log`, Drizzle + migrations, and the three CLI scripts
(`cms:migrate`, `admin:create-user`, `admin:reset-password`).

Per phase 2 of the plan, the auth tables were pulled forward so the phase could actually be exercised;
the property and media tables still arrive in Phase 2 proper.

| # | Check | Result |
|---|---|---|
| 1 | `/admin/signin` renders | 200, heading present |
| 2 | `/admin` with no cookie | 307 → `/admin/signin` |
| 3 | `/api/admin/auth/me` with no cookie | 401 JSON |
| 4 | Malformed login body | 400 (generic message) |
| 5 | Wrong password | 401 `Invalid username or password` |
| 6 | Correct password | 200 `{ok, redirectTo:"/admin/password", mustChangePassword:true}` |
| 7 | `me` with cookie | 200, user JSON, no hash/token fields |
| 8 | `/admin` with a pending password change | 307 → `/admin/password` |
| 9 | Change password | 200; `mustChangePassword` becomes false |
| 10 | `/admin` dashboard | 200, renders "Signed in as", audit trail visible |
| 11 | Sign out | 200 |
| 12 | Cookie replayed after sign-out | 401 — the session row was revoked server-side, not merely cleared |
| 13 | Five wrong passwords | 4× 401 then 429 `locked for 15 minutes` (changed to 5 minutes in Phase 4) |
| 14 | Correct password while locked | 429 `This account is locked…` |
| 15 | `admin:reset-password` (break-glass) | Unlocks the account, sets a temporary password, forces a change at next sign-in |
| 16 | Login with the recovered password | 200, `mustChangePassword: true` |
| 17 | Cross-origin POST | 403 (CSRF origin check) |
| 18 | `npm run build` | `/` and `/interior` still **static**; `/admin*` and `/api/admin/*` **dynamic**; proxy registered |
| 19 | Production (`next start`) smoke test | Login 200, `Set-Cookie: …; Max-Age=28800; Secure; HttpOnly; SameSite=lax`, cross-origin 403 |
| 20 | `npx tsc --noEmit` | Clean |

Two things this phase taught, both now encoded in the code:

1. **A client component may only import `lib/admin/password-policy.ts`.** The first build failed because the
   password form pulled `PASSWORD_MIN_LENGTH` from `lib/admin/password.ts`, which imports native argon2 whose
   browser build has no exports. Policy (pure) and hashing (server-only) are separate files for that reason.
2. **Production needs `TURSO_DATABASE_URL` (and `IP_HASH_SALT`, `APP_ORIGIN`) at runtime.** `next start` with
   none set returns 500 by design — the env guard fails the request rather than opening the wrong database.
   A local production smoke test can pass `TURSO_DATABASE_URL=file:./.local/cms.db`.

Known, unrelated to this phase: `npm audit` reports advisories against the pinned `next@16.0.10`
(patched in the 16.3.x line, including proxy-bypass issues). Upgrading Next is recommended before the admin
is exposed publicly, and is a prerequisite for the Payload/OpenNext options noted earlier.

## 18. Phase 2 — delivered (verified)

Built: the content half of the schema — `properties` (18 columns, slug primary key, position index,
a CHECK on `status`), `property_media` (FK to `properties` with `ON DELETE cascade`, the
`(slug, role, position)` index, a CHECK on `role`) and `settings` — generated as
`drizzle/0001_content_tables.sql` and applied through the same libSQL client as Phase 1. Plus the
CLI plumbing that makes "the local file, then Turso" a single command: `scripts/cli-utils.ts` now
loads `.env.local` (Next does that for the app; `tsx` does not), reads `.env.turso.local` with
`--turso`, labels the target before every write, and `scripts/cms-status.ts` (`npm run cms:status`)
answers "what is in the database?" read-only.

| # | Check | Result |
|---|---|---|
| 1 | `npx drizzle-kit generate` | `drizzle/0001_content_tables.sql` — 3 tables, 2 indexes, 2 CHECK constraints, 1 FK |
| 2 | `npm run cms:migrate` (local file) | Applied; `__drizzle_migrations` holds 2 rows |
| 3 | `npm run cms:status` | tables: `audit_log, properties, property_media, rate_limits, sessions, settings, users` |
| 4 | CHECK constraints are real | A `status` outside the four allowed values is refused by the database, not by the API alone |
| 5 | `property_media` cascade | Deleting a `properties` row removes its media rows |
| 6 | Same SQL both sides | One migration folder, one migrator, one client — no environment-specific DDL |
| 7 | `npm run cms:migrate -- --turso` | Applied. The first attempt failed with `401 … invalid JWT token: can't be decoded with any of the existing keys` — the token on hand belonged to a different database — and then sat unnoticed for a day because its replacement had been added to `.env.local` under the non-canonical names `TURSO_DB_URL` / `TURSO_DB_TOKEN` |
| 8 | `npm run cms:status -- --turso` | 2 migrations, all 7 tables, `casa` (admin, active) — identical to the local file |
| 9 | App against Turso (`next start` with the Turso credentials on port 3102) | `login → 200 { mustChangePassword: true }` · `GET /api/admin/users → 403 Password change required` · `GET /api/admin/auth/me → 200` · `logout → 200` · `me → 401`. Every read and the revocation path work against Turso, not just the CLI |
| 10 | `npx tsc --noEmit` | Clean |
| 11 | `npm run build` | 7 tables in the schema; `/` and `/interior` still **static**, `/admin*` and `/api/admin/*` **dynamic**, proxy registered |

Two things this phase taught:

1. **A generated migration is not named for humans.** `0001_unusual_sharon_carter.sql` was renamed
   to `0001_content_tables.sql`, and the tag in `drizzle/meta/_journal.json` with it — the journal
   tag is what the migrator looks up, so both have to agree.
2. **The dev/production split needed one new file, not a new rule.** Putting the Turso credentials
   in `.env.local` would have silently pointed `npm run dev` — and every later phase's scratch
   content — at the live catalogue, against decision D5. They live in gitignored
   `.env.turso.local` instead, which only the CLI reads, and the shell still wins over both.

## 19. Phase 3 — delivered (verified)

Built: `lib/cms/validation.ts` (zod schemas shared by the forms and the routes),
`lib/admin/users.ts` (list / create / update / reset / sign-out, the two guards and the
temporary-password generator), four endpoints under `/api/admin/users**`, and `/admin/users` — a
server component that gates on the admin role plus a client manager for create, role,
disable/enable, reset password and "sign out everywhere". Every mutation writes one `audit_log` row
naming the actor.

Evidence: a 33-check HTTP suite run against the **production build** on the local file database
(`npm start`, `SMOKE_BASE_URL=http://localhost:3100`). All 33 passed.

| # | Check | Result |
|---|---|---|
| 1 | `GET /api/admin/users` signed out | `401` JSON, and no user data in the body |
| 2 | List as admin | `200`; contains no `password_hash`, no `$argon2`, no token |
| 3 | Create without a temp password | `201`, one is generated, `mustChangePassword: true` |
| 4 | Create a duplicate username | `409 "smokeeditor" already exists…` |
| 5 | Temp password under 8 characters | `400 { error, fieldErrors.tempPassword }` |
| 6 | Deny-listed temp password | `400 That password is too predictable…` (shared policy, same as the CLI) |
| 7 | Invalid username | `400 Use 3–32 characters: a–z 0–9 . _ -` |
| 8 | First sign-in with the temporary password | `200`, `redirectTo: /admin/password` |
| 9 | Any API call before the password change | `403 Password change required` |
| 10 | Changing your own password | `200` |
| 11 | Editor calls the users API | `403 Forbidden` |
| 12 | Editor opens `/admin/users` | `307 → /admin` (a server-side gate, not just hidden UI) |
| 13 | Admin opens `/admin/users` | `200`, "Add a user" present |
| 14 | Promote then demote (editor ⇄ admin) | `200` both ways |
| 15 | Admin disables their own account | `400 You cannot disable your own account…` |
| 16 | Admin changes their own role | `400 You cannot change your own role…` |
| 17 | Disable an account | `200`, `status: disabled` |
| 18 | Disabled user signs in | `401` |
| 19 | Their live cookie after the disable | `401` — revoked in the same request |
| 20 | Re-enable, then sign in | `200` |
| 21 | Sign out everywhere | `200`, `sessionsRevoked: 1`; that cookie is dead on the next call |
| 22 | Reset password | `200`, temporary password returned once, `mustChangePassword: true`, sessions revoked |
| 23 | The reset password works | `200` |
| 24 | Cross-origin POST | `403` (CSRF origin check) |
| 25 | Dashboard activity list | Shows `user.reset_password` and `user.sign_out_all` |
| 26 | Last-admin guard (module level) | Demoting **and** disabling the last active admin → `409`; with a second admin the same demotion succeeds |
| 27 | `npx tsc --noEmit` | Clean |
| 28 | `npm run build` | `/admin/users` and the four new routes dynamic; public routes still static |

Two things this phase taught:

1. **The last-admin rule needed restating to be reachable.** A request always comes from an active
   admin, so "the target is the last active admin" implies the actor *is* the target — which the
   self-guard refuses first. The invariant is still enforced, and tested at the module level
   (check 26), as the backstop for any caller without a session; the rule an admin actually meets
   is "you cannot disable or demote yourself".
2. **A "shown once" password has nowhere to hide.** It is generated server-side, returned in that
   one response, never written to the audit row and never logged, so a lost value is simply reset
   again — which is what the screen says.

## 20. Phase 4 — delivered (verified)

Built: the content half of the admin — everything except the screens (those are Phase 5).
`lib/cms/validation.ts` gained the property contracts (closed statuses and icons read from
`lib/properties.ts`, bounded JSON arrays, the create/update/reorder/settings shapes);
`lib/cms/queries.ts` is the data layer every rule lives in (slug derivation and immutability,
`updatedAt` preconditions, publish preconditions, audit-with-JSON-on-delete, one-batch reorder);
`lib/cms/public.ts` maps published rows + their media into the components' own `Property` shape;
and the seven endpoints land exactly where §6 promised them.

| # | Check | Result |
|---|---|---|
| 1 | `/api/public/properties` | `200`, drafts never appear, `id` follows `position`, `Cache-Control: public, s-maxage=60` |
| 2 | Create | `201`: slug derived (`The Manor` → `the-manor`), unpublished, end of grid, standard specs seeded |
| 3 | Duplicate slug / bad status / missing name | `409` / `400 { error, fieldErrors }` / `400` |
| 4 | Save | `200` against the right revision, revision bumps, no-op → `400` |
| 5 | Stale revision | `409 { error, changedBy, changedAt }`; the fresh revision then wins |
| 6 | Slug rename | `400`, and checked first — a body carrying only `updatedAt` plus a changed slug is still refused |
| 7 | Unknown slug | `404`, answered before the payload is judged |
| 8 | Publish | Sets `published`, `published_at`, `published_by`; answers `revalidated: ["/", "/interior"]` |
| 9 | Edit a live row | Flags `pendingChanges: true` |
| 10 | Unpublish | Hides the listing but keeps `published_at`/`published_by` (the list's "last published") |
| 11 | Card image precondition | `422` when a property has media but no `card` row; passing once it exists |
| 12 | Reorder | All-or-nothing (`400` on unknown, partial, duplicated), dense positions, admin-only |
| 13 | Delete | `200` with a media count, admin-only; the audit row keeps the whole listing's JSON |
| 14 | Settings | Starts ` {}`, saves and echoes back, admin-only; a malformed `footerLinks` or an unknown key is a `400` naming the problem — never stored, never silently dropped |
| 15 | CSRF | Cross-origin publish → `403` |
| 16 | Audit | All seven new actions (`property.create/update/publish/unpublish/reorder/delete`, `settings.update`) present |
| 17 | Lockout (asked alongside the phase) | `5` minutes: 4× `401` generic, 5th → `429 "locked for 5 minutes"` with `Retry-After` seconds to the lock's expiry; the right password recovers afterwards; the per-username throttle window matches the lockout so the two cannot disagree |
| 18 | Regression | The Phase 3 suite still passes unchanged (33/33) |
| 19 | `npx tsc --noEmit` | Clean |
| 20 | `npm run build` | All seven routes dynamic; `/` and `/interior` still static; public sites untouched |

Three things this phase taught:

1. **Answer the resource before the payload.** Validating a PATCH body before looking up the slug
   turns "that property does not exist" into a misleading `400` — so the handler checks the slug
   first, and the rename guard reads the raw body, where it always fires.
2. **A union schema swallows mistakes.** The first settings schema accepted *any* short string for
   `footerLinks` and the reader then degraded it to `[]` — a mistyped value stored and forgotten.
   Each key is now validated on its own, and `.strict()` refuses unknown keys by name.
3. **Publishing must be exercisable before the media pipeline.** Requiring a card image
   unconditionally would have made Phase 4's central action impossible — so the requirement
   activates for properties that have any media, which is exactly the state Phase 6 and the
   Phase 8 migration will put listings in.

## 21. Phase 5 — delivered (verified)

Built: the screens Phase 4 deliberately left out — everything in §7 except the media
upload (that is Phase 6, the R2 pipeline). The dashboard stops being a placeholder and
becomes `/admin` with live/draft/pending counts, a publish-pending shortcut and last-10
activity; `/admin/properties` lists the catalogue in grid order with the Live/Draft/Pending
badge, create-draft, publish/unpublish, admin-only reorder buttons and a slug-typed delete;
`/admin/properties/[slug]` edits one home section-by-section against the `updatedAt`
revision (409 names the other editor), with a publish confirmation dialog and a read-only
media list until uploads exist; `/admin/settings` edits the six known keys with one PUT
(an empty field clears back to the hard-coded fallback); `/admin/audit` reads the last 50
rows through the new `GET /api/admin/audit` (editors may read, like they may publish).

| # | Check | Result |
|---|---|---|
| 1 | `/admin` dashboard | Live/draft/pending counts, pending shortcut with editor + Accra time, Users/Settings links admin-only, last-10 activity |
| 2 | `/admin/properties` list | `200`, badges, last-published line, create → draft at end of grid |
| 3 | Publish / unpublish from the list | `200`, `revalidated: ["/", "/interior"]`, notice confirms; unpublish keeps the last-published line |
| 4 | Reorder + delete | Admin-only buttons; reorder rewrites the whole order; delete asks for the slug and reports the media count |
| 5 | Editor `/admin/properties/[slug]` | Basics/intro/highlights/specs/amenities save per section with `updatedAt`; stale revision → `409` naming `changedBy`/`changedAt`, fresh revision wins |
| 6 | Publish dialog + media list | Confirmation before going live; media read-only with the card-image precondition explained |
| 7 | `/admin/settings` | Starts `{}`, saves, echoes back; empty field clears to the fallback; malformed `footerLinks` → `400` |
| 8 | `/admin/audit` + `GET /api/admin/audit` | Last-50 rows, editors may read; limit clamped 1–200 |
| 9 | E2E against local file DB (this session) | Login `casa` → `200`; create `smoke-villa` → `201`; stale PATCH → `409 by casa`; save → `200`; publish → `live + revalidated`; unpublish → hidden; reorder → 1 row; settings save/clear; delete → `ok + mediaRemoved 0`; fixtures removed, `users 1 (casa) · properties 0 · settings 0` |
| 10 | `npx tsc --noEmit` | Clean |
| 11 | `npm run build` | `/admin`, `/admin/audit`, `/admin/properties`, `/admin/properties/[slug]`, `/admin/settings`, `/api/admin/audit` all dynamic; `/` and `/interior` still static |

Two things this phase taught:

1. **The dashboard was the cheapest spec win.** It already had the session, the audit
   helper and (via Phase 4) the property list — counts and a pending shortcut were a
   filter away, and they turn "is anything waiting?" into a glance.
2. **The editor writes strings, the API writes shapes.** Highlights (`icon | title |
   description`), specs (`label | value`) and the four text lists travel as line-based
   textareas and are parsed at save time, so a validation error names the line the
   server refused rather than a JSON path nobody typed.

## 22. Phase 6 — delivered (verified)

Built: the image pipeline — the one part of §7 that Phase 5 deliberately left as a read-only
list. `lib/cms/r2.ts` signs a 5-minute browser `PUT` (S3 API against
`<account>.r2.cloudflarestorage.com`, `@aws-sdk/client-s3` + `s3-request-presigner`), so the
bytes never touch Vercel; `lib/cms/env.ts` gained the five `R2_*` values with
`isR2Configured()`/`requireR2()`, so an unconfigured deployment answers `503` instead of
failing oddly; `POST /api/admin/uploads/sign` (editor, rate-limited 30/15min),
`POST /api/admin/uploads/confirm` (writes the `property_media` row, card stays single by
demoting the previous one), `PATCH`/`DELETE /api/admin/media/[id]`; `media-manager.tsx`
resizes to WebP in the browser (≤2000 px, q0.8, ≤1.5 MB) before the PUT, with role and alt
text per image plus delete (replacing = upload the new image, then delete the old, so the
card never goes missing); the property list gained card thumbnails; deleting a property now
deletes its R2 objects too; `npm run cms:r2` lists used and orphan keys.

| # | Check | Result |
|---|---|---|
| 1 | `lib/cms/env.ts` R2 values + `isR2Configured()` / `requireR2()` | `r2configured=true`, `bucket=casa`, `public=(unset)` locally |
| 2 | Presigned PUT is real | `signed key=properties/smoke-villa/5bb9…webp`, host `casa.d4d1….r2.cloudflarestorage.com`, `ttl=300` |
| 3 | Bytes actually reach R2 | A matching `Content-Length` returned `200` and no object was left behind; a mismatched one was refused `403` — so content-type + size are bound into the signature, not advisory |
| 4 | Wrong content type | `image/gif` → `400` with `fieldErrors.contentType` |
| 5 | Key belongs to its property | confirming `properties/other/…` → `404 No property with the slug "other"` |
| 6 | Full editor flow over HTTP | create `r2-flow-villa` → sign → `PUT 200` → confirm (`role: card`) → `PATCH alt` → `publish true` → list page contains the thumbnail key → editor page contains the media manager → `DELETE` → `property.delete` audit row |
| 7 | Cleanup is complete | `npm run cms:r2` → `objects: 0 · orphans: 0`; `HeadObject` on the deleted key → `NotFound 404`; `cms:status` → `properties 0 · property_media 0` |
| 8 | Uploads when unconfigured | `/api/admin/uploads/*` → `503` with a sentence naming the missing values |
| 9 | `npx tsc --noEmit` | Clean |
| 10 | `npm run build` | `/api/admin/uploads/sign`, `/api/admin/uploads/confirm`, `/api/admin/media/[id]` all dynamic; `/` and `/interior` still static |

Two things this phase taught:

1. **A presigned PUT is only as strict as the headers in it.** Because
   `ContentLength` is part of the signature, a body of any other size is refused with a bare
   `403` — which is a useful enforcement, and a confusing error if the client signs one size
   and sends another. `media-manager.tsx` therefore signs exactly the blob it is about to
   PUT, and the API re-checks the same ceiling before signing.
2. **Absent configuration must be a clear sentence, not a stack trace.** R2 stays optional in
   `lib/cms/env.ts`: with no `R2_*` values the site, the admin and every non-upload route
   work unchanged, and only the upload routes answer `503` saying which four names are
   missing. That is what lets Phase 6 land before the public domain exists.

**One item remains before uploads work in production:** a single bucket CORS rule for the
browser `PUT` (see §22.1). The public base URL is now optional rather than required — it
only changes where images are served from, because §22.1's proxy renders them either way.

### 22.1 Reads without a public URL — the in-app image proxy (variant A)

The bucket has no public URL yet (S3 API access only), and a browser `<img>` cannot speak
SigV4, so with `R2_PUBLIC_BASE_URL` unset there was no way to put an image on a screen:
uploads landed but every `src=""` was a bare key that 404'd. Fixed without touching
Cloudflare public access, by letting the server fetch where the secret key lives:

```
browser ──GET──▶ /api/media/<key> ──GetObject──▶ R2 (signed, server-side) ──▶ bytes + cache headers
```

`app/api/media/[...key]/route.ts` streams `GetObject` through with
`Cache-Control: public, max-age=31536000, immutable` (keys are content hashes). Its key
regex — `properties/<slug>/<hash>.<ext>` — is the only boundary that matters: it pins reads
to catalogue images, so the route can never become an open proxy into the bucket, and a miss
is a bare `404` with no stack trace or bucket name. Public `GET`, no session: catalogue
images are public content.

`mediaSrc()` and its client twin gained one fallback:

| Situation | `src` |
|---|---|
| `/images/…` or full URL (the three existing homes) | unchanged, passes through |
| R2 key **with** `R2_PUBLIC_BASE_URL` | `https://images…/<key>` — direct from R2 |
| R2 key **without** it (today) | `/api/media/<key>` — proxied, works with S3 API only |

Setting the base URL later therefore flips every image site-wide from proxied to direct with
**one env var and no migration** — same keys, same bucket, no re-upload.

Verified end to end with `R2_PUBLIC_BASE_URL` unset: create → sign → `PUT 200` → confirm
`card` → `GET /api/media/<key>` → `200 · image/webp · public, max-age=31536000, immutable`
→ exact byte count → the properties list page renders `/api/media/<key>` as its thumbnail →
`/evil/key.webp` and `properties/../users/abc.webp` → `404` → delete → `cms:r2` back to
`objects: 0`. The editor's notice now explains images are served through the app.

**Why reads are proxied but uploads still go direct:** proxying reads costs only
cache-miss egress (the immutable header makes each key cheap), while proxying uploads would
push Vercel onto the hot path of every edit and contradict spec D3. So the browser still
`PUT`s to R2 directly — which needs exactly one bucket CORS rule, set once from Cloudflare.
R2 refuses `PutBucketCors` over the S3 API (`AccessDenied` — it is Cloudflare-side), so this
is the one manual step, via `wrangler r2 bucket cors put casa --file .local/r2-cors.json` or
the dashboard (bucket `casa` → Settings → CORS policy):

```json
{ "CORSRules": [{ "AllowedOrigins": ["*"], "AllowedMethods": ["PUT", "GET", "HEAD"],
                  "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }] }
```

A wildcard origin costs nothing security-wise: the upload is protected by the presigned URL
itself (5 minutes, one key, content-type and size bound), not by the `Origin` header — a
script can forge that anyway. `GET` is allowed for when a public base URL is added later;
reads today are same-origin through §22.1's proxy, which needs no CORS at all.

If the bucket must stay completely untouched, the same feature moves to variant B (browser
`POST`s the resized blob to `/api/admin/uploads/blob`, server `PUT`s it): no CORS ever, at
the cost of upload bandwidth on Vercel. Variant A is in place because it keeps uploads free
and matches D3.


## 23. Phase 7 — delivered (verified)

Built: the flip. `/` and `/interior` render published rows from the database instead of the
hand-written array in `lib/properties.ts`. `lib/cms/public.ts` owns the read —
`listPublishedProperties()` (published only, `position` order) and the mapping to the public
`Property[]`, so a component still sees exactly the shape it always saw. `app/(site)/page.tsx` is
`async` and hands the catalogue to `PropertyProvider`, which holds the single copy in the client tree:
`useProperty()` exposes `properties` and `getProperty(slug)` to the grid, the drawer and its pager, and
the shortlist. The interior band (`HomesWeDesign`) reads the same rows server-side, because that route
has no provider. `getPropertyBySlug(slug)` is now the pure `findPropertyBySlug(list, slug)` — the lookup
takes the catalogue as an argument, so no component imports a module-level constant any more.

Two consequences worth naming up front:

- `lib/properties.ts` is types and pure helpers again, plus `PROPERTIES`, which stays as the seed
  source for `npm run migrate:properties` and as this gate's baseline. Nothing in the app reads it.
- **The shortlist stores slugs.** `shortlist-store.ts` writes and reads strings that look like slugs
  and never a `Property`, so a browser that saved homes before the flip cannot resurrect stale content
  through `localStorage`, and `shortlist-float.tsx` resolves those slugs against the catalogue the
  provider holds — a home that is no longer published simply drops out.

The other half is revalidation. Publishing used to be the only writer that reached the two routes; now
every content write does — a save, a reorder, a delete, a media confirm, an alt-text edit — through one
helper, `revalidatePublishedPages()` (`lib/cms/revalidate.ts`), which publish and unpublish also report
back as `revalidated: ["/", "/interior"]`.

Both gates below are local artefacts under the gitignored `.local/`, run against a production build
(`npm run build` + `npm start`, `TURSO_DATABASE_URL=file:./.local/cms.db`) — the same shape of evidence
as §22.

| # | Check | Result |
|---|---|---|
| 1 | `npm run build` with `TURSO_DATABASE_URL` set | `/` and `/interior` still static, and now prerendered *from the database*. Without the variable a production build fails — correct, because the catalogue is a build input |
| 2 | Pixel gate — `node .local/verify/pixel-gate.mjs` | Content markup identical to the pre-refactor captures: `/` 75,989 chars, `/interior` 39,271. Script bodies (whose chunk hashes legitimately changed) and `<link>`/`<meta>` tags are excluded; what is compared is the DOM a visitor gets |
| 3 | All three homes on both routes | `the-residence`, `the-premier-home`, `the-heights` are named on `/` and `/interior`, and each is linked by slug somewhere (`?property=<slug>` on the interior band) |
| 4 | A save reaches both routes | Renaming `the-heights` through `PATCH` → `/` and `/interior` both answer `cache MISS` and show the new name; renaming it back removes it |
| 5 | Unpublish / publish | `revalidated: ["/", "/interior"]` both ways; the home leaves both routes and returns |
| 6 | Reorder | The grid order on `/` follows `position` on the next request, and `/interior` follows it too; the seeded order was restored afterwards |
| 7 | Revalidation E2E — `node .local/verify/revalidation-e2e.mjs` | 21/21 PASS. The probe home is left exactly as found (`name`, `published`, `updated_at` and `updated_by` restored; only the audit rows remain, which is what an audit trail is for) |
| 8 | `npx tsc --noEmit` | Clean |
| 9 | `npm run cms:status` · `npm run cms:r2` | users 1 (`casa`) · properties 4 (3 published + 1 draft) · property_media 23 · R2 `objects 1 · orphans 0` |
| 10 | Sign-in failure modes — `node .local/verify/auth-e2e.mjs` | 82/82 PASS, twice in a row. A foreign `Origin` is refused `403 Origin not allowed` **before a credential is read**; an unknown username and a wrong password are the same answer, character for character (`401 {"error":"Invalid username or password"}`); the counter sits on the account, not on the guess; five wrong guesses → `429 · Retry-After: 300`, and the *correct* password then gets `429` too; a disabled account fails the same generic way; the temporary password signs in to `/admin/password` and reaches nothing else (`403` on every API, `/auth/me` still `200`); changing it revokes the other session and keeps the one that changed it; `logout` clears the cookie *and* the row |
| 11 | Authorization matrix | An editor reads drafts ("an editor sees the whole catalogue, drafts included" — 4 rows), saves and publishes (`revalidated: ["/", "/interior"]`), reads the audit trail, and gets `403 Forbidden` — one body, no detail — for delete, reorder, users and settings; the refused delete left the home in place and the refused reorder changed nothing. The role check runs *after* the pending-password check (an editor asking for the user list is told about their password, not their role) and after the origin check. Signed out: API reads are `401` JSON, page reads are `307 → /admin/signin`, and a cookie that is not in `sessions` is `401`, not `500` |
| 12 | Throttle, and a gate that leaves no trace | One dedicated address makes 20 guesses (all `401`); the twenty-first is `429 · Retry-After: 899`, and it is audited as `auth.login_throttled`. The script creates its two `probe-auth-*` users per run and removes them, their sessions and their throttle rows, restores `lider` and `the-heights` field for field, and counts audit rows only above a preflight `id` floor — so run 2 of 2 repeated run 1 exactly (37 sign-in attempts, 82 checks, `PASS`) and the public pages never saw the probe |


Three things this phase taught:

1. **A client store must not own a catalogue it no longer owns.** The shortlist was the one piece of
   the read path that had quietly become a second source of truth: it persisted whole `Property`
   objects, so a home edited in the admin would still render its old price to anyone with a saved
   list — and a home unpublished would still render at all. Persisting the slug and resolving it
   against the live catalogue fixed both, and it is the rule to keep: **`localStorage` may hold
   identifiers, never content.**
2. **"Publish revalidates" was true and no longer sufficient.** The moment the page reads the
   database, every write a visitor can see is a publish-shaped event — the grid order, a card image,
   an alt-text fix, a delete. The fix was to make revalidation a property of the write path (one
   helper, one path list) rather than a step remembered in two route handlers; the missing case in
   Phase 8's review would otherwise have been found by a visitor instead.
3. **The gate has to compare markup, not responses.** Chunk hashes change whenever a client component
   changes, so a byte-diff of the two HTML documents would have failed for reasons nobody cares about
   and passed over real content drift in the noise. Stripping `<script>`/`<link>`/`<meta>` first makes
   the comparison about the DOM — 75,989 and 39,271 characters of it, identical — while still asserting
   that every published home is actually named and linked on the page, so an empty-but-identical
   catalogue cannot pass. What it deliberately does *not* replace is the two-width screenshot pass
   (§11), which is the Phase 8 item: no CSS or layout file changed in this phase, and the numbers
   above are the evidence for that, but visual confirmation happens against the deployed preview where
   the legacy `/images/…` paths and the resized WebP keys are served for real.

**One operational note for deployment.** `/` and `/interior` are still static, so the catalogue is
read at build time: a production build (and a Vercel deploy) must have `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN` set, or the prerender fails. That is the same pair the admin needs — nothing new to
provision — but it moves those variables from "needed by /admin" to "needed by the build", and it is
the first thing to check if a deploy ever fails at `/` collection. Revalidation then keeps the pages
current between deploys; image sources are unchanged by the flip, because the migration stored the
three existing homes' legacy `/images/…` paths as they were and `mediaSrc()` passes them through.

