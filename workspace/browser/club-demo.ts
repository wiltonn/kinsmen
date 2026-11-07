/**
 * Page script for /club-demo: runs the real Club workspace app in this browser
 * tab (see workspace/src/public-demo.ts).
 *
 * - The app's pages live under /club-demo/... in the address bar, so links,
 *   Back/Forward, bookmarks and refresh all work (the host rewrites
 *   /club-demo/* to this page).
 * - Link clicks and form posts are turned into Requests for app.handle(), and
 *   the HTML it returns replaces the page.
 * - Data is SQLite (sql.js) saved to this browser's localStorage, so each
 *   reviewer has their own copy. Nothing is sent anywhere.
 */
import initSqlJs, { type Database } from 'sql.js';
import { sqlJsDb } from '../src/db.ts';
import { html, layout, Raw } from '../src/html.ts';
import { DEMO_HOME, DEMO_ROLES, openPublicDemo, type DemoRole } from '../src/public-demo.ts';
import { confirmPage } from '../src/views.ts';

const BASE = '/club-demo';
const ASSETS = '/club-demo-assets';
const DB_KEY = 'kfsb-club-demo:v1:db';
const ROLE_KEY = 'kfsb-club-demo:v1:role';

// ---------------------------------------------------------------------------
// Browser storage (may be unavailable, e.g. some private windows)
// ---------------------------------------------------------------------------

let memoryRole: DemoRole | undefined;
let canSave = true;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    canSave = false;
    return null;
  }
}
function save(key: string, value: string | undefined) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    canSave = false;
  }
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const role = (): DemoRole | undefined => {
  const r = load(ROLE_KEY) ?? memoryRole;
  return r === 'member' || r === 'admin' ? r : undefined;
};
const setRole = (r: DemoRole | undefined) => {
  memoryRole = r;
  save(ROLE_KEY, r);
};

// ---------------------------------------------------------------------------
// The app, on this browser's copy of the data
// ---------------------------------------------------------------------------

const SQL = await initSqlJs({ locateFile: (f: string) => `${ASSETS}/${f}` });
let sqlite: Database;
let demo: Awaited<ReturnType<typeof openPublicDemo>>;

async function open(fresh: boolean) {
  const saved = fresh ? null : load(DB_KEY);
  try {
    sqlite = saved ? new SQL.Database(fromBase64(saved)) : new SQL.Database();
  } catch {
    sqlite = new SQL.Database();
  }
  demo = await openPublicDemo(sqlJsDb(sqlite), role);
  persist();
}
const persist = () => save(DB_KEY, toBase64(sqlite.export()));
await open(false);

// ---------------------------------------------------------------------------
// Demo-only pages: choose a view, reset
// ---------------------------------------------------------------------------

const savingNote = () =>
  canSave
    ? html`Your changes are saved in this browser only, so they’re still here if you refresh. Nobody else sees them, and nothing is emailed. <strong>Reset demo</strong> starts over.`
    : html`This browser isn’t letting the demo save, so your changes disappear if you refresh. Nobody else sees them, and nothing is emailed.`;

function choosePage() {
  return layout(
    { title: 'Try the club workspace' },
    html`<h1>Try the club workspace</h1>
<p>A working demo of the private online space a Kin club could use for meeting notes, the member directory, committees and useful links.</p>
<p class="note"><strong>Demo — sample club information.</strong> Try it with made-up names and notes. ${savingNote()}</p>
<div class="grid two">
  <section class="card"><h2>View as a member</h2><p>Read the latest meeting notes and find people, committees and links.</p><a class="btn block" href="/as/member">View as a member</a></section>
  <section class="card"><h2>View as a club admin</h2><p>Write meeting notes, save them as a draft, then share them with members.</p><a class="btn block" href="/as/admin">View as a club admin</a></section>
</div>
<p class="small"><a href="/kinsmen" data-site>← Back to the Kinsmen page</a> · <a href="/reset">Reset demo</a></p>`,
  );
}

function resetPage() {
  return layout(
    { title: 'Reset demo' },
    confirmPage({
      title: 'Reset the demo?',
      message: html`This puts the sample club back the way it started. Anything you added or changed in this browser is removed.`,
      action: '/reset',
      fields: { reset: '1' },
      confirmLabel: 'Yes, reset the demo',
      cancelHref: role() ? DEMO_HOME : '/',
      cancelLabel: 'Keep my changes',
      danger: true,
    }),
  );
}

/** The bar shown above every page of the demo. */
function demoBar() {
  const r = role();
  const tab = (to: DemoRole, label: string) =>
    html`<a class="btn small ${r === to ? '' : 'secondary'}" href="/as/${to}" ${r === to ? new Raw('aria-current="true"') : ''}>${label}</a>`;
  return html`<div class="demo-bar" role="region" aria-label="Demo">
  <div class="wrap">
    <p><strong>Demo — sample club information.</strong> Try it with made-up names and notes.${r ? html` Viewing as <strong>${DEMO_ROLES[r].label}</strong> (${DEMO_ROLES[r].name}).` : ''} <a href="/reset">Reset demo</a></p>
    ${r === 'admin' ? html`<p class="small">Try this: <strong>Add meeting notes</strong>, save a draft, finalize it, then switch to <strong>View as a member</strong> to see it.</p>` : ''}
    <div class="demo-actions">${tab('member', 'View as a member')}${tab('admin', 'View as a club admin')}</div>
  </div>
</div>`.value;
}

