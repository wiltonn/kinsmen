/**
 * Data access. No permission logic here (that's service.ts), but every query
 * for a private record is scoped by its owning workspace (`org_id = ?`), so a
 * record ID from another workspace simply isn't found.
 */
import type { SqlDb, SqlValue } from './db.ts';
import { SCHEMA } from './db.ts';
import type { AccessGrant, AccessLevel, ClubLink, ClubTrackerItem, Committee, DirectoryEntry, Invitation, MeetingNote, Organization, Person } from './domain.ts';

type Row = Record<string, SqlValue>;
const s = (v: SqlValue | undefined) => (v === null || v === undefined ? undefined : String(v));

const toOrg = (r: Row): Organization => ({
  id: String(r.id),
  name: String(r.name),
  level: r.level as Organization['level'],
  parentId: s(r.parent_id) ?? null,
  description: String(r.description ?? ''),
  contactEmail: s(r.contact_email),
  fictional: Number(r.fictional) === 1,
});
const toPerson = (r: Row): Person => ({ id: String(r.id), email: String(r.email), name: String(r.name) });
const toGrant = (r: Row): AccessGrant => ({
  id: String(r.id),
  personId: String(r.person_id),
  orgId: String(r.org_id),
  level: r.level as AccessLevel,
  status: r.status as AccessGrant['status'],
  createdAt: String(r.created_at),
  createdBy: s(r.created_by),
  revokedAt: s(r.revoked_at),
});
const toInvitation = (r: Row): Invitation => ({
  id: String(r.id),
  orgId: String(r.org_id),
  email: String(r.email),
  name: s(r.name),
  level: r.level as AccessLevel,
  status: r.status as Invitation['status'],
  createdAt: String(r.created_at),
  createdBy: String(r.created_by),
  expiresAt: String(r.expires_at),
  acceptedAt: s(r.accepted_at),
});
const toEntry = (r: Row): DirectoryEntry => {
  const e: DirectoryEntry = { id: String(r.id), orgId: String(r.org_id), name: String(r.name), contactVisibility: r.contact_visibility as DirectoryEntry['contactVisibility'] };
  if (s(r.role_title)) e.roleTitle = s(r.role_title);
  if (s(r.email)) e.email = s(r.email);
  if (s(r.phone)) e.phone = s(r.phone);
  return e;
};
const toNote = (r: Row): MeetingNote => ({
  id: String(r.id),
  orgId: String(r.org_id),
  title: String(r.title),
  meetingDate: String(r.meeting_date),
  body: String(r.body),
  status: r.status as MeetingNote['status'],
  updatedAt: String(r.updated_at),
  updatedBy: String(r.updated_by),
  finalizedAt: s(r.finalized_at),
});
const toCommittee = (r: Row): Committee => ({
  id: String(r.id),
  orgId: String(r.org_id),
  name: String(r.name),
  purpose: String(r.purpose ?? ''),
  chairEntryId: s(r.chair_entry_id),
  memberEntryIds: JSON.parse(String(r.member_entry_ids ?? '[]')) as string[],
});
const toLink = (r: Row): ClubLink => ({ id: String(r.id), orgId: String(r.org_id), title: String(r.title), url: String(r.url), description: String(r.description ?? '') });

export class Store {
  private db: SqlDb;
  constructor(db: SqlDb) {
    this.db = db;
  }

  async migrate() {
    await this.db.exec(SCHEMA);
  }

  // Organizations (names and structure are not private)
  async organizations() {
    return (await this.db.all<Row>('SELECT * FROM organizations ORDER BY name')).map(toOrg);
  }
  async organization(id: string) {
    return (await this.db.all<Row>('SELECT * FROM organizations WHERE id = ?', [id])).map(toOrg)[0];
  }
  async saveOrganization(o: Organization) {
    await this.db.run(
      `INSERT INTO organizations (id, name, level, parent_id, description, contact_email, fictional) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, level = excluded.level, parent_id = excluded.parent_id,
         description = excluded.description, contact_email = excluded.contact_email, fictional = excluded.fictional`,
      [o.id, o.name, o.level, o.parentId, o.description, o.contactEmail ?? null, o.fictional ? 1 : 0],
    );
  }

  // People and access
  async people() {
    return (await this.db.all<Row>('SELECT * FROM people ORDER BY name')).map(toPerson);
  }
  async personByEmail(email: string) {
    return (await this.db.all<Row>('SELECT * FROM people WHERE email = ?', [email])).map(toPerson)[0];
  }
  async person(id: string) {
    return (await this.db.all<Row>('SELECT * FROM people WHERE id = ?', [id])).map(toPerson)[0];
  }
  async savePerson(p: Person) {
    await this.db.run('INSERT INTO people (id, email, name) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name', [p.id, p.email, p.name]);
  }
  async grantsForPerson(personId: string) {
    return (await this.db.all<Row>('SELECT * FROM access_grants WHERE person_id = ? ORDER BY created_at', [personId])).map(toGrant);
  }
  async grantsForOrg(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM access_grants WHERE org_id = ? ORDER BY created_at', [orgId])).map(toGrant);
  }
  async grant(orgId: string, id: string) {
    return (await this.db.all<Row>('SELECT * FROM access_grants WHERE org_id = ? AND id = ?', [orgId, id])).map(toGrant)[0];
  }
  async saveGrant(g: AccessGrant) {
    await this.db.run(
      `INSERT INTO access_grants (id, person_id, org_id, level, status, created_at, created_by, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET level = excluded.level, status = excluded.status, revoked_at = excluded.revoked_at`,
      [g.id, g.personId, g.orgId, g.level, g.status, g.createdAt, g.createdBy ?? null, g.revokedAt ?? null],
    );
  }
  async invitationsForEmail(email: string) {
    return (await this.db.all<Row>('SELECT * FROM invitations WHERE email = ? ORDER BY created_at DESC', [email])).map(toInvitation);
  }
  async invitationsForOrg(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM invitations WHERE org_id = ? ORDER BY created_at DESC', [orgId])).map(toInvitation);
  }
  async invitation(orgId: string, id: string) {
    return (await this.db.all<Row>('SELECT * FROM invitations WHERE org_id = ? AND id = ?', [orgId, id])).map(toInvitation)[0];
  }
  async pendingInvitations() {
    return (await this.db.all<Row>("SELECT * FROM invitations WHERE status = 'pending' ORDER BY created_at DESC")).map(toInvitation);
  }
  async saveInvitation(i: Invitation) {
    await this.db.run(
      `INSERT INTO invitations (id, org_id, email, name, level, status, created_at, created_by, expires_at, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, accepted_at = excluded.accepted_at`,
      [i.id, i.orgId, i.email, i.name ?? null, i.level, i.status, i.createdAt, i.createdBy, i.expiresAt, i.acceptedAt ?? null],
    );
  }

