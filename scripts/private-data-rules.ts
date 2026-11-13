/**
 * Rules for scripts/check-private-data.mjs (kept here so they can be tested).
 *
 * Three kinds of marker:
 * - Website Admin tracker data and the NON-public workspace fixtures (a second
 *   club, upper-level admins): forbidden in every public file, always.
 * - The deliberately public demo fixtures and the workspace's interface text
 *   (workspace/src/public-demo-data.ts): forbidden everywhere unless
 *   ENABLE_CLUB_DEMO=true, and then allowed ONLY inside the demo's own files.
 * - The demo's address: forbidden everywhere unless the demo is enabled.
 */
import { PRIVATE_MARKERS as TRACKER_MARKERS } from '../studio/admin-tracker/model.ts';
import { CLUB_DEMO_ASSET_DIR, CLUB_DEMO_PAGE, CLUB_DEMO_PATH, isClubDemoFile } from '../src/lib/club-demo.ts';
import { WORKSPACE_PRIVATE_MARKERS } from '../workspace/src/demo-data.ts';
import { PUBLIC_DEMO_MARKERS } from '../workspace/src/public-demo-data.ts';

export const ALWAYS_PRIVATE = [...TRACKER_MARKERS, ...WORKSPACE_PRIVATE_MARKERS];

export function findPrivateData(files: { path: string; text: string }[], opts: { demoEnabled: boolean }): string[] {
  const problems: string[] = [];
  for (const { path, text } of files) {
    const demoFile = isClubDemoFile(path);
    for (const m of ALWAYS_PRIVATE) if (text.includes(m)) problems.push(`${path}: contains "${m}"`);
    if (!(opts.demoEnabled && demoFile)) {
      for (const m of PUBLIC_DEMO_MARKERS) if (text.includes(m)) problems.push(`${path}: contains demo data "${m}"${opts.demoEnabled ? ' outside the demo files' : ' but ENABLE_CLUB_DEMO is off'}`);
    }
    if (!opts.demoEnabled && text.includes(CLUB_DEMO_PATH)) problems.push(`${path}: mentions ${CLUB_DEMO_PATH} but ENABLE_CLUB_DEMO is off`);
  }
  const paths = new Set(files.map((f) => f.path));
  const demoFiles = [...paths].filter(isClubDemoFile);
  if (!opts.demoEnabled && demoFiles.length) problems.push(`demo files were built but ENABLE_CLUB_DEMO is off: ${demoFiles.join(', ')}`);
  if (opts.demoEnabled && !paths.has(CLUB_DEMO_PAGE)) problems.push(`ENABLE_CLUB_DEMO is on but ${CLUB_DEMO_PAGE} was not built`);
  if (opts.demoEnabled && !demoFiles.some((p) => p.startsWith(`${CLUB_DEMO_ASSET_DIR}/`) && p.endsWith('.js'))) problems.push(`ENABLE_CLUB_DEMO is on but no demo script was built in ${CLUB_DEMO_ASSET_DIR}/`);
  return problems;
}

/**
 * Reviewer comments (preview builds only): a production build must not ship
 * the annotator, its popup or any call to the comments API.
 */
export const REVIEW_TOOL_MARKERS = ['/api/annotations', 'review-popup', 'text-annotator'];

export function findReviewToolsInProduction(files: { path: string; text: string }[]): string[] {
  return files.flatMap(({ path, text }) =>
    REVIEW_TOOL_MARKERS.filter((m) => text.includes(m)).map((m) => `${path}: contains reviewer-comment code "${m}" in a production build`),
  );
}

export const MARKER_COUNT = ALWAYS_PRIVATE.length + PUBLIC_DEMO_MARKERS.length;
