/**
 * The public Club workspace demo (/club-demo). Off unless the site is built
 * with ENABLE_CLUB_DEMO=true. When off, nothing of the demo is built: no link
 * on /kinsmen and no /club-demo page, so a direct request gets the 404 page.
 */
export const CLUB_DEMO_PATH = '/club-demo';
/** Built files: the page, and its script/WebAssembly next to it. */
export const CLUB_DEMO_PAGE = 'club-demo.html';
export const CLUB_DEMO_ASSET_DIR = 'club-demo-assets';

export function clubDemoEnabled(env: Record<string, string | boolean | undefined>): boolean {
  const v = env.ENABLE_CLUB_DEMO;
  return typeof v === 'string' && v.trim().toLowerCase() === 'true';
}

/** Is this built file (path relative to dist/, "/" separators) part of the demo? */
export const isClubDemoFile = (rel: string) => rel === CLUB_DEMO_PAGE || rel.startsWith(`${CLUB_DEMO_ASSET_DIR}/`);
