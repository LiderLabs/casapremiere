# CASA Premier — site copy deck (v2)

**Direction:** premium real estate · interior design · property development · renovation.
**Status:** applied to the codebase (string swaps + 2 new blocks + 3 structural additions).
**Supersedes:** `docs/archive/casa-premier-copy-v1-eco.md` (the earlier eco/passive pass).
**Routes:** `/` (CASA site) and `/interior` (CASA interiors brand page).

Line references are pre-edit numbers; use the quoted string to relocate them.

---

## 0. Shared rules

| Item | Value |
|---|---|
| Brand | **CASA Premier** |
| Location | **Accra, Ghana** (office: Adjiringanor school junction) |
| Email | **projects@casapremiergh.com** |
| Phone / WhatsApp | **+233 555 287 488** |
| Hours | **Mon–Fri, 09:00–17:00 GMT** |
| Currency | **GH₵** (property prices) |
| Voice | Premium, architectural, confident. Short headlines + 1–2 sentence support. No inflated claims. |

### What v2 changed
1. Positioning moved from *energy-efficient/passive homes* to *premium property + interiors + development*.
2. Hero: headline kept (`Thoughtful Designs crafted for modern living. / Built for generations.`), **added** supporting copy + **Explore Our Properties** / **Start a Project**.
3. **New sections:** `Our Services` (`#services`) and `Our Process` (`#process`).
4. Property showcase replaced the old model cards: **Featured Properties** with location + beds/baths/m² + **View Property →**.
5. Stats tiles are now non-numeric (no invented figures).
6. Booking + contact "project type" options realigned to the new offer.
7. Anchor `#accessories` → `#properties`.

---

## 1. `/` — CASA site

### 1.1 Metadata — `app/(site)/layout.tsx:10-11`
- title: `CASA Premier — Premium Property & Interior Design in Accra`
- description: `Premium real estate and interior design in Accra — curated properties, considered interiors, property development and renovation.`

### 1.2 Hero — `components/sections/hero-section.tsx`
- Wordmark `:6`: `CASA` (unchanged).
- Tagline `:198-200` (kept): *"Thoughtful Designs crafted for modern living."* / *"Built for generations."*
- **New** supporting copy: *"Premium real estate and interior design crafted for modern living. From finding the right property to transforming it into a space that feels unmistakably yours, we bring design, quality and functionality together."*
- **New** CTAs: **Explore Our Properties** → `#properties` · **Start a Project** → booking modal.
- Note: the CTAs sit inside the `fixed` bottom layer, so the button row carries `pointer-events-auto` while the layer keeps `pointer-events-none`; they fade out with the existing scroll `textOpacity`.

### 1.3 Brand statement — `components/sections/philosophy-section.tsx`
- `:7-9` rotating titles (kept): **Premier Estate.** / **Interior Design.** / **Elevated living.**
- `:148` paragraph: *"We create and curate exceptional spaces for people who value quality, character and thoughtful design. Whether you are buying, developing, renovating or furnishing a property, our team brings every detail together to create spaces that feel as good as they look."*

### 1.4 Statement block — `components/sections/technology-section.tsx`
- `:81-83` cycles: **Thoughtful Design.** / **Timeless Materials.** / **Personal Spaces.**
- `:92` paragraph: *"Designed around the way you live. A beautiful space should do more than impress — it should feel right. Exceptional interiors begin with understanding the people who inhabit them. Every material, proportion, colour and detail is carefully considered to create spaces that are sophisticated, functional and deeply personal."*

### 1.5 Services ★NEW — `components/sections/services-section.tsx`
`#services` · eyebrow **Our Services** · h2 **From Property to Possibility.**

| Icon | Service | Copy |
|---|---|---|
| `KeyRound` | Real Estate | Discover carefully selected residential and commercial properties in sought-after locations, chosen for their potential, quality and long-term value. |
| `Sofa` | Interior Design | We transform interiors through refined materials, considered layouts, bespoke furniture and a distinctive design language tailored to each client. |
| `Building2` | Property Development | From concept to completion, we develop spaces that combine strong architectural character, practical functionality and enduring appeal. |
| `Paintbrush` | Renovation & Styling | Reimagine existing spaces with strategic renovations, curated finishes and interiors designed around the way you live. |

### 1.6 Featured Properties — `components/sections/collection-section.tsx`
`id="properties"` · eyebrow **Selected Portfolio** · h2 **Featured Properties**

| Property | Location · Spec | Description | Price | Link |
|---|---|---|---|---|
| The Residence | East Legon, Accra · 4 Bedrooms · 5 Bathrooms · 520 m² | A contemporary residence combining generous living spaces, refined finishes and seamless indoor-outdoor living. | GH₵ 285,000 | View Property → `#contact` |
| The Heights | Cantonments, Accra · 3 Bedrooms · 4 Bathrooms · 340 m² | Sophisticated city living with carefully considered interiors, premium finishes and exceptional attention to detail. | GH₵ 395,000 | View Property → `#contact` |
| The Courtyard | Airport Residential, Accra · 4 Bedrooms · 5 Bathrooms · 460 m² | A modern private residence designed around natural light, privacy and effortless entertaining. | GH₵ 525,000 | View Property → `#contact` |

