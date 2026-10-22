import { describe, expect, it } from 'vitest';
import { getActiveNotice, getPancakeHouseDates, getReservationView, getSeasonView } from '../src/lib/season';
import { resolveBooking } from '../src/lib/opentable';
import type { Season } from '../src/lib/content/types';

/** Noon in Toronto (EST, UTC-5) on the given date. */
const at = (iso: string, time = '12:00') => new Date(`${iso}T${time}:00-05:00`);

const base: Season = {
  provenance: 'confirmed',
  year: 2027,
  status: 'upcoming',
  operatingDates: [
    { label: 'Family Day weekend', startDate: '2027-02-13', endDate: '2027-02-15' },
    { startDate: '2027-02-27', endDate: '2027-02-28' },
    { label: 'March Break', startDate: '2027-03-15', endDate: '2027-03-19' },
  ],
  pancakeHouse: { dateMode: 'sameAsOperating' },
  reservations: { state: 'notAnnounced', tourRelationship: 'separate' },
  faqs: [],
};
const season = (overrides: Partial<Season> = {}): Season => ({ ...base, ...overrides });

const configured = resolveBooking({ bookingUrl: 'https://www.opentable.ca/r/example-restaurant', widgetEnabled: false });
const unconfigured = resolveBooking({ widgetEnabled: false });

describe('getSeasonView', () => {
  it('reports no season when nothing is announced', () => {
    expect(getSeasonView(undefined, at('2026-10-21')).phase).toBe('notAnnounced');
  });

  it('treats a season without dates as not announced', () => {
    const view = getSeasonView(season({ operatingDates: [] }), at('2026-10-21'));
    expect(view.phase).toBe('notAnnounced');
    expect(view.headline).toBe('2027 dates coming soon');
  });

  it('shows the opening date for an announced upcoming season', () => {
    const view = getSeasonView(season(), at('2026-10-21'));
    expect(view.phase).toBe('upcoming');
    expect(view.headline).toBe('2027 season opens February 13');
    expect(view.firstDate).toBe('2027-02-13');
    expect(view.lastDate).toBe('2027-03-19');
  });

  it('is "open today" only when the editor has opened the season', () => {
    expect(getSeasonView(season({ status: 'open' }), at('2027-02-14')).phase).toBe('openToday');
    // Editor hasn't switched to open: dates alone don't claim the site is open.
    expect(getSeasonView(season({ status: 'upcoming' }), at('2027-02-14')).phase).toBe('inSeason');
  });

  it('gives the next public day between open dates', () => {
    const view = getSeasonView(season({ status: 'open' }), at('2027-02-20'));
    expect(view.phase).toBe('inSeason');
    expect(view.nextOpenDate).toBe('2027-02-27');
  });

  it('uses the Toronto calendar date, not UTC', () => {
    // 11:30 p.m. Feb 12 in Toronto is already Feb 13 in UTC.
    const lateEvening = new Date('2027-02-13T04:30:00Z');
    expect(getSeasonView(season({ status: 'open' }), lateEvening).phase).toBe('upcoming');
    // 12:30 a.m. Feb 13 in Toronto.
    expect(getSeasonView(season({ status: 'open' }), new Date('2027-02-13T05:30:00Z')).phase).toBe('openToday');
  });

  it('handles the daylight-saving change in March', () => {
    // DST starts 2027-03-14; 11:30 p.m. EDT Mar 14 is 03:30Z Mar 15.
    const view = getSeasonView(season({ status: 'open' }), new Date('2027-03-15T03:30:00Z'));
    expect(view.today).toBe('2027-03-14');
  });

  it('ends the season after the last date even if left "open"', () => {
    const view = getSeasonView(season({ status: 'open' }), at('2027-03-20'));
    expect(view.phase).toBe('ended');
    expect(view.headline).toBe('The 2027 season has ended');
  });

  it('ends the season when an editor closes it', () => {
    expect(getSeasonView(season({ status: 'closed' }), at('2027-02-14')).phase).toBe('ended');
  });
});

describe('getReservationView', () => {
  const now = at('2026-12-01');

  it('does not offer booking before reservations are announced, even if OpenTable is configured', () => {
    const view = getReservationView(season(), configured, now);
    expect(view.canBook).toBe(false);
    expect(view.showHeaderCta).toBe(false);
    expect(view.message).toMatch(/haven’t been announced/);
  });

  it('shows a confirmed opening date without enabling booking', () => {
    const view = getReservationView(
      season({ reservations: { state: 'openingSoon', opensOn: '2027-01-15', tourRelationship: 'separate' } }),
      configured,
      now,
    );
    expect(view.canBook).toBe(false);
    expect(view.opensOn).toBe('2027-01-15');
    expect(view.message).toContain('Friday, January 15, 2027');
  });

  it('drops an opening date that has passed instead of implying booking is live', () => {
    const view = getReservationView(
      season({ reservations: { state: 'openingSoon', opensOn: '2027-01-15', tourRelationship: 'separate' } }),
      configured,
      at('2027-01-20'),
    );
    expect(view.opensOn).toBeUndefined();
    expect(view.canBook).toBe(false);
  });

  it('enables booking and the header action when open and configured', () => {
    const view = getReservationView(season({ reservations: { state: 'open', tourRelationship: 'separate' } }), configured, now);
    expect(view).toMatchObject({ canBook: true, showHeaderCta: true, misconfigured: false });
  });

  it('flags open-but-unconfigured without pretending booking works', () => {
    const view = getReservationView(season({ reservations: { state: 'open', tourRelationship: 'separate' } }), unconfigured, now);
    expect(view).toMatchObject({ canBook: false, showHeaderCta: false, misconfigured: true });
  });

  it('never says "sold out"', () => {
    for (const state of ['notAnnounced', 'openingSoon', 'open', 'closed'] as const) {
      for (const booking of [configured, unconfigured]) {
        const view = getReservationView(season({ reservations: { state, tourRelationship: 'separate' } }), booking, now);
        expect(`${view.headline} ${view.message}`.toLowerCase()).not.toContain('sold out');
      }
    }
  });

  it('lets editors override the message but not the booking logic', () => {
    const view = getReservationView(
      season({ reservations: { state: 'closed', message: 'See you next spring!', tourRelationship: 'separate' } }),
      configured,
      now,
    );
    expect(view.message).toBe('See you next spring!');
    expect(view.canBook).toBe(false);
  });
});

describe('getActiveNotice', () => {
  const notice = { message: 'Trails are icy', level: 'important' as const, expiresAt: '2027-02-14T17:00:00-05:00' };
  it('shows a notice until it expires', () => {
    expect(getActiveNotice(season({ notice }), at('2027-02-14', '16:59'))).toBeDefined();
    expect(getActiveNotice(season({ notice }), at('2027-02-14', '17:00'))).toBeUndefined();
  });
  it('ignores empty notices', () => {
    expect(getActiveNotice(season({ notice: { ...notice, message: '  ' } }), at('2027-02-01'))).toBeUndefined();
  });
});

describe('getPancakeHouseDates', () => {
  it('reuses the public dates instead of duplicating them', () => {
    expect(getPancakeHouseDates(season())).toBe(base.operatingDates);
  });
  it('returns nothing when not announced', () => {
    expect(getPancakeHouseDates(season({ pancakeHouse: { dateMode: 'notAnnounced' } }))).toBeUndefined();
  });
});
