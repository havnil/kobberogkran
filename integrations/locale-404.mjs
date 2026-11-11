// @ts-check
import { access, rename, rmdir } from 'node:fs/promises';

/**
 * Astro only writes the root `src/pages/404.astro` as `404.html`; a nested
 * `src/pages/<locale>/404.astro` becomes `<locale>/404/index.html`. Cloudflare's
 * `not_found_handling: "404-page"` serves the nearest `404.html` up the path, so
 * this moves each locale's 404 page to `<locale>/404.html`. Unknown paths under
 * `/en/` then get the English 404 page, everything else the Norwegian one.
 *
 * @param {{ locales: string[] }} options non-default locales that have a 404 page
 * @returns {import('astro').AstroIntegration}
 */
export default function locale404({ locales }) {
  return {
    name: 'kobberogkran:locale-404',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        for (const locale of locales) {
          const from = new URL(`${locale}/404/index.html`, dir);
          const to = new URL(`${locale}/404.html`, dir);
          try {
            await access(from);
          } catch {
            logger.warn(`No 404 page found for locale "${locale}"`);
            continue;
          }
          await rename(from, to);
          await rmdir(new URL(`${locale}/404/`, dir));
          logger.info(`Moved ${locale}/404/index.html to ${locale}/404.html`);
        }
      },
    },
  };
}
