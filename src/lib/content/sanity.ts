/**
 * Sanity content adapter. Runs only at build time: the published site is
 * static HTML, so publishing in Sanity triggers a rebuild (see README).
 *
 * Queries return raw documents; `map*` functions normalise them into the
 * shared types so pages behave identically with fixtures or Sanity.
 */
import { createClient } from '@sanity/client';
import { createImageUrlBuilder } from '@sanity/image-url';
import { escapeHTML, toHTML, uriLooksSafe } from '@portabletext/to-html';
import type {
  ContactDetails,
  DateBlock,
  Download,
  EnquiryRoute,
  Faq,
  Hours,
  Menu,
  PriceList,
  Provenance,
  Season,
  SiteContent,
  SiteImage,
} from './types';
import { phoneHref } from '../format';
import type { RuntimeConfig } from '../config';

/* eslint-disable @typescript-eslint/no-explicit-any -- raw GROQ results are untyped */
type Raw = any;

const IMAGE = `{ ..., "alt": alt, "credit": credit, "caption": caption, asset->{ _id, url, metadata { dimensions { width, height } } } }`;
const DOWNLOAD = `{ _id, title, description, language, languageLabel, year, reviewStatus, reviewNote, "url": file.asset->url, "size": file.asset->size }`;
const FAQ = `{ _id, question, answer, topic, reviewStatus, reviewNote }`;

export const SITE_QUERY = `{
  "settings": *[_id == "siteSettings"][0]{
    ...,
    "languageResources": languageResources[]->${DOWNLOAD},
    "images": images{
      "hero": hero${IMAGE}, "pancakeHouse": pancakeHouse${IMAGE}, "experience": experience${IMAGE},
      "schoolTours": schoolTours${IMAGE}, "products": products${IMAGE}, "community": community${IMAGE},
      "volunteers": volunteers${IMAGE}
    },
    "season": currentSeason->{
      ...,
      "menu": menu->,
      "faqs": faqs[]->${FAQ},
      "schoolTours": schoolTours{ ..., "downloads": downloads[]->${DOWNLOAD} }
    }
  },
  "booking": *[_id == "bookingSettings"][0],
  "kinsmen": *[_id == "kinsmenPage"][0],
  "experiences": *[_type == "experience"] | order(order asc, title asc),
  "faqs": *[_type == "faq"] | order(order asc, question asc)${FAQ},
  "products": *[_type == "mapleProduct"] | order(order asc, name asc),
  "purchaseLocations": *[_type == "purchaseLocation"] | order(order asc, name asc),
  "organizations": *[_type == "supportedOrganization"] | order(order asc, name asc),
  "stories": *[_type == "impactStory"] | order(order asc, _createdAt desc){ ..., "image": image${IMAGE} }
}`;

const provenance = (doc: Raw): Provenance => (doc?.reviewStatus === 'confirmed' ? 'confirmed' : 'needsReview');
const reviewable = (doc: Raw) => ({ provenance: provenance(doc), reviewNote: doc?.reviewNote || undefined });

