/**
 * Every operation the workspace offers, each checked against the actor's
 * access to the owning workspace before any data is read or written.
 * The HTTP layer only calls these methods; it never queries the store directly.
 */
import { createItem as createTrackerItem, moveItem as moveTrackerItem, COLUMNS, type Column } from '../../studio/admin-tracker/model.ts';
import {
  INVITATION_DAYS,
  isEmail,
  isExpired,
  isSafeUrl,
  normalizeEmail,
  type AccessGrant,
  type AccessLevel,
  type ClubLink,
  type ClubTrackerItem,
  type Committee,
  type DirectoryEntry,
  type Invitation,
  type MeetingNote,
  type Organization,
} from './domain.ts';
import { AccessDenied, ancestors, canManage, directoryView, requireManage, requireRead, unitNamesBelow, workspacesFor, wouldRemoveLastAdmin, type Actor } from './policy.ts';
import type { Store } from './store.ts';

/** A problem the person can fix (shown next to the form). */
export class UserError extends Error {
  /** The form field to mark, if the problem belongs to one. */
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'UserError';
    this.field = field;
  }
}

export type SignInResult =
  | { kind: 'ok'; actor: Actor }
  | { kind: 'expired'; org: Organization; help: HelpContact }
  | { kind: 'revoked'; org: Organization; help: HelpContact }
  | { kind: 'no-access'; email: string };

export interface HelpContact {
  orgName: string;
  contactEmail?: string;
  adminNames: string[];
}

