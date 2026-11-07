/**
 * Cloudflare Worker entry for a SHARED deployment (not deployed by this spike).
 *
 * - Sign-in: Cloudflare Access in front of the Worker (one-time PIN by email).
 *   Requires WORKSPACE_AUTH=cloudflare-access, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD.
 * - Data: a D1 database bound as DB (schema in src/db.ts).
 * - The demo sign-in can never be enabled here: `local: false`.
 * - With anything missing, every private route returns 503 (fail closed).
 */
import { createApp } from './src/app.ts';
import { authFromEnv } from './src/auth.ts';
import { d1Db, type D1Like } from './src/db.ts';
import { WorkspaceService } from './src/service.ts';
import { Store } from './src/store.ts';

export interface Env {
  DB?: D1Like;
  WORKSPACE_AUTH?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export function appForEnv(env: Env) {
  const auth = authFromEnv(env, { local: false });
  if (!env.DB) {
    return { handle: async () => new Response('Workspace storage is not configured.', { status: 503, headers: { 'cache-control': 'no-store' } }) };
  }
  return createApp({ service: new WorkspaceService({ store: new Store(d1Db(env.DB)) }), auth });
}

export default {
  fetch(request: Request, env: Env) {
    return appForEnv(env).handle(request);
  },
};
