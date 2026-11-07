/**
 * Club workspace (workspace/): access rules enforced at the data boundary,
 * the acceptance cases from docs/spikes/club-workspace.md, and sign-in modes.
 * Uses Node's SQLite with the same schema/queries the shared (D1) build uses.
 */
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../workspace/src/app';
import { authFromEnv, cloudflareAccessAuth, DEMO_COOKIE, demoAuth, unconfiguredAuth, verifyAccessJwt, type Jwks } from '../workspace/src/auth';
import { sqliteDb } from '../workspace/src/db';
import { DEMO_IDENTITIES, DEMO_ORGS, PUBLIC_DEMO_MARKERS, seedDemo, WORKSPACE_PRIVATE_MARKERS } from '../workspace/src/demo-data';
import { validateOrganizations, type AccessGrant, type Organization } from '../workspace/src/domain';
import { AccessDenied, directoryView, levelIn, wouldRemoveLastAdmin, type Actor } from '../workspace/src/policy';
import { UserError, WorkspaceService } from '../workspace/src/service';
import { Store } from '../workspace/src/store';
import { appForEnv } from '../workspace/worker';

const NOW = new Date('2026-11-07T15:00:00Z');
let store: Store;
let service: WorkspaceService;
let n = 0;

beforeEach(async () => {
  store = new Store(sqliteDb(new DatabaseSync(':memory:')));
  await seedDemo(store, NOW);
  n = 0;
  service = new WorkspaceService({ store, now: () => NOW, newId: () => `id${++n}` });
});

async function as(email: string): Promise<Actor> {
  const r = await service.signIn(email);
  if (r.kind !== 'ok') throw new Error(`${email} could not sign in: ${r.kind}`);
  return r.actor;
}

const denied = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(AccessDenied);

// HTTP helpers (demo sign-in, as the local dev server wires it)
const ORIGIN = 'http://127.0.0.1:4322';
function app() {
  return createApp({
    service,
    auth: demoAuth(async () => [...DEMO_IDENTITIES.map((i) => i.email), 'newbie@example.org', 'pat@example.org']),
    demo: { identities: DEMO_IDENTITIES, invitees: async () => [], reset: async () => undefined },
  });
}
async function http(path: string, opts: { as?: string; form?: Record<string, string>; origin?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.as) headers.cookie = `${DEMO_COOKIE}=${encodeURIComponent(opts.as)}`;
  let body: URLSearchParams | undefined;
  if (opts.form) {
    body = new URLSearchParams(opts.form);
    headers.origin = opts.origin ?? ORIGIN;
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }
  const res = await app().handle(new Request(`${ORIGIN}${path}`, { method: opts.form ? 'POST' : 'GET', headers, body }));
  return { status: res.status, location: res.headers.get('location'), text: await res.text() };
}

describe('organization model', () => {
  it('demo hierarchy is National → Region → District → Clubs, all fictional', () => {
    expect(validateOrganizations(DEMO_ORGS)).toEqual([]);
    expect(DEMO_ORGS.every((o) => o.fictional)).toBe(true);
    expect(DEMO_ORGS.map((o) => o.name).join(' ')).not.toMatch(/Greater London/);
  });

  it('rejects a wrong parent level, but allows an unassigned club', () => {
    const orgs: Organization[] = [
      { id: 'n', name: 'N', level: 'national', parentId: null, description: '', fictional: true },
      { id: 'd', name: 'D', level: 'district', parentId: 'n', description: '', fictional: true },
      { id: 'c', name: 'Real club, district not yet verified', level: 'club', parentId: null, description: '', fictional: false },
    ];
    expect(validateOrganizations(orgs)).toEqual(['D: a district must belong to a region, not a national.']);
  });
});

