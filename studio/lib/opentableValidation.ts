/**
 * Studio-side copy of the OpenTable URL rules in ../../src/lib/opentable.ts.
 * The website re-validates at build time; this gives editors instant feedback.
 * tests/opentable.test.ts checks both implementations agree.
 */
const BOOKING_HOSTS = ['www.opentable.ca', 'www.opentable.com', 'opentable.ca', 'opentable.com'];
const WIDGET_HOSTS = ['www.opentable.ca', 'www.opentable.com'];
const WIDGET_PATH = '/widget/reservation/loader';
const WIDGET_TYPES = ['standard', 'tall', 'wide', 'button', 'multi'];

function parse(raw: string): URL | undefined {
  const value = raw.trim().startsWith('//') ? `https:${raw.trim()}` : raw.trim();
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

/** Returns an error message, or true when valid. */
export function checkBookingUrl(raw: string | undefined): true | string {
  if (!raw) return true;
  const url = parse(raw);
  if (!url) return 'This is not a valid web address.';
  if (url.protocol !== 'https:') return 'The address must start with https://';
  if (url.username || url.password) return 'The address must not contain a username or password.';
  if (!BOOKING_HOSTS.includes(url.hostname)) return 'Use the OpenTable address (opentable.ca or opentable.com) supplied by the account administrator.';
  if (url.pathname === '/' || url.pathname === '') return "Use the restaurant's own OpenTable page, not the OpenTable home page.";
  return true;
}

export function checkWidgetLoaderUrl(raw: string | undefined): true | string {
  if (!raw) return true;
  if (/<|>/.test(raw)) return 'Paste only the web address from the src="…" part of the embed code, not the whole <script> tag.';
  const url = parse(raw);
  if (!url) return 'This is not a valid web address.';
  if (url.protocol !== 'https:') return 'The address must use https.';
  if (!WIDGET_HOSTS.includes(url.hostname)) return 'The widget address must be on www.opentable.ca or www.opentable.com.';
  if (url.pathname !== WIDGET_PATH) return `The widget address must contain ${WIDGET_PATH}.`;
  const rid = url.searchParams.get('rid') ?? url.searchParams.get('rids');
  if (!rid || !/^\d+(,\d+)*$/.test(rid)) return 'The widget address must include the numeric restaurant ID (rid=…).';
  const type = url.searchParams.get('type') ?? 'standard';
  if (!WIDGET_TYPES.includes(type)) return `Unsupported widget type "${type}".`;
  return true;
}
