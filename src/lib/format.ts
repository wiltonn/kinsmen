import type { Hours, LocalTime } from './content/types';

const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 2,
});

/** 8.25 -> "$8.25"; null -> "Included" */
export function formatPrice(price: number | null | undefined): string {
  if (price === null) return 'Included';
  if (price === undefined) return '';
  return currency.format(price);
}

/** "09:00" -> "9 a.m.", "16:30" -> "4:30 p.m." (Canadian Press style) */
export function formatTime(time: LocalTime): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time "${time}". Use 24-hour HH:MM.`);
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours === 12 && minutes === '00') return 'noon';
  const suffix = hours < 12 ? 'a.m.' : 'p.m.';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === '00' ? `${h12} ${suffix}` : `${h12}:${minutes} ${suffix}`;
}

export const formatHours = (hours: Hours) => `${formatTime(hours.opens)} to ${formatTime(hours.closes)}`;

/** "(519) 461-1073" -> "tel:+15194611073" */
export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `1${digits}` : digits;
  return `tel:+${withCountry}`;
}
