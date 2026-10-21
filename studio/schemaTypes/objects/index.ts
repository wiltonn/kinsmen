import { defineArrayMember, defineField, defineType } from 'sanity';

const ISO_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const accessibleImage = defineType({
  name: 'accessibleImage',
  title: 'Image',
  type: 'image',
  options: { hotspot: true },
  fields: [
    defineField({
      name: 'alt',
      title: 'Alternative text',
      type: 'string',
      description:
        'Describe what the photo shows for people who can’t see it, e.g. “Children watching sap boil in the sugar shack”. Don’t start with “Image of”.',
      validation: (rule) => rule.required().min(10).max(200),
    }),
    defineField({ name: 'credit', title: 'Photo credit', type: 'string', description: 'Photographer or source, if a credit is required.' }),
    defineField({ name: 'caption', title: 'Caption', type: 'string' }),
  ],
});

export const dateBlock = defineType({
  name: 'dateBlock',
  title: 'Date or date range',
  type: 'object',
  fields: [
    defineField({ name: 'startDate', title: 'Date (or first day)', type: 'date', validation: (rule) => rule.required() }),
    defineField({
      name: 'endDate',
      title: 'Last day',
      type: 'date',
      description: 'Leave empty for a single day. Days in between are included.',
      validation: (rule) =>
        rule.custom((end, context) => {
          const start = (context.parent as { startDate?: string } | undefined)?.startDate;
          return !end || !start || end >= start ? true : 'The last day must be on or after the first day.';
        }),
    }),
    defineField({ name: 'label', title: 'Highlight label', type: 'string', description: 'Optional, e.g. “Family Day weekend” or “March Break”.' }),
    defineField({ name: 'note', title: 'Note', type: 'string', description: 'Optional, e.g. “Closes early at 2 p.m.”' }),
  ],
  preview: {
    select: { start: 'startDate', end: 'endDate', label: 'label' },
    prepare: ({ start, end, label }) => ({ title: end && end !== start ? `${start} → ${end}` : start, subtitle: label }),
  },
});

export const hours = defineType({
  name: 'hours',
  title: 'Hours',
  type: 'object',
  description: 'Use 24-hour time, e.g. 09:00 and 16:00. Leave both empty if not confirmed.',
  options: { columns: 2 },
  fields: [
    defineField({
      name: 'opens',
      title: 'Opens',
      type: 'string',
      validation: (rule) => rule.regex(ISO_TIME, { name: 'time' }).error('Use HH:MM, e.g. 09:00'),
    }),
    defineField({
      name: 'closes',
      title: 'Closes',
      type: 'string',
      validation: (rule) => rule.regex(ISO_TIME, { name: 'time' }).error('Use HH:MM, e.g. 16:00'),
    }),
    defineField({ name: 'note', title: 'Note', type: 'string', description: 'e.g. “Last seating 3:30 p.m.”' }),
  ],
  validation: (rule) =>
    rule.custom((value: { opens?: string; closes?: string } | undefined) => {
      if (!value || (!value.opens && !value.closes)) return true;
      if (!value.opens || !value.closes) return 'Enter both an opening and closing time, or neither.';
      return value.closes > value.opens ? true : 'Closing time must be after opening time.';
    }),
});

export const priceList = defineType({
  name: 'priceList',
  title: 'Price list',
  type: 'object',
  fields: [
    defineField({ name: 'title', title: 'Heading', type: 'string', initialValue: 'Prices' }),
    defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 2 }),
    defineField({
      name: 'items',
      title: 'Prices',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'priceItem',
          fields: [
            defineField({ name: 'label', title: 'What it is', type: 'string', description: 'e.g. “Adult”, “Child (3–12)”, “Walking tour only”', validation: (r) => r.required() }),
            defineField({ name: 'price', title: 'Price (CAD)', type: 'number', description: 'Numbers only, e.g. 8.25', validation: (r) => r.min(0).precision(2) }),
            defineField({ name: 'included', title: 'Free / included', type: 'boolean', description: 'Tick instead of entering a price if this is free.' }),
            defineField({ name: 'description', title: 'Details', type: 'string' }),
          ],
          validation: (rule) =>
            rule.custom((item: { price?: number; included?: boolean } | undefined) =>
              item && (item.included || typeof item.price === 'number') ? true : 'Enter a price, or tick “Free / included”.',
            ),
          preview: { select: { title: 'label', price: 'price' }, prepare: ({ title, price }) => ({ title, subtitle: price != null ? `$${price}` : 'Included' }) },
        }),
      ],
    }),
    defineField({ name: 'footnote', title: 'Fine print', type: 'text', rows: 2, description: 'e.g. what the fee covers.' }),
  ],
});

export const enquiryRoute = defineType({
  name: 'enquiryRoute',
  title: 'Enquiry route',
  type: 'object',
  description: 'Leave the destination empty to hide this route from the website. Never point a route at a form nobody monitors.',
  fields: [
    defineField({ name: 'label', title: 'Title', type: 'string' }),
    defineField({ name: 'description', title: 'Who should use this', type: 'text', rows: 2 }),
    defineField({
      name: 'href',
      title: 'Destination',
      type: 'url',
      description: 'A Google Form or other https:// link, mailto:someone@example.com, or tel:+15195551234.',
      validation: (rule) => rule.uri({ scheme: ['https', 'mailto', 'tel'] }),
    }),
    defineField({ name: 'actionLabel', title: 'Button text', type: 'string' }),
  ],
});

export const sizePrice = defineType({
  name: 'sizePrice',
  title: 'Size and price',
  type: 'object',
  fields: [
    defineField({ name: 'label', title: 'Size', type: 'string', description: 'e.g. “500 mL”, “Small”', validation: (r) => r.required() }),
    defineField({ name: 'price', title: 'Price (CAD)', type: 'number', validation: (r) => r.required().min(0).precision(2) }),
  ],
  preview: { select: { title: 'label', price: 'price' }, prepare: ({ title, price }) => ({ title, subtitle: `$${price}` }) },
});

export const objectTypes = [accessibleImage, dateBlock, hours, priceList, enquiryRoute, sizePrice];
