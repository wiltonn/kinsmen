/**
 * DELIBERATELY PUBLIC demo fixtures: one fictional club (Maple Ridge) and its
 * fictional upper levels. This is the only data the in-browser demo at
 * /club-demo ships (workspace/browser/club-demo.ts), so everything here may
 * appear in the public website build when ENABLE_CLUB_DEMO=true, but only in
 * the demo's own files (see scripts/private-data-rules.ts).
 *
 * The local demo and the tests add a second club and more people on top of
 * this (demo-data.ts). Those extra records are NOT public and must never
 * appear in any public file, including the demo bundle.
 *
 * Nothing here is a real Kin unit, person, phone number or email address.
 */
import type { AccessGrant, ClubLink, ClubTrackerItem, Committee, DirectoryEntry, Invitation, MeetingNote, Organization, Person } from './domain.ts';
import type { Store } from './store.ts';

export const PUBLIC_DEMO_CLUB_ID = 'club-maple';

export const PUBLIC_DEMO_ORGS: Organization[] = [
  { id: 'demo-national', name: 'Demo National Association', level: 'national', parentId: null, description: 'Fictional national level for the demo.', fictional: true },
  { id: 'demo-region', name: 'Demo Northern Region', level: 'region', parentId: 'demo-national', description: 'Fictional region for the demo.', fictional: true },
  { id: 'demo-district', name: 'Demo District 7', level: 'district', parentId: 'demo-region', description: 'Fictional district containing the two demo clubs.', fictional: true, contactEmail: 'district7@example.org' },
  { id: PUBLIC_DEMO_CLUB_ID, name: 'Maple Ridge Kin Club (demo)', level: 'club', parentId: 'demo-district', description: 'Fictional Club A.', fictional: true, contactEmail: 'secretary@maple.example.org' },
];

const P = (id: string, name: string, email: string): Person => ({ id, name, email });
export const PUBLIC_DEMO_MEMBER = P('p-mary', 'Mary Member', 'mary@example.org');
export const PUBLIC_DEMO_ADMIN = P('p-alex', 'Alex Admin', 'alex@example.org');
export const PUBLIC_DEMO_PEOPLE: Person[] = [PUBLIC_DEMO_MEMBER, PUBLIC_DEMO_ADMIN, P('p-ray', 'Ray Former', 'ray@example.org')];

const DAY = 86_400_000;
const iso = (now: Date, days: number) => new Date(now.getTime() + days * DAY).toISOString();
const ymd = (now: Date, days: number) => iso(now, days).slice(0, 10);

const INVITES: [id: string, email: string, name: string, createdDaysAgo: number, status: Invitation['status']][] = [
  ['i-pat', 'pat@example.org', 'Pat Newcomer', 2, 'pending'],
  ['i-erin', 'erin@example.org', 'Erin Late', 20, 'pending'],
  // Ray's old invitation: revoked with his access, so it can't let him back in.
  ['i-ray', 'ray@example.org', 'Ray Former', 70, 'revoked'],
];

