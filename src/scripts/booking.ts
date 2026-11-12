// Browser helpers shared by the booking panel, checkout, confirmation and manage-booking pages.
import { clock } from '../config/booking';

export interface SiteConfig {
  mode: 'instant' | 'request';
  stripePublishableKey: string | null;
  turnstileSiteKey: string | null;
}

let configPromise: Promise<SiteConfig> | undefined;
export function getConfig(): Promise<SiteConfig> {
  configPromise ??= fetch('/api/config')
    .then((r) => r.json() as Promise<SiteConfig>)
    .catch(() => ({ mode: 'request' as const, stripePublishableKey: null, turnstileSiteKey: null }));
  return configPromise;
}

export async function postJson<T>(url: string, body: unknown): Promise<T & { ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as T & { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Something went wrong with the connection. Check you are online and try again.' } as T & { ok: boolean; error?: string };
  }
}

export const gbp = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);

const DAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtDate = (iso: string) => DAY.format(new Date(`${iso}T00:00:00Z`));
export const fmtDateLong = (iso: string) => DAY_LONG.format(new Date(`${iso}T00:00:00Z`));

/** "3pm on Sunday 1 November 2026", in London time. */
export function fmtDeadline(isoTimestamp: string) {
  const d = new Date(isoTimestamp);
  const time = clock(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/London' }).format(d));
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(d);
  return `${time} on ${day}`;
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Renders a Turnstile widget into `el` if the site key is set. Returns a getter for the token. */
export async function mountTurnstile(el: HTMLElement | null): Promise<() => string | undefined> {
  const { turnstileSiteKey } = await getConfig();
  if (!el || !turnstileSiteKey) return () => undefined;
  const w = window as unknown as { turnstile?: { render: (el: HTMLElement, o: object) => string; getResponse: (id: string) => string; reset: (id: string) => void } };
  if (!w.turnstile) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Turnstile failed to load'));
      document.head.append(s);
    }).catch(() => undefined);
  }
  if (!w.turnstile) return () => undefined;
  const id = w.turnstile.render(el, { sitekey: turnstileSiteKey, theme: 'light', size: 'flexible' });
  return () => w.turnstile?.getResponse(id);
}

export interface PublicBooking {
  ref: string;
  property: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  checkInTime: string;
  checkOutTime: string;
  guests: number;
  nights: number;
  extras: { id: string; label: string; pence: number }[];
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  mode: 'instant' | 'request';
  firstName: string;
  freeCancellationUntil: string;
  canCancel: boolean;
}

/** The booking details table used on the confirmation and manage-booking pages. */
export function bookingRows(b: PublicBooking): string {
  const rows: [string, string][] = [
    ['Booking reference', b.ref],
    ['Home', b.propertyName],
    ['Check-in', `${fmtDateLong(b.checkIn)} from ${clock(b.checkInTime)}`],
    ['Checkout', `${fmtDateLong(b.checkOut)} by ${clock(b.checkOutTime)}`],
    ['Guests', String(b.guests)],
    [plural(b.nights, 'night'), gbp(b.subtotal)],
    ...(b.discount ? [['Direct booking discount', `−${gbp(b.discount)}`] as [string, string]] : []),
    ...b.extras.map((e) => [e.label, gbp(e.pence)] as [string, string]),
    [b.mode === 'request' ? 'Total to pay' : 'Total paid', gbp(b.total)],
  ];
  return `<dl class="rows">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}