describe('policy', () => {
  const g = (orgId: string, level: AccessGrant['level'], status: AccessGrant['status'] = 'active', id = `${orgId}-${level}`): AccessGrant => ({ id, personId: 'p', orgId, level, status, createdAt: '' });
  const actor = (grants: AccessGrant[]): Actor => ({ person: { id: 'p', email: 'p@example.org', name: 'P' }, grants });

  it('access is per workspace and never inherited from a parent', () => {
    const district = actor([g('demo-district', 'admin')]);
    expect(levelIn(district, 'demo-district')).toBe('admin');
    expect(levelIn(district, 'club-maple')).toBeUndefined();
    expect(levelIn(actor([g('club-maple', 'member'), g('club-maple', 'admin', 'revoked')]), 'club-maple')).toBe('member');
  });

  it('detects removal of the last active admin', () => {
    const a = g('c', 'admin', 'active', 'a');
    const b = g('c', 'admin', 'active', 'b');
    expect(wouldRemoveLastAdmin([a], a)).toBe(true);
    expect(wouldRemoveLastAdmin([a, b], a)).toBe(false);
    expect(wouldRemoveLastAdmin([a, { ...b, status: 'revoked' }], a)).toBe(true);
    expect(wouldRemoveLastAdmin([a, g('c', 'member', 'active', 'm')], g('c', 'member', 'active', 'm'))).toBe(false);
  });

  it('hides admin-only contact details from members', () => {
    const e = { id: 'e', orgId: 'c', name: 'Jamie', phone: '555', email: 'j@example.org', contactVisibility: 'admins' as const };
    expect(directoryView(e, 'member')).toEqual({ id: 'e', orgId: 'c', name: 'Jamie', contactVisibility: 'admins' });
    expect(directoryView(e, 'admin')).toEqual(e);
  });
});

describe('1. basic member', () => {
  it('lands directly in their only club and reads the latest finalized notes', async () => {
    const mary = await as('mary@example.org');
    expect((await service.workspaces(mary)).map((w) => w.id)).toEqual(['club-maple']);
    expect((await service.latestFinalNote(mary, 'club-maple'))?.title).toBe('October general meeting');
    expect((await service.notes(mary, 'club-maple')).drafts).toEqual([]);
  });

  it('over HTTP: no picker, no role choice, no editing controls, one click to the notes', async () => {
    const root = await http('/', { as: 'mary@example.org' });
    expect(root.status).toBe(303);
    expect(root.location).toBe('/w/club-maple');
    const home = await http('/w/club-maple', { as: 'mary@example.org' });
    expect(home.status).toBe(200);
    expect(home.text).toContain('Maple Ridge Kin Club (demo)');
    expect(home.text).toContain('href="/w/club-maple/notes/n-maple-oct"');
    for (const word of ['Latest meeting notes', 'Member directory', 'Committees', 'Useful links', 'Sign out']) expect(home.text).toContain(word);
    for (const hidden of ['Switch workspace', 'Manage club', 'Invite someone', 'Add meeting notes', 'November general meeting (draft)', 'Demo District 7']) expect(home.text).not.toContain(hidden);
    const notes = await http('/w/club-maple/notes/n-maple-oct', { as: 'mary@example.org' });
    expect(notes.text).toContain('Sugar bush season planning started.');
    expect(notes.text).not.toMatch(/Reopen|Finalize|Edit draft/);
  });

  it('cannot see admin-only contact details', async () => {
    const mary = await as('mary@example.org');
    const jamie = (await service.directory(mary, 'club-maple')).find((e) => e.name === 'Jamie Chair')!;
    expect(jamie.phone).toBeUndefined();
  });
});

