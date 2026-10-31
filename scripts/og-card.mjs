// Renders the 1200×630 share card (BRIEF.md 4.5) to public/og/stoke-newington.png.
// Playwright isn't a site dependency, so run it from a folder that has it installed:
//   cd ../qa && node ../tworiversliving-site/scripts/og-card.mjs
// Re-run after changing the guests, bedrooms, fromPriceFallback or ogPhoto of the first property.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p));
const b64 = (p) => read(p).toString('base64');

// The first property's facts, read from the data file so the card can't drift from it
const data = read('src/data/properties.ts').toString();
const field = (k) => data.match(new RegExp(`\\n\\s+${k}: '?([^,'\\n]+)'?,`))?.[1];
const [slug, guests, bedrooms, price, photo] = ['slug', 'guests', 'bedrooms', 'fromPriceFallback', 'ogPhoto'].map(field);
if (![slug, guests, bedrooms, price, photo].every(Boolean)) throw new Error('Could not read the property fields');

const font = (family, file) =>
  `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${b64(`node_modules/@fontsource/${file}`)}) format('woff2'); }`;

const html = `<!doctype html><html><head><style>
${font('Redaction', 'redaction/files/redaction-latin-400-normal.woff2')}
${font('Redaction 50', 'redaction-50/files/redaction-50-latin-400-normal.woff2')}
${font('Fragment Mono', 'fragment-mono/files/fragment-mono-latin-400-normal.woff2')}
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; display: grid; grid-template-columns: 1fr 470px; background: #fafaf6; color: #2f3a2b; }
.text { display: flex; flex-direction: column; padding: 64px 0 60px 72px; }
.logo { width: 190px; height: auto; }
h1 { margin-top: auto; font: 400 96px/0.92 'Redaction', Georgia, serif; letter-spacing: -0.015em; }
.worn { display: block; font-family: 'Redaction 50', 'Redaction', Georgia, serif; }
p { margin-top: 36px; padding-top: 16px; border-top: 1px solid #2f3a2b; width: 560px;
    font: 400 20px/1.3 'Fragment Mono', monospace; letter-spacing: 0.04em; color: #7a6740; }
img.photo { width: 470px; height: 630px; object-fit: cover; display: block; }
</style></head><body>
<div class="text">
  <img class="logo" src="data:image/svg+xml;base64,${b64('public/brand/logo-horizontal.svg')}" alt="">
  <h1>Stoke Newington,<span class="worn">kept local.</span></h1>
  <p>${guests} GUESTS · ${bedrooms} BEDROOMS · FROM £${price}</p>
</div>
<img class="photo" src="data:image/jpeg;base64,${b64(`src/assets/properties/${slug}/${photo}`)}" alt="">
</body></html>`;

const out = path.join(root, 'public/og/stoke-newington.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out });
await browser.close();
console.log('Wrote', path.relative(root, out));
