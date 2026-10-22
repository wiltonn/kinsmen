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
  ['ink', 'paper-50', 4.5],
  ['ink', 'paper-100', 4.5],
  ['ink', 'paper-200', 4.5],
  ['smoke-700', 'paper-100', 4.5],
  ['smoke-700', 'paper-200', 4.5],
  ['smoke-600', 'paper-50', 4.5],
  ['smoke-600', 'paper-200', 4.5],
  ['kin-500', 'paper-50', 3], // h1/h2 in brand red: large text only
  ['kin-500', 'paper-100', 3],
  ['kin-500', 'paper-200', 3],
  ['kin-600', 'paper-50', 4.5], // links, eyebrows, small red text
  ['kin-600', 'paper-100', 4.5],
  ['kin-600', 'paper-200', 4.5],
  ['kin-700', 'paper-50', 4.5], // secondary button text
  ['kin-800', 'kin-100', 4.5], // date labels
  ['kin-800', 'kin-50', 4.5], // review flags
  ['plum-700', 'paper-50', 4.5], // activity notes
  ['paper-100', 'plum-800', 4.5], // purple panels
  ['kin-100', 'plum-800', 4.5],
  ['kin-100', 'kin-700', 4.5], // footer headings
  ['ink', 'paper-50', 4.5], // light buttons
  ['alert-700', 'alert-50', 4.5],
  ['plum-700', 'paper-50', 3], // focus outline (non-text, 1.4.11)
  ['plum-700', 'paper-200', 3],
  ['go', 'paper-50', 3], // "open" status dot (non-text)
];

describe('colour contrast (WCAG 2.2 AA)', () => {
  it.each(pairs)('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it.each(['kin-700', 'kin-800', 'plum-700', 'plum-800', 'plum-900'])('white text on %s ≥ 4.5:1', (bg) => {
    expect(contrast(WHITE, token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
