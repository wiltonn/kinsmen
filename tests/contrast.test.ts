import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** WCAG 2.x relative luminance and contrast ratio. */
const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
const token = (name: string) => {
  const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
  if (!match) throw new Error(`Missing colour token ${name}`);
  return match[1];
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const WHITE = '#ffffff';
// [foreground, background, minimum] for every text pairing the design uses.
const pairs: [string, string, number][] = [
  ['ink', 'cream-100', 4.5],
  ['ink', 'cream-50', 4.5],
  ['bark-700', 'cream-100', 4.5],
  ['bark-600', 'cream-50', 4.5],
  ['bark-600', 'cream-200', 4.5],
  ['maple-700', 'cream-100', 4.5], // links, eyebrows
  ['maple-700', 'cream-50', 4.5],
  ['maple-800', 'maple-100', 4.5], // date labels
  ['maple-800', 'maple-50', 4.5], // review flags
  ['forest-900', 'cream-100', 4.5],
  ['forest-700', 'cream-50', 4.5],
  ['cream-100', 'forest-900', 4.5], // dark sections
  ['maple-100', 'forest-900', 4.5],
  ['maple-100', 'forest-800', 4.5],
  ['forest-900', 'cream-50', 4.5], // light buttons
  ['alert-700', 'alert-50', 4.5],
  ['maple-600', 'cream-100', 3], // focus outline (non-text, 1.4.11)
  ['maple-300', 'forest-900', 3], // focus outline on dark
];

describe('colour contrast (WCAG 2.2 AA)', () => {
  it.each(pairs)('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it.each(['maple-700', 'maple-800', 'forest-700', 'forest-800', 'forest-900'])('white text on %s ≥ 4.5:1', (bg) => {
    expect(contrast(WHITE, token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
