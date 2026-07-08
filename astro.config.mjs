import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// Bilingual static site: English at /en (default), Vietnamese at /vi; / -> /en.
// Pages stay prerendered (static); only /api/apply runs on-demand (prerender=false).
// Update `site` to the real production domain for correct canonical/hreflang URLs.
export default defineConfig({
  site: 'https://racehub-academy.vercel.app',
  output: 'static',
  adapter: vercel(),
  redirects: {
    '/': '/en',
  },
});
