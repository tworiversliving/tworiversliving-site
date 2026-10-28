# TwoRivers site redesign brief

Version 1 · 28 October 2026 · for Claude Code in VS Code

Put this file at `docs/redesign/BRIEF.md` in the `tworiversliving-site` repo. Run one phase per chat. Each phase prompt at the end of this file is self-contained: paste it into a fresh chat and it tells Claude Code what to read.

---

## 1. What this redesign is

The current build works and its copy is good, but it reads as a template and the phone experience is weak. This redesign changes **type, layout rhythm, hero and mobile booking flow**. It does **not** change the colour palette, the booking engine, payments, the database or the PMS adapter.

The design blends two directions:

- **Journal:** an editorial display serif (Redaction) for headlines, generous space, framed photos with the headline overlapping the frame. One "worn" word per page.
- **Floor plan:** every hard fact (beds, distances, times, prices, fees) is set in a mono schedule, like an architect's drawing schedule. Facts sell the flat; photos support.

A visual mockup exists as a Claude Design canvas ("TwoRivers Site Mockup"), but Claude Code cannot open it. Everything needed is written down below. Where this brief and the mockup disagree, this brief wins.

### Stack (from the build plan, confirm by inspecting the repo)

Astro + TypeScript on Cloudflare Workers (free tier), D1, Stripe Embedded Checkout, Resend, Turnstile. The PMS is reached through a swappable adapter (Smoobu now). No React in the project today.

### Hard rules for every phase

1. Work on a new git branch per phase: `redesign/phase-N-short-name`. Commit at the end. Do not push or open a PR unless asked.
2. Do not change booking, pricing, payment, availability, D1 schema, email or PMS adapter **logic**. Phase 3 changes the booking **UI** only and must call the existing logic.
3. Do not add any new Smoobu dependency. Do not add any paid service. Running costs stay at zero.
4. No new UI framework. Prefer Astro components plus small vanilla TypeScript. A single Astro island is allowed only where Phase 3 says so.
5. No em dashes in any copy. British English. Keep the existing copy unless this brief gives new copy.
6. Every page must work at 360, 390 and 430 px wide with no horizontal scroll, and at 1440 px.
7. Before finishing a phase: `npm run build` passes, then take Playwright screenshots of every page touched at 390 px and 1440 px and look at them. Fix what is broken. Report what you changed and what is left.

---

## 2. Design system

### 2.1 Fonts (all OFL-1.1, free for commercial use, self-hosted via npm)

| Role | Family | Package | Weights to import |
|---|---|---|---|
| Display | Redaction | `@fontsource/redaction` | 400 normal, 400 italic |
| Display, worn | Redaction 50 | `@fontsource/redaction-50` | 400 normal |
| UI and body | Host Grotesk | `@fontsource/host-grotesk` | 400, 500 |
| Facts and labels | Fragment Mono | `@fontsource/fragment-mono` | 400 |

- Import only the weights listed, Latin subset only.
- Remove Manrope and Newsreader (and their packages) once nothing uses them.
- Preload the Redaction 400 woff2 on pages whose hero uses it.
- Optional: credit the Redaction designers on a `/credits` page, using the credit wording from the font's own README in `node_modules/@fontsource/redaction`.

**Redaction 50 rule:** use it for at most one phrase per page, always the second line or second half of the main headline. Never for body text, buttons or labels.

### 2.2 Colour tokens

Keep the existing tokens. Add the new ones. Do not introduce any other colour.

```css
:root {
  /* existing, unchanged */
  --forest: #2f3a2b;
  --forest-soft: #5c6657;
  --brass: #a08a5b;
  --brass-deep: #7a6740;
  --mist: #eef0e8;
  --paper: #fafaf6;
  --line: #d9dcd1;
  --error: #9b2c1f;
  --success: #2f6b3a;

  /* new */
  --ink: #1d221b;          /* body text, footer ground */
  --text-2: #3d4439;       /* intro paragraphs */
  --text-3: #4a5246;       /* secondary text */
  --line-strong: var(--forest);   /* top rule of every schedule */
  --line-mist: #cfd3c6;    /* rules on mist ground */
  --on-forest: #eef0e8;
  --on-forest-2: #d5dacd;  /* secondary text on forest */
  --brass-on-forest: #d6c7a2; /* labels on forest */
  --range: #e4e8dc;        /* selected date range fill */
  --scrim: rgb(29 34 27 / .45);
}
```