describe('2. club admin: invite, draft, finalize', () => {
  it('invites a member (default level Member) who then gets in on first visit', async () => {
    const alex = await as('alex@example.org');
    const inv = await service.invite(alex, 'club-maple', { email: ' Newbie@Example.org ', name: 'Newbie' });
    expect(inv).toMatchObject({ orgId: 'club-maple', email: 'newbie@example.org', level: 'member', status: 'pending', expiresAt: '2026-11-21T15:00:00.000Z' });
    const newbie = await as('newbie@example.org');
    expect(newbie.grants).toMatchObject([{ orgId: 'club-maple', level: 'member', status: 'active' }]);
    expect(newbie.person.name).toBe('Newbie');
  });

  it('adds a directory entry without granting access', async () => {
    const alex = await as('alex@example.org');
    await service.saveDirectoryEntry(alex, 'club-maple', { name: 'Quinn Listed', email: 'quinn@example.org' });
    expect((await service.signIn('quinn@example.org')).kind).toBe('no-access');
  });

  it('a draft is invisible to members; once finalized members can read it; members can edit neither', async () => {
    const alex = await as('alex@example.org');
    const mary = await as('mary@example.org');
    const draft = await service.saveNote(alex, 'club-maple', { title: 'December meeting', meetingDate: '2026-12-08', body: 'Secret draft text' });
    expect(draft.status).toBe('draft');
    await denied(service.note(mary, 'club-maple', draft.id));
    expect((await service.notes(mary, 'club-maple')).final.map((x) => x.id)).not.toContain(draft.id);
    await denied(service.saveNote(mary, 'club-maple', { id: draft.id, title: 'x', meetingDate: '2026-12-08', body: 'x' }));
    await denied(service.finalizeNote(mary, 'club-maple', draft.id));

    await service.finalizeNote(alex, 'club-maple', draft.id);
    expect((await service.note(mary, 'club-maple', draft.id)).body).toBe('Secret draft text');
    expect((await service.latestFinalNote(mary, 'club-maple'))?.id).toBe(draft.id);
    await denied(service.reopenNote(mary, 'club-maple', draft.id));
    await denied(service.saveNote(mary, 'club-maple', { id: draft.id, title: 'x', meetingDate: '2026-12-08', body: 'x' }));
    await expect(service.saveNote(alex, 'club-maple', { id: draft.id, title: 'x', meetingDate: '2026-12-08', body: 'x' })).rejects.toBeInstanceOf(UserError);
  });

  it('over HTTP: save draft, member gets 404, finalize, member reads it, member POST is refused', async () => {
    const save = await http('/w/club-maple/notes', { as: 'alex@example.org', form: { title: 'Board meeting', meetingDate: '2026-11-20', body: 'Draft body', action: 'draft' } });
    expect(save.status).toBe(303);
    const path = save.location!.split('?')[0];
    expect(save.location).toContain('done=note-draft');
    expect((await http(path, { as: 'mary@example.org' })).status).toBe(404);
    expect((await http(path, { as: 'mary@example.org', form: { action: 'finalize' } })).status).toBe(404);
    const confirm = await http(`${path}?done=note-draft`, { as: 'alex@example.org' });
    expect(confirm.text).toContain('Draft saved. Members can’t see it until you finalize it.');
    await http(path, { as: 'alex@example.org', form: { action: 'finalize' } });
    const read = await http(path, { as: 'mary@example.org' });
    expect(read.status).toBe(200);
    expect(read.text).toContain('Draft body');
    expect((await http(path, { as: 'mary@example.org', form: { action: 'reopen' } })).status).toBe(404);
  });
});

describe('3. two clubs in one district', () => {
  it('Club A admin cannot read or change Club B records by ID', async () => {
    const alex = await as('alex@example.org');
    await denied(service.note(alex, 'club-cedar', 'n-cedar-oct'));
    await denied(service.note(alex, 'club-maple', 'n-cedar-oct'));
    await denied(service.directory(alex, 'club-cedar'));
    await denied(service.links(alex, 'club-cedar'));
    await denied(service.committees(alex, 'club-cedar'));
    await denied(service.trackerItems(alex, 'club-cedar'));
    await denied(service.directoryEntry(alex, 'club-maple', 'd-cedar-private'));
    await denied(service.saveNote(alex, 'club-maple', { id: 'n-cedar-oct', title: 'Hijack', meetingDate: '2026-01-01', body: 'x' }));
    await denied(service.removeDirectoryEntry(alex, 'club-maple', 'd-cedar-private'));
    await denied(service.revokeAccess(alex, 'club-cedar', 'g-blair'));
    await denied(service.revokeAccess(alex, 'club-maple', 'g-blair'));
    await denied(service.invite(alex, 'club-cedar', { email: 'x@example.org', level: 'admin' }));
    const blair = await as('blair@example.org');
    expect((await service.note(blair, 'club-cedar', 'n-cedar-oct')).title).toBe('Cedar Falls October meeting');
    expect((await service.directory(blair, 'club-cedar')).map((e) => e.id)).toContain('d-cedar-private');
  });

  it('over HTTP, changing the URL or record ID returns 404 with no private content', async () => {
    const cases = ['/w/club-cedar', '/w/club-cedar/notes/n-cedar-oct', '/w/club-maple/notes/n-cedar-oct', '/w/club-cedar/members', '/w/club-maple/members/d-cedar-private/edit', '/w/club-cedar/manage', '/w/club-cedar/links'];
    for (const path of cases) {
      const res = await http(path, { as: 'alex@example.org' });
      expect(res.status, path).toBe(404);
      expect(res.text).not.toMatch(/PRIVATE|Morgan Cedar-Private|Cedar Falls October/);
    }
    expect((await http('/w/club-cedar/notes/n-cedar-oct', { as: 'alex@example.org', form: { action: 'reopen' } })).status).toBe(404);
    expect((await http('/w/club-maple/access/g-blair', { as: 'alex@example.org', form: { action: 'remove' } })).status).toBe(404);
    expect((await store.note('club-cedar', 'n-cedar-oct'))?.status).toBe('final');
  });
});

