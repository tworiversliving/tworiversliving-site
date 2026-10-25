import { booking, extras as extraDefs, type ExtraId } from '../config/booking';
import { getProperty } from '../data/properties';
import { addDays, eachNight, isIsoDate, nightsBetween, todayLondon } from './dates';
import { getPms, pmsIdFor, type NightInfo } from './pms';

export interface CalendarDay {
  date: string;
  available: boolean;
  /** Direct nightly price in pence, after the discount. */
  price: number | null;
  /** PMS nightly price in pence, before the discount. */
  base: number | null;
  minStay: number;
}

export function directDiscount(env: Env): number {
  const d = Number(env.DIRECT_DISCOUNT ?? '0.1');
  return Number.isFinite(d) && d >= 0 && d < 0.5 ? d : 0.1;
}

/** Nights already taken by direct bookings or by guests mid-payment (held in D1). */
async function directlyTaken(env: Env, slug: string, from: string, to: string, ignoreRef?: string): Promise<Set<string>> {
  const taken = new Set<string>();
  if (!env.DB) return taken;
  const now = new Date().toISOString();
  const [bookings, holds] = await Promise.all([
    env.DB.prepare(
      `SELECT ref, check_in, check_out FROM bookings
       WHERE property = ? AND status IN ('confirmed','pending') AND check_in < ? AND check_out > ?`,
    ).bind(slug, to, from).all<{ ref: string; check_in: string; check_out: string }>(),
    env.DB.prepare(
      `SELECT booking_ref AS ref, check_in, check_out FROM holds
       WHERE property = ? AND expires_at > ? AND check_in < ? AND check_out > ?`,
    ).bind(slug, now, to, from).all<{ ref: string; check_in: string; check_out: string }>(),
  ]);
  for (const r of [...bookings.results, ...holds.results]) {
    if (ignoreRef && r.ref === ignoreRef) continue;
    for (const n of eachNight(r.check_in, r.check_out)) taken.add(n);
  }
  return taken;
}

/**
 * The calendar the site shows and books against: PMS nights, minus anything taken by a direct
 * booking or an active hold. `ignoreRef` lets a booking re-check its own dates.
 */
export async function getCalendar(env: Env, slug: string, from: string, to: string, ignoreRef?: string): Promise<CalendarDay[]> {
  const pms = getPms(env);
  const [nights, taken] = await Promise.all([
    pms.getNights(pmsIdFor(env, slug), from, to),
    directlyTaken(env, slug, from, to, ignoreRef),
  ]);
  const byDate = new Map<string, NightInfo>(nights.map((n) => [n.date, n]));
  const discount = directDiscount(env);
  const today = todayLondon();
  const out: CalendarDay[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) {
    const n = byDate.get(d);
    const available = !!n && n.available && n.basePence != null && !taken.has(d) && d >= today;
    out.push({
      date: d,
      available,
      price: n?.basePence != null ? Math.round(n.basePence * (1 - discount)) : null,
      base: n?.basePence ?? null,
      minStay: n?.minStay ?? booking.defaultMinStay,
    });
  }
  return out;
}

export interface QuoteInput {
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  extras?: ExtraId[];
  ignoreRef?: string;
}

export interface QuoteLine {
  id: string;
  label: string;
  pence: number;
}

export interface Quote {
  ok: boolean;
  /** 'instant' = can be booked now; 'enquire' = 15+ nights, goes to the enquiry form. */
  mode: 'instant' | 'enquire' | null;
  errors: string[];
  slug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: { date: string; base: number; price: number }[];
  nightCount: number;
  subtotal: number; // pence, before discount
  discount: number; // pence
  stay: number; // pence, after discount
  extras: QuoteLine[];
  extrasTotal: number;
  total: number;
  eligibleExtras: ExtraId[];
  discountRate: number;
}