Grounds by section: paper (default), mist (neighbourhood), forest ("Two ways to stay"), ink (footer). Body text on paper is `--ink`. Labels on paper are `--brass-deep` or `--forest-soft`. Check every text/ground pair is at least 4.5:1.

### 2.3 Type scale

```css
:root {
  --font-display: "Redaction", Georgia, serif;
  --font-worn: "Redaction 50", "Redaction", Georgia, serif;
  --font-sans: "Host Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Fragment Mono", ui-monospace, Menlo, monospace;

  --t-hero: clamp(3.375rem, 1.6rem + 7.4vw, 8.5rem);   /* 54px phone → 136px desktop, line-height .9 */
  --t-h1: clamp(2.5rem, 1.9rem + 2.6vw, 4rem);        /* property title, line-height 1 */
  --t-h2: clamp(2.375rem, 1.9rem + 1.9vw, 3.5rem);    /* section heads, line-height 1 */
  --t-h3: clamp(1.75rem, 1.5rem + 1vw, 2.25rem);      /* sub-heads, serif, line-height 1.1 */
  --t-body: 1.0625rem;   /* 17px, line-height 1.55 */
  --t-lead: 1.1875rem;   /* 19px intro paragraphs, desktop only */
  --t-small: .9375rem;   /* 15px */
  --t-label: .8125rem;   /* 13px mono uppercase, letter-spacing .04em */
  --t-mono: .8125rem;    /* 13px schedule keys */
}
```

- Headlines: Redaction 400, `text-wrap: balance`, letter-spacing `-0.015em` on the hero only.
- Emphasis inside a headline uses Redaction italic (`<em>`), never bold.
- Section labels ("THE FLAT", "STOKE NEWINGTON, N16") are Fragment Mono uppercase in `--brass-deep`. Use a label only where it adds information. **Do not** put a label above every heading.
- Body copy maximum width 36em.

### 2.4 Space and layout

- Container: `max-width: 1280px`, side padding 40px desktop, 20px phone (use `max(20px, env(safe-area-inset-left))` etc.).
- Section vertical padding: 96px desktop, 48px phone.
- Sections are separated by a 1px `--line` rule or a change of ground, never by both.
- Photos have **no border radius**. Pills (buttons, sticky bar) are fully rounded. Inputs and the booking card use 10px and 16px. The bottom sheet uses 20px top corners. Nothing else is rounded.
- No drop shadows except the sticky booking bar and the bottom sheet.
- No cards with a border around every block. The booking card is the only bordered box.

### 2.5 Components to build (in `src/components/ui/` or the repo's equivalent)

**Button**
- `primary`: forest fill, paper text, 500 weight, pill, min height 44px, padding 12px 22px.
- `secondary`: 1px current-colour border, transparent fill.
- `price` variant of primary: two lines, "Check dates" over mono "from £216 a night". Used in the homepage hero.

**Label**: mono uppercase, 13px (12px phone), `--brass-deep`.

**Schedule** (the "Floor plan" element, used everywhere facts appear)
- Top border 1px `--line-strong`, each row bottom border 1px `--line` (`--line-mist` on mist).
- Row = two columns: key in mono uppercase `--forest-soft`, value in sans `--ink`. Desktop key column 200px; phone 96 to 118px.
- Variant `inline`: `<dl>` with no rules, used in the hero (key / value pairs, mono 13px).
- Variant `distance`: place on the left in sans, time on the right in mono.
- Always a real `<dl>` or table semantics.

**Photo**
- Wraps the Astro `<Image>`/`<Picture>` with a fixed `aspect-ratio` prop (`4/5`, `3/2`, `1`, `16/7`), `object-fit: cover`, no radius.
- If the source is missing, render a toned placeholder block (`--line` or a warm grey) with the intended filename in mono at bottom-left, so the site can ship before the reshoot. Never render "Photo to add" text in production; the placeholder only shows in dev or behind a flag.

**Swipe row**
- CSS scroll-snap, `overflow-x: auto`, items at 78% width on phone so the next photo peeks.
- Counter in mono: "1 / 24". Updates with an IntersectionObserver.
- No carousel library.

