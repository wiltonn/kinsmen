/**
 * DEVELOPMENT FIXTURE CONTENT
 *
 * Lets the site run before Sanity credentials exist. Production builds refuse
 * to use this file (see src/lib/config.ts).
 *
 * Every critical item is labelled:
 * - provenance 'needsReview': copied from the previous website
 *   (kinsmenfanshawesugarbush.com, audited 2026-10-21). Real, but unconfirmed.
 * - provenance 'sample': development placeholder. NOT a real fact.
 *
 * Unknown facts (hours, admission prices, reservation dates, accessibility)
 * are deliberately left out rather than invented. See docs/content-checklist.md.
 */
import type { BookingSettings, Faq, SiteContent } from './types';
import { phoneHref } from '../format';

import heroImage from '../../assets/images/sugar-shack-visitors.jpg';
import productsImage from '../../assets/images/maple-products-shelf.jpg';
import horsesImage from '../../assets/images/horses-and-visitors.jpg';
import historyImage from '../../assets/images/history-display.jpg';
import paradeImage from '../../assets/images/santa-claus-parade-float.jpg';
import stevensonImage from '../../assets/images/stevenson-camp-celebration.jpg';

const FROM_OLD_SITE = 'Copied from the previous website (audited Oct 2026). Confirm before launch.';
const PHOTO_CREDIT_NOTE = 'Photo from the previous website. Confirm photographer credit and permission.';

const PHONE = '(519) 461-1073';

const teacherPackage = {
  provenance: 'needsReview' as const,
  reviewNote: 'Teacher package dated February 2015. Confirm it is still current or replace it.',
  title: 'Teacher’s guide and school information package',
  description: 'Pre-visit, on-site and follow-up activities for students, plus a booking form. PDF, 16 pages.',
  url: '/downloads/kinsmen-fanshawe-sugar-bush-teacher-package.pdf',
  language: 'en',
  languageLabel: 'English',
  fileSizeLabel: '12 MB',
  year: 2015,
};

const portugueseBrochure = {
  provenance: 'needsReview' as const,
  reviewNote:
    'Linked from the old site’s “French” page, but the brochure is in Portuguese. No French content was found. Confirm whether a French version exists.',
  title: 'Self-guided tour brochure — Kinsmen Fanshawe Sugar Bush (Mata do Açúcar): Viagem autoguiada',
  description: 'Tree identification, how sap becomes syrup, and the history of maple sugaring. PDF, 2 pages.',
  url: '/downloads/self-guided-tour-portuguese.pdf',
  language: 'pt',
  languageLabel: 'Português (Portuguese)',
  fileSizeLabel: '1.2 MB',
};

const bookingFaq: Faq = {
  provenance: 'needsReview',
  reviewNote: FROM_OLD_SITE + ' Shown beside the 2027 school tour table on the old site; confirm it applies to public visitors.',
  topic: 'pancakeHouse',
  question: 'Do I need to book?',
  answer: [
    'Only for the Pancake House. A booking reserves your time in the Pancake House.',
    'The walking tour and wagon ride are first come, first served, so there’s no need to book them.',
  ],
};

const feeFaq: Faq = {
  provenance: 'needsReview',
  reviewNote: FROM_OLD_SITE + ' Shown with school tour pricing; confirm whether public admission works the same way.',
  topic: 'visit',
  question: 'What does the fee cover?',
  answer: ['Parking and the tour, plus your pancake meal if you choose a meal option.'],
};

const syrupAfterSeasonFaq: Faq = {
  provenance: 'needsReview',
  reviewNote: FROM_OLD_SITE,
  topic: 'products',
  question: 'Can I buy your maple syrup after the season ends?',
  answer: ['Yes. When the Sugar Bush season is over, visit Thorndale Hardware in Thorndale, Ontario to buy our pure maple syrup.'],
};

