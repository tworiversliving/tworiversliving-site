// Shared bits for the API routes: JSON responses, body parsing and the booking shape sent to the browser.
import { booking as rules } from '../config/booking';
import { getProperty } from '../data/properties';
import type { BookingRow } from './db';
import { freeCancellationDeadline } from './email';

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export const fail = (message: string, status = 400) => json({ ok: false, error: message }, status);

/** Reads a JSON or form-encoded body into a plain object. */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) return ((await request.json()) as Record<string, unknown>) ?? {};
    if (type.includes('form')) return Object.fromEntries((await request.formData()).entries());
  } catch {
    /* fall through */
  }
  return {};
}

export const clientIp = (request: Request) => request.headers.get('cf-connecting-ip') ?? undefined;

/** Trims a value to a string, capped at `max` characters. */
export const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** What the confirmation and manage-booking pages may see. No phone number or notes. */
export function publicBooking(b: BookingRow, now = new Date()) {
  const deadline = freeCancellationDeadline(b);
  const inWindow = now < deadline;
  return {
    ref: b.ref,
    property: b.property,
    propertyName: getProperty(b.property)?.name ?? b.property,
    checkIn: b.check_in,
    checkOut: b.check_out,
    checkInTime: rules.checkInTime,
    checkOutTime: rules.checkOutTime,
    guests: b.guests,
    nights: (JSON.parse(b.nights_json) as unknown[]).length,
    extras: JSON.parse(b.extras_json) as { id: string; label: string; pence: number }[],
    subtotal: b.subtotal_pence,
    discount: b.discount_pence,
    total: b.total_pence,
    status: b.status,
    mode: b.mode,
    firstName: b.first_name,
    freeCancellationUntil: deadline.toISOString(),
    canCancel: (b.status === 'confirmed' && inWindow) || b.status === 'requested',
  };
}

export type PublicBooking = ReturnType<typeof publicBooking>;
