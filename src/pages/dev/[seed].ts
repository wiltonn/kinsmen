/**
 * Preview-only: exports the migrated fixture content as Sanity NDJSON, so the
 * club doesn't retype menus and dates. Documents keep their review status
 * (only club-confirmed facts arrive as "Confirmed"). Sample content is never exported.
 *
 *   CONTENT_SOURCE=fixtures npm run build
 *   cd studio && npx sanity dataset import ../dist/dev/sanity-seed.ndjson production
 *
 * Not generated in production builds. See docs/launch-checklist.md.
 */
import type { APIRoute } from 'astro';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { getConfig } from '../../lib/config';
import { getFixtureContent } from '../../lib/content/fixtures';
import type { DateBlock, Download, Faq, PriceList, Reviewable, SiteImage } from '../../lib/content/types';

// A dynamic route so production builds can skip it entirely.
export function getStaticPaths() {
  return getConfig().isProduction ? [] : [{ params: { seed: 'sanity-seed.ndjson' } }];
}

const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const notSample = <T extends Reviewable>(item: T) => item.provenance !== 'sample';
const review = (item?: Reviewable) => ({
  reviewStatus: item?.provenance === 'confirmed' ? 'confirmed' : 'needsReview',
  reviewNote: item?.reviewNote,
});
const key = (i: number) => `k${i}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const ref = (id: string, i?: number) => ({ _type: 'reference', _ref: id, ...(i !== undefined ? { _key: key(i) } : {}) });

const dates = (blocks: DateBlock[] | undefined) =>
  (blocks ?? []).map((b, i) => ({ _type: 'dateBlock', _key: key(i), startDate: b.startDate, endDate: b.endDate, label: b.label, note: b.note }));

const priceList = (list: PriceList | undefined) =>
  list && {
    _type: 'priceList',
    title: list.title,
    intro: list.intro,
    footnote: list.footnote,
    items: list.items.map((item, i) => ({
      _type: 'priceItem',
      _key: key(i),
      label: item.label,
      price: item.price ?? undefined,
      included: item.price === null ? true : undefined,
      description: item.description,
    })),
  };

/** Local images are uploaded by `sanity dataset import` from the file path. */
const image = (img: SiteImage | undefined) => {
  if (!img || img.kind !== 'local') return undefined;
  // Astro gives image metadata; plain Vite (unit tests) gives a URL string.
  const src: string = typeof img.asset === 'string' ? img.asset : img.asset.src;
  const file = src.split('/').pop()!.split('?')[0].replace(/\.[^.]+\.(jpg|jpeg|png)$/, '.$1');
  const path = resolve(root, 'src/assets/images', file);
  return { _type: 'accessibleImage', _sanityAsset: `image@file://${path}`, alt: img.alt };
};

const download = (d: Download) => ({
  _id: `download-${slug(d.title)}`,
  _type: 'download',
  title: d.title,
  description: d.description,
  file: { _type: 'file', _sanityAsset: `file@file://${resolve(root, 'public', d.url.replace(/^\//, ''))}` },
  language: d.language,
  languageLabel: d.languageLabel,
  year: d.year,
  ...review(d),
});

const faqDoc = (f: Faq, i: number) => ({
  _id: `faq-${slug(f.question)}`,
  _type: 'faq',
  question: f.question,
  answer: f.answer.join('\n\n'),
  topic: f.topic,
  order: i,
  ...review(f),
});