const sampleFaqs: Faq[] = [
  {
    provenance: 'sample',
    reviewNote: 'Sample question only. Write a confirmed answer (accessibility provisions were not published on the old site).',
    topic: 'visit',
    question: 'Is the Sugar Bush accessible for wheelchairs and strollers?',
    answer: ['[Sample — answer needed. Describe trail surfaces, accessible parking and washrooms once confirmed.]'],
  },
  {
    provenance: 'sample',
    reviewNote: 'Sample question only. Policy not published on the old site.',
    topic: 'visit',
    question: 'Can I bring my dog?',
    answer: ['[Sample — answer needed.]'],
  },
  {
    provenance: 'sample',
    reviewNote: 'Sample question only. Payment methods not published on the old site.',
    topic: 'visit',
    question: 'Which payment methods do you accept?',
    answer: ['[Sample — answer needed.]'],
  },
  {
    provenance: 'sample',
    reviewNote: 'Sample question only. Confirm what to wear / trail conditions.',
    topic: 'visit',
    question: 'What should we wear?',
    answer: ['[Sample — answer needed.]'],
  },
];

const fixtureBooking = (overrides: { bookingUrl?: string; widgetLoaderUrl?: string }): BookingSettings => ({
  // No OpenTable URL or widget code was found on the previous website.
  // Values must come from the OpenTable account administrator.
  bookingUrl: overrides.bookingUrl,
  widgetEnabled: Boolean(overrides.widgetLoaderUrl),
  widgetLoaderUrl: overrides.widgetLoaderUrl,
});