→ ⚠️ `[confirm]` names/locations/specs/prices — these are the sample's illustrative listings. The **View Property** link currently targets `#contact` (no detail pages yet); swap `href` per property when pages exist.

### 1.7 Numbers — `components/sections/editorial-section.tsx`
- **New** heading band: eyebrow **At a Glance** + h2 **Experience, measured.**
- `:5-10` four tiles — **non-numeric** per your decision (no invented figures):

| Label (small) | Value (large) |
|---|---|
| Luxury Homes | Residential |
| Workspaces & Hospitality | Commercial |
| Complete Design Services | Interior |
| End-to-End Projects | Development |

- Video + iframe title (`CASA Premier — a look around the estate`) unchanged.

### 1.8 Interiors cross-link — `components/sections/interior-section.tsx`
`#exterior` · label **The Interior** · heading **The Art of the Interior** · body *"Step inside spaces where architecture, furniture, materials and light come together. From contemporary minimalism to warm, sophisticated interiors, we create environments that reflect the people who live, work and gather in them."* · CTA **Explore Our Interiors** → `/interior`.

### 1.9 Process ★NEW — `components/sections/process-section.tsx`
`#process` · eyebrow **Our Process** · h2 **From Vision to Reality.**

| # | Step | Copy |
|---|---|---|
| 01 | Discover | We begin by understanding your property, lifestyle, aspirations and vision. |
| 02 | Design | Our designers develop the concept, spatial planning, materials, finishes and visual direction. |
| 03 | Refine | Every detail is reviewed, from furniture and lighting to joinery and finishing touches. |
| 04 | Deliver | We coordinate the execution and bring the finished space to life with precision and care. |

### 1.10 Brand statement — `components/sections/testimonials-section.tsx` (`#about`)
- **New** `<h2>`: **Spaces Worth Coming Home To.**
- Supporting paragraph: *"We believe the spaces around us shape the way we experience life. That is why we create properties and interiors that go beyond appearance — spaces with character, comfort and lasting value."*
- Image alt: *CASA Premier home in its landscape, Adjiringanor, Accra*.

### 1.11 Contact — `components/sections/contact-section.tsx`
- eyebrow **Start a Project** · h2 **Let's Create Your Next Space.** · paragraph *"Whether you are searching for your next property, planning a new development or ready to transform your interior, our team is ready to bring your vision to life."*
- Details: `projects@casapremiergh.com` · `+233 555 287 488` · **Studio** — Adjiringanor school junction Accra, Ghana.
- Secondary button: **Prefer to book a consultation?** (opens the booking modal).
- Form card: **New** heading **Tell Us About Your Project**, fields **Name · Email · Phone (optional) · Project Type (select) · Message**; success copy *"Thanks for reaching out. Our team will reply within one business day."*
  - `projectType` is a required enum sourced from `BOOKING_SERVICES` (single source of truth with the booking modal).
  - The form still has no backend — it logs and shows the success state (unchanged behaviour).

### 1.12 Footer — `components/sections/footer-section.tsx`
- Brand blurb: *"Spaces thoughtfully designed. Properties carefully curated. Premium real estate and interior design in Accra, Ghana."*
- Column headings: **Explore / Company / Services**

| Column | Links |
|---|---|
| Explore | Properties `#properties` · Gallery `#gallery` · Developments `#services` · Interior Design `/interior` |
| Company | About Us `#about` · Our Approach `#services` · Our Process `#process` · Contact `#contact` |
| Services | Real Estate `#properties` · Interior Design `/interior` · Property Development `#services` · Renovation & Styling `#contact` · Book a consultation *(opens modal)* |

- Socials: Instagram · LinkedIn · YouTube (`href="#"` — `[confirm]` URLs); bottom bar `© 2026 CASA Premier. All rights reserved.`
- The old dead entries (*Team*, *Careers*, *Installation*, *Maintenance*, *Support*, all pointing at `#`) are gone.

### 1.13 Header — `components/header.tsx`
Nav (desktop + mobile): **Properties** `#properties` · **Gallery** `#gallery` · **Services** `#services` · **About** `#about` · **Contact** `#contact` · **Interiors** `/interior`; CTA **Book a Consultation**.

---

## 2. `/interior` — interiors brand page (design & animations untouched)

Per your instruction the interior page keeps its structure, styling and animations, and stays the interiors brand page. The v1 copy stands, with one functional string updated for the booking realignment.

