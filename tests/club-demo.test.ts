/**
 * The public Club workspace demo (/club-demo, behind ENABLE_CLUB_DEMO):
 * the build flag, the privacy rules that confine demo fixtures to the demo's
 * files, and the demo app itself, run here on sql.js exactly as in the browser.
 */
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { beforeAll, describe, expect, it } from 'vitest';
import { findPrivateData } from '../scripts/private-data-rules';
import { CLUB_DEMO_PATH, clubDemoEnabled, isClubDemoFile } from '../src/lib/club-demo';
import { createApp } from '../workspace/src/app';
import { sqlJsDb } from '../workspace/src/db';
import { demoAuth } from '../workspace/src/auth';
import { WORKSPACE_PRIVATE_MARKERS } from '../workspace/src/demo-data';
import { DEMO_HOME, openPublicDemo, type DemoRole } from '../workspace/src/public-demo';
import { PUBLIC_DEMO_MARKERS } from '../workspace/src/public-demo-data';
import { WorkspaceService } from '../workspace/src/service';
import { Store } from '../workspace/src/store';

const ORIGIN = 'https://kinsmenfanshawesugarbush.vercel.app';
let SQL: Awaited<ReturnType<typeof initSqlJs>>;
beforeAll(async () => {
  SQL = await initSqlJs();
});

describe('ENABLE_CLUB_DEMO flag', () => {
  it('is off unless explicitly "true"', () => {
    expect(clubDemoEnabled({})).toBe(false);
    for (const v of ['', 'false', '0', '1', 'yes', 'on']) expect(clubDemoEnabled({ ENABLE_CLUB_DEMO: v }), v).toBe(false);
    for (const v of ['true', 'TRUE', ' true ']) expect(clubDemoEnabled({ ENABLE_CLUB_DEMO: v }), v).toBe(true);
  });

  it('vercel.json serves every /club-demo/... address from the demo page (a 404 when it was not built)', () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    expect(vercel.rewrites).toEqual([{ source: '/club-demo/:path*', destination: '/club-demo.html' }]);
  });
});

describe('private-data rules', () => {
  const page = (path: string, text: string) => ({ path, text });
  const demoBuild = [page('club-demo.html', '<title>Try the club workspace</title>'), page('club-demo-assets/club-demo.js', 'Mary Member Manage club'), page('kinsmen.html', `<a href="${CLUB_DEMO_PATH}">Try the club workspace</a>`)];

  it('flag on: demo fixtures are allowed in the demo files only', () => {
    expect(findPrivateData(demoBuild, { demoEnabled: true })).toEqual([]);
    expect(findPrivateData([...demoBuild, page('kinsmen.html', 'Mary Member')], { demoEnabled: true }).join('\n')).toContain('kinsmen.html: contains demo data "Mary Member" outside the demo files');
  });

  it('flag on: non-public fixtures and tracker data are refused even inside the demo files', () => {
    const problems = findPrivateData([...demoBuild, page('club-demo-assets/club-demo.js', 'PRIVATE TO CEDAR FALLS Website Admin')], { demoEnabled: true }).join('\n');
    expect(problems).toContain('"PRIVATE TO CEDAR FALLS"');
    expect(problems).toContain('"Website Admin"');
  });

  it('flag off: no demo files, no demo data, no link to /club-demo', () => {
    const problems = findPrivateData(demoBuild, { demoEnabled: false }).join('\n');
    expect(problems).toContain('demo files were built but ENABLE_CLUB_DEMO is off');
    expect(problems).toContain('club-demo-assets/club-demo.js: contains demo data "Mary Member"');
    expect(problems).toContain('kinsmen.html: mentions /club-demo');
    expect(findPrivateData([page('index.html', 'Pancakes')], { demoEnabled: false })).toEqual([]);
  });

  it('flag on but the demo was not built is a failure', () => {
    expect(findPrivateData([page('index.html', 'Pancakes')], { demoEnabled: true }).join('\n')).toContain('club-demo.html was not built');
  });

  it('only the demo page and its asset folder count as demo files', () => {
    expect(isClubDemoFile('club-demo.html')).toBe(true);
    expect(isClubDemoFile('club-demo-assets/club-demo.js')).toBe(true);
    for (const f of ['kinsmen.html', 'club-demo-evil.html', '_astro/club-demo.js', 'club-demo/x.html']) expect(isClubDemoFile(f), f).toBe(false);
  });
});

