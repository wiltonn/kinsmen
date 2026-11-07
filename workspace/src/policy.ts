/**
 * Access rules. Pure functions, used by the service layer on every read and
 * write (never only to hide buttons).
 *
 * - Access is per workspace and never inherited: an admin of a District has
 *   no access to its clubs' private records unless explicitly granted.
 * - Upper-level admins may see the *names* of units below them.
 * - Every workspace must keep at least one active admin.
 */
import type { AccessGrant, AccessLevel, DirectoryEntry, Organization, Person } from './domain.ts';

export interface Actor {
  person: Person;
  /** Active grants only (revoked grants are filtered out when the actor is built). */
  grants: AccessGrant[];
}

/** Thrown when an actor may not see or change something. Rendered as "not found". */
export class AccessDenied extends Error {
  constructor(message = 'Not found, or you do not have access.') {
    super(message);
    this.name = 'AccessDenied';
  }
}

/** The actor's level in exactly this workspace (no inheritance from parents). */
export function levelIn(actor: Actor, orgId: string): AccessLevel | undefined {
  let level: AccessLevel | undefined;
  for (const g of actor.grants) {
    if (g.orgId !== orgId || g.status !== 'active') continue;
    if (g.level === 'admin') return 'admin';
    level = 'member';
  }
  return level;
}

export const canRead = (actor: Actor, orgId: string) => levelIn(actor, orgId) !== undefined;
export const canManage = (actor: Actor, orgId: string) => levelIn(actor, orgId) === 'admin';

export function requireRead(actor: Actor, orgId: string): AccessLevel {
  const level = levelIn(actor, orgId);
  if (!level) throw new AccessDenied();
  return level;
}

export function requireManage(actor: Actor, orgId: string): void {
  if (!canManage(actor, orgId)) throw new AccessDenied();
}

export function ancestors(orgId: string, orgs: Organization[]): Organization[] {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const out: Organization[] = [];
  let current = byId.get(orgId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    current = byId.get(current.parentId);
    if (current) out.push(current);
  }
  return out;
}

export function descendants(orgId: string, orgs: Organization[]): Organization[] {
  const out: Organization[] = [];
  const queue = [orgId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const child of orgs.filter((o) => o.parentId === id)) {
      out.push(child);
      queue.push(child.id);
    }
  }
  return out;
}

/** Names of units below a workspace: admins of that workspace only. Names only, nothing private. */
export function unitNamesBelow(actor: Actor, orgId: string, orgs: Organization[]): { id: string; name: string; level: Organization['level']; parentId: string | null }[] {
  requireManage(actor, orgId);
  return descendants(orgId, orgs).map(({ id, name, level, parentId }) => ({ id, name, level, parentId }));
}

/** The workspaces this actor can open, in a stable order (clubs first: the common case). */
export function workspacesFor(actor: Actor, orgs: Organization[]): (Organization & { access: AccessLevel })[] {
  const order = { club: 0, district: 1, region: 2, national: 3 } as const;
  return orgs
    .filter((o) => canRead(actor, o.id))
    .map((o) => ({ ...o, access: levelIn(actor, o.id)! }))
    .sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name));
}

/** What a reader may see of a directory entry. Contact details can be admin-only. */
export function directoryView(entry: DirectoryEntry, level: AccessLevel): DirectoryEntry {
  if (level === 'admin' || entry.contactVisibility === 'members') return entry;
  const { email: _email, phone: _phone, ...rest } = entry;
  return rest;
}

/**
 * Would this change leave the workspace without an active admin?
 * `grants` are all grants for the workspace; `changing` is the grant being
 * revoked or demoted.
 */
export function wouldRemoveLastAdmin(grants: AccessGrant[], changing: AccessGrant): boolean {
  if (changing.level !== 'admin' || changing.status !== 'active') return false;
  return !grants.some((g) => g.id !== changing.id && g.orgId === changing.orgId && g.status === 'active' && g.level === 'admin');
}
