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

## History note

The original two apps were `apps/interior` (Hously) and `apps/main-app`. `apps/interior` was removed after the merge was verified; it remains fully recoverable from git history (`git log --oneline -- apps/interior`, `git checkout <commit> -- apps/interior`).
