import { BasketIcon } from '@sanity/icons/Basket';
import { BookIcon } from '@sanity/icons/Book';
import { DownloadIcon } from '@sanity/icons/Download';
import { HeartIcon } from '@sanity/icons/Heart';
import { HelpCircleIcon } from '@sanity/icons/HelpCircle';
import { PinIcon } from '@sanity/icons/Pin';
import { SparklesIcon } from '@sanity/icons/Sparkles';
import { StarIcon } from '@sanity/icons/Star';
import { UsersIcon } from '@sanity/icons/Users';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { reviewFields, reviewGroup } from '../objects/review';

const order = defineField({
  name: 'order',
  title: 'Display order',
  type: 'number',
  description: 'Lower numbers appear first.',
  group: 'main',
});
const mainGroup = { name: 'main', title: 'Content', default: true };

export const menu = defineType({
  name: 'menu',
  title: 'Pancake House menu',
  type: 'document',
  icon: BookIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', initialValue: 'Pancake House menu', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 2, group: 'main' }),
    defineField({
      name: 'categories',
      title: 'Categories',
      type: 'array',
      group: 'main',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'menuCategory',
          title: 'Category',
          fields: [
            defineField({ name: 'title', title: 'Category name', type: 'string', description: 'e.g. “Pancakes”, “Drinks”', validation: (r) => r.required() }),
            defineField({ name: 'description', title: 'Description', type: 'string' }),
            defineField({
              name: 'items',
              title: 'Items',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'object',
                  name: 'menuItem',
                  title: 'Menu item',
                  fields: [
                    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
                    defineField({ name: 'description', title: 'Description', type: 'string' }),
                    defineField({ name: 'price', title: 'Price (CAD)', type: 'number', description: 'Leave empty if you use sizes below.', validation: (r) => r.min(0).precision(2) }),
                    defineField({ name: 'variants', title: 'Sizes', type: 'array', of: [defineArrayMember({ type: 'sizePrice' })] }),
                    defineField({ name: 'dietaryNote', title: 'Dietary note', type: 'string', description: 'Only confirmed information, e.g. “Contains milk”.' }),
                  ],
                  validation: (rule) =>
                    rule.custom((item: { price?: number; variants?: unknown[] } | undefined) =>
                      item && (typeof item.price === 'number' || item.variants?.length) ? true : 'Enter a price or at least one size.',
                    ),
                  preview: { select: { title: 'name', price: 'price' }, prepare: ({ title, price }) => ({ title, subtitle: price != null ? `$${price}` : 'Sizes' }) },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    ...reviewFields,
  ],
});

export const faq = defineType({
  name: 'faq',
  title: 'Question (FAQ)',
  type: 'document',
  icon: HelpCircleIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'question', title: 'Question', type: 'string', group: 'main', validation: (r) => r.required().max(140) }),
    defineField({ name: 'answer', title: 'Answer', type: 'text', rows: 5, group: 'main', description: 'Plain language. Separate paragraphs with a blank line.', validation: (r) => r.required() }),
    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'string',
      group: 'main',
      options: {
        list: [
          { title: 'Visiting', value: 'visit' },
          { title: 'Pancake House', value: 'pancakeHouse' },
          { title: 'School and group tours', value: 'schoolTours' },
          { title: 'Maple products', value: 'products' },
          { title: 'The Kinsmen Club', value: 'kinsmen' },
        ],
      },
      initialValue: 'visit',
      validation: (r) => r.required(),
    }),
    order,
    ...reviewFields,
  ],
  preview: { select: { title: 'question', subtitle: 'topic' } },
});

export const download = defineType({
  name: 'download',
  title: 'Download (PDF)',
  type: 'document',
  icon: DownloadIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'What’s inside', type: 'text', rows: 2, group: 'main' }),
    defineField({ name: 'file', title: 'File', type: 'file', group: 'main', options: { accept: 'application/pdf' }, validation: (r) => r.required() }),
    defineField({ name: 'language', title: 'Language code', type: 'string', group: 'main', description: 'e.g. en, fr, pt', initialValue: 'en', validation: (r) => r.required().regex(/^[a-z]{2}(-[A-Z]{2})?$/) }),
    defineField({ name: 'languageLabel', title: 'Language name', type: 'string', group: 'main', description: 'As visitors should see it, e.g. “Français (French)”.', initialValue: 'English' }),
    defineField({ name: 'year', title: 'Edition year', type: 'number', group: 'main' }),
    ...reviewFields,
  ],
});

export const experience = defineType({
  name: 'experience',
  title: 'Sugar Bush activity',
  type: 'document',
  icon: SparklesIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'title', title: 'Activity', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'body', title: 'Description', type: 'text', rows: 3, group: 'main', validation: (r) => r.required().max(300) }),
    defineField({ name: 'bookingNote', title: 'Booking note', type: 'string', group: 'main', description: 'e.g. “First come, first served — no booking needed.”' }),
    order,
    ...reviewFields,
  ],
});