const DEMO_CSS = `
.demo-bar{background:var(--warn-bg);border-bottom:1px solid var(--line);padding:10px 0;font-size:16px;line-height:1.45}
.demo-bar p{margin:0 0 8px}.demo-bar .demo-actions{display:flex;gap:8px}
.demo-bar .demo-actions .btn{flex:1;min-height:44px;padding:6px 10px;font-size:16px;text-align:center;line-height:1.25}
main:focus{outline:none}
`;

// ---------------------------------------------------------------------------
// Routing: app paths ("/w/club-maple/notes") <-> address bar ("/club-demo/w/...")
// ---------------------------------------------------------------------------

const inDemo = (pathname: string) => pathname === BASE || pathname.startsWith(`${BASE}/`);
const toAppPath = (u: URL) => (u.pathname.slice(BASE.length) || '/') + u.search + u.hash;
const toBrowserPath = (appPath: string) => (appPath.startsWith('/?') || appPath.startsWith('/#') || appPath === '/' ? BASE + appPath.slice(1) : BASE + appPath);

type Page = { html: string; appPath: string; bar?: boolean };

async function respond(appPath: string, body?: FormData): Promise<Page> {
  const u = new URL(appPath, location.origin);
  const path = u.pathname.replace(/\/+$/, '') || '/';

  if (path === '/as/member' || path === '/as/admin') {
    setRole(path === '/as/admin' ? 'admin' : 'member');
    return respond(DEMO_HOME);
  }
  if (path === '/sign-out') {
    setRole(undefined);
    return { html: choosePage(), appPath: '/', bar: false };
  }
  if (path === '/reset') {
    if (!body) return { html: resetPage(), appPath: '/reset' };
    await open(true);
    setRole(undefined);
    return { html: choosePage(), appPath: '/', bar: false };
  }
  // Nobody chosen yet (first visit, even to a deep link): ask first.
  if (!role()) return { html: choosePage(), appPath: '/', bar: false };

  let res = await demo.app.handle(new Request(new URL(appPath, location.origin), body ? { method: 'POST', body } : undefined));
  let finalPath = appPath;
  for (let hops = 0; res.status === 303 && hops < 5; hops++) {
    finalPath = res.headers.get('location') ?? DEMO_HOME;
    if (!role()) return { html: choosePage(), appPath: '/', bar: false };
    res = await demo.app.handle(new Request(new URL(finalPath, location.origin)));
  }
  if (body) persist();
  return { html: await res.text(), appPath: finalPath };
}

/** Puts a page the app rendered into the document, with the demo bar, and app links pointed under /club-demo. */
function show(page: Page) {
  const doc = new DOMParser().parseFromString(page.html, 'text/html');
  doc.head.insertAdjacentHTML('beforeend', `<style>${DEMO_CSS}</style>`);
  if (page.bar !== false) doc.body.insertAdjacentHTML('afterbegin', demoBar());
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href^="/"]:not([href^="//"]):not([data-site])')) a.setAttribute('href', toBrowserPath(a.getAttribute('href')!));
  for (const f of doc.querySelectorAll<HTMLFormElement>('form[action^="/"]:not([action^="//"])')) f.setAttribute('action', toBrowserPath(f.getAttribute('action')!));
  document.title = doc.title;
  document.head.replaceChildren(...[...doc.head.childNodes].map((n) => document.importNode(n, true)));
  document.body.replaceWith(document.importNode(doc.body, true));
  // Scripts inserted this way don't run; recreate them so they do (e.g. "Copy link").
  for (const old of document.body.querySelectorAll('script')) {
    const s = document.createElement('script');
    s.textContent = old.textContent;
    old.replaceWith(s);
  }
  const hash = new URL(page.appPath, location.origin).hash;
  const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  const main = document.getElementById('main');
  if (main) {
    main.tabIndex = -1;
    if (!target) main.focus({ preventScroll: true });
  }
}

let busy = false;
async function go(appPath: string, opts: { body?: FormData; history?: 'push' | 'replace' | 'none' } = {}) {
  if (busy) return;
  busy = true;
  try {
    const page = await respond(appPath, opts.body);
    const url = toBrowserPath(page.appPath);
    if (opts.history === 'replace') history.replaceState(null, '', url);
    else if (opts.history !== 'none' && url !== location.pathname + location.search + location.hash) history.pushState(null, '', url);
    show(page);
  } catch (e) {
    console.error(e);
    show({
      html: layout({ title: 'Something went wrong' }, html`<h1>Something went wrong</h1><p>The demo hit a problem. Try <a href="/reset">resetting the demo</a>.</p>`),
      appPath: '/',
    });
  } finally {
    busy = false;
  }
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin || !inDemo(u.pathname)) return;
  // Same page, different #section: let the browser scroll.
  if (u.hash && u.pathname === location.pathname && u.search === location.search) return;
  e.preventDefault();
  void go(toAppPath(u));
});

document.addEventListener('submit', (e) => {
  const form = e.target as HTMLFormElement;
  // Read the attributes: form.action / form.method are shadowed by fields named "action" (the app uses those).
  const u = new URL(form.getAttribute('action') ?? '', location.href);
  if (u.origin !== location.origin || !inDemo(u.pathname)) return;
  e.preventDefault();
  const data = new FormData(form, (e as SubmitEvent).submitter);
  if ((form.getAttribute('method') ?? 'get').toLowerCase() === 'post') return void go(toAppPath(u), { body: data });
  for (const [k, v] of data) if (typeof v === 'string') u.searchParams.set(k, v);
  void go(toAppPath(u));
});

window.addEventListener('popstate', () => void go(toAppPath(new URL(location.href)), { history: 'none' }));

await go(toAppPath(new URL(location.href)), { history: 'replace' });
