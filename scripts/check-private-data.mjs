#!/usr/bin/env node
/**
 * Post-build check: the public website must not contain Website Admin tracker
 * data or private Club workspace data. Scans every file in dist/ (HTML, JS
 * bundles, JSON, _headers, _redirects, ...). Runs as part of `npm run build`.
 *
 * The public Club workspace demo (ENABLE_CLUB_DEMO=true) is the one exception,
 * and a narrow one: its deliberately public fictional fixtures may appear in
 * the demo's own files only. See scripts/private-data-rules.ts.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { clubDemoEnabled } from '../src/lib/club-demo.ts';
import { findPrivateData, MARKER_COUNT } from './private-data-rules.ts';

const DIST = new URL('../dist/', import.meta.url).pathname;
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|pdf|woff2?|ttf)$/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])))).flat();
}

const demoEnabled = clubDemoEnabled(process.env);
const all = await walk(DIST);
const files = await Promise.all(
  all.map(async (f) => ({ path: relative(DIST, f).split(sep).join('/'), text: BINARY.test(f) ? '' : await readFile(f, 'utf8') })),
);
const problems = findPrivateData(files, { demoEnabled });

if (problems.length) {
  console.error(`\n✗ Private-data check failed:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ Private-data check passed: ${MARKER_COUNT} markers checked in ${files.length} public files (club demo ${demoEnabled ? 'ON: demo data confined to the demo files' : 'off'}).`);