  // Private club records: always scoped by org_id
  async directory(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM directory_entries WHERE org_id = ? ORDER BY name', [orgId])).map(toEntry);
  }
  async directoryEntry(orgId: string, id: string) {
    return (await this.db.all<Row>('SELECT * FROM directory_entries WHERE org_id = ? AND id = ?', [orgId, id])).map(toEntry)[0];
  }
  async saveDirectoryEntry(e: DirectoryEntry) {
    await this.db.run(
      `INSERT INTO directory_entries (id, org_id, name, role_title, email, phone, contact_visibility) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, role_title = excluded.role_title, email = excluded.email,
         phone = excluded.phone, contact_visibility = excluded.contact_visibility WHERE directory_entries.org_id = excluded.org_id`,
      [e.id, e.orgId, e.name, e.roleTitle ?? null, e.email ?? null, e.phone ?? null, e.contactVisibility],
    );
  }
  async deleteDirectoryEntry(orgId: string, id: string) {
    await this.db.run('DELETE FROM directory_entries WHERE org_id = ? AND id = ?', [orgId, id]);
  }

  async notes(orgId: string, status?: MeetingNote['status']) {
    const rows = status
      ? await this.db.all<Row>('SELECT * FROM meeting_notes WHERE org_id = ? AND status = ? ORDER BY meeting_date DESC, updated_at DESC', [orgId, status])
      : await this.db.all<Row>('SELECT * FROM meeting_notes WHERE org_id = ? ORDER BY meeting_date DESC, updated_at DESC', [orgId]);
    return rows.map(toNote);
  }
  async note(orgId: string, id: string) {
    return (await this.db.all<Row>('SELECT * FROM meeting_notes WHERE org_id = ? AND id = ?', [orgId, id])).map(toNote)[0];
  }
  async saveNote(n: MeetingNote) {
    await this.db.run(
      `INSERT INTO meeting_notes (id, org_id, title, meeting_date, body, status, updated_at, updated_by, finalized_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, meeting_date = excluded.meeting_date, body = excluded.body, status = excluded.status,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by, finalized_at = excluded.finalized_at WHERE meeting_notes.org_id = excluded.org_id`,
      [n.id, n.orgId, n.title, n.meetingDate, n.body, n.status, n.updatedAt, n.updatedBy, n.finalizedAt ?? null],
    );
  }

  async committees(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM committees WHERE org_id = ? ORDER BY name', [orgId])).map(toCommittee);
  }
  async committee(orgId: string, id: string) {
    return (await this.db.all<Row>('SELECT * FROM committees WHERE org_id = ? AND id = ?', [orgId, id])).map(toCommittee)[0];
  }
  async saveCommittee(c: Committee) {
    await this.db.run(
      `INSERT INTO committees (id, org_id, name, purpose, chair_entry_id, member_entry_ids) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, purpose = excluded.purpose, chair_entry_id = excluded.chair_entry_id,
         member_entry_ids = excluded.member_entry_ids WHERE committees.org_id = excluded.org_id`,
      [c.id, c.orgId, c.name, c.purpose, c.chairEntryId ?? null, JSON.stringify(c.memberEntryIds)],
    );
  }
  async deleteCommittee(orgId: string, id: string) {
    await this.db.run('DELETE FROM committees WHERE org_id = ? AND id = ?', [orgId, id]);
  }

  async links(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM links WHERE org_id = ? ORDER BY title', [orgId])).map(toLink);
  }
  async saveLink(l: ClubLink) {
    await this.db.run(
      `INSERT INTO links (id, org_id, title, url, description) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET title = excluded.title, url = excluded.url, description = excluded.description WHERE links.org_id = excluded.org_id`,
      [l.id, l.orgId, l.title, l.url, l.description],
    );
  }
  async deleteLink(orgId: string, id: string) {
    await this.db.run('DELETE FROM links WHERE org_id = ? AND id = ?', [orgId, id]);
  }

  async trackerItems(orgId: string) {
    return (await this.db.all<Row>('SELECT * FROM tracker_items WHERE org_id = ?', [orgId])).map((r) => ({ ...(JSON.parse(String(r.data)) as ClubTrackerItem), orgId: String(r.org_id) }));
  }
  async trackerItem(orgId: string, id: string) {
    return (await this.trackerItems(orgId)).find((i) => i.id === id);
  }
  async saveTrackerItem(item: ClubTrackerItem) {
    await this.db.run('INSERT INTO tracker_items (id, org_id, data) VALUES (?, ?, ?) ON CONFLICT(org_id, id) DO UPDATE SET data = excluded.data', [item.id, item.orgId, JSON.stringify(item)]);
  }
}
