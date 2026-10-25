import { IcalAdapter, MockAdapter } from './fallback';
import { SmoobuAdapter } from './smoobu';
import type { PmsAdapter } from './types';

export type { NightInfo, PmsAdapter, PmsBooking } from './types';

function json<T>(s: string | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Picks the adapter from PMS_PROVIDER. This is the only place that knows which PMS is in use. */
export function getPms(env: Env): PmsAdapter {
  switch (env.PMS_PROVIDER) {
    case 'smoobu':
      if (!env.SMOOBU_API_KEY || !env.SMOOBU_API_SECRET) throw new Error('SMOOBU_API_KEY and SMOOBU_API_SECRET must be set');
      return new SmoobuAdapter(env.SMOOBU_API_KEY, env.SMOOBU_API_SECRET, env.SMOOBU_CHANNEL_ID ? Number(env.SMOOBU_CHANNEL_ID) : undefined);
    case 'ical':
      return new IcalAdapter(json<Record<string, string>>(env.ICAL_URLS, {}));
    default:
      return new MockAdapter();
  }
}

/** The id a property has inside the PMS. Smoobu uses numeric apartment ids; iCal and mock use the slug. */
export function pmsIdFor(env: Env, slug: string): string {
  if (env.PMS_PROVIDER === 'smoobu') {
    const ids = json<Record<string, number | string>>(env.SMOOBU_APARTMENT_IDS, {});
    const id = ids[slug];
    if (id == null) throw new Error(`No Smoobu apartment id for ${slug} in SMOOBU_APARTMENT_IDS`);
    return String(id);
  }
  return slug;
}
