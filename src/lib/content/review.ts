/**
 * Collects every piece of content that is not yet confirmed, so editors can
 * see what still needs checking (build log + the /dev/content-review page in
 * non-production builds).
 */
import type { Provenance, Reviewable, SiteContent } from './types';

export interface ReviewItem {
  area: string;
  label: string;
  provenance: Exclude<Provenance, 'confirmed'>;
  note?: string;
}

export function collectReviewItems(content: SiteContent): ReviewItem[] {
  const items: ReviewItem[] = [];
  const add = (area: string, label: string, r: Reviewable | undefined) => {
    if (r && r.provenance !== 'confirmed') items.push({ area, label, provenance: r.provenance, note: r.reviewNote });
  };

  const { settings, season } = content;
  add('Contact', 'Contact details', settings.contact);
  add('Kinsmen', 'Land acknowledgement', settings.landAcknowledgement);

  if (season) {
    add('Season', `${season.year} season dates and details`, season);
    add('Pancake House', season.menu?.title ?? 'Menu', season.menu);
    add('School tours', 'School tour details', season.schoolTours);
    add('School tours', 'School tour pricing', season.schoolTours?.pricing);
    season.schoolTours?.downloads.forEach((d) => add('Downloads', d.title, d));
    season.faqs.forEach((f) => add('FAQ', f.question, f));
  } else {
    items.push({ area: 'Season', label: 'Current season', provenance: 'needsReview', note: 'No current season is selected in Site settings.' });
  }

  content.experiences.forEach((e) => add('Experience', e.title, e));
  content.generalFaqs.forEach((f) => add('FAQ', f.question, f));
  content.products.forEach((p) => add('Maple products', p.name, p));
  content.purchaseLocations.forEach((l) => add('Where to buy', l.name, l));
  content.organizations.forEach((o) => add('Community impact', o.name, o));
  content.stories.forEach((s) => add('Community impact', s.title, s));
  add('Kinsmen', 'Kin Canada facts', content.kinsmen.clubFacts);
  content.kinsmen.recognition.forEach((r) => add('Kinsmen', r.title, r));
  add('Get involved', 'Volunteering', content.kinsmen.volunteering);
  add('Get involved', 'Membership', content.kinsmen.membership);
  content.languageResources.forEach((d) => add('Downloads', d.title, d));

  // De-duplicate FAQs that appear both on the season and in the general list.
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.area}|${i.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