describe('4. district admin', () => {
  it('sees club names but not private club data; explicit access to Club A unlocks Club A only', async () => {
    const dana = await as('dana@example.org');
    expect((await service.workspaces(dana)).map((w) => w.id)).toEqual(['demo-district']);
    const units = await service.unitsBelow(dana, 'demo-district');
    expect(units.map((u) => u.name)).toEqual(['Cedar Falls Kin Club (demo)', 'Maple Ridge Kin Club (demo)']);
    expect(JSON.stringify(units)).not.toMatch(/contact|description|secretary/i);
    await denied(service.directory(dana, 'club-maple'));
    await denied(service.directory(dana, 'club-cedar'));
    await denied(service.latestFinalNote(dana, 'club-maple'));

    const alex = await as('alex@example.org');
    await service.invite(alex, 'club-maple', { email: 'dana@example.org', level: 'admin' });
    const dana2 = await as('dana@example.org');
    expect((await service.workspaces(dana2)).map((w) => [w.id, w.access])).toEqual([
      ['club-maple', 'admin'],
      ['demo-district', 'admin'],
    ]);
    expect((await service.directory(dana2, 'club-maple')).length).toBeGreaterThan(0);
    await denied(service.directory(dana2, 'club-cedar'));
    await denied(service.note(dana2, 'club-cedar', 'n-cedar-oct'));
  });

  it('upper levels are also isolated: a region admin cannot manage the district', async () => {
    const rory = await as('rory@example.org');
    expect((await service.unitsBelow(rory, 'demo-region')).map((u) => u.name)).toEqual(['Demo District 7', 'Cedar Falls Kin Club (demo)', 'Maple Ridge Kin Club (demo)']);
    await denied(service.people(rory, 'demo-district'));
    await denied(service.directory(rory, 'club-maple'));
    const nadia = await as('nadia@example.org');
    await denied(service.unitsBelow(nadia, 'demo-region'));
  });

  it('over HTTP: district landing shows names only; Switch workspace appears only after a second grant', async () => {
    const before = await http('/w/demo-district', { as: 'dana@example.org' });
    expect(before.text).toContain('Maple Ridge Kin Club (demo)');
    expect(before.text).not.toContain('Switch workspace');
    expect(before.text).not.toMatch(/October general meeting|Jamie Chair/);
    expect((await http('/w/club-maple', { as: 'dana@example.org' })).status).toBe(404);
    await http('/w/club-maple/invite', { as: 'alex@example.org', form: { email: 'dana@example.org', level: 'admin' } });
    expect((await http('/w/club-maple', { as: 'dana@example.org' })).text).toContain('Switch workspace');
    expect((await http('/w/club-cedar', { as: 'dana@example.org' })).status).toBe(404);
  });
});

