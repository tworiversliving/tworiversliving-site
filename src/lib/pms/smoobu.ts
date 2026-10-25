import type { NightInfo, PmsAdapter, PmsBooking } from './types';

// Smoobu API (https://docs.smoobu.com). Uses HMAC request signing: the legacy single
// `Api-Key` header stops working after 31 October 2026.
// Create the key in Smoobu: Settings → Advanced → API Keys → Create API Key, then Generate Secret.

const BASE = 'https://login.smoobu.com';

const enc = new TextEncoder();

async function sha256Hex(body: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(body));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  let bin = '';
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** RFC 3986 encoding, as Smoobu's canonical query string requires ([] becomes %5B%5D). */
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function canonicalQuery(params: [string, string][]): string {
  return params
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export class SmoobuAdapter implements PmsAdapter {
  readonly name = 'smoobu';
  constructor(
    private apiKey: string,
    private apiSecret: string,
    private channelId?: number,
  ) {}

  private async request<T>(method: string, path: string, params: [string, string][] = [], body?: unknown): Promise<T> {
    const query = canonicalQuery(params);
    const bodyText = body === undefined ? '' : JSON.stringify(body);
    const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const nonce = crypto.randomUUID();
    const canonical = [method, path, query, timestamp, nonce, await sha256Hex(bodyText), this.apiKey].join('\n');
    const signature = await hmacBase64(this.apiSecret, canonical);
    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : bodyText,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Smoobu ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async getNights(apartmentId: string, from: string, to: string): Promise<NightInfo[]> {
    // Smoobu's end_date is inclusive; we want nights up to but not including `to`.
    const end = new Date(`${to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    const data = await this.request<{ data: Record<string, Record<string, { price: number | null; min_length_of_stay: number | null; available: number }>> }>(
      'GET',
      '/api/rates',
      [
        ['start_date', from],
        ['end_date', end.toISOString().slice(0, 10)],
        ['apartments[]', apartmentId],
      ],
    );
    const days = data.data?.[apartmentId] ?? {};
    return Object.entries(days)
      .map(([date, d]) => ({
        date,
        available: d.available === 1,
        basePence: d.price == null ? null : Math.round(d.price * 100),
        minStay: d.min_length_of_stay ?? null,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  async createBooking(b: PmsBooking) {
    const body: Record<string, unknown> = {
      arrivalDate: b.checkIn,
      departureDate: b.checkOut,
      apartmentId: Number(b.propertyPmsId),
      firstName: b.firstName,
      lastName: b.lastName,
      email: b.email,
      phone: b.phone,
      adults: b.guests,
      children: 0,
      price: b.totalPence / 100,
      priceStatus: b.paid ? 1 : 0,
      notice: b.notice,
      language: 'en',
    };
    if (b.arrivalTime) body.arrivalTime = b.arrivalTime;
    if (this.channelId) body.channelId = this.channelId;
    const res = await this.request<{ id: number }>('POST', '/api/reservations', [], body);
    return { pmsRef: String(res.id) };
  }

  async cancelBooking(pmsRef: string) {
    await this.request('DELETE', `/api/reservations/${encodeURIComponent(pmsRef)}`);
  }
}
