// @ts-check
/**
 * Builds the public Club workspace demo into the site, only when the build
 * runs with ENABLE_CLUB_DEMO=true (see src/lib/club-demo.ts):
 *
 *   dist/club-demo.html                 the page (also served for /club-demo/*)
 *   dist/club-demo-assets/club-demo.js  the workspace app + page script
 *   dist/club-demo-assets/sql-wasm.wasm SQLite for the browser
 *
 * With the flag off this does nothing, so /club-demo is a 404.
 */
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

/** @returns {import('astro').AstroIntegration} */
export default function clubDemo() {
  return {
    name: 'kfsb-club-demo',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const { clubDemoEnabled, CLUB_DEMO_ASSET_DIR, CLUB_DEMO_PAGE } = await import('../src/lib/club-demo.ts');
        if (!clubDemoEnabled(process.env)) {
          logger.info('Club workspace demo: off (set ENABLE_CLUB_DEMO=true to include it).');
          return;
        }
        const out = fileURLToPath(dir);
        const assets = `${out}/${CLUB_DEMO_ASSET_DIR}`;
        const root = fileURLToPath(new URL('..', import.meta.url));
        const { build } = await import('vite');
        await build({
          configFile: false,
          root,
          publicDir: false,
          logLevel: 'warn',
          build: {
            outDir: assets,
            emptyOutDir: true,
            target: 'es2022',
            modulePreload: false,
            copyPublicDir: false,
            rollupOptions: {
              input: fileURLToPath(new URL('../workspace/browser/club-demo.ts', import.meta.url)),
              output: { entryFileNames: 'club-demo.js', chunkFileNames: '[name]-[hash].js', assetFileNames: '[name]-[hash][extname]' },
            },
          },
        });
        await mkdir(assets, { recursive: true });
        const require = createRequire(import.meta.url);
        await copyFile(require.resolve('sql.js/dist/sql-wasm.wasm'), `${assets}/sql-wasm.wasm`);
        await writeFile(`${out}/${CLUB_DEMO_PAGE}`, PAGE(CLUB_DEMO_ASSET_DIR));
        logger.info(`Club workspace demo: ON, built ${CLUB_DEMO_PAGE} and ${CLUB_DEMO_ASSET_DIR}/.`);
      },
    },
  };
}

/** Shown until the script takes over (or if it can't run). */
const PAGE = (/** @type {string} */ assets) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Try the club workspace (demo)</title>
<link rel="icon" href="data:,">
<style>body{margin:0;font:18px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d1d1f;background:#faf8f5}main{max-width:40rem;margin:0 auto;padding:32px 16px}a{color:#7d1222}@media (prefers-color-scheme:dark){body{color:#f2f2f2;background:#141416}a{color:#ff7a8a}}</style>
<script type="module" src="/${assets}/club-demo.js"></script>
</head>
<body>
<main id="main">
<h1>Try the club workspace</h1>
<p id="loading">Loading the demo…</p>
<noscript><p>This demo needs JavaScript. Turn it on in your browser settings, then reload the page.</p></noscript>
<p><a href="/kinsmen">← Back to the Kinsmen page</a></p>
</main>
</body>
</html>
`;
