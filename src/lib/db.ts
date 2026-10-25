// Small helpers around Cloudflare D1.

export interface BookingRow {
  id: number;
  ref: string;
  property: string;
  check_in: string;
  check_out: string;
  guests: number;
  nights_json: string;
  extras_json: string;
  subtotal_pence: number;
  discount_pence: number;
  extras_pence: number;
  total_pence: number;
  status: 'pending' | 'confirmed' | 'requested' | 'cancelled' | 'refunded' | 'conflict' | 'expired';
  mode: 'instant' | 'request';
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  arrival_time: string | null;
  work_trip: number;
  company: string | null;
  notes: string | null;
  terms_version: string;
  terms_accepted_at: string;
  terms_ip: string | null;
  stripe_session_id: string | null;
  payment_intent: string | null;
  pms_ref: string | null;
  pre_arrival_sent: number;
  checkin_followup_sent: number;
  thank_you_sent: number;
  created_at: string;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Booking reference like TRL-7KQ4MX: no 0/O or 1/I so it reads cleanly over the phone. */
export function newRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `TRL-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;
}

export async function getBookingByRef(db: D1Database, ref: string) {
  return db.prepare('SELECT * FROM bookings WHERE ref = ?').bind(ref).first<BookingRow>();
}

export async function getBookingBySession(db: D1Database, sessionId: string) {
  return db.prepare('SELECT * FROM bookings WHERE stripe_session_id = ?').bind(sessionId).first<BookingRow>();
}

export async function setStatus(db: D1Database, ref: string, status: BookingRow['status'], extra: Record<string, string | number | null> = {}) {
  const keys = Object.keys(extra);
  const sets = ['status = ?', "updated_at = datetime('now')", ...keys.map((k) => `${k} = ?`)].join(', ');
  await db.prepare(`UPDATE bookings SET ${sets} WHERE ref = ?`).bind(status, ...keys.map((k) => extra[k]), ref).run();
}

export async function logEvent(db: D1Database | undefined, type: string, property?: string | null, meta?: unknown) {
  if (!db) return;
  try {
    await db.prepare('INSERT INTO events (type, property, meta) VALUES (?, ?, ?)').bind(type, property ?? null, meta ? JSON.stringify(meta) : null).run();
  } catch (e) {
    console.error('event log failed', e);
  }
}