describe('5. recovery, revocation and handover', () => {
  it('expired invitation explains what to do and who to ask', async () => {
    const r = await service.signIn('erin@example.org');
    expect(r).toMatchObject({ kind: 'expired', help: { orgName: 'Maple Ridge Kin Club (demo)', contactEmail: 'secretary@maple.example.org', adminNames: ['Alex Admin'] } });
    const page = await http('/', { as: 'erin@example.org' });
    expect(page.status).toBe(403);
    expect(page.text).toContain('Your invitation has expired');
    expect(page.text).toContain('Get help from your club');
  });

  it('an admin re-sends an expired invitation and the person gets in', async () => {
    const alex = await as('alex@example.org');
    expect((await service.invitations(alex, 'club-maple')).find((i) => i.email === 'erin@example.org')?.expired).toBe(true);
    await service.invite(alex, 'club-maple', { email: 'erin@example.org' });
    expect((await service.signIn('erin@example.org')).kind).toBe('ok');
  });

  it('removed access blocks the next request even with an old session and an old invitation', async () => {
    expect((await http('/w/club-maple', { as: 'mary@example.org' })).status).toBe(200);
    const alex = await as('alex@example.org');
    await service.invite(alex, 'club-maple', { email: 'mary@example.org', level: 'admin' }); // a pending invitation…
    await service.revokeAccess(alex, 'club-maple', 'g-mary'); // …is revoked with the access
    const after = await http('/w/club-maple', { as: 'mary@example.org' }); // same demo session cookie
    expect(after.status).toBe(403);
    expect(after.text).toContain('You no longer have access');
    expect((await service.signIn('mary@example.org')).kind).toBe('revoked');
    expect((await service.signIn('ray@example.org')).kind).toBe('revoked');
  });

  it('a cancelled invitation can no longer be used', async () => {
    const alex = await as('alex@example.org');
    await service.revokeInvitation(alex, 'club-maple', 'i-pat');
    expect((await service.signIn('pat@example.org')).kind).toBe('no-access');
  });

  it('never removes or demotes the last admin; a second named admin enables handover', async () => {
    const alex = await as('alex@example.org');
    await expect(service.revokeAccess(alex, 'club-maple', 'g-alex')).rejects.toThrow(/last admin/);
    await expect(service.setAccessLevel(alex, 'club-maple', 'g-alex', 'member')).rejects.toThrow(/last admin/);
    const res = await http('/w/club-maple/access/g-alex', { as: 'alex@example.org', form: { action: 'remove' } });
    expect(res.status).toBe(422);
    expect(res.text).toContain('This is the last admin');

    await service.setAccessLevel(alex, 'club-maple', 'g-mary', 'admin');
    await service.setAccessLevel(alex, 'club-maple', 'g-alex', 'member');
    const mary = await as('mary@example.org');
    expect(service.isAdmin(mary, 'club-maple')).toBe(true);
    await expect(service.revokeAccess(mary, 'club-maple', 'g-mary')).rejects.toThrow(/last admin/);
  });

  it('an uninvited but verified email gets a plain explanation, not access', async () => {
    expect(await service.signIn('stranger@example.org')).toEqual({ kind: 'no-access', email: 'stranger@example.org' });
  });
});

describe('design review changes', () => {
  it('destructive and power-granting actions go through a confirmation page that changes nothing', async () => {
    const page = await http('/w/club-maple/access/g-mary/remove', { as: 'alex@example.org' });
    expect(page.status).toBe(200);
    expect(page.text).toContain('Remove <strong>Mary Member</strong>’s access to <strong>Maple Ridge Kin Club (demo)</strong>?');
    expect(page.text).toContain('Yes, remove access');
    expect((await service.signIn('mary@example.org')).kind).toBe('ok');
    expect((await http('/w/club-maple/access/g-mary/make-admin', { as: 'alex@example.org' })).text).toContain('Yes, make admin');
    for (const path of ['/w/club-maple/invitations/i-pat/cancel', '/w/club-maple/links/l-cal/remove', '/w/club-maple/committees/c-fund/remove', '/w/club-maple/members/d-taylor/remove']) {
      const res = await http(path, { as: 'alex@example.org' });
      expect(res.status, path).toBe(200);
      expect(res.text, path).toMatch(/Yes, (cancel|remove)/);
    }
    expect((await service.links(await as('alex@example.org'), 'club-maple')).map((l) => l.id)).toContain('l-cal');
  });

  it('confirmation pages enforce the same access rules', async () => {
    for (const path of ['/w/club-maple/access/g-alex/remove', '/w/club-maple/links/l-cal/remove', '/w/club-maple/members/d-taylor/remove', '/w/club-maple/invitations/i-pat/cancel']) {
      expect((await http(path, { as: 'mary@example.org' })).status, path).toBe(404);
    }
    for (const path of ['/w/club-cedar/access/g-blair/remove', '/w/club-maple/access/g-blair/remove', '/w/club-maple/links/l-cedar/remove', '/w/club-maple/members/d-cedar-private/remove', '/w/club-maple/committees/c-cedar/remove']) {
      const res = await http(path, { as: 'alex@example.org' });
      expect(res.status, path).toBe(404);
      expect(res.text).not.toMatch(/Blair Cedar|Cedar Falls shared drive|Morgan Cedar-Private|Cedar hall/);
    }
  });

  it('the invitation page is a redirect target, so refreshing it does not invite again', async () => {
    const res = await http('/w/club-maple/invite', { as: 'alex@example.org', form: { email: 'sam@example.org', name: 'Sam' } });
    expect(res.status).toBe(303);
    expect(res.location).toMatch(/^\/w\/club-maple\/invite\/[a-z0-9]+$/);
    for (let i = 0; i < 2; i++) {
      const ready = await http(res.location!, { as: 'alex@example.org' });
      expect(ready.text).toContain('Invitation ready');
      expect(ready.text).toContain('No email has been sent yet.');
    }
    expect((await store.invitationsForOrg('club-maple')).filter((i) => i.email === 'sam@example.org')).toHaveLength(1);
    expect((await http(res.location!, { as: 'mary@example.org' })).status).toBe(404);
  });

  it('marks the field that has the problem', async () => {
    const res = await http('/w/club-maple/invite', { as: 'alex@example.org', form: { email: 'not-an-email' } });
    expect(res.status).toBe(422);
    expect(res.text).toMatch(/id="iemail"[^>]*aria-invalid="true" aria-describedby="err-email"/);
    expect(res.text).toContain('<p class="field-error" id="err-email">');
    const link = await http('/w/club-maple/links', { as: 'alex@example.org', form: { title: 'Bad', url: 'ftp://x' } });
    expect(link.text).toMatch(/id="lurl"[^>]*aria-invalid="true"/);
  });

  it('the last admin sees an explanation instead of disabled buttons', async () => {
    const manage = await http('/w/club-maple/manage', { as: 'alex@example.org' });
    expect(manage.text).toContain('You’re the only admin. To step down, first make someone else an admin.');
    expect(manage.text).not.toContain('/access/g-alex/remove');
    expect(manage.text).not.toMatch(/<button[^>]*disabled/);
    expect(manage.text).toContain('<h1>Manage club</h1>');
  });

  it('success messages name the workspace', async () => {
    const res = await http('/w/club-maple/links', { as: 'alex@example.org', form: { title: 'Rota', url: 'https://example.org/rota' } });
    expect((await http(res.location!, { as: 'alex@example.org' })).text).toContain('Link added for Maple Ridge Kin Club (demo).');
  });
});

