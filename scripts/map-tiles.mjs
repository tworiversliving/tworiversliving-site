// Downloads the OpenStreetMap tiles each property's location map needs into public/maps/<slug>/.
// Run it once per property, and again after changing a property's `map` in src/data/properties.ts.
// Usage: node scripts/map-tiles.mjs   (Node 22.18+ for TypeScript imports)
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { properties } from '../src/data/properties.ts';
import { mapLayout } from '../src/lib/map.ts';

// OSM's tile policy asks for an identifying User-Agent.
const headers = { 'User-Agent': 'tworiversliving-site map build (stay@tworiversliving.co.uk)' };

for (const p of properties) {
  const dir = new URL(`../public/maps/${p.slug}/`, import.meta.url);
  mkdirSync(dir, { recursive: true });
  const { tiles } = mapLayout(p.map);
  const wanted = new Set(tiles.map((t) => t.file));

  // Clear out tiles from an earlier map position.
  for (const f of readdirSync(dir)) if (!wanted.has(f)) rmSync(new URL(f, dir));

  for (const t of tiles) {
    const file = new URL(t.file, dir);
    if (existsSync(file)) continue;
    const res = await fetch(t.url, { headers });
    if (!res.ok) throw new Error(`${t.url}: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  console.log(`${p.slug}: ${tiles.length} tiles in public/maps/${p.slug}/`);
}