**Sticky booking bar (phone only, below 900px)**
- Homepage: floating pill, forest ground, 12px from screen edges, shows after the hero leaves the viewport. Left: mono "FROM" over "£216 a night". Right: paper pill "Check dates".
- Property page: full-width paper bar with top rule, always visible. Left: "£216 a night" over mono "NO FEES · FREE CANCELLATION 5 DAYS". Right: forest pill "Check dates".
- Respect `env(safe-area-inset-bottom)`. Add bottom padding to the page so the footer is never hidden.

**Header**
- Wordmark left (use the existing logo SVG from `/public/brand/`), nav centre-right, "Check dates" primary pill right.
- Nav items: The flat · Work & long stays · Stoke Newington · Questions.
- Phone: wordmark plus a 44px round menu button. Menu opens as a full-screen paper panel with the nav in Redaction at `--t-h3`, and the email and WhatsApp in mono at the bottom.
- Remove the dark overlay header variant over the hero photo; the new hero puts the headline on paper.

**Footer**
- Ink ground. Wordmark in Redaction, email and WhatsApp in mono, three link columns (Stay / Company / Legal), company line in mono "Two Rivers Living Ltd · London".

**Accordion (FAQ)**
- Native `<details>`/`<summary>`. Top rule forest, row rules `--line`. Summary 19px 500 weight (17px phone). First item open.

---

## 3. Content facts (use these, do not invent)

| Fact | Value |
|---|---|
| Guests | 7: three double beds plus a sofa bed in bedroom 1 |
| Bathrooms | 1 |
| Floor | Top floor, stairs to the front door, no lift, not step-free |
| Check-in / checkout | From 3pm / by 11am |
| Entry | Self check-in, keys in a lockbox |
| Workspace | Desk and chair, wifi speed tested |
| Laundry | Washing machine |
| Church Street | 1 minute walk |
| Stoke Newington station | 5 minute walk |
| Liverpool Street | About 15 minutes by train |
| Payment | Full payment upfront, no deposit |
| Cancellation | Full refund up to 5 days before arrival |
| Instant book | Up to 14 nights |
| Enquiry | 15 nights or more; nothing over 89 nights |
| Extras | Parking (resident permit, £15), early check-in, late checkout |
| Fees | No booking fee, no cleaning fee |
| Hosts | Hamza and Emmanuel, born and raised in Stoke Newington |
| Email | stay@tworiversliving.co.uk |
| Reply hours | Within a few hours, 8am to 10pm |

**Blanks to leave as visible TODOs in a single `src/content/todo.ts` (or similar) so they are easy to fill:** WhatsApp number, Clissold Park walk time, bus routes, wifi speed, shower or bath, parking basis (per stay or per night), and what happens after the 5-day refund window. Do not render a bracketed placeholder on the live site; hide the line if the value is empty.

**Photos:** reuse the existing images in the repo. The living room shots with the TV visible (Netflix logo) must not be used in the hero or any above-the-fold slot. Use `living-room-detail` cropped 4:5 for the hero until the reshoot. Never show the same photo twice on one page.

---

## 4. Page specs

### 4.1 Homepage (`/`)

Six sections in this order. Remove the old "Where you can stay" listing grid; with one flat it is folded into the sections below.

1. **Hero**
   - Desktop: a relative wrapper. Photo frame starts at 38% from the left, full remaining width, 620px tall. Headline is absolutely positioned top-left over the frame edge: "Stoke Newington," on line 1 in Redaction, "kept local." on line 2 in Redaction 50, colour forest, `--t-hero`.
   - Below, a three-column row aligned to the bottom: intro paragraph (`--t-lead`, `--text-2`); inline schedule (SLEEPS 7 · three doubles + sofa bed / CHURCH ST 1 min walk / LIVERPOOL ST about 15 min by train / FEES none, the price is the price); price button "Check dates / from £216 a night".
   - Phone (below 900px): headline on paper first (54px), then the photo at 4:5, then the paragraph, then the inline schedule with a forest top rule. No form and no button in the hero; the floating sticky bar appears once the hero scrolls out.
   - The "from" price must come from the existing pricing source, not be hard-coded.
