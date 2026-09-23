# CASA Premier — site copy deck

**Status:** applied to the codebase (string-only edits; no layout, structure or logic changes).
**Date:** 2026-09-23
**Routes covered:** `/` (CASA estate site) and `/interior` (CASA interiors site), plus the shared booking modal.

Line references are the **pre-edit** line numbers of each file (use the quoted string to relocate them).

---

## 0. Shared rules (single source of truth)

| Item | Value used everywhere |
|---|---|
| Brand | **CASA Premier** (retired: `Hously`, `EVASION`, bare `CASA`) |
| Location | **Adjiringanor, Accra, Ghana** |
| Email | **projects@casapremiergh.com** (retired: `hello@hously.com`, `casapremier@primestrategygh.com`) |
| Phone / WhatsApp | **+233 555 287 488** (`tel:+233555287488`, `wa.me/233555287488`) |
| Hours | **Mon–Fri, 09:00–17:00 GMT** |
| Currency | **GH₵** |
| Tone | Calm, precise, architecture-led. Short sentences, no exclamation marks, no unevidenced claims. |

### Applied changes at a glance

- Killed the two leftover *outdoor-gear* strings (hero tagline, `/` metadata description).
- Restored the hero wordmark (`const word = "CASA"` — it had been blanked to `""`).
- Replaced the fictional foreign portfolio (Malibu / Tokyo / Lisbon / Oslo) and the "San Francisco studio" FAQ with Accra/Adjiringanor content.
- Fixed the dead `hello@hously.com` links, the `tel:+1234567890`/label mismatch, and the mismatched email label in the interior footer.
- Pointed the interior page's "Projects" nav/footer entries at the renamed **Interiors** section; fixed the interior mobile menu's cross-site link that was labelled **Interior** while the desktop menu labelled it **Exterior**.
- Replaced `/interior`'s broken image `public/images/build1.jpg` (file does not exist) with `/images/exterior.png`.
- Swapped `/interior` services icons to match the new services.

---

## 1. `/` — CASA estate site

### 1.1 Metadata — `app/(site)/layout.tsx:10-11`
- title: `CASA Premier — Energy-Efficient Homes in Adjiringanor, Accra`
- description: `CASA Premier designs and builds energy-efficient homes in Adjiringanor, Accra — contemporary architecture, passive climate design and locally sourced materials.`

### 1.2 Hero — `components/sections/hero-section.tsx`
| Ref | Copy |
|---|---|
| `:6` wordmark | `CASA` (was `""` — blank) |
| `:197-201` tagline | *"Designed for the climate."* / *"Built for generations."* |
| `:11,17,23,29` side alts | CASA Premier façade in corten steel, Adjiringanor, Accra · Aerial view of the CASA Premier estate, Accra · Living space opening onto the garden, CASA Premier · CASA Premier home lit at dusk |
| `:152` centre alt | CASA Premier home under construction, Accra |

