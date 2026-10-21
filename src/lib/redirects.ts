/**
 * Single source of truth for redirects from the previous (Wix) website.
 * Written to `dist/_redirects` (Cloudflare Pages) at build time and mirrored
 * in `vercel.json` (kept in sync by tests/redirects.test.ts).
 * Documented in docs/redirects.md.
 */
export interface Redirect {
  from: string;
  to: string;
  status: 301 | 302;
  note: string;
}

export const REDIRECTS: Redirect[] = [
  { from: '/menus', to: '/pancake-house#menu', status: 301, note: 'Wix restaurant menu page (also /menus?menu=dinner-menu)' },
  { from: '/french', to: '/visit#languages', status: 301, note: 'Old “French” page; it linked a Portuguese self-guided tour brochure' },
  { from: '/about-1', to: '/kinsmen', status: 301, note: 'Unused Wix template “About” page' },
  { from: '/about', to: '/kinsmen', status: 301, note: 'Common guess for the old About page' },
  { from: '/home', to: '/', status: 301, note: 'Wix default home slug' },
  { from: '/menu', to: '/pancake-house#menu', status: 301, note: 'Common guess' },
  { from: '/school-tours', to: '/school-group-tours', status: 301, note: 'Common guess / old menu label “School Tours”' },
  { from: '/volunteer', to: '/kinsmen/get-involved', status: 301, note: 'Old menu label “Volunteer/Join”' },
  {
    from: '/_files/ugd/17f70a_2f498428d478422c8eb9ef61e178dab3.pdf',
    to: '/downloads/kinsmen-fanshawe-sugar-bush-teacher-package.pdf',
    status: 301,
    note: 'School information package PDF',
  },
  {
    from: '/_files/ugd/2c371f_2f011964cc3d4051b4181fce39f813a2.pdf',
    to: '/downloads/self-guided-tour-portuguese.pdf',
    status: 301,
    note: 'Portuguese self-guided tour brochure PDF',
  },
];

/**
 * The old site was a single long page whose menu scrolled to sections with
 * Wix IDs (e.g. https://…/#comp-lthkyjqn). Fragments never reach the server,
 * so the homepage maps them in the browser instead (see LegacyAnchors.astro).
 */
export const LEGACY_HASHES: Record<string, string> = {
  'comp-lthimuoa': '/maple-products',
  'comp-lthimupj': '/maple-products',
  'comp-lthkyjqn': '/visit#dates',
  'comp-lthkyjry': '/visit#dates',
  'anchor-1': '/visit#dates',
  'comp-lthif79m': '/school-group-tours',
  'comp-lthif7ar': '/school-group-tours',
  'comp-lter9u54': '/kinsmen',
  'comp-ltn84wc5': '/kinsmen',
  'comp-lu63c92a': '/kinsmen#land-acknowledgement',
  'comp-ltn7d3kn': '/kinsmen/get-involved',
  'comp-ltenix7h': '/kinsmen/community-impact',
  'comp-ltn6fak9': '/contact',
  'comp-ltn6fam2': '/contact',
  // Readable guesses people may have typed or bookmarked.
  tours: '/visit#dates',
  'school-tours': '/school-group-tours',
  'maple-miracles': '/kinsmen',
  'land-acknowledgement': '/kinsmen#land-acknowledgement',
  volunteer: '/kinsmen/get-involved',
  benefactors: '/kinsmen/community-impact',
  contact: '/contact',
  menu: '/pancake-house#menu',
};

export function toCloudflareRedirects(redirects: Redirect[]): string {
  const lines = redirects.map((r) => `${r.from} ${r.to} ${r.status}`);
  return `# Generated from src/lib/redirects.ts at build time. Do not edit dist/_redirects by hand.\n${lines.join('\n')}\n`;
}
