// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import locale404 from './integrations/locale-404.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://kobberogkran.no',
  i18n: {
    defaultLocale: 'nb',
    locales: ['nb', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  // The site does not use Astro sessions. Without this the adapter adds a `SESSION` KV binding
  // without an id, which `wrangler preview` (branch previews in Workers Builds) rejects (code 10021).
  session: false,
  adapter: cloudflare(),
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'nb',
        locales: { nb: 'nb-NO', en: 'en' },
      },
    }),
    locale404({ locales: ['en'] }),
  ],
});