export async function getQuote(env: Env, input: QuoteInput): Promise<Quote> {
  const { slug, checkIn, checkOut } = input;
  const guests = Math.floor(Number(input.guests) || 0);
  const property = getProperty(slug);
  const base: Quote = {
    ok: false, mode: null, errors: [], slug, checkIn, checkOut, guests,
    nights: [], nightCount: 0, subtotal: 0, discount: 0, stay: 0, extras: [], extrasTotal: 0, total: 0,
    eligibleExtras: [], discountRate: directDiscount(env),
  };
  if (!property) return { ...base, errors: ['That property could not be found.'] };
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return { ...base, errors: ['Choose your check-in and checkout dates.'] };

  const nightCount = nightsBetween(checkIn, checkOut);
  base.nightCount = nightCount;
  const today = todayLondon();
  if (checkIn < today) return { ...base, errors: ['Your check-in date has already passed.'] };
  if (nightCount < 1) return { ...base, errors: ['Checkout must be after check-in.'] };
  if (checkIn > addDays(today, booking.bookingWindowDays)) return { ...base, errors: ['We only take bookings up to a year ahead.'] };
  if (nightCount > booking.maxNights) {
    return { ...base, errors: [`For stays of ${booking.maxNights + 1} nights or more, get in touch and we'll talk it through.`] };
  }
  if (guests < 1 || guests > property.guests) return { ...base, errors: [`This home sleeps up to ${property.guests}.`] };

  // Long stays go to an enquiry. We still check availability so the guest isn't sent down a dead end.
  const mode: Quote['mode'] = nightCount > booking.maxInstantNights ? 'enquire' : 'instant';

  // Fetch one night either side so we can work out early check-in and late checkout.
  const cal = await getCalendar(env, slug, addDays(checkIn, -1), addDays(checkOut, 1), input.ignoreRef);
  const byDate = new Map(cal.map((c) => [c.date, c]));
  const stayNights = eachNight(checkIn, checkOut);
  const unavailable = stayNights.filter((d) => !byDate.get(d)?.available);
  if (unavailable.length) {
    return { ...base, mode, errors: ['Some of those nights are already booked. Try different dates.'] };
  }
  const minStay = byDate.get(checkIn)?.minStay ?? booking.defaultMinStay;
  if (nightCount < minStay) {
    return { ...base, mode, errors: [`The minimum stay for these dates is ${minStay} nights.`] };
  }

  const discountRate = directDiscount(env);
  const nights = stayNights.map((d) => {
    const c = byDate.get(d)!;
    return { date: d, base: c.base!, price: c.price! };
  });
  const stay = nights.reduce((s, n) => s + n.price, 0);
  const subtotal = nights.reduce((s, n) => s + n.base, 0);

  const nightBefore = byDate.get(addDays(checkIn, -1));
  const departureNight = byDate.get(checkOut);
  const eligibleExtras = property.extras.filter((id) => {
    const def = extraDefs.find((e) => e.id === id);
    if (!def) return false;
    // A night that is free (or before today, i.e. nobody checking out) means the cleaner has time.
    if (def.needs === 'night_before_free') return !nightBefore || nightBefore.available || nightBefore.date < today;
    if (def.needs === 'departure_night_free') return !departureNight || departureNight.available;
    return true;
  });

  const chosen = (input.extras ?? []).filter((id) => eligibleExtras.includes(id));
  const extrasLines: QuoteLine[] = chosen.map((id) => {
    const def = extraDefs.find((e) => e.id === id)!;
    const pence = def.per === 'night' ? def.price * nightCount : def.price;
    return { id, label: def.label, pence };
  });
  const extrasTotal = extrasLines.reduce((s, l) => s + l.pence, 0);

  return {
    ...base,
    ok: true,
    mode,
    nights,
    subtotal,
    discount: subtotal - stay,
    stay,
    extras: extrasLines,
    extrasTotal,
    total: stay + extrasTotal,
    eligibleExtras,
    discountRate,
  };
}

export const gbp = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);