export function getFixtureContent(overrides: { bookingUrl?: string; widgetLoaderUrl?: string } = {}): SiteContent {
  return {
    source: 'fixtures',
    settings: {
      siteName: 'Kinsmen Fanshawe Sugar Bush',
      organizationName: 'Kinsmen Club of Greater London',
      description:
        'Maple syrup tours, a seasonal Pancake House and school trips at the Kinsmen Fanshawe Sugar Bush near Thorndale, Ontario — run by volunteers of the Kinsmen Club of Greater London.',
      contact: {
        provenance: 'needsReview',
        reviewNote:
          'From the old site footer. The 2015 PDFs list a different email (kinsmenfanshawesugarbush@primus.ca). Confirm which inbox is monitored.',
        phone: PHONE,
        phoneHref: phoneHref(PHONE),
        email: 'greaterlondonkinsmenclub@primus.ca',
        addressLines: ['21201C Lakeside Drive'],
        locality: 'Thorndale',
        region: 'ON',
        postalCode: 'N0M 2P0',
        mapUrl: 'https://maps.app.goo.gl/PLVQeSin3onaFRXy6',
        directions: [
          'The Sugar Bush is on the north shore of Fanshawe Lake, in Thames Centre, south-west of Thorndale.',
        ],
      },
      facebookUrl: 'https://www.facebook.com/KinsmenFanshaweSugarBush/',
      enquiries: {
        general: {
          label: 'General questions',
          description: 'Questions about visiting, the Pancake House or maple products.',
          href: `mailto:greaterlondonkinsmenclub@primus.ca`,
          actionLabel: 'Email us',
        },
        schoolTours: {
          label: 'School and group tours',
          description: 'Book a school tour date or ask about group visits. Please have your preferred date and group size ready.',
          href: phoneHref(PHONE),
          actionLabel: `Call ${PHONE}`,
        },
        volunteering: {
          label: 'Volunteering',
          description: 'Help at the Sugar Bush or at other Kin events. High school students can earn volunteer hours.',
          href: 'https://docs.google.com/forms/d/e/1FAIpQLScEVBH9DL-LmnG-2wGS7hsW6q3UL9ZKy8Owzns0PMXZzZrZ8w/viewform',
          actionLabel: 'Volunteer interest form',
          external: true,
        },
        membership: {
          label: 'Membership',
          description: 'Find out about joining the Kinsmen Club of Greater London.',
          href: 'https://docs.google.com/forms/d/e/1FAIpQLScEVBH9DL-LmnG-2wGS7hsW6q3UL9ZKy8Owzns0PMXZzZrZ8w/viewform',
          actionLabel: 'Membership interest form',
          external: true,
        },
      },
      landAcknowledgement: {
        provenance: 'needsReview',
        reviewNote:
          'Transcribed word-for-word from an image on the old site (artwork signed “Zana ’23”). Have the club confirm the wording and the artist credit.',
        paragraphs: [
          'We acknowledge that the Kinsmen Fanshawe Sugarbush occupies the ancestral lands of the Neutral\\Attawandaren, the Huron, the Tobacco and the Erie Nations along with the Anishinawbe and the Haudenosaunee who were the First Nations to live in this area after the glaciers receded.',
          'The Caldwell, the Chippewa, the Eelunaapeew (Lenai Lenape), the Oneida, the Anishinawbe from Sarnia, Kettle and Stoney Point and Walpole Island are the Nations that still live in this area - the majority of the Indigenous people are living according to the Dish With One Spoon Treaty which was created in 1701. We recognize the significance of The Dish With One Spoon Covenant and offer our respect and gratitude to all of the Indigenous Peoples of Turtle Island who have cared for and defended this land for thousands of years.',
          'We acknowledge that we are here as a result of blood that has been shed through colonization and the pain of which continues to be the lived experience of Indigenous Communities across Turtle Island. This acknowledgment is our declaration of our responsibility to this place and to its peoples histories, rights and presence. We support and add our voices to the Truth and Reconciliation Commission of Canada’s “94 calls to action” to never forget, to hold governments to account and seek redress and healing for this injustice.',
          'We also would like to acknowledge the many contributions to the world that the Indigenous People have shared and we also would like to honour the Code Talkers who served in both World Wars who also came from this area.',
          'The Kinsmen Club of Greater London strive to use the Kinsmen Fanshawe Sugar Bush Project to be allies towards education and positive change.',
        ],
        closing: 'Nya weh and Miigwetch',
      },
    },

    season: {
      provenance: 'needsReview',
      reviewNote: '2027 public and school dates copied from the old homepage tables. Hours, admission prices and Pancake House details were not published.',
      year: 2027,
      status: 'upcoming',
      operatingDates: [
        { label: 'Family Day weekend', startDate: '2027-02-13', endDate: '2027-02-15' },
        { startDate: '2027-02-27', endDate: '2027-02-28' },
        { startDate: '2027-03-06', endDate: '2027-03-07' },
        { startDate: '2027-03-13', endDate: '2027-03-14' },
        { label: 'March Break', startDate: '2027-03-15', endDate: '2027-03-19' },
        { startDate: '2027-03-20', endDate: '2027-03-21' },
      ],
      // Opening hours were not published on the old site: deliberately omitted.
      operatingHours: undefined,
      pancakeHouse: {
        // Not published on the old site. Editors choose "same as public dates" once confirmed.
        dateMode: 'notAnnounced',
      },
      admission: undefined,
      menu: {
        provenance: 'needsReview',
        reviewNote: 'Prices from the old site’s menu page (last updated March 2025). Confirm 2027 prices.',
        title: 'Pancake House menu',
        intro: 'Pancakes come with pure maple syrup.',
        categories: [
          {
            title: 'Pancakes and sausages',
            items: [
              { name: '2 pancakes, 3 sausages', price: 8.25 },
              { name: '3 pancakes', price: 5.75 },
              { name: '2 pancakes', price: 5.25 },
              { name: '1 pancake, 2 sausages', price: 4.75 },
              { name: '1 pancake', price: 3.5 },
              { name: '3 sausages', price: 4.5 },
              { name: 'Extra syrup', price: 1.75 },
            ],
          },
          {
            title: 'Drinks',
            items: [
              { name: 'Coffee', price: 2 },
              { name: 'Pop', price: 2 },
              { name: 'Milk', price: 2 },
              { name: 'Juice', description: 'Orange or apple', price: 2 },
              { name: 'Tea', price: 1.5 },
              { name: 'Hot chocolate', price: 1.5 },
              { name: 'Water', price: 1.5 },
            ],
          },
        ],
      },
      reservations: {
        state: 'notAnnounced',
        tourRelationship: 'separate',
        tourRelationshipNote:
          'A Pancake House reservation holds your table time only. The walking tour and wagon ride are first come, first served and don’t need to be booked.',
      },
      notice: undefined,
      schoolTours: {
        provenance: 'needsReview',
        reviewNote:
          'Dates and prices copied from the old homepage’s 2027 school tour table. Booking and payment instructions come from the 2015 teacher package.',
        intro:
          'Bring your class to see how sap becomes maple syrup: a guided walk through the sugar bush, the sugar shack and the history displays, with an optional pancake meal.',
        dates: [
          { startDate: '2027-02-23' },
          { startDate: '2027-02-25' },
          { startDate: '2027-03-02' },
          { startDate: '2027-03-04' },
          { startDate: '2027-03-09' },
          { startDate: '2027-03-11' },
          { startDate: '2027-03-23' },
          { startDate: '2027-03-25' },
        ],
        pricing: {
          provenance: 'needsReview',
          reviewNote: 'Old-site “Tour Pricing” table. Confirm whether prices are per student and whether they also apply to public visitors.',
          title: 'Tour pricing',
          items: [
            { label: '2 pancakes, hot chocolate, maple bud', price: 9 },
            { label: '1 pancake, hot chocolate, maple bud', price: 8.25 },
            { label: 'Walking tour, maple bud', price: 6.5 },
            { label: 'Walking tour only', price: 6 },
          ],
          footnote: 'The fee covers parking and the tour, plus your pancake meal if you choose a meal option.',
        },
        howToBook: `Call ${PHONE} to book a date for your class.`,
        paymentNote: 'Please make cheques payable to the Kinsmen Club of Greater London.',
        downloads: [teacherPackage],
      },
      faqs: [bookingFaq, feeFaq],
    },

    booking: fixtureBooking(overrides),

    experiences: [
      {
        provenance: 'needsReview',
        reviewNote: 'Old site mentions the walking tour (first come, first served). Confirm trail length and duration before adding them.',
        title: 'Walking tour',
        body: 'Follow the trail through the sugar bush to see how maple sap is collected, then step into the sugar shack where it is boiled down into syrup.',
        bookingNote: 'First come, first served — no booking needed.',
      },
      {
        provenance: 'needsReview',
        reviewNote: 'Old site mentions the wagon ride (first come, first served); photos show horses. Confirm it runs in 2027.',
        title: 'Wagon ride',
        body: 'Ride out through the woods on the wagon — a favourite with families.',
        bookingNote: 'First come, first served — no booking needed.',
      },
      {
        provenance: 'needsReview',
        reviewNote: 'Based on photos of the on-site display boards (“Spiles through the ages”).',
        title: 'Maple history displays',
        body: 'See how sap collection has changed over the centuries, from Indigenous methods to early settlers’ spiles and today’s tubing.',
      },
      {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE,
        title: 'Maple products',
        body: 'Take home pure maple syrup, maple butter, jellies and more from our shop.',
      },
    ],

    generalFaqs: [syrupAfterSeasonFaq, ...sampleFaqs],

    products: [
      {
        provenance: 'needsReview',
        reviewNote: 'Old menu page (March 2025). Confirm 2027 sizes and prices.',
        category: 'syrup',
        name: 'Pure maple syrup — jugs',
        variants: [
          { label: '250 mL', price: 9 },
          { label: '500 mL', price: 14 },
          { label: '1 L', price: 23 },
          { label: '2 L', price: 40 },
          { label: '4 L', price: 65 },
        ],
      },
      {
        provenance: 'needsReview',
        reviewNote: 'Old menu page (March 2025). Confirm 2027 sizes and prices.',
        category: 'syrup',
        name: 'Pure maple syrup — glass bottles',
        variants: [
          { label: '50 mL', price: 6 },
          { label: '100 mL', price: 9 },
          { label: '250 mL', price: 12 },
          { label: '500 mL', price: 18 },
        ],
      },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Maple butter', variants: [{ label: 'Small', price: 7 }, { label: 'Large', price: 11 }] },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Cinnamon maple butter', variants: [{ label: 'Small', price: 7 }, { label: 'Large', price: 11 }] },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Maple red pepper jelly', variants: [{ label: 'Small', price: 6 }, { label: 'Large', price: 9 }] },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Maple mustard', variants: [{ label: 'Small', price: 6 }, { label: 'Large', price: 9 }] },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Maple BBQ sauce', variants: [{ label: 'Bottle', price: 9 }] },
      { provenance: 'needsReview', reviewNote: FROM_OLD_SITE, category: 'other', name: 'Maple ice cream', description: 'Made with pure maple syrup.', variants: [{ label: 'Serving', price: 5 }] },
    ],

    purchaseLocations: [
      {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE,
        name: 'At the Sugar Bush',
        when: 'During the season, on public days.',
      },
      {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE + ' Add the store address once confirmed.',
        name: 'Thorndale Hardware',
        when: 'After the Sugar Bush season is over.',
        address: 'Thorndale, Ontario',
      },
    ],

    organizations: [
      { provenance: 'needsReview', reviewNote: 'Listed under “Benefactors” on the old site. Confirm the current list.', name: 'Stevenson Children’s Camp', url: 'https://stevensoncamp.ca/', description: 'A long-lasting relationship: the club recently celebrated its 75th year of supporting the camp.' },
      { provenance: 'needsReview', reviewNote: 'Listed under “Benefactors” on the old site.', name: 'Cystic Fibrosis Canada', url: 'https://www.cysticfibrosis.ca/', description: 'Kin Canada’s national charity partner since 1964.' },
      { provenance: 'needsReview', reviewNote: 'Listed under “Benefactors” on the old site.', name: 'Hal Rogers Endowment Fund', url: 'https://www.kincanada.ca/about-bursaries', description: 'Kin Canada bursaries.' },
      { provenance: 'needsReview', reviewNote: 'Old site showed this organisation’s logo linking to diabetes.ca.', name: 'Diabetes Canada', url: 'https://www.diabetes.ca/' },
      { provenance: 'needsReview', reviewNote: 'Old site showed a “CLL” logo linking to cll.on.ca. Confirm the organisation name.', name: 'Community Living London', url: 'https://www.cll.on.ca/' },
      { provenance: 'needsReview', reviewNote: 'Listed under “Benefactors” on the old site.', name: 'Ark Aid Street Mission', url: 'https://arkaidmission.ca/' },
      { provenance: 'needsReview', reviewNote: 'Old site showed a logo linking to sari.ca. Confirm the organisation name.', name: 'SARI Therapeutic Riding', url: 'https://www.sari.ca/' },
      { provenance: 'needsReview', reviewNote: 'Old site showed a logo linking to anovafuture.org.', name: 'Anova', url: 'https://www.anovafuture.org/' },
      { provenance: 'needsReview', reviewNote: 'Old site showed a logo linking to epilepsyswo.ca.', name: 'Epilepsy Southwestern Ontario', url: 'https://epilepsyswo.ca/' },
    ],

    stories: [
      {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE + ' Add the year of the 75th anniversary.',
        title: 'Seventy-five years with Stevenson Children’s Camp',
        body: [
          'The Kinsmen Club of Greater London has had a long-lasting relationship with Stevenson Children’s Camp, and recently celebrated its 75th year of helping to support the camp.',
        ],
        image: {
          kind: 'local',
          asset: stevensonImage,
          alt: 'A celebration cake decorated with the Kin Canada and Stevenson Children’s Camp logos, reading “Well done Kin… Stevenson Camp!”',
          provenance: 'needsReview',
          reviewNote: PHOTO_CREDIT_NOTE,
        },
      },
      {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE,
        title: 'Raising funds and awareness for Cystic Fibrosis Canada',
        body: [
          'In August 2013, the Kinsmen Club of Greater London received the Bill Skelly Award on behalf of the Kinsmen Fanshawe Sugar Bush for raising funds and awareness for Cystic Fibrosis Canada.',
        ],
      },
      {
        provenance: 'needsReview',
        reviewNote: 'Photo from the old site (“santa claus parade”). Confirm which parade and year.',
        title: 'Out in the community',
        body: ['Our volunteers bring the Sugar Bush to community events, including the Santa Claus Parade.'],
        image: {
          kind: 'local',
          asset: paradeImage,
          alt: 'The Kinsmen Fanshawe Sugar Bush parade float, decorated with lights and Canadian flags and pulled by two black horses at night.',
          provenance: 'needsReview',
          reviewNote: PHOTO_CREDIT_NOTE,
        },
      },
    ],

    kinsmen: {
      intro: [
        'The Kinsmen Fanshawe Sugar Bush is the main fundraising project of the Kinsmen Club of Greater London. Club members and volunteers run it every spring, and the money raised goes back into our community.',
      ],
      clubFacts: {
        provenance: 'needsReview',
        reviewNote: 'National Kin Canada facts from the old site. Check current figures at kincanada.ca.',
        items: [
          { title: 'Part of Kin Canada', body: 'Founded by Hal Rogers on February 20, 1920, Kin Canada is the nation’s largest all-Canadian service club organization.' },
          { title: 'Our motto', body: 'Serving the Community’s Greatest Need.' },
          { title: 'Our mission', body: 'Volunteers enriching Canadian communities through community service, leadership and partnership.' },
          { title: 'Across Canada', body: 'Kinsmen, Kinette and Kin clubs across the country work to better their communities, enhance the well-being of Canadians and improve the environment.' },
        ],
      },
      recognition: [
        {
          provenance: 'needsReview',
          reviewNote: 'Old site showed a “Best of London 2016 Winner” badge (The London Free Press). Confirm wording.',
          title: 'Best of London 2016',
          body: 'Named winner of the “Best Kept Tourism Secret” category in The London Free Press Best of London 2016 readers’ survey.',
        },
      ],
      volunteering: {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE,
        intro: [
          'Without members and volunteers, the Sugar Bush wouldn’t be possible. Change lives, make your community a better place, and build lifelong friendships along the way.',
        ],
        reasons: [
          { title: 'Enjoy the outdoors', body: 'Spend late winter in the woods helping run our main fundraising project.' },
          { title: 'Earn volunteer hours', body: 'During the Sugar Bush season there are plenty of opportunities for high school students to earn credit towards their volunteer hours.' },
          { title: 'Build skills and friendships', body: 'Develop leadership and personal skills, gain confidence, and make lifelong friends.' },
        ],
      },
      membership: {
        provenance: 'needsReview',
        reviewNote: FROM_OLD_SITE + ' Add meeting location and frequency once confirmed.',
        intro: [
          'Kin Canada is made up of enthusiastic people just like you, gathered together in clubs from coast to coast. Together we’re bettering our communities and changing lives — you can be part of it too.',
        ],
        steps: [
          'Take us for a test drive: tell us you’re interested and we’ll let you know when and where our next meeting or event is.',
          'Come out, meet the members and see if the club is right for you.',
        ],
      },
    },

    languageResources: [portugueseBrochure],

    images: {
      hero: {
        kind: 'local',
        asset: heroImage,
        alt: 'Families gathering outside the Kinsmen Fanshawe Sugar Bush sugar shack on a sunny late-winter day, with bare maple woods behind.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      experience: {
        kind: 'local',
        asset: horsesImage,
        alt: 'A group of smiling visitors in winter coats posing in the snow with two harnessed draft horses.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      schoolTours: {
        kind: 'local',
        asset: historyImage,
        alt: 'Display boards at the Sugar Bush, including “Spiles through the ages”, showing how maple sap collection has changed over time.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      products: {
        kind: 'local',
        asset: productsImage,
        alt: 'Shelves stocked with Kinsmen Fanshawe Sugarbush maple syrup jugs, maple-leaf glass bottles, maple butter and jellies.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      community: {
        kind: 'local',
        asset: paradeImage,
        alt: 'The Kinsmen Fanshawe Sugar Bush parade float, decorated with lights and Canadian flags and pulled by two black horses.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      volunteers: {
        kind: 'local',
        asset: heroImage,
        alt: 'Visitors outside the sugar shack beside the sign that reads “Kinsmen Fanshawe Sugar Bush — Operated by Kinsmen of Greater London”.',
        provenance: 'needsReview',
        reviewNote: PHOTO_CREDIT_NOTE,
      },
      // No Pancake House photo exists on the old site. A labelled placeholder is shown in development.
      pancakeHouse: undefined,
    },
  };
}
