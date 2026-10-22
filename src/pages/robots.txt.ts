import type { APIRoute } from 'astro';
import { getConfig } from '../lib/config';

/** Only the production deployment may be indexed. */
export const GET: APIRoute = () => {
  const { isProduction, siteUrl } = getConfig();
  const body = isProduction
    ? `User-agent: *\nAllow: /\nDisallow: /dev/\n\nSitemap: ${siteUrl}/sitemap-index.xml\n`
    : `# Non-production build (SITE_ENV is not "production"): keep out of search indexes.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
