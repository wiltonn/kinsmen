/**
 * FICTIONAL demo data for the local workspace demo and tests.
 * None of these organizations, people or boundaries are real Kin units.
 * The real Kinsmen Club of Greater London is deliberately not included, so it
 * isn't placed under an unverified district or region.
 */
import type { AccessGrant, ClubLink, ClubTrackerItem, Committee, DirectoryEntry, Invitation, MeetingNote, Organization, Person } from './domain.ts';
import type { Store } from './store.ts';

export const DEMO_ORGS: Organization[] = [
  { id: 'demo-national', name: 'Demo National Association', level: 'national', parentId: null, description: 'Fictional national level for the demo.', fictional: true },
  { id: 'demo-region', name: 'Demo Northern Region', level: 'region', parentId: 'demo-national', description: 'Fictional region for the demo.', fictional: true },
  { id: 'demo-district', name: 'Demo District 7', level: 'district', parentId: 'demo-region', description: 'Fictional district containing the two demo clubs.', fictional: true, contactEmail: 'district7@example.org' },
  { id: 'club-maple', name: 'Maple Ridge Kin Club (demo)', level: 'club', parentId: 'demo-district', description: 'Fictional Club A.', fictional: true, contactEmail: 'secretary@maple.example.org' },
  { id: 'club-cedar', name: 'Cedar Falls Kin Club (demo)', level: 'club', parentId: 'demo-district', description: 'Fictional Club B.', fictional: true, contactEmail: 'secretary@cedar.example.org' },
];

export interface DemoIdentity {
  email: string;
  label: string;
  explains: string;
}

const P = (id: string, name: string, email: string): Person => ({ id, name, email });
export const DEMO_PEOPLE: Person[] = [
  P('p-mary', 'Mary Member', 'mary@example.org'),
  P('p-alex', 'Alex Admin', 'alex@example.org'),
  P('p-blair', 'Blair Cedar', 'blair@example.org'),
  P('p-dana', 'Dana District', 'dana@example.org'),
  P('p-rory', 'Rory Region', 'rory@example.org'),
  P('p-nadia', 'Nadia National', 'nadia@example.org'),
  P('p-ray', 'Ray Former', 'ray@example.org'),
];

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

const DAY = 86_400_000;
const iso = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString();
const ymd = (now: Date, days: number) => iso(now, days).slice(0, 10);

