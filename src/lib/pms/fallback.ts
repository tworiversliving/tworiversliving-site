import { fallbackRates } from '../../config/rates';
import { addDays } from '../dates';
import type { NightInfo, PmsAdapter, PmsBooking } from './types';

function priceFor(slug: string, date: string): { basePence: number | null; minStay: number | null } {
  const r = fallbackRates[slug];
  if (!r) return { basePence: null, minStay: null };
  const override = r.overrides?.[date];
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 5 = Fri, 6 = Sat
  const pounds = override ?? (dow === 5 || dow === 6 ? r.weekend : r.weekday);
  return { basePence: pounds * 100, minStay: r.minStay };
}

/** Parses blocked nights out of an iCal feed (Smoobu, Airbnb and most PMSs export one). */
export function parseIcalBlocked(ics: string): Set<string> {
  const blocked = new Set<string>();
  const unfolded = ics.replace(/\r?\n[ \t]/g, '');
  for (const ev of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const start = ev.match(/DTSTART[^:]*:(\d{8})/)?.[1];
    const end = ev.match(/DTEND[^:]*:(\d{8})/)?.[1];
    if (!start) continue;
    const s = `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`;
    const e = end ? `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}` : addDays(s, 1);
    for (let d = s; d < e; d = addDays(d, 1)) blocked.add(d);
  }
  return blocked;
}

/**
 * iCal adapter: availability from any PMS's iCal export, prices from config/rates.ts.
 * It cannot write bookings into the PMS; instead the PMS imports our feed at /ical/<slug>.ics.
 */
export class IcalAdapter implements PmsAdapter {
  readonly name = 'ical';
  constructor(private urls: Record<string, string>) {}

  async getNights(slug: string, from: string, to: string): Promise<NightInfo[]> {
    const url = this.urls[slug];
    if (!url) throw new Error(`No iCal URL configured for ${slug}`);
    const res = await fetch(url, { cf: { cacheTtl: 300 } } as RequestInit);
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const blocked = parseIcalBlocked(await res.text());
    const out: NightInfo[] = [];
    for (let d = from; d < to; d = addDays(d, 1)) out.push({ date: d, available: !blocked.has(d), ...priceFor(slug, d) });
    return out;
  }
  async createBooking(_b: PmsBooking) {
    return { pmsRef: null };
  }
  async cancelBooking() {}
}

/** Local development only: fake but stable availability so the booking flow can be tested. */
export class MockAdapter implements PmsAdapter {
  readonly name = 'mock';
  async getNights(slug: string, from: string, to: string): Promise<NightInfo[]> {
    const out: NightInfo[] = [];
    for (let d = from; d < to; d = addDays(d, 1)) {
      const day = Number(d.slice(8, 10));
      // Block a few short runs each month so the calendar shows real-looking gaps.
      const available = !((day >= 8 && day <= 11) || (day >= 22 && day <= 24));
      out.push({ date: d, available, ...priceFor(slug, d) });
    }
    return out;
  }
  async createBooking(b: PmsBooking) {
    return { pmsRef: `mock-${b.ref}` };
  }
  async cancelBooking() {}
}
