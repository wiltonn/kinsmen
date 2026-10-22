#!/usr/bin/env node
/**
 * Post-build check: every internal link, image, download and redirect target
 * in dist/ must resolve to a built file, and every #fragment must exist on
 * the target page. Runs as part of `npm run build`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat();
}

const exists = async (p) => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

/** Map a URL path to the built file, mirroring Cloudflare/Vercel clean URLs. */
async function resolvePath(pathname) {
  const clean = decodeURIComponent(pathname).replace(/\/$/, '') || '/';
  const candidates =
    clean === '/' ? ['index.html'] : [clean.slice(1), `${clean.slice(1)}.html`, `${clean.slice(1)}/index.html`];
  for (const c of candidates) if (await exists(join(DIST, c))) return join(DIST, c);
  return undefined;
}

const idCache = new Map();
async function idsIn(file) {
  if (!idCache.has(file)) {
    const html = await readFile(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return idCache.get(file);
}

const files = await walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const problems = [];
let checked = 0;

async function check(url, from) {
  if (!url || /^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(url)) return;
  const base = '/' + relative(DIST, from).replace(/(index)?\.html$/, '');
  const target = new URL(url, `https://site.test${base}`);
  checked++;
  const file = target.pathname === base.replace(/\/$/, '') || url.startsWith('#') ? from : await resolvePath(target.pathname);
  if (!file) {
    problems.push(`${relative(DIST, from)}: broken link ${url}`);
    return;
  }
  const fragment = decodeURIComponent(target.hash.slice(1));
  if (fragment && file.endsWith('.html') && !(await idsIn(file)).has(fragment)) {
    problems.push(`${relative(DIST, from)}: missing anchor #${fragment} on ${relative(DIST, file)}`);
  }
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) await check(m[1], file);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) await check(part.trim().split(/\s+/)[0], file);
  }
}

// Redirect destinations must exist too.
const redirectsFile = join(DIST, '_redirects');
if (await exists(redirectsFile)) {
  for (const line of (await readFile(redirectsFile, 'utf8')).split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [, to] = line.split(/\s+/);
    await check(to, join(DIST, 'index.html'));
  }
}

if (problems.length) {
  console.error(`\n✗ Link check failed (${problems.length} problem(s)):\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ Link check passed: ${checked} internal links/assets across ${htmlFiles.length} pages.`);
