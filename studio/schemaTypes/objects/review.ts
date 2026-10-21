import { defineField } from 'sanity';

/** Shared "has this been checked?" fields for documents holding visitor facts. */
export const reviewFields = [
  defineField({
    name: 'reviewStatus',
    title: 'Review status',
    type: 'string',
    description:
      'Mark as “Confirmed” only after checking every fact (dates, prices, names) is correct. Unconfirmed content is flagged in preview builds.',
    options: {
      list: [
        { title: 'Needs review', value: 'needsReview' },
        { title: 'Confirmed', value: 'confirmed' },
      ],
      layout: 'radio',
      direction: 'horizontal',
    },
    initialValue: 'needsReview',
    validation: (rule) => rule.required(),
    group: 'review',
  }),
  defineField({
    name: 'reviewNote',
    title: 'Note for reviewers',
    type: 'text',
    rows: 2,
    description: 'Optional. What still needs checking, or where the information came from. Never shown to visitors.',
    group: 'review',
  }),
];

export const reviewGroup = { name: 'review', title: 'Review' };