2. **The flat**: top rule. Desktop two columns 5fr / 7fr: 4:5 photo (bedroom-1) left; right: label THE FLAT, h2 "Three doubles, one long table and a *real* desk.", paragraph, full schedule (BEDROOM 1, BEDROOM 2, BEDROOM 3, BATHROOM, WORKSPACE, KITCHEN, LAUNDRY, ACCESS), text link "See the whole flat". Then a photo strip below the section: 2fr 1fr 1fr 1fr, 300px tall (dining, kitchen-detail, bedroom-3-detail, workspace), with mono "5 of 24 photos" left and "View all" right. Phone: h2 at 38px, swipe row instead of the strip, counter below.
3. **Two ways to stay**: forest ground. h2 in on-forest. Two columns split by a 1px rule at 25% opacity. Left: label "UP TO 14 NIGHTS · BOOK NOW", h3 "Short stays", copy, mono "From £216 a night", paper pill "Check dates". Right: label "15 NIGHTS OR MORE · ENQUIRE", h3 "Work and long stays", copy (whole flat to one booker, a quote for your dates, invoices in your company name), mono reply hours, outline pill "Ask for a quote" linking to `/work-stays`. Phone: stacked, each with a top rule.
4. **Why book here**: label, then one large Redaction line: "Same flat as on Airbnb," + Redaction 50 "without the platform fee." Then three columns under a rule: Lowest price is here / No booking or cleaning fees / Two hosts, not a call centre, each a 500-weight sans heading plus one line. Plain text, no icons, no boxes. Phone: stacked.
5. **Neighbourhood**: mist ground. Desktop 6fr / 5fr. Left: label "STOKE NEWINGTON, N16", h2 "A minute from Church Street", paragraph, distance schedule. Right: photo grid, one 3:2 spanning two columns (church-street) then two squares (clissold-park, hosts photo). Link to `/areas/stoke-newington`.
6. **Before you book**: desktop 4fr / 7fr, h2 left, accordion right. Six questions: cheaper than Airbnb or Booking.com; how many people; cancellation; check-in and checkout; parking; step-free. Link to `/faq` for the rest.

Footer as in 2.5.

### 4.2 Property page (`/stays/stoke-newington-3-bed`)

1. **Gallery**
   - Desktop: grid `2fr 1fr 1fr` × 2 rows, 580px tall, 10px gap. Main photo spans both rows. Four smaller photos fill the other cells exactly (this fixes the empty bands in the current gallery). Last cell carries a paper pill "All 24 photos".
   - Phone: full-width swipe row at 4:5, round paper back button top-left (44px), mono counter pill bottom-right "1 / 24".
   - "All photos" opens a full-screen lightbox built on `<dialog>`: vertical list on phone, grid on desktop, grouped by room (Living room, Kitchen and dining, Bedroom 1, 2, 3, Bathroom, Workspace, Neighbourhood). Escape and a close button close it.
2. **Two-column body** (desktop `1fr 380px`, gap 80px; phone single column):
   - Title block: label "STOKE NEWINGTON HIGH STREET · N16"; h1 "A three-bedroom flat," + Redaction 50 "a minute from Church Street."; mono line "7 GUESTS · 3 BEDROOMS · 1 BATHROOM · TOP FLOOR"; the two existing paragraphs.
   - Where you'll sleep: three 4:5 tiles with name and mono bed type. Phone: swipe row, 62% wide items.
   - What's in the flat: schedule in two columns on desktop, one on phone (WIFI, WORK, KITCHEN, DINING, LAUNDRY, LIVING, BEDDING, PARKING, BATHROOM, HOSTS).
   - Arriving and leaving: four cells between forest rules: CHECK-IN 3pm and CHECKOUT 11am in Redaction 32px; ENTRY and ACCESS as text. Phone: two cells plus a sentence. Line below about extras.
   - Cancellation: one paragraph.
   - Where it is: static map image (generate once and store in the repo, no maps API at runtime) linking out to Google Maps, then the distances in one mono line.
   - Keep any existing sections not listed (house rules, good to know) restyled with the same pattern: h2 plus schedule or paragraph.
3. **Booking card** (desktop, `position: sticky; top: 24px`): 1px forest border, 16px radius, 28px padding. "£216" in Redaction 40px plus "a night, from". Check-in / checkout pair (opens the calendar), guests select, breakdown (nights, "Booking and cleaning fees £0", total) in mono figures, Reserve button full width, small note "You won't be charged until the next step. Staying 15 nights or more? Ask for a quote."
4. **Phone sticky bar** as in 2.5. "Check dates" opens the date sheet (Phase 3).

### 4.3 Check dates sheet and calendar

