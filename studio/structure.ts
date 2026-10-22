import type { StructureResolver } from 'sanity/structure';
import { BasketIcon } from '@sanity/icons/Basket';
import { CalendarIcon } from '@sanity/icons/Calendar';
import { CogIcon } from '@sanity/icons/Cog';
import { HeartIcon } from '@sanity/icons/Heart';
import { LinkIcon } from '@sanity/icons/Link';
import { UsersIcon } from '@sanity/icons/Users';

const singleton = (S: Parameters<StructureResolver>[0], id: string, title: string, icon: typeof CogIcon) =>
  S.listItem().title(title).id(id).icon(icon).child(S.document().schemaType(id).documentId(id).title(title));

/** A volunteer-friendly sidebar grouped like the website. */
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Website content')
    .items([
      singleton(S, 'siteSettings', 'Site settings', CogIcon),
      singleton(S, 'bookingSettings', 'Booking settings (OpenTable)', LinkIcon),
      S.divider(),
      S.listItem()
        .title('Visit the Sugar Bush')
        .icon(CalendarIcon)
        .child(
          S.list()
            .title('Visit the Sugar Bush')
            .items([
              S.documentTypeListItem('season').title('Seasons'),
              S.documentTypeListItem('menu').title('Pancake House menus'),
              S.documentTypeListItem('experience').title('Activities'),
              S.documentTypeListItem('faq').title('Visitor questions'),
              S.documentTypeListItem('download').title('Downloads (PDFs)'),
            ]),
        ),
      S.listItem()
        .title('Maple products')
        .icon(BasketIcon)
        .child(
          S.list()
            .title('Maple products')
            .items([S.documentTypeListItem('mapleProduct').title('Products'), S.documentTypeListItem('purchaseLocation').title('Where to buy')]),
        ),
      S.divider(),
      singleton(S, 'kinsmenPage', 'About the Kinsmen', UsersIcon),
      S.listItem()
        .title('Community impact')
        .icon(HeartIcon)
        .child(
          S.list()
            .title('Community impact')
            .items([
              S.documentTypeListItem('impactStory').title('Stories'),
              S.documentTypeListItem('supportedOrganization').title('Supported organizations'),
            ]),
        ),
    ]);
