/**
 * Everything a page needs about the site's current state, computed once per
 * build: content, season status, reservation messaging and booking config.
 */
import { getConfig } from './config';
import { getContent } from './content';
import type { SiteContent } from './content/types';
import { resolveBooking, type ResolvedBooking } from './opentable';
import { getActiveNotice, getReservationView, getSeasonView, type ReservationView, type SeasonView } from './season';
import { applyScenario } from './scenarios';

export interface SiteState {
  content: SiteContent;
  booking: ResolvedBooking;
  seasonView: SeasonView;
  reservationView: ReservationView;
  notice: ReturnType<typeof getActiveNotice>;
  isProduction: boolean;
  /** Show review badges and development notices. */
  showDevNotes: boolean;
  builtAt: Date;
}

let pending: Promise<SiteState> | undefined;

/**
 * Build time ("now"). Non-production builds may set SITE_NOW to an ISO
 * date-time to preview how the site looks on a given day.
 */
function buildNow(): Date {
  const config = getConfig();
  const override = process.env.SITE_NOW ?? import.meta.env.SITE_NOW;
  if (override && !config.isProduction) {
    const parsed = new Date(override);
    if (Number.isNaN(parsed.getTime())) throw new Error(`SITE_NOW is not a valid date-time: ${override}`);
    return parsed;
  }
  return new Date();
}

async function load(): Promise<SiteState> {
  const config = getConfig();
  let content = await getContent();
  if (content.source === 'fixtures') {
    content = applyScenario(content, process.env.FIXTURE_SCENARIO ?? import.meta.env.FIXTURE_SCENARIO);
  }
  const now = buildNow();
  const booking = resolveBooking(content.booking);
  for (const issue of booking.issues) console.warn(`[opentable] ${issue}`);

  const reservationView = getReservationView(content.season, booking, now);
  if (reservationView.misconfigured) {
    console.warn('[opentable] Reservations are marked open, but no valid OpenTable booking URL or widget is configured.');
  }

  return {
    content,
    booking,
    seasonView: getSeasonView(content.season, now),
    reservationView,
    notice: getActiveNotice(content.season, now),
    isProduction: config.isProduction,
    showDevNotes: !config.isProduction,
    builtAt: now,
  };
}

export function getSiteState(): Promise<SiteState> {
  pending ??= load();
  return pending;
}