- **Phone:** bottom sheet on `<dialog>` with a scrim, 20px top corners, drag handle, starts 118px from the top. Contents: h2 "Your dates" + 44px close button; check-in / checkout summary pair (mono labels "CHECK-IN · 3PM", "CHECKOUT · 11AM"); month calendar; guests stepper (− / count / +, 44px round buttons, 1 to 7); footer pinned to the bottom with summary ("3 nights · 4 guests · no fees" + total in mono), a note line, and a full-width forest button.
- **Desktop:** the same calendar component in a popover under the booking card's date pair, showing two months side by side.
- **Calendar cells:** 46px tall, day number in sans 15px 500 and the nightly price in mono 9.5px under it. Check-in and checkout days: forest fill, paper text, 10px radius. Nights in between: `--range` fill, square. Unavailable days: struck through, 40% opacity, not focusable as selectable. Weekdays header M T W T F S S, week starts Monday.
- **Behaviour:** first tap sets check-in, second tap after it sets checkout, tapping on or before check-in restarts. Enforce existing minimum stay and availability rules from the booking engine. Arrow keys move focus between days; Enter selects.
- **Rules in the UI:** up to 14 nights: button "Continue · £TOTAL" proceeds to the existing checkout. 15 to 89 nights: note "Stays over 14 nights are quoted for the whole flat." and the button becomes "Ask for a quote", which opens the work-stay enquiry with the dates prefilled. Over 89 nights: disable and say "We can't take stays over 89 nights."
- **Data:** get availability and nightly prices from the existing booking engine endpoints. If per-night prices are not exposed today, add a read-only endpoint that returns them from the same source the checkout uses. Never compute prices in the browser that the server does not also compute.
- **Implementation:** a vanilla TypeScript custom element (`<tr-calendar>`) is preferred. If that gets unwieldy, one Preact island is allowed (add `@astrojs/preact`), used only for the calendar.
- Replaces every native `type="date"` input on the site.

### 4.4 Other pages

Apply the system without new layouts unless listed:

- `/work-stays`: hero is type only: h1 "Three bedrooms in N16, ready for your team." with no Redaction 50 (save it for the second line if you split it). Schedule of terms (WHOLE FLAT one booker / INVOICES in your company name / BILLS included / MINIMUM 15 nights / MAXIMUM 89 nights / REPLY within a few hours, 8am to 10pm). Enquiry form below with dates prefilled from the query string.
- `/areas/stoke-newington`: distances schedule at the top, then the existing guide content with Redaction h2s. Photo slots per section.
- `/about`: one hosts photo slot, the story, then a short schedule (BORN Stoke Newington / LIVE a few minutes away / REPLY 8am to 10pm).
- `/faq`, `/contact`, `/book-direct`, legal pages, booking and confirmation pages, 404: restyle with the new tokens, components and type only.
- Remove `/stays` as a listing page or redirect it to the property page while there is one property. Keep the route working.

### 4.5 Open Graph

Add an OG image (1200×630) for the homepage and property page: paper ground, "Stoke Newington, kept local." in Redaction, mono line "7 GUESTS · 3 BEDROOMS · FROM £216", one photo on the right. Generate it at build time or commit a static PNG.

---

## 5. Things that make a site look generated (avoid all of these)

- A small label above every single heading.
- Sections that all follow the same "label, heading, three cards" shape.
- Every block in a bordered card with the same radius and shadow.
- Fade-up-on-scroll animation on every section. Allowed motion: the sheet sliding up, the sticky bar fading in, focus and hover states. Respect `prefers-reduced-motion`.
- Icon sets next to every feature. No icons except close, menu, back and the stepper.
- Gradients, glows, glassmorphism, emoji.
- Copy words: discover, experience, elevate, curated, nestled, oasis, seamless, unforgettable.
- Centred text for whole sections.
- Repeating the same photo on one page.

---

## 6. Phase prompts

Paste one block into a new Claude Code chat. Each one assumes this file is at `docs/redesign/BRIEF.md`.

### Phase 1: Foundations

```
Read docs/redesign/BRIEF.md sections 1, 2 and 5. Do Phase 1 only.

Create branch redesign/phase-1-foundations. Before changing anything, map the repo: where global CSS and tokens live, how fonts are loaded, the layout component, header, footer, and the image setup. Tell me the map in five lines.

Then:
1. Install @fontsource/redaction, @fontsource/redaction-50, @fontsource/host-grotesk, @fontsource/fragment-mono. Import only the weights in 2.1. Remove Manrope and Newsreader.
2. Add the colour tokens (2.2) and type, space and layout tokens (2.3, 2.4) to the existing token file. Keep existing tokens.
3. Build Button, Label, Schedule (all variants), Photo (with dev placeholder), SwipeRow with counter, Accordion styles (2.5).
4. Rebuild the header (with phone menu panel) and footer (2.5).
5. Create the TODO content file from section 3.
Don't redesign any page body yet. Run the build, screenshot the homepage at 390 and 1440 to check header, footer and fonts, then commit.
```