export async function seedDemo(store: Store, now = new Date()) {
  await store.migrate();
  for (const o of DEMO_ORGS) await store.saveOrganization(o);
  for (const p of DEMO_PEOPLE) await store.savePerson(p);

  const grant = (id: string, personId: string, orgId: string, level: AccessGrant['level'], status: AccessGrant['status'] = 'active'): AccessGrant => ({
    id,
    personId,
    orgId,
    level,
    status,
    createdAt: iso(now, -60),
    createdBy: 'seed',
    revokedAt: status === 'revoked' ? iso(now, -5) : undefined,
  });
  for (const g of [
    grant('g-mary', 'p-mary', 'club-maple', 'member'),
    grant('g-alex', 'p-alex', 'club-maple', 'admin'),
    grant('g-blair', 'p-blair', 'club-cedar', 'admin'),
    grant('g-dana', 'p-dana', 'demo-district', 'admin'),
    grant('g-rory', 'p-rory', 'demo-region', 'admin'),
    grant('g-nadia', 'p-nadia', 'demo-national', 'admin'),
    grant('g-ray', 'p-ray', 'club-maple', 'member', 'revoked'),
  ])
    await store.saveGrant(g);

  const inv = (id: string, email: string, name: string, createdDaysAgo: number, status: Invitation['status'] = 'pending'): Invitation => ({
    id,
    orgId: 'club-maple',
    email,
    name,
    level: 'member',
    status,
    createdAt: iso(now, -createdDaysAgo),
    createdBy: 'p-alex',
    expiresAt: iso(now, 14 - createdDaysAgo),
  });
  for (const i of [
    inv('i-pat', 'pat@example.org', 'Pat Newcomer', 2),
    inv('i-erin', 'erin@example.org', 'Erin Late', 20),
    // Ray's old invitation: revoked with his access, so it can't let him back in.
    inv('i-ray', 'ray@example.org', 'Ray Former', 70, 'revoked'),
  ])
    await store.saveInvitation(i);

  const entry = (id: string, orgId: string, name: string, extra: Partial<DirectoryEntry> = {}): DirectoryEntry => ({ id, orgId, name, contactVisibility: 'members', ...extra });
  for (const e of [
    entry('d-alex', 'club-maple', 'Alex Admin', { roleTitle: 'Secretary', email: 'alex@example.org', phone: '555-0101' }),
    entry('d-mary', 'club-maple', 'Mary Member', { email: 'mary@example.org' }),
    // Listed and chairs a committee, but has no access to the workspace at all.
    entry('d-jamie', 'club-maple', 'Jamie Chair', { roleTitle: 'Sugar bush operations chair', phone: '555-0144', contactVisibility: 'admins' }),
    entry('d-taylor', 'club-maple', 'Taylor Treasurer', { roleTitle: 'Treasurer', email: 'taylor@example.org' }),
    entry('d-blair', 'club-cedar', 'Blair Cedar', { roleTitle: 'President', email: 'blair@example.org' }),
    entry('d-cedar-private', 'club-cedar', 'Morgan Cedar-Private', { phone: '555-0199' }),
  ])
    await store.saveDirectoryEntry(e);

  const note = (id: string, orgId: string, title: string, daysAgo: number, status: MeetingNote['status'], body: string): MeetingNote => ({
    id,
    orgId,
    title,
    meetingDate: ymd(now, -daysAgo),
    body,
    status,
    updatedAt: iso(now, -daysAgo + 1),
    updatedBy: orgId === 'club-maple' ? 'p-alex' : 'p-blair',
    finalizedAt: status === 'final' ? iso(now, -daysAgo + 2) : undefined,
  });
  for (const n of [
    note('n-maple-sep', 'club-maple', 'September general meeting', 45, 'final', 'Welcomed two guests.\nAgreed the fall clean-up date.\nTreasurer’s report accepted.'),
    note('n-maple-oct', 'club-maple', 'October general meeting', 14, 'final', 'Sugar bush season planning started.\nVolunteer sign-up sheet goes out next week.\nNext meeting: second Tuesday of next month, 7 pm.'),
    note('n-maple-draft', 'club-maple', 'November general meeting (draft)', 1, 'draft', 'DRAFT: not yet approved. Budget figures to confirm.'),
    note('n-cedar-oct', 'club-cedar', 'Cedar Falls October meeting', 10, 'final', 'PRIVATE TO CEDAR FALLS: hall rental renewed.'),
    note('n-cedar-draft', 'club-cedar', 'Cedar Falls November meeting (draft)', 2, 'draft', 'PRIVATE CEDAR DRAFT.'),
  ])
    await store.saveNote(n);

  const committees: Committee[] = [
    { id: 'c-ops', orgId: 'club-maple', name: 'Sugar bush operations', purpose: 'Runs the season: volunteers, equipment and the Pancake House.', chairEntryId: 'd-jamie', memberEntryIds: ['d-jamie', 'd-mary'] },
    { id: 'c-fund', orgId: 'club-maple', name: 'Fundraising', purpose: 'Plans the club’s fundraising events.', chairEntryId: 'd-taylor', memberEntryIds: ['d-taylor', 'd-alex'] },
    { id: 'c-cedar', orgId: 'club-cedar', name: 'Cedar hall committee', purpose: 'Private to Cedar Falls.', memberEntryIds: ['d-blair'] },
  ];
  for (const c of committees) await store.saveCommittee(c);

  const links: ClubLink[] = [
    { id: 'l-cal', orgId: 'club-maple', title: 'Club calendar', url: 'https://example.org/maple/calendar', description: 'Meetings and events (demo link).' },
    { id: 'l-expense', orgId: 'club-maple', title: 'Expense claim form', url: 'https://example.org/maple/expenses', description: 'Submit receipts (demo link).' },
    { id: 'l-cedar', orgId: 'club-cedar', title: 'Cedar Falls shared drive', url: 'https://example.org/cedar/drive', description: 'Private to Cedar Falls (demo link).' },
  ];
  for (const l of links) await store.saveLink(l);

  const item: ClubTrackerItem = {
    id: 't-hall01',
    orgId: 'club-maple',
    title: 'Book the hall for the December meeting',
    description: 'Example club to-do item.',
    column: 'next',
    createdAt: iso(now, -3),
    updatedAt: iso(now, -3),
  };
  await store.saveTrackerItem(item);
}

/**
 * Strings that must never appear in the public website build
 * (scripts/check-private-data.mjs).
 */
export const WORKSPACE_PRIVATE_MARKERS: string[] = [
  'Club workspace',
  'Manage club',
  ...DEMO_ORGS.map((o) => o.name),
  ...DEMO_PEOPLE.flatMap((p) => [p.name, p.email]),
  'Jamie Chair',
  'Morgan Cedar-Private',
  'PRIVATE TO CEDAR FALLS',
  'November general meeting (draft)',
  'kfsb_demo_identity',
];
