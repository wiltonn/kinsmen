/**
 * The public, in-browser Club workspace demo (served at /club-demo when the
 * site is built with ENABLE_CLUB_DEMO=true).
 *
 * It is the real workspace app (same routes, screens, validation and access
 * rules) running inside the visitor's browser tab, on its own private copy of
 * the fictional Maple Ridge fixtures. There is no server, no shared database
 * and no sign-in: choosing "member" or "club admin" only decides which
 * fictional person this tab's copy of the app treats as signed in. It can't
 * reach the real workspace, which runs elsewhere behind Cloudflare Access.
 */
import { createApp } from './app.ts';
import type { AuthProvider } from './auth.ts';
import type { SqlDb } from './db.ts';
import { PUBLIC_DEMO_ADMIN, PUBLIC_DEMO_CLUB_ID, PUBLIC_DEMO_MEMBER, seedPublicDemo } from './public-demo-data.ts';
import { WorkspaceService } from './service.ts';
import { Store } from './store.ts';

export type DemoRole = 'member' | 'admin';

export const DEMO_ROLES: Record<DemoRole, { email: string; name: string; label: string }> = {
  member: { email: PUBLIC_DEMO_MEMBER.email, name: PUBLIC_DEMO_MEMBER.name, label: 'a member' },
  admin: { email: PUBLIC_DEMO_ADMIN.email, name: PUBLIC_DEMO_ADMIN.name, label: 'a club admin' },
};

export const DEMO_HOME = `/w/${PUBLIC_DEMO_CLUB_ID}`;

/** "Signed in" as whichever fictional person the chosen role stands for; nobody otherwise. */
export function publicDemoAuth(role: () => DemoRole | undefined): AuthProvider {
  return {
    mode: 'demo',
    signOutPath: '/sign-out',
    async identify() {
      const r = role();
      return r ? { kind: 'verified', email: DEMO_ROLES[r].email } : { kind: 'signed-out' };
    },
  };
}

/** Opens the demo app on a SQL database, seeding the fictional club if it's empty. */
export async function openPublicDemo(db: SqlDb, role: () => DemoRole | undefined, now = new Date()) {
  const store = new Store(db);
  await store.migrate();
  if ((await store.organizations()).length === 0) await seedPublicDemo(store, now);
  const service = new WorkspaceService({ store });
  const app = createApp({ service, auth: publicDemoAuth(role), publicDemo: true });
  return { app, store, service };
}