### Phase 2: Homepage

```
Read docs/redesign/BRIEF.md sections 1 to 5, focusing on 4.1. Do Phase 2 only. Phase 1 (tokens, fonts, components, header, footer) is done on branch redesign/phase-1-foundations; branch from it as redesign/phase-2-home.

Rebuild src/pages/index (or the repo's homepage) to the six-section spec in 4.1 using the Phase 1 components. Keep existing copy where 4.1 doesn't give new copy. Pull the "from" price from the existing pricing source. Add the phone floating sticky bar (2.5); for now its "Check dates" links to the property page with #book, since the sheet comes in Phase 3. Follow the photo rules in section 3: no TV shots above the fold, no photo used twice.

Run the build, screenshot at 360, 390, 430 and 1440, fix issues, and check section 5 against the result. Commit.
```

### Phase 3: Calendar and date sheet

```
Read docs/redesign/BRIEF.md sections 1, 2, 3 and 4.3. Do Phase 3 only. Branch redesign/phase-3-calendar from the latest redesign branch.

First, find and explain in a few lines how the current booking flow gets availability, minimum stay and prices, and what the checkout expects as input. Do not change that logic.

Build the <tr-calendar> custom element and the phone bottom sheet and desktop popover from 4.3. Wire the homepage sticky bar, the property page sticky bar and the property booking card to it. Implement the 14 / 15-89 / 89+ night rules, with "Ask for a quote" opening the work-stay enquiry with dates prefilled. Replace every native date input on the site. Keyboard: arrows, Enter, Escape. Respect reduced motion.

If per-night prices are not exposed, add a read-only endpoint that returns them from the same source checkout uses, and tell me what you added.

Test a full short-stay booking up to the Stripe step in dev and a 20-night quote, at 390 and 1440. Commit.
```

### Phase 4: Property page

```
Read docs/redesign/BRIEF.md sections 1 to 5, focusing on 4.2. Do Phase 4 only. Branch redesign/phase-4-property from the latest redesign branch.

Rebuild the property page to 4.2: the gallery grid that fills its cells exactly, phone swipe gallery with counter and back button, the grouped <dialog> lightbox, the two-column body with schedules, the sticky booking card using the Phase 3 calendar, and the phone sticky bar. Generate a static map image once and commit it (no runtime maps API). Keep house rules and other existing sections, restyled.

Screenshot at 360, 390, 430 and 1440, including the lightbox open and the sheet open. Fix issues. Commit.
```

### Phase 5: Remaining pages

```
Read docs/redesign/BRIEF.md sections 1, 2, 3, 4.4, 4.5 and 5. Do Phase 5 only. Branch redesign/phase-5-pages from the latest redesign branch.

Apply the system to /work-stays, /areas/stoke-newington, /about, /faq, /contact, /book-direct, legal pages, booking and confirmation pages and 404, per 4.4. Redirect or fold /stays as 4.4 says. Add the OG images from 4.5. Remove any leftover "Photo to add" or bracketed placeholder text from rendered pages; empty TODO values hide their line.

Screenshot every page at 390 and 1440, fix issues, commit.
```

### Phase 6: Mobile QA and polish

```
Read docs/redesign/BRIEF.md sections 1, 2 and 5. Do Phase 6 only, on branch redesign/phase-6-qa from the latest redesign branch.

Write a Playwright script that loads every route at 360, 390, 430, 768 and 1440 wide and fails on horizontal scroll, tap targets under 44px, text contrast under 4.5:1, images without width and height, and console errors. Run it and fix what it finds.

Then check: sticky bars clear the iPhone home indicator (safe-area), the sheet uses dvh not vh, fonts don't flash (preload Redaction 400 on hero pages), every image has a proper srcset, and Lighthouse mobile performance is 90+ on home and property. Go through section 5 page by page and remove anything that still reads as templated.

Report what you fixed and anything left that needs a decision from me. Commit.
```
