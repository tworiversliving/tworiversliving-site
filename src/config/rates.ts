// Base nightly rates (before the direct discount), in pounds.
// Only used when PMS_PROVIDER is 'ical' (an iCal feed carries availability but no prices)
// or 'mock' (local development). With Smoobu, rates and minimum stays come from Smoobu.

export const fallbackRates: Record<string, { weekday: number; weekend: number; minStay: number; overrides?: Record<string, number> }> = {
  'stoke-newington-3-bed': {
    weekday: 240, // Sun–Thu nights
    weekend: 275, // Fri and Sat nights
    minStay: 2,
    // Specific dates, e.g. events or Christmas: 'YYYY-MM-DD': price
    overrides: {},
  },
};
