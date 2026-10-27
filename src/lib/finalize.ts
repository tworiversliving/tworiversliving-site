// What happens to a booking after the guest submits: request mode, payment confirmation, conflicts and cancellation.
import { booking as rules } from '../config/booking';
import type { Quote } from './availability';
import { getCalendar } from './availability';
import { addDays, todayLondon } from './dates';
import { getBookingByRef, logEvent, newRef, setStatus, type BookingRow } from './db';
import { arrivalInfo, emails, freeCancellationDeadline, notifySlack, sendEmail } from './email';
import { getPms, pmsIdFor } from './pms';
import { refund } from './stripe';

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrivalTime: string | null;
  workTrip: boolean;
  company: string | null;
  notes: string | null;
  ip?: string;
}

/** Saves a booking from a checked quote. Status is 'pending' (about to pay) or 'requested' (no Stripe). */
export async function insertBooking(env: Env, q: Quote, g: GuestDetails, mode: BookingRow['mode']): Promise<BookingRow> {
  const ref = newRef();
  await env.DB.prepare(
    `INSERT INTO bookings (ref, property, check_in, check_out, guests, nights_json, extras_json, subtotal_pence, discount_pence,
       extras_pence, total_pence, status, mode, first_name, last_name, email, phone, arrival_time, work_trip, company, notes,
       terms_version, terms_accepted_at, terms_ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      ref, q.slug, q.checkIn, q.checkOut, q.guests, JSON.stringify(q.nights), JSON.stringify(q.extras), q.subtotal, q.discount,
      q.extrasTotal, q.total, mode === 'instant' ? 'pending' : 'requested', mode, g.firstName, g.lastName, g.email, g.phone,
      g.arrivalTime, g.workTrip ? 1 : 0, g.company, g.notes, rules.termsVersion, new Date().toISOString(), g.ip ?? null,
    )
    .run();
  return (await getBookingByRef(env.DB, ref))!;
}

/**
 * Holds the dates while the guest pays. Returns false if another guest's hold on any of the nights
 * was placed first, in which case the new hold is removed again.
 */
export async function placeHold(env: Env, b: BookingRow, expiresAt: Date): Promise<boolean> {
  const row = await env.DB.prepare('INSERT INTO holds (booking_ref, property, check_in, check_out, expires_at) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(b.ref, b.property, b.check_in, b.check_out, expiresAt.toISOString())
    .first<{ id: number }>();
  const clash = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM holds WHERE property = ? AND expires_at > ? AND check_in < ? AND check_out > ? AND id < ?',
  )
    .bind(b.property, new Date().toISOString(), b.check_out, b.check_in, row!.id)
    .first<{ n: number }>();
  if (clash && clash.n > 0) {
    await releaseHold(env, b.ref);
    return false;
  }
  return true;
}

export const releaseHold = (env: Env, ref: string) => env.DB.prepare('DELETE FROM holds WHERE booking_ref = ?').bind(ref).run();

/** Emails and alerts for a booking request (request mode, no payment taken). */
export async function notifyRequest(env: Env, b: BookingRow) {
  await Promise.all([
    sendEmail(env, emails.requested(env, b)),
    sendEmail(env, emails.hostNewBooking(env, b)),
    notifySlack(env, `Booking request ${b.ref}: ${b.first_name} ${b.last_name}, ${b.check_in} to ${b.check_out}, ${b.guests} guests. Not paid: send a payment link.`),
    logEvent(env.DB, 'request', b.property, { ref: b.ref, total: b.total_pence }),
  ]);
}

/**
 * Called when Stripe says a booking is paid, from the webhook or the confirmation page (whichever comes first).
 * Re-checks the nights; confirms and writes to the PMS, or refunds if an OTA booking got there first.
 */
export async function finalizePaid(env: Env, ref: string, paymentIntent: string | null): Promise<BookingRow | null> {
  // Claim the booking so the webhook and the confirmation page can't both finalise it.
  const claim = await env.DB.prepare(
    `UPDATE bookings SET payment_intent = ?, updated_at = datetime('now')
     WHERE ref = ? AND status IN ('pending', 'expired') AND payment_intent IS NULL`,
  )
    .bind(paymentIntent ?? 'paid', ref)
    .run();
  if (!claim.meta.changes) return getBookingByRef(env.DB, ref);

  try {
    const b = (await getBookingByRef(env.DB, ref))!;
    const cal = await getCalendar(env, b.property, b.check_in, b.check_out, ref);
    const free = cal.length > 0 && cal.every((d) => d.available);
    return free ? await confirm(env, b) : await conflict(env, b);
  } catch (e) {
    // Let the next webhook retry pick it up.
    await env.DB.prepare("UPDATE bookings SET payment_intent = NULL WHERE ref = ? AND status IN ('pending', 'expired')").bind(ref).run();
    throw e;
  }
}

async function confirm(env: Env, b: BookingRow): Promise<BookingRow> {
  await setStatus(env.DB, b.ref, 'confirmed');
  await releaseHold(env, b.ref);

  let pmsRef: string | null = null;
  try {
    const res = await getPms(env).createBooking({
      ref: b.ref,
      propertyPmsId: pmsIdFor(env, b.property),
      checkIn: b.check_in,
      checkOut: b.check_out,
      guests: b.guests,
      firstName: b.first_name,
      lastName: b.last_name,
      email: b.email,
      phone: b.phone,
      arrivalTime: b.arrival_time,
      totalPence: b.total_pence,
      paid: true,
      notice: `Direct booking ${b.ref} via tworiversliving.co.uk.${b.notes ? ` Guest notes: ${b.notes}` : ''}`,
    });
    pmsRef = res.pmsRef;
    if (pmsRef) await env.DB.prepare('UPDATE bookings SET pms_ref = ? WHERE ref = ?').bind(pmsRef, b.ref).run();
  } catch (e) {
    // The booking stands; the host email says to add it to the PMS by hand.
    console.error('PMS createBooking failed', b.ref, e);
  }

  const row = (await getBookingByRef(env.DB, b.ref))!;
  await Promise.all([
    sendEmail(env, emails.confirmed(env, row)),
    sendEmail(env, emails.hostNewBooking(env, row)),
    notifySlack(env, `New direct booking ${row.ref}: ${row.first_name} ${row.last_name}, ${row.check_in} to ${row.check_out}, ${row.guests} guests.${pmsRef ? '' : ' NOT in the PMS yet: add it by hand.'}`),
    logEvent(env.DB, 'paid', row.property, { ref: row.ref, total: row.total_pence }),
  ]);
  // Booked inside the 48-hour window: the daily job won't get to it in time, so send arrival details now.
  if (row.check_in <= addDays(todayLondon(), 2)) await sendPreArrival(env, row);
  return row;
}

async function conflict(env: Env, b: BookingRow): Promise<BookingRow> {
  let refunded = false;
  try {
    if (b.payment_intent && b.payment_intent !== 'paid') {
      await refund(env, b.ref, b.payment_intent);
      refunded = true;
    }
  } catch (e) {
    console.error('Conflict refund failed', b.ref, e);
  }
  await setStatus(env.DB, b.ref, 'conflict');
  await releaseHold(env, b.ref);
  const row = (await getBookingByRef(env.DB, b.ref))!;
  await Promise.all([
    sendEmail(env, emails.conflict(env, row)),
    sendEmail(env, emails.hostConflict(env, row, refunded)),
    notifySlack(env, `Double booking caught on ${row.ref} (${row.check_in} to ${row.check_out}). ${refunded ? 'Refunded automatically.' : 'REFUND FAILED: refund by hand in Stripe.'}`),
    logEvent(env.DB, 'conflict', row.property, { ref: row.ref, refunded }),
  ]);
  return row;
}

export async function sendPreArrival(env: Env, b: BookingRow) {
  await sendEmail(env, emails.preArrival(env, b, arrivalInfo(env, b.property)));
  await env.DB.prepare('UPDATE bookings SET pre_arrival_sent = 1 WHERE ref = ?').bind(b.ref).run();
}

/** A Checkout session lapsed without payment: free the dates. */
export async function expireBooking(env: Env, ref: string) {
  await env.DB.prepare("UPDATE bookings SET status = 'expired', updated_at = datetime('now') WHERE ref = ? AND status = 'pending' AND payment_intent IS NULL")
    .bind(ref)
    .run();
  await releaseHold(env, ref);
}

/**
 * Guest cancels from the manage-booking page. Confirmed bookings are refunded in full inside the
 * free-cancellation window (outside it the page sends them to us instead). Requests are simply withdrawn.
 */
export async function cancelByGuest(env: Env, b: BookingRow): Promise<{ ok: true; refundPence: number } | { ok: false; error: string }> {
  if (b.status === 'requested') {
    await setStatus(env.DB, b.ref, 'cancelled');
  } else if (b.status === 'confirmed') {
    if (new Date() >= freeCancellationDeadline(b)) {
      return { ok: false, error: `Free cancellation closed ${rules.freeCancellationDays} days before check-in. Get in touch and we'll see what we can do.` };
    }
    if (!b.payment_intent || b.payment_intent === 'paid') return { ok: false, error: "We couldn't find the payment for this booking. Get in touch and we'll sort it." };
    // Refund first: if Stripe fails, the booking stays as it is and the guest can try again.
    await refund(env, b.ref, b.payment_intent);
    await setStatus(env.DB, b.ref, 'refunded');
  } else {
    return { ok: false, error: 'This booking is not active, so there is nothing to cancel.' };
  }

  let pmsCancelled = false;
  if (b.pms_ref) {
    try {
      await getPms(env).cancelBooking(b.pms_ref);
      pmsCancelled = true;
    } catch (e) {
      console.error('PMS cancelBooking failed', b.ref, e);
    }
  }
  const refundPence = b.status === 'confirmed' ? b.total_pence : 0;
  const row = (await getBookingByRef(env.DB, b.ref))!;
  await Promise.all([
    sendEmail(env, emails.cancelled(env, row, refundPence)),
    sendEmail(env, emails.hostCancelled(env, row, refundPence, pmsCancelled)),
    notifySlack(env, `${row.ref} cancelled by the guest (${row.check_in} to ${row.check_out}).${refundPence ? ' Refunded in full.' : ''}`),
    logEvent(env.DB, 'cancel', row.property, { ref: row.ref, refund: refundPence }),
  ]);
  return { ok: true, refundPence };
}
