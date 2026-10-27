// Booking rules for direct bookings. Change values here, not in page code.

export const booking = {
  /** Stays longer than this go to an enquiry instead of instant booking. */
  maxInstantNights: 14,
  /** Hard cap on any stay requested through the site (Hackney licensing: nothing over 89 nights). */
  maxNights: 89,
  /** Used when the PMS gives no minimum stay for a date. Decision still open: 2 is the suggestion. */
  defaultMinStay: 2,
  /** How far ahead guests can book. */
  bookingWindowDays: 365,
  /** Free cancellation until this many days before check-in, at the check-in time. */
  freeCancellationDays: 5,
  /** Minutes a guest has to pay before their hold on the dates lapses (Stripe's minimum is 30). */
  holdMinutes: 30,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  currency: 'GBP',
  /** Bump this whenever the booking terms change, so each booking records which version was agreed. */
  termsVersion: '2026-10-27',
};

export type ExtraId = 'parking' | 'early_checkin' | 'late_checkout';

export interface ExtraDef {
  id: ExtraId;
  label: string;
  description: string;
  /** Price in pence. */
  price: number;
  per: 'stay' | 'night';
  /** Early check-in needs the night before arrival free; late checkout needs the departure night free. */
  needs?: 'night_before_free' | 'departure_night_free';
}

// Prices for early check-in and late checkout are suggestions until decided.
// Parking: confirm whether £15 is per stay or per night, then set `per`.
export const extras: ExtraDef[] = [
  {
    id: 'parking',
    label: 'Parking permit',
    description: 'A visitor permit for the resident bays nearby. It is a permit, not a private space.',
    price: 1500,
    per: 'stay',
  },
  {
    id: 'early_checkin',
    label: 'Early check-in from 12:00',
    description: 'Arrive three hours early. Only offered when the flat is free the night before.',
    price: 2500,
    per: 'stay',
    needs: 'night_before_free',
  },
  {
    id: 'late_checkout',
    label: 'Late checkout until 13:00',
    description: 'Leave two hours later. Only offered when nobody arrives that day.',
    price: 2500,
    per: 'stay',
    needs: 'departure_night_free',
  },
];
