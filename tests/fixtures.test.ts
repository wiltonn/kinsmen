import { describe, expect, it } from 'vitest';
import { getFixtureContent } from '../src/lib/content/fixtures';
import { collectReviewItems } from '../src/lib/content/review';
import { applyScenario, SCENARIOS } from '../src/lib/scenarios';
import { isIsoDate, formatWeekdayRange } from '../src/lib/time';
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

  it('marks nothing as confirmed: fixtures are never verified facts', () => {
    expect(collectReviewItems(content).length).toBeGreaterThan(10);
    const serialized = JSON.stringify(content);
    expect(serialized).not.toContain('"provenance":"confirmed"');
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