describe('sign-in modes fail closed', () => {
  it('no provider: every private route is 503 and shows nothing private', async () => {
    const closed = createApp({ service, auth: unconfiguredAuth('No sign-in provider is configured.') });
    for (const path of ['/', '/w/club-maple', '/w/club-maple/notes/n-maple-oct', '/__demo']) {
      const res = await closed.handle(new Request(`${ORIGIN}${path}`, { headers: { cookie: `${DEMO_COOKIE}=alex%40example.org` } }));
      expect([503, 404]).toContain(res.status);
      expect(await res.text()).not.toMatch(/October general meeting|Maple Ridge|Developer panel/);
    }
  });

  it('demo sign-in is refused outside the local server, including in the Worker', async () => {
    expect(authFromEnv({ WORKSPACE_AUTH: 'demo' }, { local: false, demo: () => demoAuth(async () => []) }).mode).toBe('none');
    expect(authFromEnv({ WORKSPACE_AUTH: 'cloudflare-access' }, { local: false }).mode).toBe('none');
    expect(authFromEnv({}, { local: true }).mode).toBe('none');
    const db = new DatabaseSync(':memory:');
    const d1 = { prepare: (sql: string) => ({ bind: (...p: (string | number | null)[]) => ({ all: async () => ({ results: db.prepare(sql).all(...p) }), run: async () => db.prepare(sql).run(...p) }) }), exec: async (sql: string) => db.exec(sql) };
    await new Store(sqliteDb(db)).migrate();
    const res = await appForEnv({ DB: d1 as never, WORKSPACE_AUTH: 'demo' }).handle(new Request('https://club.example.org/w/club-maple', { headers: { cookie: `${DEMO_COOKIE}=alex%40example.org` } }));
    expect(res.status).toBe(503);
    expect((await appForEnv({ WORKSPACE_AUTH: 'cloudflare-access', CF_ACCESS_AUD: 'a', CF_ACCESS_TEAM_DOMAIN: 't.cloudflareaccess.com' }).handle(new Request('https://x.example/'))).status).toBe(503);
  });

  it('the developer panel does not exist without demo mode', async () => {
    const access = createApp({ service, auth: cloudflareAccessAuth({ teamDomain: 't.cloudflareaccess.com', audience: 'aud', fetchJwks: async () => ({ keys: [] }) }) });
    expect((await access.handle(new Request(`${ORIGIN}/__demo`))).status).toBe(404);
    expect((await access.handle(new Request(`${ORIGIN}/w/club-maple`))).status).toBe(401);
  });

  it('rejects cross-site form posts', async () => {
    expect((await http('/w/club-maple/notes', { as: 'alex@example.org', form: { title: 'x', meetingDate: '2026-11-01', body: 'x' }, origin: 'https://evil.example' })).status).toBe(403);
  });
});

