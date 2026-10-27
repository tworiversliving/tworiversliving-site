// Social share images, cropped from the real property photos to the 1.91:1 shape at build.
import type { ImageMetadata } from 'astro';
import { getImage } from 'astro:assets';
import { properties } from '../data/properties';

const photos = import.meta.glob<{ default: ImageMetadata }>('/src/assets/properties/**/*.{jpg,jpeg,png,webp}', { eager: true });

export interface PhotoRef {
  slug: string;
  file: string;
}

const fallback: PhotoRef = { slug: properties[0].slug, file: properties[0].ogPhoto };
const find = (ref: PhotoRef) => photos[`/src/assets/properties/${ref.slug}/${ref.file}`]?.default;

/** A photo that hasn't been added yet falls back to the first property's share photo. */
export async function ogImage(ref: PhotoRef = fallback) {
  const used = find(ref) ? ref : fallback;
  const src = find(used);
  if (!src) return undefined;
  const alt = properties.find((p) => p.slug === used.slug)?.photos.find((ph) => ph.file === used.file)?.alt ?? '';
  // 1200×630 where the photo is wide enough; never upscaled (the current photos are 1086px wide).
  const width = Math.min(1200, src.width);
  const height = Math.round(width / 1.905);
  const img = await getImage({ src, width, height, fit: 'cover', position: 'centre', format: 'jpg', quality: 80 });
  return { src: img.src, width, height, alt };
}

/** Plain-size JPEGs of a few photos, for the property's structured data. */
export async function schemaImages(slug: string, files: string[]) {
  const out: string[] = [];
  for (const file of files) {
    const src = find({ slug, file });
    if (src) out.push((await getImage({ src, width: Math.min(1600, src.width), format: 'jpg', quality: 80 })).src);
  }
  return out;
}
