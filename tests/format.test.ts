import { describe, expect, it } from 'vitest';
import { formatPrice, formatTime, phoneHref } from '../src/lib/format';
import { expandDateBlocks, formatDateRange, formatWeekdayRange, isIsoDate, torontoDate } from '../src/lib/time';

describe('format', () => {
  it('formats Canadian prices', () => {
    expect(formatPrice(8.25)).toBe('$8.25');
    expect(formatPrice(9)).toBe('$9.00');
    expect(formatPrice(null)).toBe('Included');
  });
  it('formats times in Canadian Press style', () => {
    expect(formatTime('09:00')).toBe('9 a.m.');
    expect(formatTime('16:30')).toBe('4:30 p.m.');
    expect(formatTime('12:00')).toBe('noon');
    expect(() => formatTime('9am')).toThrow();
  });
  it('builds tel: links', () => {
    expect(phoneHref('(519) 461-1073')).toBe('tel:+15194611073');
  });
});

describe('time', () => {
  it('validates ISO dates', () => {
    expect(isIsoDate('2027-02-13')).toBe(true);
    expect(isIsoDate('2027-02-30')).toBe(false);
    expect(isIsoDate('Feb 13')).toBe(false);
  });
  it('expands and de-duplicates ranges', () => {
    expect(expandDateBlocks([{ startDate: '2027-02-27', endDate: '2027-03-01' }, { startDate: '2027-02-28' }])).toEqual([
      '2027-02-27',
      '2027-02-28',
      '2027-03-01',
    ]);
  });
  it('labels ranges and weekdays like the old site', () => {
    expect(formatDateRange({ startDate: '2027-02-13', endDate: '2027-02-15' })).toBe('Feb 13 – 15');
    expect(formatWeekdayRange({ startDate: '2027-02-13', endDate: '2027-02-15' })).toBe('Sat – Mon');
    expect(formatWeekdayRange({ startDate: '2027-03-15', endDate: '2027-03-19' })).toBe('Mon – Fri');
    expect(formatDateRange({ startDate: '2027-02-27', endDate: '2027-03-01' })).toBe('Feb 27 – Mar 1');
  });
  it('rejects backwards ranges', () => {
    expect(() => expandDateBlocks([{ startDate: '2027-03-02', endDate: '2027-03-01' }])).toThrow();
  });
  it('computes the Toronto date', () => {
    expect(torontoDate(new Date('2027-01-01T04:59:00Z'))).toBe('2026-12-31');
    expect(torontoDate(new Date('2027-01-01T05:00:00Z'))).toBe('2027-01-01');
  });
});

describe('pagePath', async () => {
  const { pagePath, isCurrent } = await import('../src/lib/navigation');
  it('strips build file extensions', () => {
    expect(pagePath('/visit.html')).toBe('/visit');
    expect(pagePath('/kinsmen/get-involved.html')).toBe('/kinsmen/get-involved');
    expect(pagePath('/index.html')).toBe('/');
    expect(pagePath('/')).toBe('/');
    expect(isCurrent('/kinsmen.html', '/kinsmen')).toBe(true);
    expect(isCurrent('/kinsmen/get-involved.html', '/kinsmen')).toBe(false);
  });
});
