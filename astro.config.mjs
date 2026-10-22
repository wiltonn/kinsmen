// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import hostFiles from './integrations/host-files.mjs';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const site = (env.PUBLIC_SITE_URL || 'https://www.kinsmenfanshawesugarbush.com').replace(/\/$/, '');

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // /visit -> dist/visit.html, so canonical URLs have no trailing slash
    format: 'file',
  },
  compressHTML: true,
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/dev/') && !page.endsWith('/404'),
    }),
    hostFiles(),
  ],
  image: {
    // Sanity's CDN serves responsive images for CMS content.
    domains: ['cdn.sanity.io'],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