### 1.3 Design concept — `components/sections/philosophy-section.tsx`
- `:6-10` rotating titles: **Passive by design.** / **Built for the tropics.** / **Built to last.** (the third persists — matches the component's "last text stays visible" logic)
- `:147-148` body: *"CASA Premier is a private estate of design-led homes in Adjiringanor, Accra. Every house pairs a contemporary plan with a high-performance envelope — cross ventilation, deep shading, rooftop solar and locally sourced materials — so it stays comfortable through the Harmattan and the rains, and costs less to run for the decades ahead."*

### 1.4 Build technology — `components/sections/technology-section.tsx`
- `:80-84` cycles: **Climate-first construction.** / **Energy that pays back.** / **Materials with a future.**
- `:92` body: *"Each home is designed as a passive house for a tropical climate: a ventilated, insulated envelope, deep roof overhangs and cross-flow openings that move air without mechanical cooling. Rooftop solar, rainwater harvesting and efficient lighting reduce running costs, while low-carbon local materials keep the rooms cool and the footprint small."*
  → ⚠️ `[confirm]` every technical claim here.

### 1.5 Image grid — `components/sections/featured-products-section.tsx:5-46,71`
Each of the 10 bento images now carries its own `alt` (was `Architecture sketch N`): Façade detail, CASA Premier · Site and landscape study · Timber and concrete detail · Completed living room, CASA Premier · Terrace and garden · Roof and solar array · Model plan drawing · Joinery detail · Estate landscape at dusk · Water storage and services.

### 1.6 The models — `components/sections/collection-section.tsx:34-36,5-27`
- Heading: **The Models** (was "Surface Options" — now matches the header nav)
- Cards: **Bank** — 120 m² three-bedroom home with optimal energy efficiency · **Casa Premier** — 180 m² four-bedroom home, the balance of space and efficiency · **Heights** — 250 m² five-bedroom home with an upper terrace and maximum comfort.
- Prices now read `GH₵ 285,000` / `GH₵ 395,000` / `GH₵ 525,000`.
  → ⚠️ `[confirm]` the numerals. The old copy showed `$285,000` etc.; only the currency label was changed. **Send the real GHS figures** (or switch to "From GH₵ …" / "Price on application"). Also `[confirm]` whether "Bank" is the intended model name.

### 1.7 Performance specs — `components/sections/editorial-section.tsx`
- `:5-10` four values kept verbatim: Surface Area 180 m² · Energy Use 15 kWh/m² · Solar Panels 40 m² · Carbon Balance −20% → `[confirm]` they describe the flagship 180 m² model.
- `:98` iframe title: `CASA Premier — a look around the estate`.

### 1.8 Interiors cross-link — `components/sections/interior-section.tsx:24-38`
label **The Interiors** · heading **Step inside a CASA Premier home** · body *"Interior concepts, material palettes and finishes developed by our in-house studio for every home in the estate — and for clients furnishing their own spaces."* · CTA **Explore the Interiors** → `/interior`.

### 1.9 About block — `components/sections/testimonials-section.tsx:8-24` (`id="about"`)
*"CASA Premier is a Ghanaian developer building a private estate of energy-efficient homes in Adjiringanor, Accra — we keep every house close to its site, and we build with materials that age well, so a home here stays comfortable, economical and quiet for a lifetime."*
alt → *CASA Premier home in its landscape, Adjiringanor, Accra*

### 1.10 Contact — `components/sections/contact-section.tsx:83-87,137-138`
- intro → *"Questions about the estate, a model or a site visit? Tell us what you are planning and we will come back to you. You are welcome to visit the show home in Adjiringanor — appointments are usually confirmed within one business day."*
- success message → *"Thanks for reaching out. Our team will reply within one business day."*
- details unchanged: `projects@casapremiergh.com` · `+233 555 287 488` · *Adjiringanor school junction Accra, Ghana*.

### 1.11 Footer — `components/sections/footer-section.tsx:19-39,81-83,109-134`
- brand blurb → *"CASA Premier builds energy-efficient, design-led homes in Adjiringanor, Accra — contemporary architecture, passive climate design and materials chosen to last."*
- **Explore:** Design (`#technology`) · Gallery (`#gallery`) · Models (`#accessories`) — labels now match the header nav.
- **About:** Our Story (`#about`) · Contact (`#contact`) · Interiors (`/interior`) — the dead *Team* / *Careers* entries (which pointed at `#`) were dropped, and *Exterior* → *Interiors*.
- bottom bar: `© 2026 CASA Premier. All rights reserved.`; socials **Instagram · LinkedIn · YouTube** (was Twitter).
  → ⚠️ the three social `href`s are still `#` — send the real URLs.

### 1.12 Header — `components/header.tsx:52-87,116-157`
nav: Design · Gallery · Models · About · Contact · **Interiors** (both desktop and mobile); CTA unchanged: *Book a Visit*.

---

## 2. `/interior` — CASA interiors site

### 2.1 Metadata — `app/(interior)/layout.tsx:11-13`
- title: `CASA Premier — Interiors`
- description: `Interior design by CASA Premier: space planning, bespoke joinery and material palettes for homes in Adjiringanor, Accra and across the estate.`

### 2.2 Hero — `components/hero.tsx:142,148,150`
- eyebrow: **CASA Premier — Interior Design**
- headline: **Interiors designed** / *for the way you live* (orange span)

### 2.3 Interior design concepts — `components/philosophy.tsx:6-26,76-79`
Intro → *"An interior should feel inevitable — as if the house could not have been arranged any other way. We design every CASA Premier home from the inside out, and take on a small number of interiors for clients' own spaces each year."*

Four concept cards (were "Minimal, not empty / Architecture-led design / Subtle motion / Timeless aesthetic"):
1. **Light and material** — *"Daylight is the first material. We plan rooms around it, then choose finishes that hold it — lime plaster, timber, stone and brushed brass."*
2. **Space that flows** — *"Sight lines, thresholds and storage are resolved early, so living, dining and rest connect without clutter or wasted corridor."*
3. **Made to measure** — *"Bespoke joinery, wardrobes and kitchens drawn for each home — nothing from a catalogue, nothing that fights the walls."*
4. **Cool by design** — *"Shading, airflow and thermal mass keep interiors comfortable through the Accra heat, without leaning on the air conditioner."*

### 2.4 The designs we've made — `components/projects.tsx:6-39,73-82`
Header: eyebrow **Interiors Made** · h2 **Selected Interiors** · link **Talk to the studio** (was "View all projects", which pointed nowhere).

| Title | Category · Location | Year |
|---|---|---|
| **The Ridge House** | Full interior fit-out · Adjiringanor, Accra | 2026 |
| **Courtyard Kitchen** | Kitchen and dining · Accra | 2025 |
| **Quiet Bedrooms** | Bedrooms and joinery · Casa Premier Estate | 2025 |
| **Studio at Home** | Live-work interior · Accra | 2024 |

→ ⚠️ `[confirm]` these four: they replace the old Malibu/Tokyo/Lisbon/Oslo placeholders. Send the real project names, scopes, locations and years (images unchanged: `/images/hously-1…4.png`).

### 2.5 Services — `components/expertise.tsx:4,7-31,68-71`
Intro → *"Interiors are drawn with the same care as the building itself — by the studio that designed the house."*
1. **Interior Architecture** (Ruler) — *"Layouts, partitions, ceiling and lighting plans — the structure of a good interior, resolved on paper first."*
2. **Bespoke Joinery** (Hammer) — *"Kitchens, wardrobes, vanities and built-in seating, made to the millimetre for the room they belong to."*
3. **Material & Finish Palettes** (Palette) — *"Flooring, paint, stone, metal and fabric schedules, coordinated with the architecture and the budget."*
4. **Furnishing & Styling** (Sofa) — *"Furniture selection and final styling, so a finished home is handed over ready to live in."*


