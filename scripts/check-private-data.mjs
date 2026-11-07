#!/usr/bin/env node
/**
 * Post-build check: the public website must not contain Website Admin tracker
 * data, Club workspace data (members, meetings, committees, links, people),
 * or either local demo. Scans every file in dist/ (HTML, JS bundles, JSON,
 * NDJSON, _headers, ...) for the markers in studio/admin-tracker/model.ts:
 * the tracker document type and ID prefix, the demo storage key, the tool name,
 * and every starter item's ID and title. Runs as part of `npm run build`.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { PRIVATE_MARKERS as TRACKER_MARKERS } from '../studio/admin-tracker/model.ts';
import { WORKSPACE_PRIVATE_MARKERS } from '../workspace/src/demo-data.ts';

const PRIVATE_MARKERS = [...TRACKER_MARKERS, ...WORKSPACE_PRIVATE_MARKERS];

const DIST = new URL('../dist/', import.meta.url).pathname;
const BINARY = /\.(png|jpe?g|webp|avif|gif|ico|pdf|woff2?|ttf)$/i;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])))).flat();
}

const files = (await walk(DIST)).filter((f) => !BINARY.test(f));
const problems = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const marker of PRIVATE_MARKERS) if (text.includes(marker)) problems.push(`${relative(DIST, file)}: contains "${marker}"`);
}

if (problems.length) {
  console.error(`\n✗ Private-data check failed: private admin/workspace data found in the public build:\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exit(1);
}
console.log(`✓ Private-data check passed: ${PRIVATE_MARKERS.length} private markers absent from ${files.length} public files.`);
