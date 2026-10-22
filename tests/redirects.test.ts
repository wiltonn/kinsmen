import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEGACY_HASHES, REDIRECTS, toCloudflareRedirects } from '../src/lib/redirects';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const PAGES = ['/', '/visit', '/pancake-house', '/school-group-tours', '/maple-products', '/faq', '/kinsmen', '/kinsmen/community-impact', '/kinsmen/get-involved', '/contact'];

describe('redirects', () => {
  it('vercel.json mirrors src/lib/redirects.ts', () => {
    expect(vercel.redirects).toEqual(
      REDIRECTS.map((r) => ({ source: r.from, destination: r.to, permanent: r.status === 301 })),
    );
  });

  it('every old Wix page and file is covered', () => {
    const froms = REDIRECTS.map((r) => r.from);
    for (const old of ['/menus', '/french', '/about-1', '/_files/ugd/17f70a_2f498428d478422c8eb9ef61e178dab3.pdf', '/_files/ugd/2c371f_2f011964cc3d4051b4181fce39f813a2.pdf']) {
      expect(froms).toContain(old);
    }
  });

  it('points only at real routes or files', () => {
    for (const target of [...REDIRECTS.map((r) => r.to), ...Object.values(LEGACY_HASHES)]) {
      const path = target.split('#')[0];
      const ok = PAGES.includes(path) || existsSync(new URL(`../public${path}`, import.meta.url));
      expect(ok, `${target} should exist`).toBe(true);
    }
  });

  it('formats Cloudflare _redirects lines', () => {
    expect(toCloudflareRedirects(REDIRECTS)).toContain('/menus /pancake-house#menu 301');
  });
});
