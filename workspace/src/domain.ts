/**
 * Club workspace: the data model.
 *
 * Three separate ideas, deliberately not merged:
 *   Organization    a unit in National → Region → District → Club
 *   DirectoryEntry  a person listed in a club's member directory (no access implied)
 *   AccessGrant     permission for a signed-in Person to use one workspace
 *
 * Being in the directory, or chairing a committee, never grants access.
 * Only an AccessGrant (created by accepting an Invitation) does.
 */
import type { TrackerItem } from '../../studio/admin-tracker/model.ts';

export const ORG_LEVELS = ['national', 'region', 'district', 'club'] as const;
export type OrgLevel = (typeof ORG_LEVELS)[number];

/** The level each organization's parent must have. A club may be unassigned (null parent). */
export const PARENT_LEVEL: Record<OrgLevel, OrgLevel | null> = {
  national: null,
  region: 'national',
  district: 'region',
  club: 'district',
};

export const LEVEL_LABEL: Record<OrgLevel, string> = {
  national: 'National',
  region: 'Region',
  district: 'District',
  club: 'Club',
};

export const CHILD_LABEL: Record<OrgLevel, string | null> = {
  national: 'Regions',
  region: 'Districts',
  district: 'Clubs',
  club: null,
};

export interface Organization {
  id: string;
  name: string;
  level: OrgLevel;
  parentId: string | null;
  description: string;
  /** Shown on "Get help from your club". */
  contactEmail?: string;
  /** Demo/test organizations are fictional and say so. */
  fictional: boolean;
}

export const ACCESS_LEVELS = ['member', 'admin'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Someone who can sign in. Identified by an email address verified by the sign-in provider. */
export interface Person {
  id: string;
  email: string;
  name: string;
}

export interface AccessGrant {
  id: string;
  personId: string;
  orgId: string;
  level: AccessLevel;
  status: 'active' | 'revoked';
  createdAt: string;
  createdBy?: string;
  revokedAt?: string;
}

export const INVITATION_DAYS = 14;

export interface Invitation {
  id: string;
  orgId: string;
  email: string;
  name?: string;
  level: AccessLevel;
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  createdBy: string;
  expiresAt: string;
  acceptedAt?: string;
}

export const isExpired = (inv: Invitation, now: Date) => inv.status === 'pending' && new Date(inv.expiresAt).getTime() <= now.getTime();

export interface DirectoryEntry {
  id: string;
  orgId: string;
  name: string;
  roleTitle?: string;
  email?: string;
  phone?: string;
  /** Who may see email/phone: everyone in the workspace, or admins only. */
  contactVisibility: 'members' | 'admins';
}

export interface MeetingNote {
  id: string;
  orgId: string;
  title: string;
  /** YYYY-MM-DD */
  meetingDate: string;
  body: string;
  /** Drafts are visible to admins only. */
  status: 'draft' | 'final';
  updatedAt: string;
  updatedBy: string;
  finalizedAt?: string;
}

export interface Committee {
  id: string;
  orgId: string;
  name: string;
  purpose: string;
  /** A directory entry. Chairing a committee grants no access. */
  chairEntryId?: string;
  memberEntryIds: string[];
}

export interface ClubLink {
  id: string;
  orgId: string;
  title: string;
  url: string;
  description: string;
}

/** A club's own to-do item (reuses the website tracker's model). Admin-only. */
export interface ClubTrackerItem extends TrackerItem {
  orgId: string;
}

export function validateOrganizations(orgs: Organization[]): string[] {
  const byId = new Map(orgs.map((o) => [o.id, o]));
  const problems: string[] = [];
  for (const o of orgs) {
    const expected = PARENT_LEVEL[o.level];
    if (o.parentId === null) {
      if (expected && o.level !== 'club') problems.push(`${o.name}: a ${o.level} must belong to a ${expected}.`);
      continue;
    }
    const parent = byId.get(o.parentId);
    if (!parent) problems.push(`${o.name}: parent ${o.parentId} doesn't exist.`);
    else if (parent.level !== expected) problems.push(`${o.name}: a ${o.level} must belong to a ${expected}, not a ${parent.level}.`);
  }
  return problems;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isEmail = (email: string) => EMAIL.test(email.trim());

export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}
