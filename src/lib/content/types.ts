/**
 * Normalised content model used by every page.
 *
 * Both content adapters (Sanity and local fixtures) return these shapes, so
 * pages never know where content came from. Field names mirror the Sanity
 * schemas in `studio/schemaTypes`.
 */
import type { ImageMetadata } from 'astro';

/**
 * Where a piece of content came from.
 * - `confirmed`: published in Sanity and marked as reviewed by an editor.
 * - `needsReview`: real content (usually migrated from the previous website)
 *   that an editor has not yet confirmed for the current season.
 * - `sample`: development placeholder. Never real. Only exists in fixtures,
 *   and fixtures cannot be used for production builds.
 */
export type Provenance = 'confirmed' | 'needsReview' | 'sample';

export interface Reviewable {
  provenance: Provenance;
  /** Short note for editors/developers explaining the source or what to check. */
  reviewNote?: string;
}

/** An ISO calendar date, `YYYY-MM-DD`, interpreted in America/Toronto. */
export type IsoDate = string;
/** 24-hour local time, `HH:MM`, interpreted in America/Toronto. */
export type LocalTime = string;

export interface DateBlock {
  /** Optional highlight, e.g. "Family Day weekend" or "March Break". */
  label?: string;
  startDate: IsoDate;
  /** Inclusive. Omit for a single day. */
  endDate?: IsoDate;
  note?: string;
}

export interface Hours {
  opens: LocalTime;
  closes: LocalTime;
  /** e.g. "Last seating 3:30 p.m." */
  note?: string;
}

export interface PriceItem {
  label: string;
  /** Dollars (CAD). `null` = free / included; omit the item if unknown. */
  price: number | null;
  description?: string;
}

export interface PriceList extends Reviewable {
  title: string;
  intro?: string;
  items: PriceItem[];
  /** Fine print shown below the list, e.g. what the fee covers. */
  footnote?: string;
}

export type SeasonStatus = 'upcoming' | 'open' | 'closed';
export type ReservationState = 'notAnnounced' | 'openingSoon' | 'open' | 'closed';
export type TourBookingRelationship = 'separate' | 'included' | 'unconfirmed';

export interface VisitorNotice {
  message: string;
  level: 'info' | 'important';
  /** ISO date-time. The notice disappears after this moment (Toronto time). */
  expiresAt?: string;
  linkLabel?: string;
  linkUrl?: string;
}

export interface Season extends Reviewable {
  year: number;
  status: SeasonStatus;
  /** Days the Sugar Bush is open to the public. */
  operatingDates: DateBlock[];
  operatingHours?: Hours;
  operatingNote?: string;

  pancakeHouse: {
    /** `sameAsOperating` re-uses `operatingDates`; avoids typing dates twice. */
    dateMode: 'sameAsOperating' | 'custom' | 'notAnnounced';
    dates?: DateBlock[];
    servingHours?: Hours;
    note?: string;
  };

  /** Public admission (walking tour, wagon ride, parking...). Separate from dining. */
  admission?: PriceList;
  /** Dining prices live on the menu; this only links to it. */
  menu?: Menu;

  reservations: {
    state: ReservationState;
    /** Only shown when an editor has confirmed the opening date. */
    opensOn?: IsoDate;
    /** Optional editor override for the reservations message. */
    message?: string;
    /** Does a Pancake House reservation include a Sugar Bush tour? */
    tourRelationship: TourBookingRelationship;
    tourRelationshipNote?: string;
  };

  notice?: VisitorNotice;

  schoolTours?: SchoolTourDetails;
  faqs: Faq[];
}

export interface SchoolTourDetails extends Reviewable {
  intro?: string;
  dates: DateBlock[];
  /** Times of day tours run, if published. */
  hours?: Hours;
  pricing?: PriceList;
  howToBook: string;
  paymentNote?: string;
  downloads: Download[];
}

export interface MenuItem {
  name: string;
  description?: string;
  /** Single price, or use `variants` for sizes. */
  price?: number;
  variants?: { label: string; price: number }[];
  dietaryNote?: string;
}

export interface MenuCategory {
  title: string;
  description?: string;
  items: MenuItem[];
}

