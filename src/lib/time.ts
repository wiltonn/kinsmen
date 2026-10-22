/**
 * Date helpers. All visitor-facing dates are calendar dates in Ontario, so
 * everything time-sensitive is evaluated in America/Toronto regardless of
 * where the site is built or viewed.
 */
import type { DateBlock, IsoDate } from './content/types';

export const SITE_TIME_ZONE = 'America/Toronto';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's calendar date in Toronto, as `YYYY-MM-DD`. */
export function torontoDate(now: Date): IsoDate {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SITE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Noon UTC on the given calendar date: safe for weekday/month formatting. */
function toUtcNoon(iso: IsoDate): Date {
  if (!isIsoDate(iso)) throw new Error(`Invalid date "${iso}". Use YYYY-MM-DD.`);
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toUtcNoon(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Every calendar date covered by a block, inclusive. */
export function expandDateBlock(block: DateBlock): IsoDate[] {
  const end = block.endDate ?? block.startDate;
  if (end < block.startDate) {
    throw new Error(`Date block ends (${end}) before it starts (${block.startDate}).`);
  }
  const dates: IsoDate[] = [];
  for (let d = block.startDate; d <= end; d = addDays(d, 1)) dates.push(d);
  return dates;
}

/** Sorted, de-duplicated list of every date in the blocks. */
export function expandDateBlocks(blocks: DateBlock[]): IsoDate[] {
  return [...new Set(blocks.flatMap(expandDateBlock))].sort();
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...options });

const weekdayShort = fmt({ weekday: 'short' });
const weekdayLong = fmt({ weekday: 'long' });
const monthDay = fmt({ month: 'short', day: 'numeric' });
const monthDayLong = fmt({ month: 'long', day: 'numeric' });
const fullDate = fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export const formatWeekday = (iso: IsoDate, style: 'short' | 'long' = 'short') =>
  (style === 'short' ? weekdayShort : weekdayLong).format(toUtcNoon(iso));

/** "Feb 13" */
export const formatMonthDay = (iso: IsoDate) => monthDay.format(toUtcNoon(iso));
/** "February 13" */
export const formatMonthDayLong = (iso: IsoDate) => monthDayLong.format(toUtcNoon(iso));
/** "Saturday, February 13, 2027" */
export const formatFullDate = (iso: IsoDate) => fullDate.format(toUtcNoon(iso));

/** "Feb 13 – 15", "Feb 27 – Mar 1", or "Mar 6" */
export function formatDateRange(block: DateBlock): string {
  const end = block.endDate ?? block.startDate;
  if (end === block.startDate) return formatMonthDay(block.startDate);
  const sameMonth = block.startDate.slice(0, 7) === end.slice(0, 7);
  const endLabel = sameMonth ? String(Number(end.slice(8, 10))) : formatMonthDay(end);
  return `${formatMonthDay(block.startDate)} – ${endLabel}`;
}

/** "Sat – Mon" or "Sat" */
export function formatWeekdayRange(block: DateBlock): string {
  const end = block.endDate ?? block.startDate;
  const start = formatWeekday(block.startDate);
  return end === block.startDate ? start : `${start} – ${formatWeekday(end)}`;
}

/** Machine-readable range for <time datetime>. */
export const dateRangeLabelForScreenReaders = (block: DateBlock): string => {
  const end = block.endDate ?? block.startDate;
  return end === block.startDate
    ? formatFullDate(block.startDate)
    : `${formatFullDate(block.startDate)} to ${formatFullDate(end)}`;
};

/** Parse an ISO date-time (with offset or Z). Returns undefined if invalid. */
export function parseInstant(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}