export interface Deps {
  store: Store;
  now?: () => Date;
  newId?: () => string;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export class WorkspaceService {
  private store: Store;
  private now: () => Date;
  private newId: () => string;

  constructor(deps: Deps) {
    this.store = deps.store;
    this.now = deps.now ?? (() => new Date());
    this.newId = deps.newId ?? (() => crypto.randomUUID().replace(/-/g, '').slice(0, 12));
  }

  // -------------------------------------------------------------------------
  // Sign-in: turn a *verified* email (from the sign-in provider) into an actor
  // -------------------------------------------------------------------------

  async signIn(verifiedEmail: string): Promise<SignInResult> {
    const email = normalizeEmail(verifiedEmail);
    const now = this.now();
    let person = await this.store.personByEmail(email);
    const invitations = (await this.store.invitationsForEmail(email)).filter((i) => i.status === 'pending');
    const valid = invitations.filter((i) => !isExpired(i, now));

    if (valid.length) {
      if (!person) {
        person = { id: this.newId(), email, name: valid.find((i) => i.name)?.name ?? email.split('@')[0] };
        await this.store.savePerson(person);
      }
      const grants = await this.store.grantsForPerson(person.id);
      for (const inv of valid) {
        const existing = grants.find((g) => g.orgId === inv.orgId && g.status === 'active');
        if (!existing) {
          await this.store.saveGrant({ id: this.newId(), personId: person.id, orgId: inv.orgId, level: inv.level, status: 'active', createdAt: now.toISOString(), createdBy: inv.createdBy });
        } else if (existing.level === 'member' && inv.level === 'admin') {
          await this.store.saveGrant({ ...existing, level: 'admin' });
        }
        await this.store.saveInvitation({ ...inv, status: 'accepted', acceptedAt: now.toISOString() });
      }
    }

    const allGrants = person ? await this.store.grantsForPerson(person.id) : [];
    const active = allGrants.filter((g) => g.status === 'active');
    if (person && active.length) return { kind: 'ok', actor: { person, grants: active } };

    const expired = invitations.find((i) => isExpired(i, now));
    if (expired) {
      const org = (await this.store.organization(expired.orgId))!;
      return { kind: 'expired', org, help: await this.helpFor(org) };
    }
    const revoked = allGrants.find((g) => g.status === 'revoked');
    if (revoked) {
      const org = (await this.store.organization(revoked.orgId))!;
      return { kind: 'revoked', org, help: await this.helpFor(org) };
    }
    return { kind: 'no-access', email };
  }

  /** Who to ask for help. Names of active admins and the club's contact email only. */
  private async helpFor(org: Organization): Promise<HelpContact> {
    const grants = (await this.store.grantsForOrg(org.id)).filter((g) => g.status === 'active' && g.level === 'admin');
    const names: string[] = [];
    for (const g of grants) {
      const p = await this.store.person(g.personId);
      if (p) names.push(p.name);
    }
    return { orgName: org.name, contactEmail: org.contactEmail, adminNames: names };
  }

  // -------------------------------------------------------------------------
  // Workspaces
  // -------------------------------------------------------------------------

  async workspaces(actor: Actor) {
    return workspacesFor(actor, await this.store.organizations());
  }

  /** The workspace itself (name, level, description). Requires access to it. */
  async workspace(actor: Actor, orgId: string) {
    const access = requireRead(actor, orgId);
    const org = await this.store.organization(orgId);
    if (!org) throw new AccessDenied();
    return { org, access };
  }

  /** Names of units below (admins of upper levels). Never includes private records. */
  async unitsBelow(actor: Actor, orgId: string) {
    return unitNamesBelow(actor, orgId, await this.store.organizations());
  }

  /** Names of the units above, for upper-level workspaces' own context. */
  async unitsAbove(actor: Actor, orgId: string) {
    requireRead(actor, orgId);
    return ancestors(orgId, await this.store.organizations()).map(({ id, name, level }) => ({ id, name, level }));
  }

  async updateWorkspaceInfo(actor: Actor, orgId: string, input: { description?: unknown; contactEmail?: unknown }) {
    requireManage(actor, orgId);
    const org = (await this.store.organization(orgId))!;
    const contactEmail = text(input.contactEmail, 200);
    if (contactEmail && !isEmail(contactEmail)) throw new UserError('Enter a contact email like secretary@example.org, or leave it empty.', 'contactEmail');
    await this.store.saveOrganization({ ...org, description: text(input.description, 1000), contactEmail: contactEmail || undefined });
  }

  // -------------------------------------------------------------------------
  // Meeting notes
  // -------------------------------------------------------------------------

  /** Finalized notes for everyone in the workspace; drafts are added for admins only. */
  async notes(actor: Actor, orgId: string) {
    const level = requireRead(actor, orgId);
    const final = await this.store.notes(orgId, 'final');
    const drafts = level === 'admin' ? await this.store.notes(orgId, 'draft') : [];
    return { final, drafts };
  }

  async latestFinalNote(actor: Actor, orgId: string): Promise<MeetingNote | undefined> {
    requireRead(actor, orgId);
    return (await this.store.notes(orgId, 'final'))[0];
  }

  /** A draft is reported as "not found" to members: it doesn't exist for them. */
  async note(actor: Actor, orgId: string, noteId: string) {
    const level = requireRead(actor, orgId);
    const note = await this.store.note(orgId, noteId);
    if (!note || (note.status === 'draft' && level !== 'admin')) throw new AccessDenied();
    return note;
  }

  async saveNote(actor: Actor, orgId: string, input: { id?: string; title: unknown; meetingDate: unknown; body: unknown; finalize?: boolean }) {
    requireManage(actor, orgId);
    const title = text(input.title, 160);
    const meetingDate = text(input.meetingDate, 10);
    const body = text(input.body, 20000);
    if (!title) throw new UserError('Add a title, for example “November general meeting”.', 'title');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) throw new UserError('Choose the meeting date.', 'meetingDate');
    const existing = input.id ? await this.store.note(orgId, input.id) : undefined;
    if (input.id && !existing) throw new AccessDenied();
    if (existing?.status === 'final') throw new UserError('These notes are finalized. Reopen them as a draft to make changes.');
    const now = this.now().toISOString();
    const note: MeetingNote = {
      id: existing?.id ?? this.newId(),
      orgId,
      title,
      meetingDate,
      body,
      status: input.finalize ? 'final' : 'draft',
      updatedAt: now,
      updatedBy: actor.person.id,
      finalizedAt: input.finalize ? now : undefined,
    };
    await this.store.saveNote(note);
    return note;
  }

