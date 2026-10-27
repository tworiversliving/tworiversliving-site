# Two Rivers Living: Direct Booking Website Build Plan

Oct 25, 2026 · @IfMediaPaid

## Summary

We build a custom, on-brand direct booking site at **tworiversliving.co.uk**. It runs on free infrastructure (Cloudflare and Stripe) and has its own booking engine, so Smoobu can be swapped for another PMS without a rebuild. Running cost is £0 a month plus Stripe's fee on each booking.

### Decisions locked

| Area | Decision |
| --- | --- |
| Domain | tworiversliving.co.uk, with www redirecting to the bare domain |
| Email | Free mailbox on the domain (stay@tworiversliving.co.uk), see Domain section |
| Booking engine | Custom flow in the site, not a Smoobu widget. PMS connected through a swappable adapter |
| Payments | Stripe (registered to the Ltd, paying out to Tide). Full payment upfront, no security deposit |
| Cancellation | Full refund up to 5 days before check-in |
| Pricing | Direct rates below OTA rates. Discount % set in one config value |
| Booking mode | Instant book up to 14 nights. 15+ nights go to an enquiry form |
| Paid extras | Parking, early check-in, late checkout |
| Positioning | Leisure and corporate shown equally |
| Heritage story | Subtle. Name and logo carry it, no About page essay |
| Homepage | Stays grid from day one, even with one property |
| Content updates | Through Claude Code edits, no CMS for now |
| Tracking | None at launch. Cookieless analytics only |
| Reviews | Show the 4 existing reviews (3 Airbnb, 1 Booking.com), attributed to the platform |
| Copy | Reuse the live listing copy (airbnb-listing-v3) as the base |

### Open items before build

- [x] **Address:** you said show 212a. Our notes say the correct address is 212 Stoke Newington High Street, and Booking.com wrongly shows 212A. Confirm which is right.
- [x] Direct discount % (suggest 10%, see Booking section)
- [ ] Minimum stay for direct bookings
- [ ] Prices for early check-in and late checkout. Parking is charged at £15: per stay or per night?
- [ ] Company number and registered office address for the footer
- [ ] Phone/WhatsApp number (placeholder until set up)
- [ ] High-res original photos, plus wifi speed result for the "fast wifi" claim
- [ ] Insurance confirmed for direct bookings (see Legal section)

## Domain, hosting and email

Recommendation: keep the domain registered at GoDaddy, move its DNS to Cloudflare (free), and host the site on Cloudflare Workers (free). Everything then sits in one dashboard: site, database, DNS, email forwarding and SSL.

### Why Cloudflare over Vercel or Netlify

- **Vercel's free Hobby tier is for non-commercial use.** A booking site taking payments is commercial, so Vercel would mean Pro at roughly $20/month (approximate).
- **Cloudflare's free Workers plan covers 100,000 requests a day, and the free D1 database covers 5 GB.** A one-property booking site uses a tiny fraction of that. ([source](https://developers.cloudflare.com/workers/platform/pricing/))
- One limit to design around: **10 ms CPU per request** on the free plan. This is why the plan uses Astro (mostly static pages) rather than a full Next.js app. Pages are pre-built, and only the booking endpoints run code.

### Domain setup steps

1. Create a free Cloudflare account under the Two Rivers Living email.
2. Add tworiversliving.co.uk to Cloudflare. It imports the existing DNS records.
3. In GoDaddy, swap the two nameservers to the ones Cloudflare gives you. It takes effect within a few hours.
4. Bare domain is primary. www.tworiversliving.co.uk redirects to it.
5. SSL is automatic.
6. Optional later: transfer the registration to Cloudflare Registrar, which charges cost price and avoids GoDaddy renewal mark-ups. Check the renewal price in GoDaddy first.

### Email on the domain

