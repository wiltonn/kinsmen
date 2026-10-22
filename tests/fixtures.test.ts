import { describe, expect, it } from 'vitest';
import { getFixtureContent } from '../src/lib/content/fixtures';
import { collectReviewItems } from '../src/lib/content/review';
import { applyScenario, SCENARIOS } from '../src/lib/scenarios';
import { expandDateBlocks, isIsoDate, formatWeekdayRange } from '../src/lib/time';
import { resolveBooking } from '../src/lib/opentable';

const content = getFixtureContent();

describe('fixture content', () => {
  it('has valid dates everywhere', () => {
    const blocks = [...content.season!.operatingDates, ...content.season!.schoolTours!.dates];
    for (const b of blocks) {
      expect(isIsoDate(b.startDate)).toBe(true);
      if (b.endDate) expect(isIsoDate(b.endDate)).toBe(true);
    }
  });

  it('matches the weekdays published on the old site', () => {
    // Old site: Family Day weekend Feb 13–15 (Sat – Mon), March Break Mar 15–19 (Mon – Fri).
    const [familyDay, , , , marchBreak] = content.season!.operatingDates;
    expect(formatWeekdayRange(familyDay)).toBe('Sat – Mon');
    expect(formatWeekdayRange(marchBreak)).toBe('Mon – Fri');
    // School tours were Tuesdays and Thursdays.
    for (const d of content.season!.schoolTours!.dates) expect(['Tue', 'Thu']).toContain(formatWeekdayRange(d));
  });

  it('confirms only the club-supplied dates', () => {
    expect(content.season!.provenance).toBe('confirmed');
    expect(collectReviewItems(content).length).toBeGreaterThan(10);
    // Everything else copied from the old site still needs review.
    expect(content.season!.menu!.provenance).toBe('needsReview');
    expect(content.season!.schoolTours!.provenance).toBe('needsReview');
    expect(content.settings.contact.provenance).toBe('needsReview');
  });

  it('matches the 2027 dates supplied by the club (21 Oct 2026)', () => {
    const blocks = content.season!.operatingDates.map((b) => [b.label ?? '', b.startDate, b.endDate ?? b.startDate]);
    expect(blocks).toEqual([
      ['Family Day weekend', '2027-02-13', '2027-02-15'],
      ['', '2027-02-27', '2027-02-28'],
      ['', '2027-03-06', '2027-03-07'],
      ['', '2027-03-13', '2027-03-14'],
      ['March Break', '2027-03-15', '2027-03-19'],
      ['', '2027-03-20', '2027-03-21'],
    ]);
    expect(content.season!.schoolTours!.dates.map((d) => d.startDate)).toEqual([
      '2027-02-23', '2027-02-25', '2027-03-02', '2027-03-04', '2027-03-09', '2027-03-11', '2027-03-23', '2027-03-25',
    ]);
  });

  it('keeps school days separate from public days', () => {
    const publicDays = new Set(expandDateBlocks(content.season!.operatingDates));
    for (const d of content.season!.schoolTours!.dates) expect(publicDays.has(d.startDate)).toBe(false);
  });

  it('invents no hours, admission prices or OpenTable details', () => {
    expect(content.season!.operatingHours).toBeUndefined();
    expect(content.season!.admission).toBeUndefined();
    expect(content.season!.pancakeHouse.servingHours).toBeUndefined();
    expect(resolveBooking(content.booking).configured).toBe(false);
  });

  it('labels every scenario as sample content', () => {
    for (const name of SCENARIOS.filter((s) => s !== 'default')) {
      expect(applyScenario(content, name).season!.provenance).toBe('sample');
    }
    expect(() => applyScenario(content, 'bogus')).toThrow();
  });
});