  async finalizeNote(actor: Actor, orgId: string, noteId: string) {
    requireManage(actor, orgId);
    const note = await this.store.note(orgId, noteId);
    if (!note) throw new AccessDenied();
    const now = this.now().toISOString();
    const final: MeetingNote = { ...note, status: 'final', finalizedAt: now, updatedAt: now, updatedBy: actor.person.id };
    await this.store.saveNote(final);
    return final;
  }

  /** Take finalized notes back to draft (hidden from members) to correct them. */
  async reopenNote(actor: Actor, orgId: string, noteId: string) {
    requireManage(actor, orgId);
    const note = await this.store.note(orgId, noteId);
    if (!note) throw new AccessDenied();
    const draft: MeetingNote = { ...note, status: 'draft', finalizedAt: undefined, updatedAt: this.now().toISOString(), updatedBy: actor.person.id };
    await this.store.saveNote(draft);
    return draft;
  }

  // -------------------------------------------------------------------------
  // Member directory (a list of people, not a list of logins)
  // -------------------------------------------------------------------------

  async directory(actor: Actor, orgId: string) {
    const level = requireRead(actor, orgId);
    return (await this.store.directory(orgId)).map((e) => directoryView(e, level));
  }

  async directoryEntry(actor: Actor, orgId: string, id: string) {
    const level = requireRead(actor, orgId);
    const e = await this.store.directoryEntry(orgId, id);
    if (!e) throw new AccessDenied();
    return directoryView(e, level);
  }

  async saveDirectoryEntry(actor: Actor, orgId: string, input: { id?: string; name: unknown; roleTitle?: unknown; email?: unknown; phone?: unknown; contactVisibility?: unknown }) {
    requireManage(actor, orgId);
    const name = text(input.name, 120);
    const email = text(input.email, 200);
    if (!name) throw new UserError('Add the person’s name.', 'name');
    if (email && !isEmail(email)) throw new UserError('That email address doesn’t look right.', 'email');
    if (input.id && !(await this.store.directoryEntry(orgId, input.id))) throw new AccessDenied();
    const entry: DirectoryEntry = {
      id: input.id ?? this.newId(),
      orgId,
      name,
      contactVisibility: input.contactVisibility === 'admins' ? 'admins' : 'members',
    };
    const roleTitle = text(input.roleTitle, 120);
    const phone = text(input.phone, 40);
    if (roleTitle) entry.roleTitle = roleTitle;
    if (email) entry.email = email;
    if (phone) entry.phone = phone;
    await this.store.saveDirectoryEntry(entry);
    return entry;
  }

  async removeDirectoryEntry(actor: Actor, orgId: string, id: string) {
    requireManage(actor, orgId);
    if (!(await this.store.directoryEntry(orgId, id))) throw new AccessDenied();
    await this.store.deleteDirectoryEntry(orgId, id);
  }

  // -------------------------------------------------------------------------
  // Committees and links
  // -------------------------------------------------------------------------

  async committees(actor: Actor, orgId: string) {
    const level = requireRead(actor, orgId);
    const entries = new Map((await this.store.directory(orgId)).map((e) => [e.id, directoryView(e, level)]));
    return (await this.store.committees(orgId)).map((c) => ({
      ...c,
      chair: c.chairEntryId ? entries.get(c.chairEntryId) : undefined,
      members: c.memberEntryIds.map((id) => entries.get(id)).filter((e): e is DirectoryEntry => Boolean(e)),
    }));
  }