| Slot | Copy |
|---|---|
| Metadata | title `CASA Premier — Interiors` · description `Interior design by CASA Premier: space planning, bespoke joinery and material palettes for homes in Adjiringanor, Accra and across the estate.` |
| Hero | eyebrow **CASA Premier — Interior Design** · headline **Interiors designed** / *for the way you live* |
| Philosophy | **Design with intention** + intro *"An interior should feel inevitable — as if the house could not have been arranged any other way…"*; concepts: **Light and material · Space that flows · Made to measure · Cool by design** |
| Interiors Made (`#projects`) | eyebrow **Interiors Made** · h2 **Selected Interiors** · link **Talk to the studio**; cards: *The Ridge House* (Full interior fit-out · Adjiringanor, Accra · 2026) · *Courtyard Kitchen* (Kitchen and dining · Accra · 2025) · *Quiet Bedrooms* (Bedrooms and joinery · Casa Premier Estate · 2025) · *Studio at Home* (Live-work interior · Accra · 2024) |
| Services (`#services`) | **Interior Architecture · Bespoke Joinery · Material & Finish Palettes · Furnishing & Styling** (icons: Ruler · Hammer · Palette · Sofa) |
| FAQ (`#faq`) | 6 Accra-appropriate Q&A — estate location, interior timelines, customising a purchased model, interiors-only projects, keeping interiors cool, how to start |
| The Exterior (`#interior`) | heading **See the architecture** · body about the buildings/façades/estate plans · CTA **Explore the Estate** → `/`; image corrected from the missing `/images/build1.jpg` to `/images/exterior.png` |
| CTA | **Ready to create something extraordinary?** · `mailto:projects@casapremiergh.com` · **Book a consultation** → prefills `Interior design` (the only functional string change on this page) |
| Footer | logo alt **CASA Premier** · statement *"CASA Premier designs interiors — space, joinery, materials and furniture…"* · Connect: `projects@casapremiergh.com` · `tel:+233555287488` (+233 555 287 488) · Adjiringanor, Accra, Ghana · Studio links (Interiors · About · Services · Contact · Exterior) · `© 2026 CASA Premier.` |
| Header | logo alt **CASA Premier** · nav Home · Philosophy · **Interiors** · What we do · FAQ · **Exterior**; the mobile menu's cross-site link was corrected from *Interior* to *Exterior* to match the desktop menu |

---

## 3. Booking flow (shared)

| Slot | Copy |
|---|---|
| `lib/booking.ts` services | **Site visit · Buy a property · Sell a property · Interior design · Renovation · Property development · Commercial project** |
| Modal | *Appointments / Book a Consultation / "Tell us about your project and pick a time that suits you. All times GMT (Accra)."* (unchanged) |
| WhatsApp status line | unchanged — online submission stays disabled, so nothing claims the site received a request |
| Availability | unchanged — Mon–Fri, 09:00–17:00, 1-day lead, 90-day horizon |
| Contact form | shares the same 7 options, so the modal and the form can never disagree |

---

## 4. Open items to replace with real data

1. **Properties** — *The Residence / The Heights / The Courtyard*, their locations, bed/bath/m² and the GH₵ prices come from the sample. Confirm or replace; deleting the `price` field removes the price from both card layouts.
2. **View Property** currently targets `#contact`. Point each `href` at a detail page when one exists.
3. **Numbers** — the 4 tiles are non-numeric by your decision; real figures are a one-line edit in `editorial-section.tsx`.
4. **Socials** — Instagram / LinkedIn / YouTube are still `href="#"` in both footers.
5. **Interiors portfolio** — the 4 titles, places and years on `/interior` are drafts.
6. **`#accessories` → `#properties`** — old bookmarked anchors no longer resolve (nothing else breaks).

---

## 5. Verification record

- `npm run build` → both routes prerendered as static content (`/`, `/interior`). The pre-existing type error at `components/projects.tsx:93` (a ref callback returning a value) is untouched and ignored by `next.config.mjs` (`typescript.ignoreBuildErrors: true`).
- Content assertions ran against the **prerendered HTML** (`.next/server/app/index.html`, `interior.html`):
  - **present on `/`**: hero tagline + supporting copy + both CTAs, brand-statement words (`curate`, `exceptional`), `From Property to Possibility`, service names, `Featured Properties`, `The Residence`, `East Legon, Accra`, `View Property` (×6 = 3 mobile + 3 desktop), `Experience, measured.`, `The Art of the Interior`, `Explore Our Interiors`, `From Vision to Reality`, `Spaces Worth Coming Home To.`, `Tell Us About Your Project`, `Choose a project type`, `Company`, `Our Process`.
  - **absent on `/`**: `adventure-ready`, `Surface Options`, `The Models`, `passive house`, `Climate-first`, `San Francisco`, `Malibu`/`Tokyo`/`Lisbon`/`Oslo`, `hello@hously`, `+1234567890`, `primestrategygh`, `Lightweight`, `Carbon Balance`, `Solar Panels`, `The Interiors`, `Energy that pays back`.
  - **present on `/interior`**: `Interiors designed`, `for the way you live`, `The Ridge House`, `projects@casapremiergh.com`.
  - **absent on `/interior`**: `hello@hously`, `San Francisco`, `Malibu`/`Tokyo`/`Lisbon`/`Oslo`, `+1234567890`, `Hously`.
- Methodology note: text inside the scroll-reveal sections renders as **per-word `<span>`s**, and apostrophes are HTML-escaped (`Let&#x27;s`). Assert on single words (`curate`, `Timeless`) rather than whole sentences, or the check reports false failures.


