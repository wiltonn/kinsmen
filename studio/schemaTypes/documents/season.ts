import { CalendarIcon } from '@sanity/icons/Calendar';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { reviewFields, reviewGroup } from '../objects/review';

/**
 * One document per season. Dates, hours and prices live here once and are
 * shown on every page that needs them. Choose the current season in
 * Site settings.
 */
export const season = defineType({
  name: 'season',
  title: 'Season',
  type: 'document',
  icon: CalendarIcon,
  groups: [
    { name: 'status', title: 'Status', default: true },
    { name: 'dates', title: 'Dates and prices' },
    { name: 'pancakeHouse', title: 'Pancake House' },
    { name: 'reservations', title: 'Reservations' },
    { name: 'school', title: 'School tours' },
    { name: 'notice', title: 'Visitor alert' },
    reviewGroup,
  ],
  fields: [
    defineField({
      name: 'year',
      title: 'Season year',
      type: 'number',
      group: 'status',
      validation: (rule) => rule.required().integer().min(2024).max(2100),
    }),
    defineField({
      name: 'status',
      title: 'Season status',
      type: 'string',
      group: 'status',
      description:
        'Upcoming: dates announced, not open yet. Open: the season is running. Closed: the season is over. After the last public date the site automatically shows the season as ended.',
      options: {
        list: [
          { title: 'Upcoming', value: 'upcoming' },
          { title: 'Open', value: 'open' },
          { title: 'Closed (season over)', value: 'closed' },
        ],
        layout: 'radio',
      },
      initialValue: 'upcoming',
      validation: (rule) => rule.required(),
    }),

    defineField({
      name: 'operatingDates',
      title: 'Public dates',
      type: 'array',
      group: 'dates',
      description: 'Every day the Sugar Bush is open to the public. Add a range for consecutive days.',
      of: [defineArrayMember({ type: 'dateBlock' })],
    }),
    defineField({ name: 'operatingHours', title: 'Public opening hours', type: 'hours', group: 'dates' }),
    defineField({ name: 'operatingNote', title: 'Note about opening', type: 'text', rows: 2, group: 'dates', description: 'Optional, e.g. weather closures policy.' }),
    defineField({
      name: 'admission',
      title: 'Admission prices',
      type: 'priceList',
      group: 'dates',
      description: 'Entry, tour and wagon prices. Pancake House meal prices go on the menu, not here.',
    }),

    defineField({
      name: 'pancakeHouse',
      title: 'Pancake House',
      type: 'object',
      group: 'pancakeHouse',
      fields: [
        defineField({
          name: 'dateMode',
          title: 'Pancake House dates',
          type: 'string',
          options: {
            list: [
              { title: 'Not announced yet', value: 'notAnnounced' },
              { title: 'Same as the public dates', value: 'sameAsOperating' },
              { title: 'Different dates (enter below)', value: 'custom' },
            ],
            layout: 'radio',
          },
          initialValue: 'notAnnounced',
        }),
        defineField({
          name: 'dates',
          title: 'Pancake House dates',
          type: 'array',
          of: [defineArrayMember({ type: 'dateBlock' })],
          hidden: ({ parent }) => parent?.dateMode !== 'custom',
        }),
        defineField({ name: 'servingHours', title: 'Serving hours', type: 'hours' }),
        defineField({ name: 'note', title: 'Note', type: 'text', rows: 2 }),
      ],
    }),
    defineField({
      name: 'menu',
      title: 'Menu',
      type: 'reference',
      to: [{ type: 'menu' }],
      group: 'pancakeHouse',
      description: 'The Pancake House menu and prices for this season.',
    }),

    defineField({
      name: 'reservations',
      title: 'Pancake House reservations',
      type: 'object',
      group: 'reservations',
      description:
        'Controls what the website says about reservations. Online booking only appears when this is “Open” AND the OpenTable booking settings are filled in. OpenTable alone decides which tables and times are available.',
      fields: [
        defineField({
          name: 'state',
          title: 'Reservations',
          type: 'string',
          options: {
            list: [
              { title: 'Not announced', value: 'notAnnounced' },
              { title: 'Opening soon', value: 'openingSoon' },
              { title: 'Open', value: 'open' },
              { title: 'Closed', value: 'closed' },
            ],
            layout: 'radio',
          },
          initialValue: 'notAnnounced',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'opensOn',
          title: 'Reservations open on',
          type: 'date',
          description: 'Only fill in once the date is confirmed. Showing a date does not switch booking on — change the state to “Open” on the day.',
          hidden: ({ parent }) => parent?.state !== 'openingSoon',
        }),
        defineField({
          name: 'message',
          title: 'Custom message',
          type: 'text',
          rows: 2,
          description: 'Optional. Replaces the standard reservations sentence. Don’t say “sold out” — OpenTable shows availability.',
        }),
        defineField({
          name: 'tourRelationship',
          title: 'Does a table reservation include a Sugar Bush tour?',
          type: 'string',
          options: {
            list: [
              { title: 'Not confirmed yet', value: 'unconfirmed' },
              { title: 'No — tours are separate', value: 'separate' },
              { title: 'Yes — included', value: 'included' },
            ],
            layout: 'radio',
          },
          initialValue: 'unconfirmed',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'tourRelationshipNote',
          title: 'Explanation for visitors',
          type: 'text',
          rows: 3,
          description: 'e.g. “A reservation holds your table time only. The walking tour is first come, first served.”',
          validation: (rule) =>
            rule.custom((note, context) => {
              const rel = (context.parent as { tourRelationship?: string } | undefined)?.tourRelationship;
              return rel && rel !== 'unconfirmed' && !note ? 'Please explain this for visitors.' : true;
            }),
        }),
      ],
    }),

    defineField({
      name: 'schoolTours',
      title: 'School tours',
      type: 'object',
      group: 'school',
      fields: [
        defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 3 }),
        defineField({ name: 'dates', title: 'School tour dates', type: 'array', of: [defineArrayMember({ type: 'dateBlock' })] }),
        defineField({ name: 'hours', title: 'Tour times', type: 'hours' }),
        defineField({ name: 'pricing', title: 'Pricing', type: 'priceList' }),
        defineField({
          name: 'howToBook',
          title: 'How to book',
          type: 'text',
          rows: 2,
          description: 'e.g. “Call (519) 461-1073 to book a date for your class.” The booking button uses the School tours route in Site settings.',
        }),
        defineField({ name: 'paymentNote', title: 'Payment instructions', type: 'string' }),
        defineField({
          name: 'downloads',
          title: 'Teacher downloads',
          type: 'array',
          of: [defineArrayMember({ type: 'reference', to: [{ type: 'download' }] })],
        }),
      ],
    }),

    defineField({
      name: 'notice',
      title: 'Visitor alert',
      type: 'object',
      group: 'notice',
      description: 'A banner at the top of every page, e.g. a weather closure. Clear the message to remove it.',
      fields: [
        defineField({ name: 'message', title: 'Message', type: 'string', validation: (rule) => rule.max(160) }),
        defineField({
          name: 'level',
          title: 'Style',
          type: 'string',
          options: { list: [{ title: 'Information', value: 'info' }, { title: 'Important', value: 'important' }], layout: 'radio' },
          initialValue: 'info',
        }),
        defineField({
          name: 'expiresAt',
          title: 'Remove automatically after',
          type: 'datetime',
          description: 'Optional. Times are Ontario time.',
          options: { timeStep: 30 },
        }),
        defineField({ name: 'linkLabel', title: 'Link text', type: 'string' }),
        defineField({ name: 'linkUrl', title: 'Link', type: 'url', validation: (rule) => rule.uri({ allowRelative: true, scheme: ['https'] }) }),
      ],
    }),

    defineField({
      name: 'faqs',
      title: 'Season-specific questions',
      type: 'array',
      group: 'status',
      description: 'Questions shown first on the FAQ page and on related pages this season.',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'faq' }] })],
    }),

    ...reviewFields,
  ],
  validation: (rule) =>
    rule.custom((doc) => {
      const season = doc as { status?: string; operatingDates?: unknown[] } | undefined;
      return season?.status === 'open' && !season.operatingDates?.length ? 'An open season needs at least one public date.' : true;
    }),
  preview: {
    select: { year: 'year', status: 'status', reservations: 'reservations.state' },
    prepare: ({ year, status, reservations }) => ({ title: `${year ?? 'New'} season`, subtitle: `${status ?? ''} · reservations: ${reservations ?? '—'}` }),
  },
  orderings: [{ title: 'Year, newest first', name: 'yearDesc', by: [{ field: 'year', direction: 'desc' }] }],
});
