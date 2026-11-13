// @ts-check
/**
 * Serves /api/annotations during `astro dev` with the same handler as the
 * Vercel function (api/annotations.ts), so reviewer comments work locally
 * without `vercel dev`. DATABASE_URL comes from .env.local / .env.
 * Has no effect on `astro build` (Vercel deploys api/ itself).
 */
import { loadEnv } from 'vite';

/** @returns {import('astro').AstroIntegration} */
export default function reviewApi() {
  return {
    name: 'kfsb-review-api',
    hooks: {
      'astro:server:setup': async ({ server, logger }) => {
        const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
        const { createAnnotationsHandler } = await server.ssrLoadModule('/src/lib/annotations/api.ts');
        const { isAnnotationsEnabled } = await server.ssrLoadModule('/src/lib/annotations/model.ts');
        const { default: pg } = await import('pg');
        const db = env.DATABASE_URL ? new pg.Pool({ connectionString: env.DATABASE_URL, max: 3 }) : undefined;
        const handle = createAnnotationsHandler({ enabled: isAnnotationsEnabled(env), db });
        logger.info(`Reviewer comments API at /api/annotations (${db ? 'Neon' : 'no DATABASE_URL: returns 503'}).`);

        server.middlewares.use('/api/annotations', async (req, res) => {
          try {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = chunks.length ? Buffer.concat(chunks) : undefined;
            const url = new URL(req.originalUrl ?? req.url ?? '/', 'http://localhost');
            const request = new Request(url, {
              method: req.method,
              headers: /** @type {Record<string, string>} */ (req.headers),
              body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            });
            const response = await handle(request);
            res.statusCode = response.status;
            for (const [key, value] of response.headers) res.setHeader(key, value);
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (e) {
            logger.error(String(e));
            res.statusCode = 500;
            res.end('{"error":"Internal error"}');
          }
        });
      },
    },
  };
}
