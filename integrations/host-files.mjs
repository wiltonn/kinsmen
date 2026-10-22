// @ts-check
/**
 * Writes host configuration into the build output:
 * - _redirects (Cloudflare Pages) from src/lib/redirects.ts
 * - _headers   (Cloudflare Pages) with security headers, and
 *   X-Robots-Tag: noindex on every non-production build.
 * Vercel uses vercel.json instead (same redirects; see tests).
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/** @returns {import('astro').AstroIntegration} */
export default function hostFiles() {
  return {
    name: 'kfsb-host-files',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const { REDIRECTS, toCloudflareRedirects } = await import('../src/lib/redirects.ts');
        await writeFile(`${out}/_redirects`, toCloudflareRedirects(REDIRECTS));

        const production = (process.env.SITE_ENV ?? '').toLowerCase() === 'production';
        const headers = [
          '/*',
          '  X-Content-Type-Options: nosniff',
          '  Referrer-Policy: strict-origin-when-cross-origin',
          '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
          '  X-Frame-Options: SAMEORIGIN',
          ...(production ? [] : ['  X-Robots-Tag: noindex, nofollow']),
          '',
          '/_astro/*',
          '  Cache-Control: public, max-age=31536000, immutable',
          '',
        ];
        await writeFile(`${out}/_headers`, headers.join('\n'));
        logger.info(`Wrote _redirects (${REDIRECTS.length} rules) and _headers (${production ? 'production' : 'noindex preview'}).`);
      },
    },
  };
}
