// Lists your Smoobu apartments and their ids, using the same HMAC signing as src/lib/pms/smoobu.ts.
// Usage: node scripts/smoobu-apartments.mjs   (reads SMOOBU_API_KEY and SMOOBU_API_SECRET from .dev.vars)
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const vars = Object.fromEntries(
  readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
);
const key = vars.SMOOBU_API_KEY;
const secret = vars.SMOOBU_API_SECRET;
if (!key || !secret) {
  console.error('Add SMOOBU_API_KEY and SMOOBU_API_SECRET to .dev.vars first (Smoobu: Settings → Advanced → API Keys).');
  process.exit(1);
}

const path = '/api/apartments';
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const nonce = randomUUID();
const bodyHash = createHash('sha256').update('').digest('hex');
const canonical = ['GET', path, '', timestamp, nonce, bodyHash, key].join('\n');
const signature = createHmac('sha256', secret).update(canonical).digest('base64');

const res = await fetch(`https://login.smoobu.com${path}`, {
  headers: { 'X-API-Key': key, 'X-Timestamp': timestamp, 'X-Nonce': nonce, 'X-Signature': signature, Accept: 'application/json' },
});
const text = await res.text();
if (!res.ok) {
  console.error(`Smoobu said ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}
const data = JSON.parse(text);
for (const a of data.apartments ?? []) console.log(`${a.id}\t${a.name}`);
console.log('\nPut the right id in .dev.vars as: SMOOBU_APARTMENT_IDS={"stoke-newington-3-bed": <id>}');
