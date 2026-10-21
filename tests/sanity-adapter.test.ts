/**
 * End-to-end check that the Sanity seed export, the Studio schema shape and
 * the website's Sanity adapter agree: seed documents are dereferenced the way
 * SITE_QUERY does, mapped with mapSanityContent, and compared to fixtures.
 */
import { describe, expect, it } from 'vitest';
import { GET } from '../src/pages/dev/[seed]';
import { mapSanityContent } from '../src/lib/content/sanity';
import { getFixtureContent } from '../src/lib/content/fixtures';
import { collectReviewItems } from '../src/lib/content/review';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function seedDocs(): Promise<any[]> {
  const res = await (GET as any)({});
  return (await res.text()).trim().split('\n').map((line: string) => JSON.parse(line));
}

/** Emulates the dereferencing in SITE_QUERY for the seed documents. */
function emulateQuery(docs: any[]) {
  const byId = new Map(docs.map((d) => [d._id, d]));
  const deref = (r: any) => (r?._ref ? byId.get(r._ref) : undefined);
  const download = (d: any) => d && { ...d, url: `https://cdn.sanity.io/files/x/production/${d._id}.pdf`, size: 1_200_000 };
  const ofType = (t: string) => docs.filter((d) => d._type === t).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const settings = byId.get('siteSettings');
  const season = deref(settings.currentSeason);
  return {
    settings: {
      ...settings,
      images: {},
      languageResources: settings.languageResources.map(deref).map(download),
      season: {
        ...season,
        menu: deref(season.menu),
        faqs: season.faqs.map(deref),
        schoolTours: { ...season.schoolTours, downloads: season.schoolTours.downloads.map(deref).map(download) },
      },
    },
    booking: byId.get('bookingSettings'),
    kinsmen: byId.get('kinsmenPage'),
    experiences: ofType('experience'),
    faqs: ofType('faq'),
    products: ofType('mapleProduct'),
    purchaseLocations: ofType('purchaseLocation'),
    organizations: ofType('supportedOrganization'),
    stories: ofType('impactStory').map((s) => ({ ...s, image: undefined })),
  };
}

describe('Sanity adapter with seeded content', async () => {
  const docs = await seedDocs();
  const content = mapSanityContent(emulateQuery(docs), { projectId: 'test', dataset: 'production' });
  const fixtures = getFixtureContent();

  it('exports no sample content and imports everything as needs review', () => {
    expect(docs.every((d) => !d.reviewStatus || d.reviewStatus === 'needsReview')).toBe(true);
    expect(JSON.stringify(docs)).not.toMatch(/SAMPLE|\[Sample/);
  });

  it('round-trips the season facts', () => {
    expect(content.season?.year).toBe(2027);
    expect(content.season?.operatingDates).toEqual(fixtures.season?.operatingDates.map((d) => ({ ...d, note: undefined, label: d.label })));
    expect(content.season?.schoolTours?.dates.map((d) => d.startDate)).toEqual(fixtures.season?.schoolTours?.dates.map((d) => d.startDate));
    expect(content.season?.schoolTours?.pricing?.items).toEqual(fixtures.season?.schoolTours?.pricing?.items.map((i) => ({ ...i, description: undefined })));
    expect(content.season?.reservations.state).toBe('notAnnounced');
    expect(content.season?.reservations.tourRelationship).toBe('separate');
  });

  it('round-trips the menu and products', () => {
    const prices = (c: typeof content) => c.season?.menu?.categories.flatMap((cat) => cat.items.map((i) => `${i.name}:${i.price}`));
    expect(prices(content)).toEqual(prices(fixtures));
    expect(content.products.map((p) => p.variants)).toEqual(fixtures.products.map((p) => p.variants));
  });

  it('keeps contact details, enquiry routes and the land acknowledgement', () => {
    expect(content.settings.contact.phoneHref).toBe('tel:+15194611073');
    expect(content.settings.enquiries.volunteering.href).toBe(fixtures.settings.enquiries.volunteering.href);
    expect(content.settings.enquiries.volunteering.external).toBe(true);
    expect(content.settings.landAcknowledgement?.paragraphs).toEqual(fixtures.settings.landAcknowledgement?.paragraphs);
  });

  it('renders story rich text as HTML', () => {
    expect(content.stories[0].bodyHtml).toContain('<p>');
  });

  it('flags everything for review until an editor confirms it', () => {
    expect(collectReviewItems(content).every((i) => i.provenance === 'needsReview')).toBe(true);
    expect(collectReviewItems(content).length).toBeGreaterThan(20);
  });

  it('starts with OpenTable unconfigured', () => {
    expect(content.booking).toEqual({ bookingUrl: undefined, widgetEnabled: false, widgetLoaderUrl: undefined });
  });
});
