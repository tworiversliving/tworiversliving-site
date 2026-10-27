// robots.txt, built with the site. Booking steps and the API stay out of search.
// While site.indexable is false, every page also carries a noindex meta tag (see Base.astro).
import type { APIRoute } from 'astro';
import { site } from '../config/site';

export const GET: APIRoute = () =>
  new Response(
    ['User-agent: *', 'Disallow: /api/', 'Disallow: /book/', 'Disallow: /booking', 'Disallow: /ical/', '', `Sitemap: ${site.url}/sitemap-index.xml`, ''].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
