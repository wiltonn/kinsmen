/**
 * OpenTable configuration: validation and controlled rendering.
 *
 * OpenTable is the source of truth for tables, dates and bookings. This site
 * only links to it or embeds OpenTable's official widget. Editors cannot add
 * arbitrary script: they paste two values from the OpenTable account
 * (the public booking URL and the widget's `src` URL), which are validated
 * here and re-built from an allowlist of hosts and parameters.
 *
 * See docs/opentable-setup.md.
 */
import type { BookingSettings } from './content/types';

/** Hosts OpenTable uses for Canadian restaurants' public pages and widgets. */
export const OPENTABLE_HOSTS = ['www.opentable.ca', 'www.opentable.com', 'opentable.ca', 'opentable.com'] as const;

/** Hosts the widget loader script may be served from. */
export const OPENTABLE_WIDGET_HOSTS = ['www.opentable.ca', 'www.opentable.com'] as const;

export const OPENTABLE_WIDGET_PATH = '/widget/reservation/loader';

/** Widget parameters OpenTable's embed generator emits. Anything else is dropped. */
const WIDGET_PARAM_ALLOWLIST = new Set([
  'rid',
  'rids',
  'type',
  'theme',
  'color',
  'dark',
  'iframe',
  'domain',
  'lang',
  'newtab',
  'overlay',
  'ot_source',
  'cfe',
]);

export const WIDGET_TYPES = ['standard', 'tall', 'wide', 'button', 'multi'] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

/**
 * Approximate rendered height of each official widget layout, used to reserve
 * space and avoid layout shift. OpenTable controls the real size.
 */
export const WIDGET_MIN_HEIGHT: Record<WidgetType, number> = {
  standard: 320,
  tall: 500,
  wide: 170,
  button: 120,
  multi: 320,
};

type Result<T> = { ok: true; value: T; warnings: string[] } | { ok: false; error: string };

function parseUrl(raw: string): URL | undefined {
  const trimmed = raw.trim();
  // OpenTable's embed code uses protocol-relative URLs ("//www.opentable.ca/...").
  const withProtocol = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  try {
    return new URL(withProtocol);
  } catch {
    return undefined;
  }
}

export function validateBookingUrl(raw: string | undefined): Result<string> {
  if (!raw?.trim()) return { ok: false, error: 'No booking URL has been entered.' };
  const url = parseUrl(raw);
  if (!url) return { ok: false, error: 'The booking URL is not a valid web address.' };
  if (url.protocol !== 'https:') return { ok: false, error: 'The booking URL must start with https://.' };
  if (url.username || url.password) return { ok: false, error: 'The booking URL must not contain credentials.' };
  if (!(OPENTABLE_HOSTS as readonly string[]).includes(url.hostname)) {
    return { ok: false, error: `The booking URL must be an OpenTable address (${OPENTABLE_HOSTS.join(', ')}).` };
  }
  if (url.pathname === '/' || url.pathname === '') {
    return { ok: false, error: "The booking URL must point to the restaurant's OpenTable page, not the home page." };
  }
  return { ok: true, value: url.toString(), warnings: [] };
}

export interface WidgetConfig {
  src: string;
  rid: string;
  type: WidgetType;
  minHeight: number;
}

export function validateWidgetLoaderUrl(raw: string | undefined): Result<WidgetConfig> {
  if (!raw?.trim()) return { ok: false, error: 'No widget script URL has been entered.' };
  const url = parseUrl(raw);
  if (!url) return { ok: false, error: 'The widget script URL is not a valid web address.' };
  if (url.protocol !== 'https:') return { ok: false, error: 'The widget script URL must use https.' };
  if (!(OPENTABLE_WIDGET_HOSTS as readonly string[]).includes(url.hostname)) {
    return { ok: false, error: `The widget script must be served by OpenTable (${OPENTABLE_WIDGET_HOSTS.join(', ')}).` };
  }
  if (url.pathname !== OPENTABLE_WIDGET_PATH) {
    return { ok: false, error: `The widget script URL must use OpenTable's ${OPENTABLE_WIDGET_PATH} address.` };
  }
  const rid = url.searchParams.get('rid') ?? url.searchParams.get('rids');
  if (!rid || !/^\d+(,\d+)*$/.test(rid)) {
    return { ok: false, error: 'The widget script URL must include the numeric restaurant ID (rid) from OpenTable.' };
  }
  const rawType = url.searchParams.get('type') ?? 'standard';
  if (!(WIDGET_TYPES as readonly string[]).includes(rawType)) {
    return { ok: false, error: `Unsupported widget type "${rawType}".` };
  }
  const type = rawType as WidgetType;

  const warnings: string[] = [];
  const clean = new URL(`https://${url.hostname}${OPENTABLE_WIDGET_PATH}`);
  for (const [key, value] of url.searchParams) {
    if (WIDGET_PARAM_ALLOWLIST.has(key)) clean.searchParams.append(key, value);
    else warnings.push(`Ignored unrecognised widget parameter "${key}".`);
  }
  return { ok: true, value: { src: clean.toString(), rid, type, minHeight: WIDGET_MIN_HEIGHT[type] }, warnings };
}

export interface ResolvedBooking {
  /** Validated OpenTable booking page, used for buttons and as the widget fallback. */
  bookingUrl?: string;
  /** Validated widget, only when the editor enabled it. */
  widget?: WidgetConfig;
  /** At least one working booking path exists. */
  configured: boolean;
  /** Problems an editor or developer should fix. Never shown to visitors. */
  issues: string[];
}

export function resolveBooking(settings: BookingSettings | undefined): ResolvedBooking {
  const issues: string[] = [];
  let bookingUrl: string | undefined;
  let widget: WidgetConfig | undefined;

  const link = validateBookingUrl(settings?.bookingUrl);
  if (link.ok) bookingUrl = link.value;
  else if (settings?.bookingUrl) issues.push(link.error);

  if (settings?.widgetEnabled) {
    const result = validateWidgetLoaderUrl(settings.widgetLoaderUrl);
    if (result.ok) {
      widget = result.value;
      issues.push(...result.warnings);
      if (!bookingUrl) issues.push('The widget is enabled but there is no booking URL to use as a fallback link.');
    } else {
      issues.push(`Widget disabled: ${result.error}`);
    }
  }

  return { bookingUrl, widget, configured: Boolean(bookingUrl || widget), issues };
}
