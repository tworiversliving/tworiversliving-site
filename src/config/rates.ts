// Nightly rates in pounds: what a direct guest pays (DIRECT_DISCOUNT is 0 since 18 Nov 2026).
// Used with PMS_PROVIDER 'ical' (the live site: Guesty's iCal feed carries availability but no prices)
// and 'mock' (local development). Change a price here, then `npm run deploy`.
// After changing the cheapest rate, also update fromPriceFallback in src/data/properties.ts and
// re-render the share card (scripts/og-card.mjs).

export const fallbackRates: Record<string, { weekday: number; weekend: number; minStay: number; overrides?: Record<string, number> }> = {
  'stoke-newington-3-bed': {
    weekday: 220, // Sun–Thu nights
    weekend: 250, // Fri and Sat nights
    minStay: 2,
    // Specific dates, e.g. events or Christmas: 'YYYY-MM-DD': price
    overrides: {},
  },
};
