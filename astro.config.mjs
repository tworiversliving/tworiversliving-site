// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tworiversliving.co.uk',
  output: 'static',
  trailingSlash: 'never',
  adapter: cloudflare({
    imageService: 'compile',
    platformProxy: { enabled: true },
    workerEntryPoint: { path: 'src/worker.ts' },
  }),
  integrations: [
    sitemap({
      filter: (page) => !/\/(book|booking)(\/|$)/.test(page),
    }),
  ],
  build: { format: 'file' },
});