  async saveCommittee(actor: Actor, orgId: string, input: { id?: string; name: unknown; purpose?: unknown; chairEntryId?: unknown; memberEntryIds?: unknown }) {
    requireManage(actor, orgId);
    const name = text(input.name, 120);
    if (!name) throw new UserError('Give the committee a name.', 'name');
    if (input.id && !(await this.store.committee(orgId, input.id))) throw new AccessDenied();
    const valid = new Set((await this.store.directory(orgId)).map((e) => e.id));
    const chair = text(input.chairEntryId, 40);
    const members = (Array.isArray(input.memberEntryIds) ? input.memberEntryIds : []).map(String).filter((id) => valid.has(id));
    const committee: Committee = { id: input.id ?? this.newId(), orgId, name, purpose: text(input.purpose, 600), memberEntryIds: [...new Set(members)] };
    if (chair && valid.has(chair)) committee.chairEntryId = chair;
    await this.store.saveCommittee(committee);
    return committee;
  }

  async removeCommittee(actor: Actor, orgId: string, id: string) {
    requireManage(actor, orgId);
    if (!(await this.store.committee(orgId, id))) throw new AccessDenied();
    await this.store.deleteCommittee(orgId, id);
  }

  async links(actor: Actor, orgId: string) {
    requireRead(actor, orgId);
    return this.store.links(orgId);
  }

  async saveLink(actor: Actor, orgId: string, input: { title: unknown; url: unknown; description?: unknown }) {
    requireManage(actor, orgId);
    const title = text(input.title, 120);
    const url = text(input.url, 500);
    if (!title) throw new UserError('Give the link a name.', 'title');
    if (!isSafeUrl(url)) throw new UserError('Enter the full web address, starting with https://', 'url');
    const link: ClubLink = { id: this.newId(), orgId, title, url, description: text(input.description, 300) };
    await this.store.saveLink(link);
    return link;
  }

  async removeLink(actor: Actor, orgId: string, id: string) {
    requireManage(actor, orgId);
    if (!(await this.store.links(orgId)).some((l) => l.id === id)) throw new AccessDenied();
    await this.store.deleteLink(orgId, id);
  }

  // -------------------------------------------------------------------------
  // Club to-do list (admins only; reuses the website tracker's model)
  // -------------------------------------------------------------------------

  async trackerItems(actor: Actor, orgId: string) {
    requireManage(actor, orgId);
    return this.store.trackerItems(orgId);
  }

  async addTrackerItem(actor: Actor, orgId: string, input: { title: unknown; column?: unknown }) {
    requireManage(actor, orgId);
    const title = text(input.title, 120);
    if (!title) throw new UserError('Describe the task.', 'title');
    const column = COLUMNS.includes(input.column as Column) ? (input.column as Column) : 'next';
    const item: ClubTrackerItem = { ...createTrackerItem({ title, description: '', column }, this.now(), `t-${this.newId().slice(0, 6)}`), orgId };
    await this.store.saveTrackerItem(item);
    return item;
  }

  async moveTrackerItem(actor: Actor, orgId: string, id: string, column: unknown) {
    requireManage(actor, orgId);
    const item = await this.store.trackerItem(orgId, id);
    if (!item || !COLUMNS.includes(column as Column)) throw new AccessDenied();
    await this.store.saveTrackerItem({ ...moveTrackerItem(item, column as Column, this.now()), orgId });
  }

  // -------------------------------------------------------------------------
  // Access: invitations, levels, removal (admins of this workspace only)
  // -------------------------------------------------------------------------

  async people(actor: Actor, orgId: string) {
    requireManage(actor, orgId);
    const grants = (await this.store.grantsForOrg(orgId)).filter((g) => g.status === 'active');
    const rows = [];
    for (const g of grants) {
      const p = await this.store.person(g.personId);
      if (p) rows.push({ grant: g, person: p, isLastAdmin: wouldRemoveLastAdmin(grants, g) });
    }
    return rows.sort((a, b) => (a.grant.level === b.grant.level ? a.person.name.localeCompare(b.person.name) : a.grant.level === 'admin' ? -1 : 1));
  }

