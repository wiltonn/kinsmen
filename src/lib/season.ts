/**
 * Seasonal state: turns the editorial `season` record plus "now" into what
 * visitors should be told. Pure functions, so every state is unit-tested.
 *
 * Rules:
 * - Editors control the season status and reservation state explicitly.
 * - Dates refine the message (e.g. "Open today") but never invent a state the
 *   editor didn't set, except that a season whose last date has passed is
 *   always shown as ended, so stale "open" messaging can't linger.
 * - Reservation messaging never depends on OpenTable availability and never
 *   says "sold out": OpenTable is the only source of truth for availability.
 */
import type { DateBlock, IsoDate, ReservationState, Season, VisitorNotice } from './content/types';
import type { ResolvedBooking } from './opentable';
import { expandDateBlocks, formatFullDate, formatMonthDayLong, parseInstant, torontoDate } from './time';

export type SeasonPhase =
  /** No season record, or a season with no dates yet. */
  | 'notAnnounced'
  /** Dates announced, first open day still ahead. */
  | 'upcoming'
  /** Today is an operating day. */
  | 'openToday'
  /** Within the season, but today isn't an operating day. */
  | 'inSeason'
  /** Season closed by an editor, or its last date has passed. */
  | 'ended';

export interface SeasonView {
  phase: SeasonPhase;
  year?: number;
  today: IsoDate;
  firstDate?: IsoDate;
  lastDate?: IsoDate;
  /** Next operating day after today (or today when open today). */
  nextOpenDate?: IsoDate;
  headline: string;
  detail: string;
}

export function getSeasonView(season: Season | undefined, now: Date): SeasonView {
  const today = torontoDate(now);
  if (!season) {
    return {
      phase: 'notAnnounced',
      today,
      headline: 'Next season to be announced',
      detail: 'Season dates are posted here as soon as they are confirmed.',
    };
  }

  const dates = expandDateBlocks(season.operatingDates);
  const firstDate = dates[0];
  const lastDate = dates.at(-1);
  const nextOpenDate = dates.find((d) => d >= today);
  const base = { year: season.year, today, firstDate, lastDate, nextOpenDate };

  const ended = season.status === 'closed' || (lastDate !== undefined && today > lastDate);
  if (ended) {
    return {
      ...base,
      phase: 'ended',
      nextOpenDate: undefined,
      headline: `The ${season.year} season has ended`,
      detail: 'Thank you for visiting and supporting our community. Next season’s dates will be posted here once confirmed.',
    };
  }

  if (!firstDate) {
    return {
      ...base,
      phase: 'notAnnounced',
      headline: season.status === 'open' ? `Open for the ${season.year} season` : `${season.year} dates coming soon`,
      detail: 'Public dates are posted here as soon as they are confirmed.',
    };
  }

  if (season.status === 'open' && nextOpenDate === today) {
    return {
      ...base,
      phase: 'openToday',
      headline: 'Open today',
      detail: `The Sugar Bush is open to visitors today, ${formatFullDate(today)}.`,
    };
  }

  if (today < firstDate) {
    return {
      ...base,
      phase: 'upcoming',
      headline: `${season.year} season opens ${formatMonthDayLong(firstDate)}`,
      detail: `Public dates run from ${formatMonthDayLong(firstDate)} to ${formatMonthDayLong(lastDate!)}.`,
    };
  }

  return {
    ...base,
    phase: 'inSeason',
    headline: `${season.year} season in progress`,
    detail: nextOpenDate
      ? `Next public day: ${formatFullDate(nextOpenDate)}.`
      : 'Check the dates below for the next public day.',
  };
}

export interface ReservationView {
  state: ReservationState;
  /** Show a working OpenTable link/widget. */
  canBook: boolean;
  /** Show "Reserve a table" in the site header. */
  showHeaderCta: boolean;
  /** Reservations are open editorially but no valid OpenTable config exists. */
  misconfigured: boolean;
  headline: string;
  message: string;
  /** Confirmed future opening date, if any. */
  opensOn?: IsoDate;
}

export function getReservationView(
  season: Season | undefined,
  booking: ResolvedBooking,
  now: Date,
): ReservationView {
  const today = torontoDate(now);
  const year = season?.year;
  const reservations = season?.reservations;
  const state: ReservationState = reservations?.state ?? 'notAnnounced';
  const override = reservations?.message?.trim();
  const forYear = year ? ` for ${year}` : '';

  const view = (headline: string, message: string, extra: Partial<ReservationView> = {}): ReservationView => ({
    state,
    canBook: false,
    showHeaderCta: false,
    misconfigured: false,
    headline,
    message: override || message,
    ...extra,
  });

  switch (state) {
    case 'open':
      if (booking.configured) {
        return view('Pancake House reservations are open', 'Choose a date and time on OpenTable to reserve your table.', {
          canBook: true,
          showHeaderCta: true,
        });
      }
      return view(
        'Pancake House reservations',
        'Online booking isn’t available on this website right now. Please contact us and we’ll help you reserve.',
        { misconfigured: true },
      );

    case 'openingSoon': {
      const opensOn = reservations?.opensOn && reservations.opensOn >= today ? reservations.opensOn : undefined;
      return view(
        'Pancake House reservations open soon',
        opensOn
          ? `Online reservations${forYear} open on ${formatFullDate(opensOn)}.`
          : `Online reservations${forYear} will open soon. Check back here for the booking link.`,
        { opensOn },
      );
    }

    case 'closed':
      return view(
        'Pancake House reservations are closed',
        `Online Pancake House reservations${forYear} are closed.`,
      );

    case 'notAnnounced':
    default:
      return view(
        'Pancake House reservations',
        `Reservation details${forYear} haven’t been announced yet. They’ll be posted here first.`,
      );
  }
}

/** The visitor notice, unless it has expired. */
export function getActiveNotice(season: Season | undefined, now: Date): VisitorNotice | undefined {
  const notice = season?.notice;
  if (!notice?.message?.trim()) return undefined;
  const expires = parseInstant(notice.expiresAt);
  if (expires && expires.getTime() <= now.getTime()) return undefined;
  return notice;
}

/** Pancake House dates, resolved from the shared operating dates when configured that way. */
export function getPancakeHouseDates(season: Season | undefined): DateBlock[] | undefined {
  if (!season) return undefined;
  switch (season.pancakeHouse.dateMode) {
    case 'sameAsOperating':
      return season.operatingDates;
    case 'custom':
      return season.pancakeHouse.dates ?? [];
    default:
      return undefined;
  }
}
