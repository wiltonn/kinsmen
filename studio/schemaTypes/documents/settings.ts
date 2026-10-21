import { CogIcon } from '@sanity/icons/Cog';
import { LinkIcon } from '@sanity/icons/Link';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { reviewFields, reviewGroup } from '../objects/review';
import { checkBookingUrl, checkWidgetLoaderUrl } from '../../lib/opentableValidation';

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  icon: CogIcon,
  groups: [
    { name: 'general', title: 'General', default: true },
    { name: 'contact', title: 'Contact' },
    { name: 'enquiries', title: 'Enquiry routes' },
    { name: 'images', title: 'Photos' },
    { name: 'kinsmen', title: 'Land acknowledgement' },
    reviewGroup,
  ],
  fields: [
    defineField({
      name: 'currentSeason',
      title: 'Current season',
      type: 'reference',
      to: [{ type: 'season' }],
      group: 'general',
      description: 'The season the whole website talks about. Switch this when the next season is announced.',
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'siteName', title: 'Site name', type: 'string', group: 'general', initialValue: 'Kinsmen Fanshawe Sugar Bush', validation: (r) => r.required() }),
    defineField({ name: 'organizationName', title: 'Club name', type: 'string', group: 'general', initialValue: 'Kinsmen Club of Greater London', validation: (r) => r.required() }),
    defineField({
      name: 'description',
      title: 'Short description',
      type: 'text',
      rows: 3,
      group: 'general',
      description: 'Used by search engines and when the site is shared. About 150 characters.',
      validation: (r) => r.required().max(200),
    }),
    defineField({ name: 'facebookUrl', title: 'Facebook page', type: 'url', group: 'general', validation: (r) => r.uri({ scheme: ['https'] }) }),
    defineField({
      name: 'languageResources',
      title: 'Resources in other languages',
      type: 'array',
      group: 'general',
      description: 'Downloads in other languages, shown on Plan your visit. Only add translations the club has reviewed.',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'download' }] })],
    }),

    defineField({
      name: 'contact',
      title: 'Contact details',
      type: 'object',
      group: 'contact',
      fields: [
        defineField({ name: 'phone', title: 'Phone', type: 'string', description: 'e.g. (519) 461-1073', validation: (r) => r.required().regex(/^[\d\s()+.-]{10,}$/, { name: 'phone' }) }),
        defineField({ name: 'email', title: 'Email', type: 'email', description: 'A monitored inbox.', validation: (r) => r.required() }),
        defineField({ name: 'addressLines', title: 'Street address', type: 'array', of: [defineArrayMember({ type: 'string' })] }),
        defineField({ name: 'locality', title: 'Town', type: 'string' }),
        defineField({ name: 'region', title: 'Province', type: 'string', initialValue: 'ON' }),
        defineField({ name: 'postalCode', title: 'Postal code', type: 'string' }),
        defineField({ name: 'mapUrl', title: 'Google Maps link', type: 'url', validation: (r) => r.uri({ scheme: ['https'] }) }),
        defineField({ name: 'directions', title: 'Directions', type: 'text', rows: 4, description: 'Separate paragraphs with a blank line.' }),
        defineField({ name: 'parking', title: 'Parking', type: 'text', rows: 2 }),
      ],
    }),

    defineField({
      name: 'enquiries',
      title: 'Enquiry routes',
      type: 'object',
      group: 'enquiries',
      description: 'Each kind of enquiry goes to its own destination. Pancake House reservations always go through OpenTable (see Booking settings).',
      fields: [
        defineField({ name: 'general', title: 'General questions', type: 'enquiryRoute' }),
        defineField({ name: 'schoolTours', title: 'School and group tours', type: 'enquiryRoute' }),
        defineField({ name: 'volunteering', title: 'Volunteering', type: 'enquiryRoute' }),
        defineField({ name: 'membership', title: 'Membership', type: 'enquiryRoute' }),
      ],
    }),

    defineField({
      name: 'images',
      title: 'Photos',
      type: 'object',
      group: 'images',
      description: 'Use real photos of the Sugar Bush. Pages show a plain pattern where a photo is missing.',
      fields: [
        defineField({ name: 'hero', title: 'Homepage main photo', type: 'accessibleImage' }),
        defineField({ name: 'pancakeHouse', title: 'Pancake House', type: 'accessibleImage' }),
        defineField({ name: 'experience', title: 'Sugar Bush experience', type: 'accessibleImage' }),
        defineField({ name: 'schoolTours', title: 'School tours', type: 'accessibleImage' }),
        defineField({ name: 'products', title: 'Maple products', type: 'accessibleImage' }),
        defineField({ name: 'community', title: 'Community', type: 'accessibleImage' }),
        defineField({ name: 'volunteers', title: 'Volunteers', type: 'accessibleImage' }),
      ],
    }),

    defineField({
      name: 'landAcknowledgement',
      title: 'Land acknowledgement',
      type: 'object',
      group: 'kinsmen',
      fields: [
        defineField({ name: 'text', title: 'Text', type: 'text', rows: 12, description: 'Separate paragraphs with a blank line.' }),
        defineField({ name: 'closing', title: 'Closing line', type: 'string' }),
      ],
    }),
    ...reviewFields,
  ],
  preview: { prepare: () => ({ title: 'Site settings' }) },
});

export const bookingSettings = defineType({
  name: 'bookingSettings',
  title: 'Booking settings (OpenTable)',
  type: 'document',
  icon: LinkIcon,
  description: 'Values must come from the OpenTable account administrator. See docs/opentable-setup.md.',
  fields: [
    defineField({
      name: 'bookingUrl',
      title: 'OpenTable booking page',
      type: 'url',
      description:
        'The restaurant’s public OpenTable reservation address, exactly as supplied by the OpenTable administrator (starts with https://www.opentable.ca/…). Used for “Reserve on OpenTable” buttons.',
      validation: (rule) => rule.custom((value) => checkBookingUrl(value as string | undefined)),
    }),
    defineField({
      name: 'widgetEnabled',
      title: 'Show the OpenTable booking widget on the Pancake House page',
      type: 'boolean',
      initialValue: false,
      description: 'Optional. The booking link above is always shown as a backup.',
    }),
    defineField({
      name: 'widgetLoaderUrl',
      title: 'Widget script address',
      type: 'string',
      description:
        'From OpenTable’s widget embed code, copy only the address inside src="…" (it contains /widget/reservation/loader?rid=…). Do not paste the whole <script> tag.',
      hidden: ({ parent }) => !parent?.widgetEnabled,
      validation: (rule) =>
        rule.custom((value, context) => {
          const enabled = (context.parent as { widgetEnabled?: boolean } | undefined)?.widgetEnabled;
          if (enabled && !value) return 'Paste the widget script address, or turn the widget off.';
          return checkWidgetLoaderUrl(value as string | undefined);
        }),
    }),
  ],
  preview: { prepare: () => ({ title: 'Booking settings (OpenTable)' }) },
});