export interface Menu extends Reviewable {
  title: string;
  intro?: string;
  categories: MenuCategory[];
}

export interface Faq extends Reviewable {
  /** Stable identifier (Sanity document id) used to de-duplicate lists. */
  id?: string;
  question: string;
  /** Plain paragraphs. */
  answer: string[];
  topic: 'visit' | 'pancakeHouse' | 'schoolTours' | 'products' | 'kinsmen';
}

export interface Download extends Reviewable {
  title: string;
  description?: string;
  url: string;
  /** BCP-47 language tag of the document, e.g. "en", "pt". */
  language: string;
  languageLabel: string;
  fileSizeLabel?: string;
  year?: number;
}

/**
 * An image ready to render. Local fixture images are Astro assets (optimised
 * at build time); Sanity images are CDN URLs with known dimensions.
 */
export type SiteImage = Partial<Reviewable> & {
  alt: string;
  credit?: string;
  caption?: string;
} & (
  | { kind: 'local'; asset: ImageMetadata }
  | { kind: 'remote'; url: string; width: number; height: number; srcset: string }
);

export interface MapleProduct extends Reviewable {
  name: string;
  description?: string;
  category: 'syrup' | 'other';
  variants: { label: string; price: number }[];
}

export interface PurchaseLocation extends Reviewable {
  name: string;
  when: string;
  address?: string;
  url?: string;
}

export interface SupportedOrganization extends Reviewable {
  name: string;
  url?: string;
  description?: string;
}

export interface ImpactStory extends Reviewable {
  title: string;
  body: string[];
  /** Sanitised HTML rendered from Sanity rich text; preferred over `body` when present. */
  bodyHtml?: string;
  image?: SiteImage;
}

export interface ContactDetails extends Reviewable {
  phone: string;
  phoneHref: string;
  email: string;
  addressLines: string[];
  locality: string;
  region: string;
  postalCode: string;
  mapUrl?: string;
  directions?: string[];
  parking?: string;
}

export interface EnquiryRoute {
  /** Who should use this route. */
  label: string;
  description: string;
  /** A verified destination: https URL, mailto: or tel:. Missing = not offered. */
  href?: string;
  actionLabel: string;
  external?: boolean;
}

export interface SiteSettings {
  siteName: string;
  organizationName: string;
  description: string;
  contact: ContactDetails;
  facebookUrl?: string;
  enquiries: {
    general: EnquiryRoute;
    schoolTours: EnquiryRoute;
    volunteering: EnquiryRoute;
    membership: EnquiryRoute;
  };
  landAcknowledgement?: Reviewable & { paragraphs: string[]; closing?: string };
}

export interface BookingSettings {
  /** Exact public OpenTable reservation page URL from the account administrator. */
  bookingUrl?: string;
  /** Show the official embedded widget (requires `widgetLoaderUrl`). */
  widgetEnabled: boolean;
  /** The `src` URL copied from OpenTable's official widget embed code. */
  widgetLoaderUrl?: string;
}

export interface KinsmenContent {
  intro: string[];
  clubFacts: Reviewable & { items: { title: string; body: string }[] };
  recognition: (Reviewable & { title: string; body: string })[];
  volunteering: Reviewable & { intro: string[]; reasons: { title: string; body: string }[] };
  membership: Reviewable & { intro: string[]; steps: string[] };
}

export interface ExperienceItem extends Reviewable {
  title: string;
  body: string;
  bookingNote?: string;
}

export interface SiteContent {
  /** Which adapter produced this content. */
  source: 'sanity' | 'fixtures';
  settings: SiteSettings;
  season?: Season;
  booking: BookingSettings;
  experiences: ExperienceItem[];
  generalFaqs: Faq[];
  products: MapleProduct[];
  purchaseLocations: PurchaseLocation[];
  organizations: SupportedOrganization[];
  stories: ImpactStory[];
  kinsmen: KinsmenContent;
  /** Language resources (e.g. the Portuguese self-guided tour brochure). */
  languageResources: Download[];
  images: {
    hero?: SiteImage;
    pancakeHouse?: SiteImage;
    experience?: SiteImage;
    schoolTours?: SiteImage;
    products?: SiteImage;
    community?: SiteImage;
    volunteers?: SiteImage;
  };
}