const ENTRIES: DirectoryEntry[] = [
  { id: 'd-alex', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Alex Admin', roleTitle: 'Secretary', email: 'alex@example.org', phone: '555-0101', contactVisibility: 'members' },
  { id: 'd-mary', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Mary Member', email: 'mary@example.org', contactVisibility: 'members' },
  // Listed and chairs a committee, but has no access to the workspace at all.
  { id: 'd-jamie', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Jamie Chair', roleTitle: 'Sugar bush operations chair', phone: '555-0144', contactVisibility: 'admins' },
  { id: 'd-taylor', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Taylor Treasurer', roleTitle: 'Treasurer', email: 'taylor@example.org', contactVisibility: 'members' },
];

const NOTES: [id: string, title: string, daysAgo: number, status: MeetingNote['status'], body: string][] = [
  ['n-maple-sep', 'September general meeting', 45, 'final', 'Welcomed two guests.\nAgreed the fall clean-up date.\nTreasurer’s report accepted.'],
  ['n-maple-oct', 'October general meeting', 14, 'final', 'Sugar bush season planning started.\nVolunteer sign-up sheet goes out next week.\nNext meeting: second Tuesday of next month, 7 pm.'],
  ['n-maple-draft', 'November general meeting (draft)', 1, 'draft', 'DRAFT: not yet approved. Budget figures to confirm.'],
];

const COMMITTEES: Committee[] = [
  { id: 'c-ops', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Sugar bush operations', purpose: 'Runs the season: volunteers, equipment and the Pancake House.', chairEntryId: 'd-jamie', memberEntryIds: ['d-jamie', 'd-mary'] },
  { id: 'c-fund', orgId: PUBLIC_DEMO_CLUB_ID, name: 'Fundraising', purpose: 'Plans the club’s fundraising events.', chairEntryId: 'd-taylor', memberEntryIds: ['d-taylor', 'd-alex'] },
];

const LINKS: ClubLink[] = [
  { id: 'l-cal', orgId: PUBLIC_DEMO_CLUB_ID, title: 'Club calendar', url: 'https://example.org/maple/calendar', description: 'Meetings and events (demo link).' },
  { id: 'l-expense', orgId: PUBLIC_DEMO_CLUB_ID, title: 'Expense claim form', url: 'https://example.org/maple/expenses', description: 'Submit receipts (demo link).' },
];

export const grantAt = (now: Date, id: string, personId: string, orgId: string, level: AccessGrant['level'], status: AccessGrant['status'] = 'active'): AccessGrant => ({
  id,
  personId,
  orgId,
  level,
  status,
  createdAt: iso(now, -60),
  createdBy: 'seed',
  revokedAt: status === 'revoked' ? iso(now, -5) : undefined,
});

export const noteAt = (now: Date, id: string, orgId: string, updatedBy: string, title: string, daysAgo: number, status: MeetingNote['status'], body: string): MeetingNote => ({
  id,
  orgId,
  title,
  meetingDate: ymd(now, -daysAgo),
  body,
  status,
  updatedAt: iso(now, -daysAgo + 1),
  updatedBy,
  finalizedAt: status === 'final' ? iso(now, -daysAgo + 2) : undefined,
});

/** Seeds only the public Maple Ridge demo club (and its fictional upper levels). */
export async function seedPublicDemo(store: Store, now = new Date()) {
  await store.migrate();
  for (const o of PUBLIC_DEMO_ORGS) await store.saveOrganization(o);
  for (const p of PUBLIC_DEMO_PEOPLE) await store.savePerson(p);
  for (const g of [
    grantAt(now, 'g-mary', 'p-mary', PUBLIC_DEMO_CLUB_ID, 'member'),
    grantAt(now, 'g-alex', 'p-alex', PUBLIC_DEMO_CLUB_ID, 'admin'),
    grantAt(now, 'g-ray', 'p-ray', PUBLIC_DEMO_CLUB_ID, 'member', 'revoked'),
  ])
    await store.saveGrant(g);
  for (const [id, email, name, createdDaysAgo, status] of INVITES)
    await store.saveInvitation({ id, orgId: PUBLIC_DEMO_CLUB_ID, email, name, level: 'member', status, createdAt: iso(now, -createdDaysAgo), createdBy: 'p-alex', expiresAt: iso(now, 14 - createdDaysAgo) });
  for (const e of ENTRIES) await store.saveDirectoryEntry(e);
  for (const [id, title, daysAgo, status, body] of NOTES) await store.saveNote(noteAt(now, id, PUBLIC_DEMO_CLUB_ID, 'p-alex', title, daysAgo, status, body));
  for (const c of COMMITTEES) await store.saveCommittee(c);
  for (const l of LINKS) await store.saveLink(l);
  const item: ClubTrackerItem = {
    id: 't-hall01',
    orgId: PUBLIC_DEMO_CLUB_ID,
    title: 'Book the hall for the December meeting',
    description: 'Example club to-do item.',
    column: 'next',
    createdAt: iso(now, -3),
    updatedAt: iso(now, -3),
  };
  await store.saveTrackerItem(item);
}

/**
 * Strings that identify the public demo: the workspace's own interface text
 * and this file's fixtures. With ENABLE_CLUB_DEMO=true they may appear only in
 * the demo's files; otherwise nowhere in the public build.
 */
export const PUBLIC_DEMO_MARKERS: string[] = [
  // Interface text from the workspace app (part of the demo bundle).
  'Club workspace',
  'Manage club',
  // The local developer panel's cookie name. It is part of the shared app code
  // (auth.ts) so it ships inside the demo bundle, but the panel itself is off there.
  'kfsb_demo_identity',
  ...PUBLIC_DEMO_ORGS.map((o) => o.name),
  ...PUBLIC_DEMO_PEOPLE.flatMap((p) => [p.name, p.email]),
  ...INVITES.flatMap(([, email, name]) => [email, name]),
  ...ENTRIES.map((e) => e.name),
  ...NOTES.map(([, title]) => title),
];