describe('Cloudflare Access JWT verification', () => {
  const team = 'kinsmen-test.cloudflareaccess.com';
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  async function setup() {
    const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
    const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
    const sign = async (payload: Record<string, unknown>, kid = 'k1') => {
      const data = `${enc({ alg: 'RS256', kid })}.${enc(payload)}`;
      const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(data))).toString('base64url');
      return `${data}.${sig}`;
    };
    const fetchJwks = async (url: string): Promise<Jwks> => {
      expect(url).toBe(`https://${team}/cdn-cgi/access/certs`);
      return { keys: [jwk] };
    };
    return { sign, config: { teamDomain: team, audience: 'aud-123', fetchJwks, now: () => NOW.getTime() } };
  }
  const exp = Math.floor(NOW.getTime() / 1000) + 3600;

  it('accepts a valid token and returns the verified email', async () => {
    const { sign, config } = await setup();
    expect(await verifyAccessJwt(await sign({ aud: ['aud-123'], iss: `https://${team}`, exp, email: 'mary@example.org' }), config)).toBe('mary@example.org');
  });

  it('rejects tampered, wrong-audience, wrong-issuer, expired and unknown-key tokens', async () => {
    const { sign, config } = await setup();
    const good = { aud: ['aud-123'], iss: `https://${team}`, exp, email: 'mary@example.org' };
    const token = await sign(good);
    const [h, , s] = token.split('.');
    await expect(verifyAccessJwt(`${h}.${enc({ ...good, email: 'alex@example.org' })}.${s}`, config)).rejects.toThrow('Bad signature');
    await expect(verifyAccessJwt(await sign({ ...good, aud: ['other'] }), config)).rejects.toThrow('Wrong audience');
    await expect(verifyAccessJwt(await sign({ ...good, iss: 'https://evil.cloudflareaccess.com' }), config)).rejects.toThrow('Wrong issuer');
    await expect(verifyAccessJwt(await sign({ ...good, exp: exp - 7200 }), config)).rejects.toThrow('Expired');
    await expect(verifyAccessJwt(await sign(good, 'nope'), config)).rejects.toThrow('Unknown signing key');
  });

  it('end to end: a verified Access token signs Mary in; a bad one does not', async () => {
    const { sign, config } = await setup();
    const accessApp = createApp({ service, auth: cloudflareAccessAuth(config) });
    const ok = await accessApp.handle(new Request(`${ORIGIN}/w/club-maple`, { headers: { 'cf-access-jwt-assertion': await sign({ aud: 'aud-123', iss: `https://${team}`, exp, email: 'mary@example.org' }) } }));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toContain('Read the latest meeting notes');
    const forged = await accessApp.handle(new Request(`${ORIGIN}/w/club-maple`, { headers: { 'cf-access-jwt-assertion': 'a.b.c' } }));
    expect(forged.status).toBe(401);
  });
});

describe('public boundary', () => {
  it('the post-build check covers workspace people, clubs and private records', () => {
    // Never public, not even in the /club-demo bundle:
    for (const s of ['Cedar Falls Kin Club (demo)', 'Blair Cedar', 'blair@example.org', 'Dana District', 'PRIVATE TO CEDAR FALLS', 'Morgan Cedar-Private', 'Cedar Falls shared drive']) expect(WORKSPACE_PRIVATE_MARKERS).toContain(s);
    // Public only inside the demo's own files, and only with ENABLE_CLUB_DEMO=true:
    for (const s of ['Mary Member', 'mary@example.org', 'Maple Ridge Kin Club (demo)', 'Demo District 7', 'November general meeting (draft)', 'Jamie Chair', 'kfsb_demo_identity', 'Manage club']) expect(PUBLIC_DEMO_MARKERS).toContain(s);
    expect(WORKSPACE_PRIVATE_MARKERS.filter((m) => PUBLIC_DEMO_MARKERS.includes(m))).toEqual([]);
  });
});
