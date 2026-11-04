// Facts still to confirm (docs/redesign/BRIEF.md section 3). Fill a value in here and it appears
// wherever the site uses it. While a value is an empty string, the line that shows it is hidden:
// never put a bracketed placeholder on the live site.

export const todo = {
  /** Shown as written, e.g. '+44 7700 900123'. */
  whatsapp: '',
  /** wa.me link, digits only, e.g. 'https://wa.me/447700900123'. */
  whatsappHref: '',
  /** Bus routes from the nearest stops, e.g. '73, 76, 106, 243'. */
  busRoutes: '',
  /** Measured wifi speed, e.g. '150 Mbps down'. */
  wifiSpeed: '',
  /** HANDOFF.md records the bathroom as a walk-in shower with no bath. Confirm before launch. */
  showerOrBath: 'Walk-in shower',
  /** Parking permit at £15: per stay or per night? Unused: the site and checkout follow `per` on the parking
   *  extra in src/config/booking.ts (per stay today). Change it there if the answer is per night. */
  parkingBasis: '',
  /** What happens when a guest cancels inside the 5-day window. /terms currently says no refund. */
  lateCancellation: '',
};

export type TodoKey = keyof typeof todo;

/** True once a value has been filled in. */
export const has = (key: TodoKey) => todo[key].trim() !== '';
