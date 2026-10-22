export interface NavLink {
  href: string;
  label: string;
  description?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  links: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'visit',
    label: 'Visit the Sugar Bush',
    links: [
      { href: '/visit', label: 'Plan your visit', description: 'Dates, prices, directions and what to do' },
      { href: '/pancake-house', label: 'Pancake House', description: 'Menu and table reservations' },
      { href: '/school-group-tours', label: 'School and group tours', description: 'Dates, pricing and the teacher’s guide' },
      { href: '/maple-products', label: 'Maple products', description: 'Syrup and treats, and where to buy them' },
      { href: '/faq', label: 'Visitor FAQ', description: 'Answers to common questions' },
    ],
  },
  {
    id: 'kinsmen',
    label: 'About the Kinsmen',
    links: [
      { href: '/kinsmen', label: 'Our club', description: 'The Kinsmen Club of Greater London' },
      { href: '/kinsmen/community-impact', label: 'Community impact', description: 'Causes your visit supports' },
      { href: '/kinsmen/get-involved', label: 'Volunteer or join', description: 'Volunteering and membership' },
    ],
  },
];

export const CONTACT_LINK: NavLink = { href: '/contact', label: 'Contact' };

/**
 * Clean URL path for the current page. With `build.format: 'file'`, Astro
 * reports "/visit.html" during the build; the public URL is "/visit".
 */
export function pagePath(pathname: string): string {
  return pathname.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/$/, '') || '/';
}

/** True when `href` is the current page or one of its children. */
export function isCurrent(pathname: string, href: string): boolean {
  const path = pagePath(pathname);
  if (href === '/') return path === '/';
  return path === href || (href !== '/kinsmen' && path.startsWith(`${href}/`));
}
