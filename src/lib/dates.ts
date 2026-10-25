// All stay dates are plain 'YYYY-MM-DD' strings. Maths is done in UTC so DST never shifts a night.

export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** Every night of a stay, i.e. check-in up to but not including check-out. */
export function eachNight(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Today's date in London. */
export function todayLondon(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
}

/** Converts a London wall-clock time on a date into a UTC Date. */
export function londonToUtc(iso: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const guess = new Date(`${iso}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  // London is UTC+0 or UTC+1. Work out the offset that applies at that moment.
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(guess);
  const lh = Number(parts.find((p) => p.type === 'hour')?.value);
  const offsetHours = (lh - guess.getUTCHours() + 24) % 24;
  return new Date(guess.getTime() - offsetHours * 3_600_000);
}

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const fmtDate = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));
export const fmtDateShort = (iso: string) => DAY_SHORT.format(new Date(`${iso}T00:00:00Z`));
export const fmtDateLong = (iso: string) => DAY_LONG.format(new Date(`${iso}T00:00:00Z`));