export const GET: APIRoute = () => {
  const c = getFixtureContent();
  const season = c.season!;
  const docs: Record<string, unknown>[] = [];

  const downloads = [...(season.schoolTours?.downloads ?? []), ...c.languageResources].filter(notSample).map(download);
  docs.push(...downloads);
  const seasonFaqs = season.faqs.filter(notSample).map(faqDoc);
  const generalFaqs = c.generalFaqs.filter(notSample).map((f, i) => faqDoc(f, i + seasonFaqs.length));
  docs.push(...seasonFaqs, ...generalFaqs);

  if (season.menu) {
    docs.push({
      _id: `menu-${season.year}`,
      _type: 'menu',
      title: season.menu.title,
      intro: season.menu.intro,
      categories: season.menu.categories.map((cat, i) => ({
        _type: 'menuCategory',
        _key: key(i),
        title: cat.title,
        description: cat.description,
        items: cat.items.map((item, j) => ({
          _type: 'menuItem',
          _key: key(j),
          name: item.name,
          description: item.description,
          price: item.price,
          variants: item.variants?.map((v, k) => ({ _type: 'sizePrice', _key: key(k), ...v })),
        })),
      })),
      ...review(season.menu),
    });
  }

  docs.push({
    _id: `season-${season.year}`,
    _type: 'season',
    year: season.year,
    status: season.status,
    operatingDates: dates(season.operatingDates),
    pancakeHouse: { dateMode: season.pancakeHouse.dateMode, dates: dates(season.pancakeHouse.dates) },
    admission: priceList(season.admission),
    menu: season.menu ? ref(`menu-${season.year}`) : undefined,
    reservations: { ...season.reservations },
    schoolTours: season.schoolTours && {
      intro: season.schoolTours.intro,
      dates: dates(season.schoolTours.dates),
      pricing: priceList(season.schoolTours.pricing),
      howToBook: season.schoolTours.howToBook,
      paymentNote: season.schoolTours.paymentNote,
      downloads: season.schoolTours.downloads.filter(notSample).map((d, i) => ref(`download-${slug(d.title)}`, i)),
    },
    faqs: seasonFaqs.map((f, i) => ref(f._id, i)),
    ...review(season),
  });

  const s = c.settings;
  const route = (r: (typeof s.enquiries)['general']) => ({ _type: 'enquiryRoute', label: r.label, description: r.description, href: r.href, actionLabel: r.actionLabel });
  docs.push({
    _id: 'siteSettings',
    _type: 'siteSettings',
    currentSeason: ref(`season-${season.year}`),
    siteName: s.siteName,
    organizationName: s.organizationName,
    description: s.description,
    facebookUrl: s.facebookUrl,
    languageResources: c.languageResources.filter(notSample).map((d, i) => ref(`download-${slug(d.title)}`, i)),
    contact: {
      phone: s.contact.phone,
      email: s.contact.email,
      addressLines: s.contact.addressLines,
      locality: s.contact.locality,
      region: s.contact.region,
      postalCode: s.contact.postalCode,
      mapUrl: s.contact.mapUrl,
      directions: s.contact.directions?.join('\n\n'),
    },
    enquiries: {
      general: route(s.enquiries.general),
      schoolTours: route(s.enquiries.schoolTours),
      volunteering: route(s.enquiries.volunteering),
      membership: route(s.enquiries.membership),
    },
    images: Object.fromEntries(Object.entries(c.images).map(([k, v]) => [k, image(v)]).filter(([, v]) => v)),
    landAcknowledgement: s.landAcknowledgement && { text: s.landAcknowledgement.paragraphs.join('\n\n'), closing: s.landAcknowledgement.closing },
    ...review(s.contact),
  });

  docs.push({ _id: 'bookingSettings', _type: 'bookingSettings', widgetEnabled: false });

  c.experiences.filter(notSample).forEach((e, i) =>
    docs.push({ _id: `experience-${slug(e.title)}`, _type: 'experience', title: e.title, body: e.body, bookingNote: e.bookingNote, order: i, ...review(e) }),
  );
  c.products.filter(notSample).forEach((p, i) =>
    docs.push({
      _id: `product-${slug(p.name)}`,
      _type: 'mapleProduct',
      name: p.name,
      description: p.description,
      category: p.category,
      variants: p.variants.map((v, k) => ({ _type: 'sizePrice', _key: key(k), ...v })),
      order: i,
      ...review(p),
    }),
  );
  c.purchaseLocations.filter(notSample).forEach((l, i) =>
    docs.push({ _id: `place-${slug(l.name)}`, _type: 'purchaseLocation', name: l.name, when: l.when, address: l.address, url: l.url, order: i, ...review(l) }),
  );
  c.organizations.filter(notSample).forEach((o, i) =>
    docs.push({ _id: `org-${slug(o.name)}`, _type: 'supportedOrganization', name: o.name, url: o.url, description: o.description, order: i, ...review(o) }),
  );
  c.stories.filter(notSample).forEach((st, i) =>
    docs.push({
      _id: `story-${slug(st.title)}`,
      _type: 'impactStory',
      title: st.title,
      body: st.body.map((text, j) => ({
        _type: 'block',
        _key: key(j),
        style: 'normal',
        markDefs: [],
        children: [{ _type: 'span', _key: `${key(j)}s`, text, marks: [] }],
      })),
      image: image(st.image),
      order: i,
      ...review(st),
    }),
  );

  const k = c.kinsmen;
  docs.push({
    _id: 'kinsmenPage',
    _type: 'kinsmenPage',
    intro: k.intro.join('\n\n'),
    clubFacts: k.clubFacts.items.map((f, i) => ({ _type: 'fact', _key: key(i), ...f })),
    recognition: k.recognition.map((r, i) => ({ _type: 'award', _key: key(i), title: r.title, body: r.body })),
    volunteeringIntro: k.volunteering.intro.join('\n\n'),
    volunteeringReasons: k.volunteering.reasons.map((r, i) => ({ _type: 'reason', _key: key(i), ...r })),
    membershipIntro: k.membership.intro.join('\n\n'),
    membershipSteps: k.membership.steps,
    ...review(k.volunteering),
  });

  const body = docs.map((d) => JSON.stringify(d)).join('\n') + '\n';
  return new Response(body, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
};
