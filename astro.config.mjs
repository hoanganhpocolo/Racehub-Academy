import { defineConfig } from 'astro/config';

// Static bilingual site: splash/language gate at /, English at /en, Vietnamese at /vi.
// Update `site` to the real production domain for correct canonical/hreflang URLs.
export default defineConfig({
  site: 'https://racehub-academy.vercel.app',
  output: 'static',
});
