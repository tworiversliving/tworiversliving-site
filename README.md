# Two Rivers Living

The direct booking site for tworiversliving.co.uk. Astro pages and a small booking API on one Cloudflare Worker, with bookings in Cloudflare D1, payments through Stripe, emails through Resend and the calendar in Smoobu.

- `PLAN.md` is the full spec. `HANDOFF.md` records what's built and the decisions that override the plan.
- Property details, photos and rules: `src/data/properties.ts`. Business details: `src/config/site.ts`. Prices, extras and booking rules: `src/config/booking.ts`.
- Anything in `[square brackets]` is a placeholder. It shows highlighted on the page until it's replaced.

## Running locally

Needs Node 22.18 or later.

```
npm install
cp .dev.vars.example .dev.vars        # if you don't have one yet, then fill it in (see Secrets below)
npm run db:local                      # create the local database tables
npm run build && npx wrangler dev --test-scheduled   # full site with the API, D1 and cron on http://localhost:8787
npm run dev                           # faster for page and style work (no booking API)
```

With `PMS_PROVIDER=mock` the calendar is fake, so you can book freely. HANDOFF.md has the steps for testing Stripe and Smoobu locally.

## Deploying to Cloudflare

You only do steps 1 to 6 once. After that, every push to `main` deploys itself.

### 1. Log in to Cloudflare from your terminal

```
npx wrangler login
```

### 2. Create the database

```
npx wrangler d1 create tworivers
```

It prints a `database_id`. Paste it into `wrangler.jsonc` in place of the row of zeros, then commit.

### 3. Create the tables

```
npm run db:remote
```

Run this again whenever a new file appears in `migrations/`, **before** the code that needs it goes live.

### 4. Add the secrets

Each command asks you to paste the value. Secrets never go in the code or in git.

```
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put TURNSTILE_SITE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put SMOOBU_API_KEY
npx wrangler secret put SMOOBU_API_SECRET
npx wrangler secret put SMOOBU_APARTMENT_IDS     # {"stoke-newington-3-bed": 3531046}
npx wrangler secret put ARRIVAL_INFO             # see below
npx wrangler secret put SLACK_WEBHOOK_URL        # optional: host alerts in Slack
```

`ARRIVAL_INFO` goes into the pre-arrival email, one entry per property:

```json
{"stoke-newington-3-bed": {"address": "...", "access": "Lockbox by the front door, code ...", "wifiName": "...", "wifiPassword": "...", "parking": "...", "extra": "..."}}
```

**Stripe is added later.** Without the Stripe keys the site takes booking requests instead of payments. Once Stripe has verified the business:

1. Stripe dashboard → Developers → Webhooks → Add endpoint: `https://tworiversliving.co.uk/api/stripe-webhook`, with the events `checkout.session.completed`, `checkout.session.expired` and `checkout.session.async_payment_succeeded`.
2. Then:

```
npx wrangler secret put STRIPE_SECRET_KEY        # sk_live_...
npx wrangler secret put STRIPE_PUBLISHABLE_KEY   # pk_live_...
npx wrangler secret put STRIPE_WEBHOOK_SECRET    # whsec_... from the endpoint you just made
```

The site switches to instant booking as soon as all three are set. No redeploy needed.

Plain settings (not secrets) live under `vars` in `wrangler.jsonc`. **Change `PMS_PROVIDER` from `mock` to `smoobu` before launch**, or the live site won't see the real calendar.

### 5. Connect GitHub (Workers Builds)

1. Cloudflare dashboard → Workers & Pages → Create → Import a repository.
2. Connect GitHub and choose `tworiversliving/tworiversliving-site`.
3. Project name: `tworiversliving` (it must match `name` in `wrangler.jsonc`, or the secrets above end up on a different Worker).
4. Build command: `npm run build`. Deploy command: `npx wrangler deploy`. Production branch: `main`.
5. Save and deploy. The first build gives you a preview address at `tworiversliving.<your-subdomain>.workers.dev`.

From now on, every push to `main` builds and deploys. Pushes to other branches get their own preview address.

If you'd rather deploy by hand: `npm run deploy`.

### 6. Custom domain

The domain must already be on Cloudflare (PLAN.md, "Domain setup steps").

1. Workers & Pages → `tworiversliving` → Settings → Domains & Routes → Add → Custom domain: `tworiversliving.co.uk`. Add `www.tworiversliving.co.uk` the same way.
2. Redirect www to the bare domain: the domain → Rules → Redirect Rules → Create from template → "Redirect from WWW to root".
3. Turnstile: add `tworiversliving.co.uk` to the widget's hostnames in the Turnstile dashboard.
4. Analytics: the domain → Web Analytics → enable it for `tworiversliving.co.uk`. It's cookieless, which is what `/cookies` and `/privacy` say.

SSL is automatic. The certificate can take a few minutes after adding the domain.

### 7. Going live

The Phase 4 checklist in PLAN.md has the full list. The site-specific switches:

- Replace every `[placeholder]` in `src/config/site.ts`: company number, registered office, ICO number, phone.
- Set `indexable: true` in `src/config/site.ts`. Until then every page tells search engines not to index it.
- Submit `https://tworiversliving.co.uk/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools.
- Have a solicitor read `/terms`, `/privacy`, `/cookies` and `/house-rules` once.

## Everyday changes

| To change | Edit | Then |
| --- | --- | --- |
| Prices of extras, cancellation days, check-in times | `src/config/booking.ts` | If the terms change, bump `termsVersion` |
| Booking terms or house rules wording | `src/pages/terms.astro`, `src/pages/house-rules.astro`, `src/data/properties.ts` | Bump `termsVersion` in `src/config/booking.ts` |
| Property copy, photos, reviews | `src/data/properties.ts`, photos in `src/assets/properties/<slug>/` | |
| Map position | `map` in `src/data/properties.ts` | Run `node scripts/map-tiles.mjs` and commit `public/maps/` |
| Database tables | Add a new numbered file in `migrations/` | `npm run db:remote` before pushing |

Push to `main` and the site rebuilds.

## Adding a second property

1. Copy the property object in `src/data/properties.ts` and give it a new slug.
2. Add its photos to `src/assets/properties/<new-slug>/`.
3. Run `node scripts/map-tiles.mjs` for its map.
4. Add its Smoobu apartment id to `SMOOBU_APARTMENT_IDS` (`node scripts/smoobu-apartments.mjs` lists them) and its arrival details to `ARRIVAL_INFO`.

Pages, sitemap, structured data and the booking flow pick it up automatically.

## Scripts

- `node scripts/smoobu-apartments.mjs`: lists Smoobu apartment ids (reads `.dev.vars`).
- `node scripts/map-tiles.mjs`: downloads the OpenStreetMap tiles each property map needs into `public/maps/`, so the live site makes no third-party requests for the map.
