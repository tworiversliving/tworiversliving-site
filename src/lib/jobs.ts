// The daily Cron Trigger (09:00 UTC, see wrangler.jsonc): tidy up holds, then send the scheduled guest emails.
import { addDays, todayLondon } from './dates';
import type { BookingRow } from './db';
import { emails, sendEmail } from './email';
import { sendPreArrival } from './finalize';

export async function runDailyJobs(env: Env) {
  const today = todayLondon();
  const now = new Date().toISOString();

  await env.DB.prepare('DELETE FROM holds WHERE expires_at < ?').bind(now).run();
  // Checkout sessions last 30 minutes, so anything still unpaid after two hours has lapsed.
  await env.DB.prepare(
    "UPDATE bookings SET status = 'expired', updated_at = datetime('now') WHERE status = 'pending' AND payment_intent IS NULL AND created_at < datetime('now', '-2 hours')",
  ).run();

  // Retention, as stated in the privacy policy (/privacy). Paid bookings are kept seven years for tax records;
  // bookings that were never paid and enquiries go after 12 months.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM bookings WHERE check_out < date('now', '-7 years')"),
    env.DB.prepare(
      "DELETE FROM bookings WHERE status IN ('expired', 'cancelled') AND payment_intent IS NULL AND created_at < datetime('now', '-12 months')",
    ),
    env.DB.prepare("DELETE FROM enquiries WHERE created_at < datetime('now', '-12 months')"),
  ]);

  const due =(sql: string, ...args: string[]) =>
    env.DB.prepare(`SELECT * FROM bookings WHERE status = 'confirmed' AND ${sql}`).bind(...args).all<BookingRow>().then((r) => r.results);

  // 48 hours before arrival (and catch up on anything arriving sooner that was missed).
  for (const b of await due('pre_arrival_sent = 0 AND check_in BETWEEN ? AND ?', today, addDays(today, 2))) {
    await run(b, () => sendPreArrival(env, b));
  }
  // The morning after arrival.
  for (const b of await due('checkin_followup_sent = 0 AND check_in = ? AND check_out > ?', addDays(today, -1), today)) {
    await run(b, async () => {
      await sendEmail(env, emails.checkinFollowup(env, b));
      await env.DB.prepare('UPDATE bookings SET checkin_followup_sent = 1 WHERE ref = ?').bind(b.ref).run();
    });
  }
  // The day after checkout.
  for (const b of await due('thank_you_sent = 0 AND check_out = ?', addDays(today, -1))) {
    await run(b, async () => {
      await sendEmail(env, emails.thankYou(env, b));
      await env.DB.prepare('UPDATE bookings SET thank_you_sent = 1 WHERE ref = ?').bind(b.ref).run();
    });
  }
}

/** One failed email shouldn't stop the rest. */
async function run(b: BookingRow, job: () => Promise<void>) {
  try {
    await job();
  } catch (e) {
    console.error('Daily job failed for', b.ref, e);
  }
}
