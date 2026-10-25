// The only contract the rest of the site has with a property management system (PMS).
// To move off Smoobu, write a new adapter that implements PmsAdapter and register it in ./index.ts.

export interface NightInfo {
  /** 'YYYY-MM-DD' — the night starting on this date. */
  date: string;
  available: boolean;
  /** Base nightly price in pence, before the direct discount. null = no price set (not bookable). */
  basePence: number | null;
  /** Minimum nights for a stay arriving on this date. null = use the site default. */
  minStay: number | null;
}

export interface PmsBooking {
  ref: string;
  propertyPmsId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  arrivalTime?: string | null;
  totalPence: number;
  paid: boolean;
  notice: string;
}

export interface PmsAdapter {
  readonly name: string;
  /** Nights from `from` up to but not including `to`. */
  getNights(propertyPmsId: string, from: string, to: string): Promise<NightInfo[]>;
  /** Writes the direct booking into the PMS so every channel is blocked. Returns the PMS's id. */
  createBooking(b: PmsBooking): Promise<{ pmsRef: string | null }>;
  cancelBooking(pmsRef: string): Promise<void>;
}