/** Split a plain-text field into paragraphs on blank lines. */
export const paragraphs = (text: string | undefined): string[] =>
  (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const list = <T>(value: T[] | undefined | null): T[] => (Array.isArray(value) ? value.filter(Boolean) : []);

function mapDateBlocks(raw: Raw): DateBlock[] {
  return list<Raw>(raw).map((b) => ({
    label: b.label || undefined,
    startDate: b.startDate,
    endDate: b.endDate || undefined,
    note: b.note || undefined,
  }));
}

const mapHours = (raw: Raw): Hours | undefined =>
  raw?.opens && raw?.closes ? { opens: raw.opens, closes: raw.closes, note: raw.note || undefined } : undefined;

function mapPriceList(raw: Raw, parent: Raw): PriceList | undefined {
  const items = list<Raw>(raw?.items).map((i) => ({
    label: i.label,
    price: i.included ? null : (i.price ?? null),
    description: i.description || undefined,
  }));
  if (!items.length) return undefined;
  return { ...reviewable(parent), title: raw.title || 'Prices', intro: raw.intro || undefined, items, footnote: raw.footnote || undefined };
}

function mapMenu(raw: Raw): Menu | undefined {
  if (!raw) return undefined;
  return {
    ...reviewable(raw),
    title: raw.title || 'Pancake House menu',
    intro: raw.intro || undefined,
    categories: list<Raw>(raw.categories).map((c) => ({
      title: c.title,
      description: c.description || undefined,
      items: list<Raw>(c.items).map((i) => ({
        name: i.name,
        description: i.description || undefined,
        price: i.price ?? undefined,
        variants: list<Raw>(i.variants).map((v) => ({ label: v.label, price: v.price })),
        dietaryNote: i.dietaryNote || undefined,
      })),
    })),
  };
}

const mapFaq = (raw: Raw): Faq => ({
  ...reviewable(raw),
  id: raw._id,
  question: raw.question,
  answer: paragraphs(raw.answer),
  topic: raw.topic ?? 'visit',
});

function formatBytes(bytes: number | undefined): string | undefined {
  if (!bytes) return undefined;
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

const mapDownload = (raw: Raw): Download | undefined =>
  raw?.url
    ? {
        ...reviewable(raw),
        title: raw.title,
        description: raw.description || undefined,
        url: raw.url,
        language: raw.language || 'en',
        languageLabel: raw.languageLabel || 'English',
        fileSizeLabel: formatBytes(raw.size),
        year: raw.year || undefined,
      }
    : undefined;

function mapSeason(raw: Raw): Season | undefined {
  if (!raw?.year) return undefined;
  const school = raw.schoolTours;
  return {
    ...reviewable(raw),
    year: raw.year,
    status: raw.status ?? 'upcoming',
    operatingDates: mapDateBlocks(raw.operatingDates),
    operatingHours: mapHours(raw.operatingHours),
    operatingNote: raw.operatingNote || undefined,
    pancakeHouse: {
      dateMode: raw.pancakeHouse?.dateMode ?? 'notAnnounced',
      dates: mapDateBlocks(raw.pancakeHouse?.dates),
      servingHours: mapHours(raw.pancakeHouse?.servingHours),
      note: raw.pancakeHouse?.note || undefined,
    },
    admission: mapPriceList(raw.admission, raw),
    menu: mapMenu(raw.menu),
    reservations: {
      state: raw.reservations?.state ?? 'notAnnounced',
      opensOn: raw.reservations?.opensOn || undefined,
      message: raw.reservations?.message || undefined,
      tourRelationship: raw.reservations?.tourRelationship ?? 'unconfirmed',
      tourRelationshipNote: raw.reservations?.tourRelationshipNote || undefined,
    },
    notice: raw.notice?.message
      ? {
          message: raw.notice.message,
          level: raw.notice.level === 'important' ? 'important' : 'info',
          expiresAt: raw.notice.expiresAt || undefined,
          linkLabel: raw.notice.linkLabel || undefined,
          linkUrl: raw.notice.linkUrl || undefined,
        }
      : undefined,
    schoolTours: school
      ? {
          ...reviewable(raw),
          intro: school.intro || undefined,
          dates: mapDateBlocks(school.dates),
          hours: mapHours(school.hours),
          pricing: mapPriceList(school.pricing, raw),
          howToBook: school.howToBook || '',
          paymentNote: school.paymentNote || undefined,
          downloads: list<Raw>(school.downloads).map(mapDownload).filter((d): d is Download => Boolean(d)),
        }
      : undefined,
    faqs: list<Raw>(raw.faqs).map(mapFaq),
  };
}

function mapRoute(raw: Raw, fallback: Omit<EnquiryRoute, 'href'>): EnquiryRoute {
  const href: string | undefined = raw?.href || undefined;
  return {
    label: raw?.label || fallback.label,
    description: raw?.description || fallback.description,
    actionLabel: raw?.actionLabel || fallback.actionLabel,
    href,
    external: href?.startsWith('http') ?? false,
  };
}

export async function getSanityContent(config: RuntimeConfig): Promise<SiteContent> {
  if (!config.sanity) throw new Error('Sanity is not configured.');
  const { apiHost, ...sanity } = config.sanity;
  const client = createClient({
    ...sanity,
    ...(apiHost ? { apiHost, useProjectHostname: false } : {}),
    useCdn: false,
    perspective: 'published',
  });
  const data: Raw = await client.fetch(SITE_QUERY);
  return mapSanityContent(data, config.sanity);
}

/** Normalise the SITE_QUERY result. Pure, so it can be tested without Sanity. */
export function mapSanityContent(data: Raw, project: { projectId: string; dataset: string }): SiteContent {
  const builder = createImageUrlBuilder({ projectId: project.projectId, dataset: project.dataset });

  const mapImage = (raw: Raw): SiteImage | undefined => {
    const dims = raw?.asset?.metadata?.dimensions;
    if (!raw?.asset?._id || !dims) return undefined;
    const widths = [480, 800, 1200, 1600, 2000].filter((w) => w <= dims.width);
    const urlFor = (w: number) => builder.image(raw).width(w).auto('format').quality(75).url();
    return {
      kind: 'remote',
      url: urlFor(Math.min(1600, dims.width)),
      width: dims.width,
      height: dims.height,
      srcset: (widths.length ? widths : [dims.width]).map((w) => `${urlFor(w)} ${w}w`).join(', '),
      alt: raw.alt ?? '',
      credit: raw.credit || undefined,
      caption: raw.caption || undefined,
    };
  };

  const s: Raw = data.settings;
  if (!s) throw new Error('Sanity has no "Site settings" document. Create and publish it in the Studio.');

  const contact: ContactDetails = {
    ...reviewable(s),
    phone: s.contact?.phone ?? '',
    phoneHref: s.contact?.phone ? phoneHref(s.contact.phone) : '',
    email: s.contact?.email ?? '',
    addressLines: list<string>(s.contact?.addressLines),
    locality: s.contact?.locality ?? '',
    region: s.contact?.region ?? 'ON',
    postalCode: s.contact?.postalCode ?? '',
    mapUrl: s.contact?.mapUrl || undefined,
    directions: paragraphs(s.contact?.directions),
    parking: s.contact?.parking || undefined,
  };

  const k: Raw = data.kinsmen ?? {};
  const images = s.images ?? {};

  return {
    source: 'sanity',
    settings: {
      siteName: s.siteName ?? 'Kinsmen Fanshawe Sugar Bush',
      organizationName: s.organizationName ?? 'Kinsmen Club of Greater London',
      description: s.description ?? '',
      contact,
      facebookUrl: s.facebookUrl || undefined,
      enquiries: {
        general: mapRoute(s.enquiries?.general, { label: 'General questions', description: 'Questions about visiting.', actionLabel: 'Contact us' }),
        schoolTours: mapRoute(s.enquiries?.schoolTours, { label: 'School and group tours', description: 'Book a school or group visit.', actionLabel: 'Book a school tour' }),
        volunteering: mapRoute(s.enquiries?.volunteering, { label: 'Volunteering', description: 'Help at the Sugar Bush.', actionLabel: 'Volunteer' }),
        membership: mapRoute(s.enquiries?.membership, { label: 'Membership', description: 'Join the Kinsmen Club of Greater London.', actionLabel: 'Ask about membership' }),
      },
      landAcknowledgement: s.landAcknowledgement?.text
        ? { ...reviewable(s), paragraphs: paragraphs(s.landAcknowledgement.text), closing: s.landAcknowledgement.closing || undefined }
        : undefined,
    },
    season: mapSeason(s.season),
    booking: {
      bookingUrl: data.booking?.bookingUrl || undefined,
      widgetEnabled: Boolean(data.booking?.widgetEnabled),
      widgetLoaderUrl: data.booking?.widgetLoaderUrl || undefined,
    },
    experiences: list<Raw>(data.experiences).map((e) => ({
      ...reviewable(e),
      title: e.title,
      body: e.body ?? '',
      bookingNote: e.bookingNote || undefined,
    })),
    generalFaqs: list<Raw>(data.faqs).map(mapFaq),
    products: list<Raw>(data.products).map((p) => ({
      ...reviewable(p),
      name: p.name,
      description: p.description || undefined,
      category: p.category === 'syrup' ? 'syrup' : 'other',
      variants: list<Raw>(p.variants).map((v) => ({ label: v.label, price: v.price })),
    })),
    purchaseLocations: list<Raw>(data.purchaseLocations).map((l) => ({
      ...reviewable(l),
      name: l.name,
      when: l.when ?? '',
      address: l.address || undefined,
      url: l.url || undefined,
    })),
    organizations: list<Raw>(data.organizations).map((o) => ({
      ...reviewable(o),
      name: o.name,
      url: o.url || undefined,
      description: o.description || undefined,
    })),
    stories: list<Raw>(data.stories).map((st) => ({
      ...reviewable(st),
      title: st.title,
      body: [],
      bodyHtml: toHTML(st.body ?? [], {
        components: {
          marks: {
            link: ({ children, value }) =>
              uriLooksSafe(value?.href ?? '') ? `<a href="${escapeHTML(value.href)}">${children}</a>` : children,
          },
        },
      }),
      image: mapImage(st.image),
    })),
    kinsmen: {
      intro: paragraphs(k.intro),
      clubFacts: { ...reviewable(k), items: list<Raw>(k.clubFacts).map((f) => ({ title: f.title, body: f.body })) },
      recognition: list<Raw>(k.recognition).map((r) => ({ ...reviewable(k), title: r.title, body: r.body })),
      volunteering: {
        ...reviewable(k),
        intro: paragraphs(k.volunteeringIntro),
        reasons: list<Raw>(k.volunteeringReasons).map((r) => ({ title: r.title, body: r.body })),
      },
      membership: { ...reviewable(k), intro: paragraphs(k.membershipIntro), steps: list<string>(k.membershipSteps) },
    },
    languageResources: list<Raw>(s.languageResources).map(mapDownload).filter((d): d is Download => Boolean(d)),
    images: {
      hero: mapImage(images.hero),
      pancakeHouse: mapImage(images.pancakeHouse),
      experience: mapImage(images.experience),
      schoolTours: mapImage(images.schoolTours),
      products: mapImage(images.products),
      community: mapImage(images.community),
      volunteers: mapImage(images.volunteers),
    },
  };
}
