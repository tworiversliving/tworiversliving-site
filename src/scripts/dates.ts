// Browser side of the date picker: date maths, the availability feed and the stay chosen on this page.
// Prices and availability come from /api/availability (the same getCalendar the quote and checkout use).

export interface Day {
  date: string;
  available: boolean;
  /** Direct nightly price in pence, as the server computes it. */
  price: number | null;
  minStay: number;
}

export interface Availability {
  today: string;
  days: Map<string, Day>;
}

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const nightsBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
export const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 8)}01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return d.toISOString().slice(0, 10);
};
export const monthStart = (iso: string) => `${iso.slice(0, 8)}01`;
export const isIso = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtShort = (iso: string) => SHORT.format(new Date(`${iso}T00:00:00Z`));

/** Today in London, as a fallback until the server says otherwise. */
export const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());

const cache = new Map<string, Promise<Availability | null>>();
/** One request per property per page. Resolves to null if the calendar can't be loaded. */
export function loadAvailability(slug: string): Promise<Availability | null> {
  let p = cache.get(slug);
  if (!p) {
    p = fetch(`/api/availability?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { today: string; days: Day[] }) => ({ today: data.today, days: new Map(data.days.map((d) => [d.date, d])) }))
      .catch(() => null);
    cache.set(slug, p);
  }
  return p;
}

/**
 * The latest checkout a stay starting `checkIn` can have: the morning after the last free night in a row.
 * With no availability data every future night counts as free.
 */
export function checkoutLimit(av: Availability | null, checkIn: string, horizon: string) {
  let d = addDays(checkIn, 1);
  if (!av) return horizon;
  while (d < horizon && av.days.get(d)?.available) d = addDays(d, 1);
  return d;
}
export const minStayFor = (av: Availability | null, checkIn: string) => (av ? (av.days.get(checkIn)?.minStay ?? 1) : 1);
export const isAvailable = (av: Availability | null, date: string, today: string) => date >= today && (av ? !!av.days.get(date)?.available : true);

export function isValidCheckout(av: Availability | null, checkIn: string, d: string, horizon: string) {
  return d > checkIn && nightsBetween(checkIn, d) >= minStayFor(av, checkIn) && d <= checkoutLimit(av, checkIn, horizon);
}

/** Last day the calendar shows. Checkout days are really limited by the availability feed, which ends a year ahead. */
export const horizonFrom = (today: string) => addDays(today, 365 + 90);

export interface Stay {
  checkIn: string | null;
  checkOut: string | null;
  guests: number;
}

/** The stay being booked on this page, shared by the booking card, the date sheet and the popover. */
const state: Stay = { checkIn: null, checkOut: null, guests: 2 };
const subs = new Set<(s: Stay) => void>();
export const stay = {
  get: (): Stay => ({ ...state }),
  set(patch: Partial<Stay>) {
    Object.assign(state, patch);
    subs.forEach((fn) => fn({ ...state }));
  },
  subscribe(fn: (s: Stay) => void) {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
