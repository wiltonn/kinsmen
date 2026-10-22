import { objectTypes } from './objects';
import { season } from './documents/season';
import { bookingSettings, siteSettings } from './documents/settings';
import { download, experience, faq, impactStory, kinsmenPage, mapleProduct, menu, purchaseLocation, supportedOrganization } from './documents/content';

/** Documents that exist exactly once (fixed IDs, no create/delete). */
export const SINGLETONS = ['siteSettings', 'bookingSettings', 'kinsmenPage'] as const;

export const schemaTypes = [
  ...objectTypes,
  siteSettings,
  bookingSettings,
  season,
  menu,
  faq,
  download,
  experience,
  mapleProduct,
  purchaseLocation,
  supportedOrganization,
  impactStory,
  kinsmenPage,
];
