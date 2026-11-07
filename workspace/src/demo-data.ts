/**
 * FICTIONAL demo data for the local workspace demo and tests.
 * None of these organizations, people or boundaries are real Kin units.
 * The real Kinsmen Club of Greater London is deliberately not included, so it
 * isn't placed under an unverified district or region.
 *
 * Builds on the deliberately public Maple Ridge fixtures (public-demo-data.ts)
 * and adds a second club and upper-level admins. These additions exist to test
 * isolation and are NEVER shipped in the public build, not even in /club-demo.
 */
import type { Committee, DirectoryEntry, Organization, Person } from './domain.ts';
import { grantAt, noteAt, PUBLIC_DEMO_MARKERS, PUBLIC_DEMO_ORGS, PUBLIC_DEMO_PEOPLE, seedPublicDemo } from './public-demo-data.ts';
import type { Store } from './store.ts';

const CEDAR: Organization = { id: 'club-cedar', name: 'Cedar Falls Kin Club (demo)', level: 'club', parentId: 'demo-district', description: 'Fictional Club B.', fictional: true, contactEmail: 'secretary@cedar.example.org' };
export const DEMO_ORGS: Organization[] = [...PUBLIC_DEMO_ORGS, CEDAR];

export interface DemoIdentity {
  email: string;
  label: string;
  explains: string;
}

const P = (id: string, name: string, email: string): Person => ({ id, name, email });
const PRIVATE_PEOPLE: Person[] = [
  P('p-blair', 'Blair Cedar', 'blair@example.org'),
  P('p-dana', 'Dana District', 'dana@example.org'),
  P('p-rory', 'Rory Region', 'rory@example.org'),
  P('p-nadia', 'Nadia National', 'nadia@example.org'),
];
export const DEMO_PEOPLE: Person[] = [...PUBLIC_DEMO_PEOPLE, ...PRIVATE_PEOPLE];

/** Shown in the developer-only panel. Each represents an email already verified by the sign-in provider. */
export const DEMO_IDENTITIES: DemoIdentity[] = [
  { email: 'mary@example.org', label: 'Mary Member', explains: 'Ordinary member of Maple Ridge (Club A).' },
  { email: 'alex@example.org', label: 'Alex Admin', explains: 'The only admin of Maple Ridge (Club A).' },
  { email: 'blair@example.org', label: 'Blair Cedar', explains: 'Admin of Cedar Falls (Club B), a sibling club in the same district.' },
  { email: 'dana@example.org', label: 'Dana District', explains: 'Admin of Demo District 7. No club access unless a club invites her.' },
  { email: 'rory@example.org', label: 'Rory Region', explains: 'Admin of Demo Northern Region.' },
  { email: 'nadia@example.org', label: 'Nadia National', explains: 'Admin of Demo National Association.' },
  { email: 'pat@example.org', label: 'Pat Newcomer', explains: 'Has a pending invitation to Maple Ridge: first visit.' },
  { email: 'erin@example.org', label: 'Erin Late', explains: 'Her Maple Ridge invitation has expired.' },
  { email: 'ray@example.org', label: 'Ray Former', explains: 'Was a Maple Ridge member; access was removed.' },
  { email: 'stranger@example.org', label: 'Unknown visitor', explains: 'Proved their email but was never invited.' },
];

const CEDAR_ENTRIES: DirectoryEntry[] = [
  { id: 'd-blair', orgId: 'club-cedar', name: 'Blair Cedar', roleTitle: 'President', email: 'blair@example.org', contactVisibility: 'members' },
  { id: 'd-cedar-private', orgId: 'club-cedar', name: 'Morgan Cedar-Private', phone: '555-0199', contactVisibility: 'members' },
];
const CEDAR_NOTES: [id: string, title: string, daysAgo: number, status: 'draft' | 'final', body: string][] = [
  ['n-cedar-oct', 'Cedar Falls October meeting', 10, 'final', 'PRIVATE TO CEDAR FALLS: hall rental renewed.'],
  ['n-cedar-draft', 'Cedar Falls November meeting (draft)', 2, 'draft', 'PRIVATE CEDAR DRAFT.'],
];
const CEDAR_COMMITTEE: Committee = { id: 'c-cedar', orgId: 'club-cedar', name: 'Cedar hall committee', purpose: 'Private to Cedar Falls.', memberEntryIds: ['d-blair'] };
const CEDAR_LINK = { id: 'l-cedar', orgId: 'club-cedar', title: 'Cedar Falls shared drive', url: 'https://example.org/cedar/drive', description: 'Private to Cedar Falls (demo link).' };

export async function seedDemo(store: Store, now = new Date()) {
  await seedPublicDemo(store, now);
  await store.saveOrganization(CEDAR);
  for (const p of PRIVATE_PEOPLE) await store.savePerson(p);
  for (const g of [
    grantAt(now, 'g-blair', 'p-blair', 'club-cedar', 'admin'),
    grantAt(now, 'g-dana', 'p-dana', 'demo-district', 'admin'),
    grantAt(now, 'g-rory', 'p-rory', 'demo-region', 'admin'),
    grantAt(now, 'g-nadia', 'p-nadia', 'demo-national', 'admin'),
  ])
    await store.saveGrant(g);
  for (const e of CEDAR_ENTRIES) await store.saveDirectoryEntry(e);
  for (const [id, title, daysAgo, status, body] of CEDAR_NOTES) await store.saveNote(noteAt(now, id, 'club-cedar', 'p-blair', title, daysAgo, status, body));
  await store.saveCommittee(CEDAR_COMMITTEE);
  await store.saveLink(CEDAR_LINK);
}

/**
 * Strings from the non-public fixtures. These must never appear in ANY public
 * file, including the /club-demo bundle (scripts/private-data-rules.ts).
 */
export const WORKSPACE_PRIVATE_MARKERS: string[] = [
  'PRIVATE TO CEDAR FALLS',
  CEDAR.name,
  ...PRIVATE_PEOPLE.flatMap((p) => [p.name, p.email]),
  ...CEDAR_ENTRIES.map((e) => e.name),
  ...CEDAR_NOTES.flatMap(([, title, , , body]) => [title, body]),
  CEDAR_COMMITTEE.name,
  CEDAR_LINK.title,
].filter((m) => !PUBLIC_DEMO_MARKERS.includes(m));

export { PUBLIC_DEMO_MARKERS };
