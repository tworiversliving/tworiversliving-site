// Security headers for every response. Static pages get them from public/_headers (served without the
// Worker); API routes and redirects get them from src/middleware.ts. Keep the two lists the same.
// No Content-Security-Policy yet: it needs testing against Stripe Embedded Checkout and Turnstile first.
export const securityHeaders: [string, string][] = [
  ['Strict-Transport-Security', 'max-age=31536000'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['X-Frame-Options', 'SAMEORIGIN'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
];
