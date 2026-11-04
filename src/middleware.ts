// Adds the security headers to responses the Worker renders (API routes, /stays). See src/lib/headers.ts.
import { defineMiddleware } from 'astro:middleware';
import { securityHeaders } from './lib/headers';

export const onRequest = defineMiddleware(async (_context, next) => {
  const res = await next();
  try {
    for (const [name, value] of securityHeaders) if (!res.headers.has(name)) res.headers.set(name, value);
  } catch {
    // A response with immutable headers goes out as it is
  }
  return res;
});
