/**
 * The one entry point pages use for content.
 *
 *   const content = await getContent();
 *
 * Chooses Sanity or local fixtures (see src/lib/config.ts), caches the result
 * for the whole build, and reports unconfirmed content.
 */
import { getConfig } from '../config';
import { getFixtureContent } from './fixtures';
import { getSanityContent } from './sanity';
import { collectReviewItems } from './review';
import type { SiteContent } from './types';

let pending: Promise<SiteContent> | undefined;

async function load(): Promise<SiteContent> {
  const config = getConfig();
  const content =
    config.contentSource === 'sanity' ? await getSanityContent(config) : getFixtureContent(config.fixtureBooking);

  const review = collectReviewItems(content);
  const samples = review.filter((i) => i.provenance === 'sample');
  if (config.isProduction && samples.length) {
    throw new Error(`Production build contains sample content: ${samples.map((s) => s.label).join(', ')}`);
  }
  if (review.length) {
    const header = `[content] ${review.length} item(s) not yet confirmed (source: ${content.source}).`;
    if (config.isProduction && config.strictReview) {
      throw new Error(`${header} STRICT_CONTENT_REVIEW is on:\n${review.map((i) => ` - ${i.area}: ${i.label}`).join('\n')}`);
    }
    console.warn(`${header} See /dev/content-review in a non-production build, or docs/content-checklist.md.`);
  }
  return content;
}

export function getContent(): Promise<SiteContent> {
  pending ??= load();
  return pending;
}

export type * from './types';