| Need | Tool | Cost |
| --- | --- | --- |
| Mailboxes you read and reply from | Zoho Mail Forever Free: up to 5 users, 5 GB each, mobile app ([source](https://moosend.com/blog/free-email-domain-providers/)) | £0 |
| Booking confirmations sent by the site | Resend: free tier of about 3,000 emails/month (approximate, check at sign-up) | £0 |
| Fallback if Zoho's free plan isn't offered at sign-up | Cloudflare Email Routing forwards stay@ to your Gmail | £0 |

Suggested addresses: **stay@** (guests and bookings), **hello@** (general and corporate enquiries), plus a personal one each for Emmanuel and Hamza. Zoho's free plan has no aliases, so hello@ either becomes a separate user or comes later.

All three need DNS records (MX, SPF, DKIM, DMARC) added in Cloudflare. Claude Code can list the exact records once the accounts exist. Without them, confirmation emails land in spam.

### Running costs

| Item | Monthly cost |
| --- | --- |
| Hosting, database, DNS, SSL (Cloudflare free) | £0 |
| Email (Zoho free + Resend free) | £0 |
| Analytics (Cloudflare Web Analytics, cookieless) | £0 |
| Fonts (Google Fonts, self-hosted) | £0 |
| Stripe | No monthly fee. 1.5% + 20p per UK card, 2.5% + 20p EEA, 3.15% + 20p international ([source](https://stripe.com/gb/pricing)) |
| Domain renewal | Already paid, annual |

Worked example: a 4-night direct booking at £230/night is £920. Stripe takes about £13.98. Airbnb's 18.6% host fee on the same booking would be about £171.

Stripe does not return its fee when you refund, so a cancelled £920 booking still costs about £14.

## Architecture: a booking engine we own

The site owns its own bookings, pricing rules and guest emails. The PMS is only asked two questions: which nights are free, and what the base rate is. It is told one thing: a direct booking has been made. That keeps the reliance on Smoobu to one swappable file, which answers question 25.

&#91;embedded content: direct booking architecture · site, Stripe, Resend, PMS\]

Every page talks to the Booking API. Only the adapter knows which PMS sits behind it, so moving off Smoobu means rewriting that one file.

### Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Astro + TypeScript | Static pages by default, fast, fits the free CPU limit |
| Hosting | Cloudflare Workers | Free, commercial use, custom domain |
| Database | Cloudflare D1 (SQLite) | Free, holds bookings, holds and enquiries |
| Payments | Stripe Embedded Checkout | Card, Apple Pay and Google Pay inside our page, on brand |
| Email | Resend + React Email templates | Confirmation, pre-arrival and enquiry emails from stay@ |
| Spam protection | Cloudflare Turnstile | Free, no image puzzles, guards both forms |
| Scheduled jobs | Cloudflare Cron Triggers | Pre-arrival emails and expiring old holds |
| Images | Astro image pipeline | Converts the high-res originals to AVIF and WebP at build |

### Who owns what

| The site owns | The PMS owns |
| --- | --- |
| Direct discount %, extras and their prices | The calendar across Airbnb, Booking.com, Vrbo and direct |
| Cancellation and booking terms | Base nightly rate |
| The booking record and payment | Minimum stay per date |
| Guest emails for direct bookings | Cleaning and ops schedule |
| Long-stay and corporate enquiries |  |

### The PMS adapter

One TypeScript interface with four methods. Every page and endpoint calls the interface, never Smoobu directly.

```
interface PmsAdapter {
  getAvailability(propertyId, from, to): Promise<BlockedNight[]>
  getRates(propertyId, from, to): Promise<NightlyRate[]>   // base price + min stay per night
  createBooking(booking): Promise<{ pmsRef: string }>
  cancelBooking(pmsRef): Promise<void>
}
```

| Adapter | When | How it works |
| --- | --- | --- |
| SmoobuAdapter (launch) | Now. Your Professional plan includes full API access ([source](https://support.smoobu.com/hc/en-us/articles/360003170680)) | Reads rates and availability. Writes the direct booking into Smoobu, which blocks every channel |
| IcalAdapter (fallback) | If a future PMS has no API, or the API is down | Reads the PMS's iCal export for blocked nights. Publishes our own feed at /ical/\<property>.ics for the PMS to import. Rates come from a rates file in the repo |
| NewPmsAdapter (later) | When you move off Smoobu | One new file plus a config change. No page changes |

Set `PMS_PROVIDER=smoobu` in the environment to choose. Switching PMS is a half-day job, not a rebuild.

### Double-booking protection

Availability is checked three times: when the price is shown, when checkout opens, and again when Stripe confirms payment.

- Opening checkout places a 15-minute hold in D1, so two direct guests can't pay for the same nights.
- If an OTA booking lands in that window, the payment is refunded automatically. The guest gets an apology email, and you get an alert.
- The iCal fallback syncs more slowly (often 15 to 60 minutes, depending on the PMS), so the payment-time check matters most there.

### Data model (D1)

| Table | Key fields |
| --- | --- |
| bookings | ref (TRL-XXXX), property, check\_in, check\_out, guests, nightly breakdown, extras, discount, total\_pence, status (pending, confirmed, cancelled, refunded, conflict), guest name, email, phone, company name, stripe\_session\_id, payment\_intent, pms\_ref, created\_at |
| holds | property, check\_in, check\_out, stripe\_session\_id, expires\_at |
| enquiries | type (long stay or corporate), property, dates, guests, company, name, email, phone, message, created\_at |

Property details live as content files in the repo (`src/content/properties/<slug>/`): name, area, specs, amenities, house rules, photos, reviews, PMS id, check-in and checkout times, and which extras are offered. Adding property two means adding one folder.

Secrets are stored as Cloudflare environment variables, never in the repo: Stripe secret key, Stripe webhook secret, Smoobu API key, Resend key and Turnstile key.

## Booking flow, pricing and policies

A guest goes from dates to paid booking in four screens, and sees the full price, including extras, before entering card details. Stays of 15 nights or more go to an enquiry instead.

### The four screens

1. **Dates and guests** (on the property page). A calendar with unavailable nights greyed out, a guest picker capped at 7, and a live price panel: nights × rate, extras, total. If the stay is 15+ nights, the button changes from "Reserve" to "Enquire about this stay", with the dates carried across.
2. **Extras.** Parking, early check-in and late checkout. Early check-in only appears if the night before arrival is free in the PMS. Late checkout only appears if the departure day is free. This avoids selling something the cleaner can't deliver.
3. **Your details.** Name, email, mobile, estimated arrival time, and "Is this a work trip?" (if yes, company name, which goes on the receipt). One tick box: "I agree to the booking terms and house rules", linking to both.
4. **Payment.** Stripe Embedded Checkout in our page, for the full amount in GBP. Card, Apple Pay and Google Pay.

Then a **confirmation page and email** with the booking reference, receipt, the date the free-cancellation window closes, and "check-in details arrive 48 hours before your stay".

### Pricing

| Element | Rule |
| --- | --- |
| Direct nightly rate | PMS base rate × (1 − direct discount). One config value, `DIRECT_DISCOUNT` |
| Suggested discount | **10%.** You save the 18.6% Airbnb fee, so 10% off still nets about 9% more per booking than Airbnb after Stripe's fee, and it's big enough to be worth a guest leaving the platform |
| Cleaning fee | None, consistent with the OTA listings |
| Booking or service fee | None. The price shown is the price paid |
| Minimum stay | Read from the PMS per date. Suggest 2 nights as the default. Your decision is still open |
| Currency | GBP only |

The headline price on cards is "From £X a night": the lowest direct rate in the next 60 days. UK consumer law (the DMCC Act 2024) bans drip pricing, so any mandatory charge must be in the first price shown. We have none, which keeps this simple.

### Extras

| Extra | Price | Rule |
| --- | --- | --- |
| Parking (resident permit) | £15 (confirm: per stay or per night) | Shown with "a permit for nearby resident bays, not a private space" |
| Early check-in from 12:00 | Suggest £25 | Only if the previous night is empty |
| Late checkout until 13:00 | Suggest £25 | Only if the departure day is empty |

Extras sit in one config file, so prices and times change without touching page code.

### Cancellation (direct bookings)

- **More than 5 days before check-in** (before 15:00, five days out): full refund.
- **Within 5 days:** no refund. You haven't said what happens inside the window, so confirm this.
- Self-serve: the confirmation email links to a "Manage booking" page (reference + email). While free cancellation is open, one button cancels, refunds through Stripe automatically and cancels the booking in the PMS. Outside it, the page shows the policy and a contact link.
- Stripe keeps its processing fee on refunds (about £14 on a £920 stay). That cost is absorbed, not passed on.

### Long stays (15+ nights) and corporate

- The enquiry form saves to D1 and emails stay@ instantly. The guest gets an auto-reply: "We'll reply with a quote within \[X\] hours."
- You reply with a quote, then send a **Stripe Payment Link** (free to create) and add the booking to the PMS by hand. Once there's volume, this can be automated into a "quote, accept, pay" flow.
- From the compliance notes: **nothing over 89 nights** until Hackney licensing is confirmed in writing. The form caps the date range at 89 nights and says "For stays of three months or more, get in touch."

## Design system

The site takes its palette straight from the logo files: deep forest green on a pale mist background, with brass as the only accent. Real daylight photos do most of the work. Note: these colours are from the final logo files on your Desktop, and they replace the Ink and Oat palette in the earlier logo log.

### Colour

| Token | Hex | Source | Use |
| --- | --- | --- | --- |
| forest | #2F3A2B | Logo symbol and "TWO RIVERS" | Headings, body text, primary buttons, footer background |
| brass | #A08A5B | Logo "LIVING" | Small caps labels, rules, icons, focus rings. Not for body text: about 3:1 contrast on mist, which fails for small text |
| brass-deep | #7A6740 | Derived | Brass when it has to be readable text, such as links |
| mist | #EEF0E8 | Logo background | Page background |
| paper | #FAFAF6 | Derived | Cards, booking panel, form fields |
| forest-soft | #5C6657 | Derived | Secondary text, captions |
| line | #D9DCD1 | Derived | Hairline borders and dividers |

Red and green status colours are only used inside the booking flow, for errors and confirmation.

### Type

- **Manrope** (matches the wordmark) for UI, body and buttons. 17px body, 1.6 line height.
- **Newsreader** for display headings only (hero, section titles, property names). A restrained serif adds warmth and stops the site reading like a SaaS template.
- **Labels** echo the logo's spaced-out "LIVING": Manrope, uppercase, 12px, 0.2em letter spacing, brass. Used sparingly, as section kickers and on property cards.
- Both fonts are free and self-hosted through Fontsource, so there are no Google Fonts calls.

### Layout and detail

- Content max 1200px, 12-column grid, 8px spacing scale, generous section spacing (120px desktop, 72px mobile).
- Corners at 4px: sharp enough to feel tailored, not pill-shaped. Hairline borders, no drop shadows, no gradients.
- The roofline symbol from the logo is used as a favicon, a loading mark and a small divider. Nowhere else.
- Motion: images fade in on load, and that is all. No scroll-jacking, parallax or counters ticking up.
- Mobile first. A sticky "Check availability" bar on property pages on mobile.

### Photography

- Use the high-res originals, landscape 3:2, daylight, warm bulbs on, as per the photo notes in the project.
- Hero: one strong living room or bedroom shot, full-bleed. No slideshow: slideshows hide every image after the first.
- Shoot 8 to 10 neighbourhood photos on a phone in good light: Church Street, Clissold Park, the station, a café front. Your own photos beat stock every time.
- Add one frame of the three bedroom doors, which the corporate page needs.

### Keeping it human, not AI-made

These are rules for Claude Code as much as for the design.

- **No AI design tells:** no purple or blue gradients, glassmorphism, sparkle or magic-wand icons, emoji, glowing buttons, or grids of six identical icon cards.
- **No default component-kit look:** no unchanged shadcn or Tailwind defaults (Inter, slate grey, rounded-2xl cards, shadow-lg). Every component uses the tokens above.
- **Copy:** British English, specifics over adjectives ("Church Street is a minute's walk", "Liverpool Street in about 15 minutes"), no em dashes. Banned words: nestled, oasis, haven, seamless, elevate, curated, unparalleled, boasts, immerse, experience the.
- **No invented content:** no fake reviews, stock faces, made-up stats or placeholder testimonials. Empty is better than fake.
- **Real trust signals:** the 4 real reviews with first name, month and platform. Your names. The company number in the footer. A real phone number.
- **No give-away code:** no "Built with" badge, no lorem ipsum, a custom 404 page, and social share images that use real photos.

## Sitemap and page specs

The site has 14 pages at launch. Every page shares one header and footer, and every page is built so property two drops in without layout changes.

| Page | URL | Purpose |
| --- | --- | --- |
| Home | / | Search, stays grid, both audiences, trust |
| Stays | /stays | All properties, filterable by dates and guests |
| Property | /stays/stoke-newington-3-bed | Everything about one home, plus the booking panel |
| Checkout | /book/\[property\] | Extras, details, payment |
| Confirmation | /book/confirmed | Reference, receipt, next steps |
| Manage booking | /booking | View or cancel with reference + email |
| Why book direct | /book-direct | The case for booking here |
| Corporate and long stays | /work-stays | Business bookers, 15+ nights, enquiry form |
| Area guide | /areas/stoke-newington | Neighbourhood guide, one page per area as you grow |
| About | /about | Who runs it and how you host |
| FAQ | /faq | Booking, stay and payment questions |
| Contact | /contact | Form, email, phone |
| Legal | /terms, /privacy, /cookies, /house-rules | Booking terms, privacy, cookies, house rules |
| 404 | any | Custom, links back to stays |

### Header and footer

- **Header:** side-by-side logo on the left. Nav: Stays, Work stays, Stoke Newington, About, Contact. On the right, a forest "Book direct" button. Transparent over the home hero, solid mist on scroll. Mobile: logo plus a menu button opening a full-screen mist panel.
- **Footer:** forest background, mist text. Stacked logo, three link columns (Stay, Company, Legal), stay@ email, phone, and the line "Two Rivers Living Ltd. Registered in England and Wales, company no. \[XXXXXXXX\]. Registered office: \[address\]." This line is a legal requirement for a limited company's website.

### Home

1. **Hero:** one full-bleed photo with a soft forest overlay at the bottom for legibility. Newsreader headline, for example "Stoke Newington, booked direct." Sub-line: "A three-bedroom flat a minute from Church Street, for short breaks and work trips." Search bar on a paper panel: Check-in to check-out, Guests, Search. The location field stays hidden until there is a second area.
2. **Three direct-booking points**, as text only with no icons: "Our lowest price is here", "One price, no booking fees", "Speak to the hosts, not a call centre".
3. **Our homes:** the stays grid. While there is one property, the card sits beside a panel: "Staying 15 nights or more? Ask about work and long stays", so the row never looks empty. Card: 3:2 photo, brass kicker "STOKE NEWINGTON", name, "7 guests · 3 bedrooms · 1 bathroom", "From £X a night".
4. **Two ways to stay:** two equal halves. Short stays (photo of the living room, "Find dates") and Work and long stays (photo of the desk, "See work stays").
5. **Reviews:** the 4 reviews as a quiet row with quote, first name, month and platform. No star graphics.
6. **The neighbourhood:** three of your own photos plus a line of times: "Church Street 1 min · Stoke Newington station 5 min · Liverpool Street about 15 min". Links to the area guide.
7. **Your hosts:** two lines: "Run by Hamza and Emmanuel, who grew up here." Optional photo of you both.
8. **FAQ:** the 5 most common questions, in accordions.

### Stays

- Filter bar (dates, guests). With dates, each card shows "Available" plus the total, or "Not available for these dates" with the card greyed.
- Area filter and a map appear only once there are two or more areas.

### Property page

1. **Gallery:** one large image and four smaller ones. "View all photos" opens a full-screen viewer grouped by room (Living room, Kitchen, Bedroom 1, 2, 3, Bathroom, Workspace, Neighbourhood).
2. **Title block:** property name, area kicker, specs line, review count.
3. **Booking panel:** sticky on the right on desktop, a bottom bar on mobile. Calendar, guests, live price breakdown, Reserve (or Enquire for 15+ nights). Line under the button: "You won't be charged until the next step."
4. **Overview:** listing copy from airbnb-listing-v3, tightened.
5. **Where you'll sleep:** a card per bedroom with photo and bed type. Bedroom 1 notes the sofa bed.
6. **Amenities:** the 12 that matter most, then "Show all".
7. **Working here:** desk and chair, measured wifi speed, washing machine.
8. **Location:** map with an approximate circle, not a pin (exact address goes in the pre-arrival email), plus walking times.
9. **Check-in and house rules:** 15:00 to 11:00, self check-in with a lockbox, quiet hours, no smoking, no pets, no parties.
10. **Good to know:** stairs and no lift, one bathroom for up to 7, parking is a resident permit, exterior camera only.
11. **Cancellation:** the policy in one line, plus a link to terms.
12. **Reviews.**

### Checkout, confirmation, manage booking

Specified in the Booking flow section. Layout: steps on the left, a sticky summary on the right (photo, dates, guests, price breakdown, cancellation date). On mobile, the summary collapses into a "Show summary" bar.

### Why book direct

One short page. The price promise (direct rate always below the platforms), pay once with no fees, flexible cancellation, a direct line to the hosts, and payments handled securely by Stripe. Ends with "Find dates". It does not name or criticise Airbnb or Booking.com.

### Work stays (corporate and long stays): answer to question 13

Flow Living does **not** have a corporate page; it is leisure only. StayLDN does, as a top-level nav item, which is the model here. Their weakness is that the terms live on LinkedIn, not the site, so ours states them outright.

&#91;embedded content: work stays page wireframe · desktop, top to bottom\]

The outlined band (terms) and the quote form are what StayLDN leaves out and what corporate bookers look for first.

1. **Hero:** photo of the desk or the three bedroom doors. Headline: "A base for work in North London." Sub-line: "The whole flat, three private bedrooms, for 15 nights to three months." A "Request a quote" button jumps to the form.
2. **Who it's for:** one line each for contractors and site teams, relocation and insurance placements, NHS and healthcare staff, film and TV crews.
3. **What's included:** whole flat with one booker and one agreement, three private double rooms, desk and wifi (speed stated), full kitchen and washing machine, bills included, mid-stay clean and linen change (confirm frequency), parking permit available.
4. **How it works:** 1. Send dates and headcount. 2. Get a quote within \[X\] hours. 3. Pay by card or invoice. 4. Self check-in.
5. **Terms in plain view:** invoices and receipts in the company name, weekly or monthly rates, card or bank transfer, and a booking agreement for every long stay.
6. **Enquiry form:** company (optional), name, email, phone, dates, guests, purpose, "Need an invoice?", message.
7. **Booker FAQ:** stairs, parking, cleaning, invoices.

### Area guide (/areas/stoke-newington)

Getting around (walking times and bus routes, still to be confirmed), eat and drink (your guidebook picks), parks (Clissold, Abney, Springfield), working nearby (cafés with good wifi), families. Your own photos throughout. It's good for SEO and reuses the guidebook.

### About

Three short paragraphs: who you are (two locals, born and raised here), how you host (self check-in, on call, a guidebook of your own picks), and the standard every home meets. Heritage stays out apart from one optional line under the logo: "Named for the two rivers our families come from."

### FAQ, Contact, Legal

- **FAQ:** grouped as Booking, Payment and cancellation, During your stay, Work stays.
- **Contact:** form (with Turnstile), email, phone or WhatsApp, "we reply within a few hours, 8am to 10pm". The address shown is for correspondence. The exact flat location is not on the site.
- **Legal:** booking terms, privacy policy (UK GDPR), cookie notice, house rules. Drafted in plain English. See the Legal section.

## Guest comms, agreements, insurance and legal

Direct guests are handled by the site's own emails plus a shared WhatsApp Business number, so none of this depends on Smoobu. Short stays are covered by terms accepted at checkout, long stays by a signed booking agreement, and the biggest gap to close before launch is insurance. Nothing here is legal advice: have a solicitor check the terms and long-stay agreement once.

### Guest comms for direct bookings (question 25)

OTA guests stay on-platform as now. Direct guests get this:

| When | What | Channel |
| --- | --- | --- |
| On payment | Confirmation, receipt, cancellation deadline, manage-booking link | Email from stay@ (Resend) |
| On payment | New booking alert to both hosts | Email to stay@ plus your Slack #stokenewington3bed channel through a free incoming webhook |
| 48 hours before | Address, lockbox code, directions, wifi, parking permit, house rules, guidebook link | Email (Cron Trigger) |
| Morning after arrival | "Everything OK?" with the WhatsApp number | Email |
| Day after checkout | Thank you, plus a direct-rebooking code for next time | Email |
| Any time | Live questions | WhatsApp Business app on one shared number, on both your phones (free) |

Every template is written in your voice and lives in one folder, so it is easy to edit.

### Rental agreement (question 26)

**Up to 14 nights: no separate agreement.** The booking terms and house rules, accepted with a tick box at checkout, are the contract. The site stores the time, IP address and the terms version against each booking, so you can show what the guest agreed to.

**15 to 89 nights: yes, a short signed booking agreement.** This matters more than for short stays, for three reasons:

- It records that the stay is for work or a holiday and that the guest's main home is elsewhere. That is what keeps a long stay from being treated as an assured shorthold tenancy, which you do not want and your landlord consent does not cover.
- It sets out the dates, the price, payment terms, the cleaning schedule, the occupant names (one booker, no sub-letting) and what happens at the end date.
- Corporate bookers expect one. StayLDN's corporate offer leads with it.

The template is drafted once and sent for e-signature through a free tool (Zoho Sign's free tier fits with Zoho Mail). Have a solicitor review it once.

**Damage without a deposit:** set Stripe to save the card at checkout. The terms then allow a charge for damage beyond normal wear, with photo evidence and notice. It is free, invisible to the guest, and replaces a deposit.

### Insurance (question 27)

Airbnb's AirCover applies only to Airbnb bookings. Booking.com, Vrbo and direct guests currently have **no damage or liability cover**, unless your own policy provides it. Before taking a direct booking, you need a short-let policy that:

- [ ] covers **public liability** (a guest injured on the stairs is the realistic claim)
- [ ] covers **guest damage** to your contents: you own all the furniture
- [ ] covers bookings from **every source, including your own website**
- [ ] accepts a **rent-to-rent** operator (you are not the owner, so many owner-only holiday-let policies won't fit)
- [ ] covers **stays up to 89 nights**, not only short stays
- [ ] ideally includes loss of income if the flat can't be let after an insured event

Get quotes from short-let specialists such as Pikl and Superhog, and check each box in writing. The project budget already allows about £50 a month for this. Also confirm the landlord's buildings insurer knows the flat is short-let.

### Legal checklist for the site

| Requirement | What the site does |
| --- | --- |
| Company details (Companies Act rules on websites) | Footer shows registered name, number, registered office, England and Wales |
| Pre-contract information (Consumer Contracts Regulations) | Total price, cancellation terms, business address and contact are shown before payment. Terms state that the 14-day cooling-off right does not apply to accommodation booked for specific dates |
| Drip pricing (DMCC Act 2024) | The first price shown includes every mandatory charge |
| Privacy (UK GDPR) | Privacy policy covering booking data, Stripe, Resend, Cloudflare, retention periods |
| ICO data protection fee | Most businesses handling customer data must pay it, about £52 a year at the lowest tier. Take the ICO self-assessment. This is the one unavoidable cost |
| Cookies (PECR) | Only strictly necessary cookies plus cookieless analytics, so no cookie banner is needed. Adding Meta Pixel or Google Ads tags later means adding a consent banner first |
| Card security | Stripe handles card data and 3D Secure. No card details touch our servers |
| Accessibility | Built to WCAG 2.2 AA: contrast, keyboard use, alt text, labelled form fields |
| 90-night cap | Direct short stays count towards it just like OTA nights. You've chosen not to track it in the site, so keep counting in the PMS |

## Marketing, SEO and Google (question 30)

At launch, focus on free search visibility and on turning guests you already have into direct repeat bookings. Skip a Google Business Profile for the flat (Google doesn't allow one), and leave Google Vacation Rentals and paid ads until after launch.

### Google, in order of value

| Item | Recommendation | Cost |
| --- | --- | --- |
| Google Search Console + Bing Webmaster Tools | **Do at launch.** Submit the sitemap and watch which searches find you | £0 |
| Google Business Profile | **Not for the flat.** Google lists "rental or for-sale properties such as vacation homes" as ineligible ([source](https://support.google.com/business/answer/13763036)). A profile would only be eligible with a staffed office customers can visit. Don't risk a suspension | — |
| Google Vacation Rentals (free booking links) | **After launch.** Google only takes these from connectivity partners, not directly from a site. Smoobu lists a "Google Vacation Finder / HomeToGo" connection, which would point guests to an OTA rather than to us. Ask Smoobu, and make Google partner status a test for your next PMS | £0 |
| Google Ads | **Later**, once the funnel is proven. A small brand + "Stoke Newington accommodation" campaign. Needs a cookie consent banner and conversion tags first | Budget-led |

### SEO built in from day one

- Unique title and description for every page. Clean URLs. Auto-generated sitemap.xml and robots.txt. Canonical tags.
- Structured data: `LodgingBusiness` on the property page (address area, amenities, check-in times, review count), `Organization` site-wide, `FAQPage` on the FAQ, `BreadcrumbList`.
- Speed: static pages plus AVIF images. Target a score of 95+ on mobile in Lighthouse.
- Pages built for searches with intent:
  - Property page: "3 bedroom apartment Stoke Newington", "short let Stoke Newington"
  - Work stays: "contractor accommodation Hackney", "serviced apartment North London", "corporate let Stoke Newington"
  - Area guide: "things to do Stoke Newington", "where to stay Stoke Newington"

### Measuring without cookies

- Cloudflare Web Analytics for visits, sources and pages (cookieless and free).
- The site logs its own funnel in D1 (date searched, quote shown, checkout opened, booking paid, enquiry sent), so conversion rates come from your own data with no tracking tags.

### Zero-cost demand

- **Work stays outreach:** your contractor lead list and cold-call script now have a page to point to. Send /work-stays, not an Airbnb link.
- **Repeat guests:** every direct guest gets a rebooking code in the thank-you email.
- **OTA guests:** don't send the website in Airbnb or Booking.com messages. Both platforms ban steering guests off-platform, and it can cost you the listing. A small printed card in the flat with the web address only is common practice, but it sits in a grey area for Airbnb. Your call.
- **Socials:** an Instagram and a LinkedIn page linking to the site. LinkedIn matters for the corporate lane.

## Build phases and launch checklist

The build runs in four phases. You do the account setup first, because Claude Code can't create accounts or fetch keys for you. Each phase ends with something you can click through on a private preview link.

### Phase 0: accounts and assets (you)

- [ ] Cloudflare account. Add the domain and switch the GoDaddy nameservers.
- [ ] Zoho Mail free: create stay@ plus your two personal addresses.
- [ ] Resend account. Verify tworiversliving.co.uk.
- [ ] Stripe: confirm the account is fully activated for the Ltd. Turn on Apple Pay and Google Pay. Set the branding (logo, #2F3A2B). Copy the test and live API keys.
- [ ] Smoobu: Settings → API. Copy the API key and the property (apartment) ID.
- [ ] Cloudflare Turnstile: create a site key.
- [ ] GitHub: create a private repo, tworiversliving-site.
- [ ] Assets: high-res photos in folders by room, the 4 review texts with first names and months, company number and registered office, logo SVGs, wifi speed result.
- [ ] Decisions: discount %, minimum stay, extra prices, parking per stay or per night, address (212 vs 212A), what happens to refunds inside 5 days.

### Phase 1: foundations and pages

Astro project, design tokens, self-hosted fonts, header and footer, the property content model, and every content page with real copy: home, stays, property, work stays, area guide, about, FAQ, contact, why book direct, 404. Deployed to a private workers.dev preview with search indexing blocked.

### Phase 2: booking engine

PMS adapter (Smoobu plus the iCal fallback), rates and availability endpoint, calendar and live price panel, extras rules, D1 tables, 15-minute holds, Stripe Embedded Checkout, the payment webhook with its availability re-check and auto-refund, writing the booking to Smoobu, confirmation page and email, and manage booking with self-serve cancellation and refund.

### Phase 3: enquiries, comms and polish

Long-stay and corporate enquiry form with Turnstile, auto-reply and alerts, scheduled emails (pre-arrival, after arrival, after checkout), Slack alert, funnel logging, legal pages, structured data, sitemap, social share images.

### Phase 4: test and launch

- [ ] Full booking in Stripe test mode: short stay, with extras, and a cancellation and refund
- [ ] Conflict test: block the dates in Smoobu mid-checkout and confirm the auto-refund fires
- [ ] 15+ nights routes to the enquiry, and 90+ nights is refused
- [ ] Early check-in and late checkout are hidden when neighbouring nights are booked
- [ ] Emails land in the inbox, not spam (SPF, DKIM and DMARC pass)
- [ ] Mobile check on an iPhone and an Android phone. Lighthouse 95+ on mobile. Keyboard-only run through checkout
- [ ] Read every page aloud once against the banned-word list
- [ ] Switch Stripe to live keys. Make one real booking on a card and refund it
- [ ] Point tworiversliving.co.uk at the Worker, remove the noindex, submit the sitemap to Search Console
- [ ] Insurance confirmed in writing before the first direct guest arrives

### Starting in Claude Code

Save this doc as `PLAN.md` in the repo root, then start with:

```
Read PLAN.md in full. We're building Phase 1 only. Set up an Astro + TypeScript
project for Cloudflare Workers, create the design tokens, fonts, header, footer and
the property content model, then build the content pages with the copy in
/content. Follow the "Keeping it human" rules exactly. Ask me before adding any
dependency not listed in the Stack table.
```

Then move through phases 2 to 4 one at a time, testing each preview before starting the next.