describe('the demo app (sql.js, as in the browser)', () => {
  async function demo() {
    let role: DemoRole | undefined;
    const db = new SQL.Database();
    const opened = await openPublicDemo(sqlJsDb(db), () => role, new Date('2026-11-07T15:00:00Z'));
    const get = async (path: string) => {
      const res = await opened.app.handle(new Request(`${ORIGIN}${path}`));
      return { status: res.status, location: res.headers.get('location'), text: await res.text() };
    };
    // Built by the page script, so no Origin header (browsers won't let scripts set it).
    const post = async (path: string, form: Record<string, string>) => {
      const body = new FormData();
      for (const [k, v] of Object.entries(form)) body.set(k, v);
      const res = await opened.app.handle(new Request(`${ORIGIN}${path}`, { method: 'POST', body }));
      return { status: res.status, location: res.headers.get('location') };
    };
    return { ...opened, db, get, post, as: (r: DemoRole | undefined) => (role = r) };
  }

  it('ships only the public Maple Ridge club', async () => {
    const d = await demo();
    expect((await d.store.organizations()).map((o) => o.id).sort()).toEqual(['club-maple', 'demo-district', 'demo-national', 'demo-region']);
    const dump = JSON.stringify(d.db.exec('SELECT * FROM people; SELECT * FROM meeting_notes; SELECT * FROM links; SELECT * FROM directory_entries; SELECT * FROM committees'));
    for (const m of WORKSPACE_PRIVATE_MARKERS) expect(dump, m).not.toContain(m);
  });

  it('nobody is signed in until a view is chosen', async () => {
    const d = await demo();
    expect((await d.get(DEMO_HOME)).status).toBe(401);
  });

  it('the walkthrough: member reads notes; admin drafts (hidden from members), finalizes (shown)', async () => {
    const d = await demo();
    d.as('member');
    const home = await d.get(DEMO_HOME);
    expect(home.text).toContain('Read the latest meeting notes');
    expect(home.text).toContain('October general meeting');
    expect(home.text).not.toContain('Manage club');
    expect((await d.get(`${DEMO_HOME}/notes`)).text).not.toContain('November general meeting (draft)');

    d.as('admin');
    const saved = await d.post(`${DEMO_HOME}/notes`, { title: 'Reviewer meeting', meetingDate: '2026-11-06', body: 'Made-up notes.', action: 'draft' });
    expect(saved.status).toBe(303);
    const noteUrl = saved.location!.split('?')[0];

    d.as('member');
    expect((await d.get(`${DEMO_HOME}/notes`)).text).not.toContain('Reviewer meeting');
    expect((await d.get(noteUrl)).status).toBe(404);
    expect((await d.post(noteUrl, { action: 'finalize' })).status).toBe(404);

    d.as('admin');
    expect((await d.post(noteUrl, { action: 'finalize' })).location).toContain('done=note-final');

    d.as('member');
    const after = await d.get(DEMO_HOME);
    expect(after.text).toContain('Reviewer meeting');
    const note = await d.get(noteUrl);
    expect(note.status).toBe(200);
    expect(note.text).not.toContain('Reopen as draft');
  });

  it('uses the app’s own validation', async () => {
    const d = await demo();
    d.as('admin');
    expect((await d.post(`${DEMO_HOME}/notes`, { title: '', meetingDate: '2026-11-06', body: '', action: 'draft' })).status).toBe(422);
  });

  it('survives a save and reload of the database (what refresh does)', async () => {
    const d = await demo();
    d.as('admin');
    await d.post(`${DEMO_HOME}/notes`, { title: 'Kept after refresh', meetingDate: '2026-11-06', body: '', action: 'final' });
    const reopened = await openPublicDemo(sqlJsDb(new SQL.Database(d.db.export())), () => 'member');
    const res = await reopened.app.handle(new Request(`${ORIGIN}${DEMO_HOME}`));
    expect(await res.text()).toContain('Kept after refresh');
  });

  it('has no developer panel, and invitations send nothing', async () => {
    const d = await demo();
    expect((await d.get('/__demo')).status).toBe(404);
    d.as('admin');
    const created = await d.post(`${DEMO_HOME}/invite`, { email: 'someone@example.org', name: 'Someone' });
    const page = await d.get(created.location!);
    expect(page.text).toContain('This is a demo, so nothing was sent');
    expect(page.text).not.toContain('mailto:');
    expect(page.text).not.toContain(ORIGIN);
  });

  it('the cross-site check still applies everywhere else', async () => {
    const store = new Store(sqlJsDb(new SQL.Database()));
    await store.migrate();
    const app = createApp({ service: new WorkspaceService({ store }), auth: demoAuth(async () => []) });
    expect((await app.handle(new Request(`${ORIGIN}${DEMO_HOME}/notes`, { method: 'POST', body: new FormData() }))).status).toBe(403);
  });
});

describe('demo markers', () => {
  it('cover the public fixtures, and never overlap the private ones', () => {
    for (const m of ['Maple Ridge Kin Club (demo)', 'Mary Member', 'Alex Admin', 'Pat Newcomer', 'Taylor Treasurer']) expect(PUBLIC_DEMO_MARKERS).toContain(m);
    expect(PUBLIC_DEMO_MARKERS.filter((m) => WORKSPACE_PRIVATE_MARKERS.includes(m))).toEqual([]);
  });
});
