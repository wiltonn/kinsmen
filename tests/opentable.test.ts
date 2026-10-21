import { describe, expect, it } from 'vitest';
import { resolveBooking, validateBookingUrl, validateWidgetLoaderUrl } from '../src/lib/opentable';
import { checkBookingUrl, checkWidgetLoaderUrl } from '../studio/lib/opentableValidation';

// Format examples only — not the Sugar Bush's real restaurant ID.
const WIDGET =
  '//www.opentable.ca/widget/reservation/loader?rid=000000&type=standard&theme=standard&color=1&dark=false&iframe=true&domain=ca&lang=en-CA&newtab=false&ot_source=Restaurant%20website&cfe=true';

describe('validateBookingUrl', () => {
  it.each([
    'https://www.opentable.ca/r/example-restaurant',
    'https://www.opentable.com/restref/client/?rid=000000',
  ])('accepts OpenTable restaurant pages: %s', (url) => {
    expect(validateBookingUrl(url).ok).toBe(true);
  });

  it.each([
    ['http://www.opentable.ca/r/example', 'https'],
    ['https://opentable.example.com/r/x', 'OpenTable address'],
    ['https://www.opentable.ca.evil.test/r/x', 'OpenTable address'],
    ['javascript:alert(1)', 'https'],
    ['https://www.opentable.ca/', 'home page'],
    ['https://user:pw@www.opentable.ca/r/x', 'credentials'],
    ['not a url', 'valid'],
  ])('rejects %s', (url, message) => {
    const result = validateBookingUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('validateWidgetLoaderUrl', () => {
  it('accepts the official protocol-relative embed URL and normalises it to https', () => {
    const result = validateWidgetLoaderUrl(WIDGET);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.src.startsWith('https://www.opentable.ca/widget/reservation/loader?rid=000000')).toBe(true);
      expect(result.value.type).toBe('standard');
      expect(result.value.minHeight).toBeGreaterThan(200);
    }
  });

  it('drops unknown parameters with a warning', () => {
    const result = validateWidgetLoaderUrl(`${WIDGET}&onload=alert(1)`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.src).not.toContain('onload');
      expect(result.warnings[0]).toContain('onload');
    }
  });

  it.each([
    ['<script src="//www.opentable.ca/widget/reservation/loader?rid=1"></script>', ''],
    ['https://evil.test/widget/reservation/loader?rid=1', 'served by OpenTable'],
    ['https://www.opentable.ca/some/other/script.js?rid=1', 'loader'],
    ['https://www.opentable.ca/widget/reservation/loader?type=standard', 'restaurant ID'],
    ['https://www.opentable.ca/widget/reservation/loader?rid=abc', 'restaurant ID'],
    ['https://www.opentable.ca/widget/reservation/loader?rid=1&type=giant', 'Unsupported'],
  ])('rejects %s', (url, message) => {
    const result = validateWidgetLoaderUrl(url);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('resolveBooking', () => {
  it('is unconfigured with no values', () => {
    expect(resolveBooking({ widgetEnabled: false })).toMatchObject({ configured: false, issues: [] });
    expect(resolveBooking(undefined).configured).toBe(false);
  });

  it('uses a valid link as the booking path', () => {
    const r = resolveBooking({ bookingUrl: 'https://www.opentable.ca/r/example', widgetEnabled: false });
    expect(r).toMatchObject({ configured: true, bookingUrl: 'https://www.opentable.ca/r/example' });
    expect(r.widget).toBeUndefined();
  });

  it('ignores a widget URL unless the widget is enabled', () => {
    expect(resolveBooking({ widgetEnabled: false, widgetLoaderUrl: WIDGET }).widget).toBeUndefined();
  });

  it('reports an invalid link instead of using it', () => {
    const r = resolveBooking({ bookingUrl: 'https://example.com/book', widgetEnabled: false });
    expect(r.configured).toBe(false);
    expect(r.issues).toHaveLength(1);
  });

  it('warns when the widget has no fallback link', () => {
    const r = resolveBooking({ widgetEnabled: true, widgetLoaderUrl: WIDGET });
    expect(r.configured).toBe(true);
    expect(r.issues.join(' ')).toContain('fallback');
  });

  it('disables a broken widget but keeps the link', () => {
    const r = resolveBooking({ bookingUrl: 'https://www.opentable.ca/r/example', widgetEnabled: true, widgetLoaderUrl: 'https://evil.test/x' });
    expect(r.widget).toBeUndefined();
    expect(r.configured).toBe(true);
    expect(r.issues[0]).toContain('Widget disabled');
  });
});

describe('Studio and website validation agree', () => {
  const bookingSamples = [
    'https://www.opentable.ca/r/example',
    'https://opentable.com/r/x',
    'http://www.opentable.ca/r/example',
    'https://www.opentable.ca/',
    'https://example.com/r/x',
    'https://u:p@www.opentable.ca/r/x',
  ];
  it.each(bookingSamples)('booking URL %s', (url) => {
    expect(checkBookingUrl(url) === true).toBe(validateBookingUrl(url).ok);
  });

  const widgetSamples = [
    WIDGET,
    'https://www.opentable.com/widget/reservation/loader?rid=1&type=tall',
    'https://www.opentable.ca/widget/reservation/loader?rid=1&type=giant',
    'https://www.opentable.ca/widget/reservation/loader?type=standard',
    'https://evil.test/widget/reservation/loader?rid=1',
    'http://www.opentable.ca/widget/reservation/loader?rid=1',
  ];
  it.each(widgetSamples)('widget URL %s', (url) => {
    expect(checkWidgetLoaderUrl(url) === true).toBe(validateWidgetLoaderUrl(url).ok);
  });
});
