/**
 * LOCAL DEMO server for the Club workspace.
 *
 *   npm run workspace:demo   →  http://127.0.0.1:4322/
 *
 * - Binds to 127.0.0.1 only.
 * - Uses fictional demo data in .workspace-data/demo.sqlite (gitignored).
 * - Demo sign-in (developer panel) is enabled only here, never in the Worker.
 * - Set WORKSPACE_AUTH=none to see the fail-closed behaviour.
 */
import { createServer } from 'node:http';
import { mkdirSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createApp } from './src/app.ts';
import { authFromEnv, demoAuth } from './src/auth.ts';
import { sqliteDb } from './src/db.ts';
import { DEMO_IDENTITIES, seedDemo } from './src/demo-data.ts';
import { WorkspaceService } from './src/service.ts';
import { Store } from './src/store.ts';

const HOST = '127.0.0.1';
const PORT = Number(process.env.WORKSPACE_PORT ?? 4322);
const dataDir = fileURLToPath(new URL('../.workspace-data/', import.meta.url));
const dbFile = `${dataDir}demo.sqlite`;

let store: Store;
let service: WorkspaceService;

async function open(fresh: boolean) {
  mkdirSync(dataDir, { recursive: true });
  if (fresh) rmSync(dbFile, { force: true });
  const db = new DatabaseSync(dbFile);
  store = new Store(sqliteDb(db));
  await store.migrate();
  if (fresh || (await store.organizations()).length === 0) await seedDemo(store);
  service = new WorkspaceService({ store });
}
await open(false);

/** Invited addresses not in the fixed demo list (e.g. someone an admin just invited). */
const invitees = async () => {
  const orgs = new Map((await store.organizations()).map((o) => [o.id, o.name]));
  const known = new Set(DEMO_IDENTITIES.map((i) => i.email));
  return (await store.pendingInvitations()).filter((i) => !known.has(i.email)).map((i) => ({ email: i.email, orgName: orgs.get(i.orgId) ?? i.orgId }));
};

/** Who the developer panel may act as: fixed demo people, anyone who has accepted an invitation, and pending invitees. */
const demoAllowed = async () => [...new Set([...DEMO_IDENTITIES.map((i) => i.email), ...(await store.people()).map((p) => p.email.toLowerCase()), ...(await invitees()).map((i) => i.email)])];

const mode = process.env.WORKSPACE_AUTH ?? 'demo';
const auth = authFromEnv(
  { WORKSPACE_AUTH: mode, CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD: process.env.CF_ACCESS_AUD },
  {
    local: true,
    demo: () => demoAuth(demoAllowed),
  },
);

// The service is replaced on reset, so build the app per request around the current one.
const appFor = () =>
  createApp({
    service,
    auth,
    demo: auth.mode === 'demo' ? { identities: DEMO_IDENTITIES, invitees, allowed: demoAllowed, reset: () => open(true) } : undefined,
  });

createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host ?? `${HOST}:${PORT}`}${req.url}`;
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? 'GET') ? undefined : Buffer.concat(chunks) });
    const response = await appFor().handle(request);
    const out: Record<string, string | string[]> = {};
    response.headers.forEach((v, k) => (out[k] = v));
    const cookies = response.headers.getSetCookie();
    if (cookies.length) out['set-cookie'] = cookies;
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Something went wrong.');
  }
}).listen(PORT, HOST, () => {
  console.log(`Club workspace (${auth.mode === 'demo' ? 'LOCAL DEMO, fictional data' : `auth: ${auth.mode}`}) → http://${HOST}:${PORT}/`);
});