export const mapleProduct = defineType({
  name: 'mapleProduct',
  title: 'Maple product',
  type: 'document',
  icon: BasketIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'name', title: 'Product', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'description', title: 'Description', type: 'string', group: 'main' }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'main',
      options: { list: [{ title: 'Maple syrup', value: 'syrup' }, { title: 'Other maple products', value: 'other' }], layout: 'radio' },
      initialValue: 'syrup',
    }),
    defineField({ name: 'variants', title: 'Sizes and prices', type: 'array', group: 'main', of: [defineArrayMember({ type: 'sizePrice' })], validation: (r) => r.required().min(1) }),
    order,
    ...reviewFields,
  ],
});

export const purchaseLocation = defineType({
  name: 'purchaseLocation',
  title: 'Where to buy',
  type: 'document',
  icon: PinIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'name', title: 'Place', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'when', title: 'When', type: 'string', group: 'main', description: 'e.g. “After the season ends”', validation: (r) => r.required() }),
    defineField({ name: 'address', title: 'Address', type: 'string', group: 'main' }),
    defineField({ name: 'url', title: 'Website', type: 'url', group: 'main', validation: (r) => r.uri({ scheme: ['https', 'http'] }) }),
    order,
    ...reviewFields,
  ],
});

export const supportedOrganization = defineType({
  name: 'supportedOrganization',
  title: 'Supported organization',
  type: 'document',
  icon: HeartIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({ name: 'url', title: 'Website', type: 'url', group: 'main', validation: (r) => r.uri({ scheme: ['https', 'http'] }) }),
    defineField({ name: 'description', title: 'How we support them', type: 'text', rows: 2, group: 'main', description: 'Only include confirmed amounts or dates.' }),
    order,
    ...reviewFields,
  ],
});

export const impactStory = defineType({
  name: 'impactStory',
  title: 'Community story',
  type: 'document',
  icon: StarIcon,
  groups: [mainGroup, reviewGroup],
  fields: [
    defineField({ name: 'title', title: 'Headline', type: 'string', group: 'main', validation: (r) => r.required() }),
    defineField({
      name: 'body',
      title: 'Story',
      type: 'array',
      group: 'main',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [{ title: 'Paragraph', value: 'normal' }],
          lists: [{ title: 'Bullets', value: 'bullet' }],
          marks: {
            decorators: [{ title: 'Bold', value: 'strong' }, { title: 'Italic', value: 'em' }],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [defineField({ name: 'href', type: 'url', title: 'URL', validation: (r) => r.uri({ scheme: ['https', 'mailto'] }) })],
              },
            ],
          },
        }),
      ],
    }),
    defineField({ name: 'image', title: 'Photo', type: 'accessibleImage', group: 'main' }),
    order,
    ...reviewFields,
  ],
});

export const kinsmenPage = defineType({
  name: 'kinsmenPage',
  title: 'About the Kinsmen',
  type: 'document',
  icon: UsersIcon,
  groups: [mainGroup, { name: 'involved', title: 'Volunteer and membership' }, reviewGroup],
  fields: [
    defineField({ name: 'intro', title: 'Introduction', type: 'text', rows: 4, group: 'main' }),
    defineField({
      name: 'clubFacts',
      title: 'About Kin Canada',
      type: 'array',
      group: 'main',
      of: [defineArrayMember({ type: 'object', name: 'fact', fields: [defineField({ name: 'title', type: 'string' }), defineField({ name: 'body', type: 'text', rows: 2 })] })],
    }),
    defineField({
      name: 'recognition',
      title: 'Awards and recognition',
      type: 'array',
      group: 'main',
      of: [defineArrayMember({ type: 'object', name: 'award', fields: [defineField({ name: 'title', type: 'string' }), defineField({ name: 'body', type: 'text', rows: 2 })] })],
    }),
    defineField({ name: 'volunteeringIntro', title: 'Volunteering introduction', type: 'text', rows: 4, group: 'involved' }),
    defineField({
      name: 'volunteeringReasons',
      title: 'Reasons to volunteer',
      type: 'array',
      group: 'involved',
      of: [defineArrayMember({ type: 'object', name: 'reason', fields: [defineField({ name: 'title', type: 'string' }), defineField({ name: 'body', type: 'text', rows: 2 })] })],
    }),
    defineField({ name: 'membershipIntro', title: 'Membership introduction', type: 'text', rows: 4, group: 'involved' }),
    defineField({ name: 'membershipSteps', title: 'How to join (steps)', type: 'array', group: 'involved', of: [defineArrayMember({ type: 'string' })] }),
    ...reviewFields,
  ],
  preview: { prepare: () => ({ title: 'About the Kinsmen' }) },
});
