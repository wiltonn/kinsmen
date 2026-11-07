/**
 * Who is making this request? Answers only with an email address that a
 * sign-in provider has VERIFIED. Never trusts an email typed into a form.
 *
 * Modes:
 *   cloudflare-access  Shared deployment. Cloudflare Access (one-time PIN by
 *                      email) sits in front of the app and signs a JWT for
 *                      every request; we verify it here.
 *   demo               Local development only, fictional people, chosen in a
 *                      developer panel. Refused in a shared deployment.
 *   none               Nothing configured: every private route fails closed.
 */

export type Identity = { kind: 'verified'; email: string } | { kind: 'signed-out' } | { kind: 'unconfigured'; reason: string };

export interface AuthProvider {
  mode: 'cloudflare-access' | 'demo' | 'none';
  identify(request: Request): Promise<Identity>;
  /** Where "Sign out" goes. */
  signOutPath: string;
}

// ---------------------------------------------------------------------------
// Not configured: fail closed
// ---------------------------------------------------------------------------

export const unconfiguredAuth = (reason: string): AuthProvider => ({
  mode: 'none',
  signOutPath: '/',
  identify: async () => ({ kind: 'unconfigured', reason }),
});

// ---------------------------------------------------------------------------
// Demo (local only)
// ---------------------------------------------------------------------------

export const DEMO_COOKIE = 'kfsb_demo_identity';

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/**
 * `allowed()` lists the fictional addresses the developer panel may act as.
 * Anything else in the cookie is ignored.
 */
export function demoAuth(allowed: () => Promise<string[]>): AuthProvider {
  return {
    mode: 'demo',
    signOutPath: '/sign-out',
    async identify(request) {
      const email = readCookie(request, DEMO_COOKIE);
      if (!email) return { kind: 'signed-out' };
      return (await allowed()).includes(email.toLowerCase()) ? { kind: 'verified', email } : { kind: 'signed-out' };
    },
  };
}

// ---------------------------------------------------------------------------
// Cloudflare Access
// ---------------------------------------------------------------------------

export type Jwks = { keys: (JsonWebKey & { kid?: string })[] };
const defaultFetchJwks = async (url: string): Promise<Jwks> => (await fetch(url)).json() as Promise<Jwks>;

export interface AccessConfig {
  /** e.g. "kinsmen.cloudflareaccess.com" */
  teamDomain: string;
  /** The Access application's Audience (AUD) tag. */
  audience: string;
  fetchJwks?: (url: string) => Promise<Jwks>;
  now?: () => number;
}

const b64urlToBytes = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

/** Verifies a Cloudflare Access JWT (RS256, team certs, aud, iss, exp). Returns the email or throws. */
export async function verifyAccessJwt(token: string, config: AccessConfig): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, p, sig] = parts;
  const header = b64urlJson(h) as { alg?: string; kid?: string };
  const payload = b64urlJson(p) as { aud?: string | string[]; iss?: string; exp?: number; nbf?: number; email?: string };
  if (header.alg !== 'RS256') throw new Error('Unexpected algorithm');

  const issuer = `https://${config.teamDomain}`;
  const fetchJwks = config.fetchJwks ?? defaultFetchJwks;
  const { keys } = await fetchJwks(`${issuer}/cdn-cgi/access/certs`);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown signing key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('Bad signature');

  const now = Math.floor((config.now?.() ?? Date.now()) / 1000);
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.audience)) throw new Error('Wrong audience');
  if (payload.iss !== issuer) throw new Error('Wrong issuer');
  if (!payload.exp || payload.exp <= now) throw new Error('Expired');
  if (payload.nbf && payload.nbf > now + 60) throw new Error('Not yet valid');
  if (!payload.email) throw new Error('No email in token');
  return payload.email;
}

export function cloudflareAccessAuth(config: AccessConfig): AuthProvider {
  let cache: { at: number; keys: Jwks } | undefined;
  const fetchJwks = config.fetchJwks ?? defaultFetchJwks;
  const cached: AccessConfig = {
    ...config,
    fetchJwks: async (url) => {
      if (!cache || Date.now() - cache.at > 10 * 60_000) cache = { at: Date.now(), keys: await fetchJwks(url) };
      return cache.keys;
    },
  };
  return {
    mode: 'cloudflare-access',
    // Ends the Cloudflare Access session for this browser.
    signOutPath: '/cdn-cgi/access/logout',
    async identify(request) {
      const token = request.headers.get('cf-access-jwt-assertion');
      if (!token) return { kind: 'signed-out' };
      try {
        return { kind: 'verified', email: await verifyAccessJwt(token, cached) };
      } catch {
        return { kind: 'signed-out' };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Choosing a mode
// ---------------------------------------------------------------------------

export interface AuthEnv {
  WORKSPACE_AUTH?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

/**
 * Shared deployments can only use Cloudflare Access; anything else fails closed.
 * `local: true` is set only by the local dev server (bound to 127.0.0.1).
 */
export function authFromEnv(env: AuthEnv, options: { local: boolean; demo?: () => AuthProvider }): AuthProvider {
  const mode = (env.WORKSPACE_AUTH ?? '').trim().toLowerCase();
  if (mode === 'cloudflare-access') {
    if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return unconfiguredAuth('Cloudflare Access is selected but CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is missing.');
    return cloudflareAccessAuth({ teamDomain: env.CF_ACCESS_TEAM_DOMAIN, audience: env.CF_ACCESS_AUD });
  }
  if (mode === 'demo') {
    if (!options.local || !options.demo) return unconfiguredAuth('The demo sign-in is only available on the local development server.');
    return options.demo();
  }
  return unconfiguredAuth('No sign-in provider is configured.');
}
