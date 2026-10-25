/// <reference types="astro/client" />

type D1Database = import('@cloudflare/workers-types').D1Database;

interface Env {
  DB: D1Database;
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
  SITE_URL: string;
  PMS_PROVIDER: 'smoobu' | 'ical' | 'mock';
  DIRECT_DISCOUNT: string;
  EMAIL_FROM: string;
  HOST_EMAIL: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  SMOOBU_API_KEY?: string;
  SMOOBU_API_SECRET?: string;
  SMOOBU_APARTMENT_IDS?: string;
  SMOOBU_CHANNEL_ID?: string;
  ICAL_URLS?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  ARRIVAL_INFO?: string;
  CRON_SECRET?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}