  async invitations(actor: Actor, orgId: string) {
    requireManage(actor, orgId);
    const now = this.now();
    return (await this.store.invitationsForOrg(orgId)).filter((i) => i.status === 'pending').map((i) => ({ ...i, expired: isExpired(i, now) }));
  }

  /** Creates an invitation tied to this workspace and access level. Sends nothing by itself. */
  async invite(actor: Actor, orgId: string, input: { email: unknown; name?: unknown; level?: unknown }): Promise<Invitation> {
    requireManage(actor, orgId);
    const email = normalizeEmail(text(input.email, 200));
    if (!isEmail(email)) throw new UserError('Enter the person’s email address, like name@example.org.', 'email');
    const level: AccessLevel = input.level === 'admin' ? 'admin' : 'member';
    const existingPerson = await this.store.personByEmail(email);
    if (existingPerson) {
      const grant = (await this.store.grantsForPerson(existingPerson.id)).find((g) => g.orgId === orgId && g.status === 'active');
      if (grant && (grant.level === 'admin' || level === 'member')) throw new UserError(`${existingPerson.name} already has ${grant.level === 'admin' ? 'admin' : 'member'} access here.`);
    }
    // One live invitation per address per workspace: replace older pending ones.
    for (const old of await this.store.invitationsForOrg(orgId)) {
      if (old.email === email && old.status === 'pending') await this.store.saveInvitation({ ...old, status: 'revoked' });
    }
    const now = this.now();
    const invitation: Invitation = {
      id: this.newId(),
      orgId,
      email,
      name: text(input.name, 120) || undefined,
      level,
      status: 'pending',
      createdAt: now.toISOString(),
      createdBy: actor.person.id,
      expiresAt: new Date(now.getTime() + INVITATION_DAYS * 86_400_000).toISOString(),
    };
    await this.store.saveInvitation(invitation);
    return invitation;
  }

  async invitation(actor: Actor, orgId: string, invitationId: string) {
    requireManage(actor, orgId);
    const inv = await this.store.invitation(orgId, invitationId);
    if (!inv) throw new AccessDenied();
    return { ...inv, expired: isExpired(inv, this.now()) };
  }

  async revokeInvitation(actor: Actor, orgId: string, invitationId: string) {
    requireManage(actor, orgId);
    const inv = await this.store.invitation(orgId, invitationId);
    if (!inv) throw new AccessDenied();
    await this.store.saveInvitation({ ...inv, status: 'revoked' });
  }

  async setAccessLevel(actor: Actor, orgId: string, grantId: string, level: AccessLevel) {
    requireManage(actor, orgId);
    const grant = await this.store.grant(orgId, grantId);
    if (!grant || grant.status !== 'active') throw new AccessDenied();
    if (level === 'member' && wouldRemoveLastAdmin(await this.store.grantsForOrg(orgId), grant)) {
      throw new UserError('This is the last admin. Make someone else an admin first, so the club is never left without one.');
    }
    await this.store.saveGrant({ ...grant, level });
  }

  /** Removes access now. Pending invitations for the same address here are revoked too. */
  async revokeAccess(actor: Actor, orgId: string, grantId: string) {
    requireManage(actor, orgId);
    const grant = await this.store.grant(orgId, grantId);
    if (!grant || grant.status !== 'active') throw new AccessDenied();
    if (wouldRemoveLastAdmin(await this.store.grantsForOrg(orgId), grant)) {
      throw new UserError('This is the last admin. Make someone else an admin first, so the club is never left without one.');
    }
    await this.store.saveGrant({ ...grant, status: 'revoked', revokedAt: this.now().toISOString() });
    const person = await this.store.person(grant.personId);
    if (person) {
      for (const inv of await this.store.invitationsForOrg(orgId)) {
        if (inv.email === person.email && inv.status === 'pending') await this.store.saveInvitation({ ...inv, status: 'revoked' });
      }
    }
  }

  isAdmin(actor: Actor, orgId: string) {
    return canManage(actor, orgId);
  }
}

export type { AccessGrant };
