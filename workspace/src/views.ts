/** Page bodies. Plain words, large controls, one main action per screen. */
import { CHILD_LABEL, LEVEL_LABEL, type AccessLevel, type ClubLink, type ClubTrackerItem, type DirectoryEntry, type Invitation, type MeetingNote, type Organization, type Person, type AccessGrant } from './domain.ts';
import { COLUMN_LABELS, COLUMNS } from '../../studio/admin-tracker/model.ts';
import { formatDate, html, Raw } from './html.ts';
import type { HelpContact } from './service.ts';

const base = (orgId: string) => `/w/${encodeURIComponent(orgId)}`;
const hidden = (name: string, value: string) => html`<input type="hidden" name="${name}" value="${value}">`;

/** A problem with what was typed, tied to one field when possible. */
export type FormError = { field?: string; message: string };
const errorFor = (e: FormError | undefined, field: string) => (e?.field === field ? html`<p class="field-error" id="err-${field}">${e.message}</p>` : '');
const invalid = (e: FormError | undefined, field: string) => (e?.field === field ? new Raw(`aria-invalid="true" aria-describedby="err-${field}"`) : '');
const contact = (e: DirectoryEntry) =>
  html`${e.email ? html`<a href="mailto:${e.email}">${e.email}</a>` : ''}${e.email && e.phone ? ' · ' : ''}${e.phone ? html`<a href="tel:${e.phone.replace(/[^\d+]/g, '')}">${e.phone}</a>` : ''}`;

// ---------------------------------------------------------------------------
// Club home
// ---------------------------------------------------------------------------

export function clubHome(p: {
  org: Organization;
  admin: boolean;
  latest?: MeetingNote;
  memberCount: number;
  committees: { id: string; name: string; chair?: DirectoryEntry }[];
  links: ClubLink[];
  draftCount: number;
  pendingInvites: number;
}) {
  const b = base(p.org.id);
  return html`
<h1 class="sr-only">${p.org.name}: home</h1>
${p.admin
  ? html`<section class="card" aria-labelledby="manage-h">
      <h2 id="manage-h">Manage club</h2>
      <p class="muted small">Changes you make here apply to <strong>${p.org.name}</strong>.</p>
      <div class="actions">
        <a class="btn" href="${b}/invite">Invite someone</a>
        <a class="btn" href="${b}/notes/new">Add meeting notes</a>
        <a class="btn secondary" href="${b}/committees">Manage committees</a>
        <a class="btn secondary" href="${b}/manage#people">People and access</a>
      </div>
      ${p.draftCount || p.pendingInvites
        ? html`<p class="small" style="margin:12px 0 0">${p.draftCount ? html`<a href="${b}/notes">${p.draftCount} draft${p.draftCount === 1 ? '' : 's'} not yet finalized</a>` : ''}${p.draftCount && p.pendingInvites ? ' · ' : ''}${p.pendingInvites ? html`<a href="${b}/manage">${p.pendingInvites} pending invitation${p.pendingInvites === 1 ? '' : 's'}</a>` : ''}</p>`
        : ''}
    </section>`
  : ''}
<section class="card" aria-labelledby="latest-h">
  <h2 id="latest-h">Latest meeting notes</h2>
  ${p.latest
    ? html`<p style="margin:0 0 4px"><strong>${p.latest.title}</strong></p>
      <p class="muted" style="margin:0">${formatDate(p.latest.meetingDate)}</p>
      <div class="actions"><a class="btn block" href="${b}/notes/${p.latest.id}">Read the latest meeting notes</a></div>
      <p class="small" style="margin:12px 0 0"><a href="${b}/notes">All meeting notes</a></p>`
    : html`<p class="muted">No meeting notes have been shared yet.</p>`}
</section>
<div class="grid two">
  <section class="card" aria-labelledby="dir-h">
    <h2 id="dir-h">Member directory</h2>
    <p>${p.memberCount} ${p.memberCount === 1 ? 'person' : 'people'} listed.</p>
    <a class="btn secondary" href="${b}/members">Open member directory</a>
  </section>
  <section class="card" aria-labelledby="com-h">
    <h2 id="com-h">Committees</h2>
    ${p.committees.length
      ? html`<ul class="plain">${p.committees.map((c) => html`<li><strong>${c.name}</strong>${c.chair ? html`<br><span class="muted small">Chair: ${c.chair.name}</span>` : ''}</li>`)}</ul>`
      : html`<p class="muted">No committees listed yet.</p>`}
    <p class="small"><a href="${b}/committees">See committee details</a></p>
  </section>
</div>
<section class="card" aria-labelledby="links-h">
  <h2 id="links-h">Useful links</h2>
  ${p.links.length
    ? html`<ul class="plain">${p.links.map((l) => html`<li><a href="${l.url}" rel="noopener noreferrer" target="_blank">${l.title}</a>${l.description ? html`<br><span class="muted small">${l.description}</span>` : ''}</li>`)}</ul>`
    : html`<p class="muted">No links yet.</p>`}
  ${p.admin ? html`<p class="small"><a href="${b}/links">Add or remove links</a></p>` : ''}
</section>`;
}

// ---------------------------------------------------------------------------
// District / Region / National landing
// ---------------------------------------------------------------------------

export function upperHome(p: {
  org: Organization;
  admin: boolean;
  above: { name: string; level: Organization['level'] }[];
  below?: { id: string; name: string; level: Organization['level']; parentId: string | null }[];
}) {
  const b = base(p.org.id);
  const childLabel = CHILD_LABEL[p.org.level];
  const tree = (parentId: string): Raw =>
    html`<ul class="plain">${(p.below ?? [])
      .filter((u) => u.parentId === parentId)
      .map((u) => html`<li><strong>${u.name}</strong> <span class="badge">${LEVEL_LABEL[u.level]}</span>${(p.below ?? []).some((c) => c.parentId === u.id) ? html`<div style="margin:6px 0 0 18px">${tree(u.id)}</div>` : ''}</li>`)}</ul>`;
  return html`
<h1>${p.org.name}</h1>
${p.org.fictional ? html`<p class="note">This is a fictional organization used for the demo.</p>` : ''}
${p.org.description ? html`<p>${p.org.description}</p>` : ''}
${p.above.length ? html`<p class="muted small">Part of ${p.above.map((a, i) => html`${i ? ' → ' : ''}${a.name}`)}</p>` : ''}
${p.admin
  ? html`<section class="card" aria-labelledby="units-h">
      <h2 id="units-h">${childLabel ?? 'Units'} in this ${LEVEL_LABEL[p.org.level].toLowerCase()}</h2>
      <p class="muted small">Names only. Each club’s directory, meeting notes and links stay private to that club. To help manage a club, ask its admin to invite you.</p>
      ${p.below?.length ? tree(p.org.id) : html`<p class="muted">None listed yet.</p>`}
    </section>
    <section class="card" aria-labelledby="m-h">
      <h2 id="m-h">Manage ${LEVEL_LABEL[p.org.level].toLowerCase()}</h2>
      <p class="muted small">Changes you make here apply to <strong>${p.org.name}</strong>.</p>
      <div class="actions"><a class="btn" href="${b}/invite">Invite someone</a><a class="btn secondary" href="${b}/manage#people">People and access</a></div>
    </section>`
  : html`<p class="muted">You have member access to this ${LEVEL_LABEL[p.org.level].toLowerCase()} workspace.</p>`}`;
}

// ---------------------------------------------------------------------------
// Meeting notes
// ---------------------------------------------------------------------------

export function notesList(p: { org: Organization; admin: boolean; final: MeetingNote[]; drafts: MeetingNote[] }) {
  const b = base(p.org.id);
  const item = (n: MeetingNote) => html`<li><a href="${b}/notes/${n.id}"><strong>${n.title}</strong></a><br><span class="muted small">${formatDate(n.meetingDate)}</span></li>`;
  return html`
<div class="row"><h1>Meeting notes</h1>${p.admin ? html`<a class="btn" href="${b}/notes/new">Add meeting notes</a>` : ''}</div>
${p.admin
  ? html`<section class="card" aria-labelledby="drafts-h">
      <h2 id="drafts-h">Drafts <span class="badge draft">Only admins can see these</span></h2>
      ${p.drafts.length ? html`<ul class="plain">${p.drafts.map(item)}</ul>` : html`<p class="muted">No drafts.</p>`}
    </section>`
  : ''}
<section class="card" aria-labelledby="final-h">
  <h2 id="final-h">${p.admin ? 'Finalized (members can read these)' : 'Finalized notes'}</h2>
  ${p.final.length ? html`<ul class="plain">${p.final.map(item)}</ul>` : html`<p class="muted">No finalized notes yet.</p>`}
</section>`;
}

export function noteView(p: { org: Organization; admin: boolean; note: MeetingNote }) {
  const b = base(p.org.id);
  const n = p.note;
  return html`
<p class="small"><a href="${b}/notes">← All meeting notes</a></p>
<article class="card">
  ${n.status === 'draft' ? html`<p class="note"><strong>Draft.</strong> Members can’t see these notes until you finalize them.</p>` : ''}
  <h1>${n.title}</h1>
  <p class="muted">${formatDate(n.meetingDate)}</p>
  <div class="notes-body">${n.body}</div>
</article>
${p.admin
  ? html`<div class="actions">
      ${n.status === 'draft'
        ? html`<a class="btn secondary" href="${b}/notes/${n.id}/edit">Edit draft</a>
          <form method="post" action="${b}/notes/${n.id}" class="inline">${hidden('action', 'finalize')}<button class="btn" type="submit">Finalize and share with members</button></form>`
        : html`<form method="post" action="${b}/notes/${n.id}" class="inline">${hidden('action', 'reopen')}<button class="btn secondary" type="submit">Reopen as draft to correct</button></form>`}
    </div>`
  : ''}`;
}

export function noteForm(p: { org: Organization; note?: Partial<MeetingNote>; today: string; error?: FormError }) {
  const b = base(p.org.id);
  const n = p.note ?? {};
  return html`
<h1>${n.id ? 'Edit draft notes' : 'Add meeting notes'}</h1>
<p class="muted">Saving a draft keeps it private to admins. Finalize when the notes are ready for members.</p>
<form method="post" action="${n.id ? `${b}/notes/${n.id}` : `${b}/notes`}" class="card">
  <label for="title">Title</label>
  <input type="text" id="title" name="title" value="${n.title ?? ''}" placeholder="November general meeting" required ${invalid(p.error, 'title')}>${errorFor(p.error, 'title')}
  <label for="meetingDate">Meeting date</label>
  <input type="date" id="meetingDate" name="meetingDate" value="${n.meetingDate ?? p.today}" required ${invalid(p.error, 'meetingDate')}>${errorFor(p.error, 'meetingDate')}
  <label for="body">Notes</label>
  <textarea id="body" name="body">${n.body ?? ''}</textarea>
  <div class="actions">
    <button class="btn secondary" type="submit" name="action" value="draft">Save draft</button>
    <button class="btn" type="submit" name="action" value="final">Save and finalize</button>
  </div>
</form>`;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export function directoryList(p: { org: Organization; admin: boolean; entries: DirectoryEntry[] }) {
  const b = base(p.org.id);
  return html`
<div class="row"><h1>Member directory</h1>${p.admin ? html`<a class="btn" href="${b}/members/new">Add to directory</a>` : ''}</div>
${p.admin ? html`<p class="note small">Being listed here doesn’t let anyone sign in. To give someone access, use <a href="${b}/invite">Invite someone</a>.</p>` : ''}
<section class="card"><ul class="plain">
${p.entries.map(
  (e) => html`<li><div class="row"><div><strong>${e.name}</strong>${e.roleTitle ? html` <span class="muted">· ${e.roleTitle}</span>` : ''}<br><span class="small">${contact(e)}</span>${p.admin && e.contactVisibility === 'admins' ? html` <span class="badge small">Contact details: admins only</span>` : ''}</div>
  ${p.admin ? html`<a class="btn secondary small" href="${b}/members/${e.id}/edit" aria-label="Edit ${e.name}">Edit</a>` : ''}</div></li>`,
)}
</ul>${p.entries.length ? '' : html`<p class="muted">Nobody is listed yet.</p>`}</section>`;
}

export function directoryForm(p: { org: Organization; entry?: Partial<DirectoryEntry>; error?: FormError }) {
  const b = base(p.org.id);
  const e = p.entry ?? {};
  return html`
<h1>${e.id ? `Edit ${e.name ?? 'entry'}` : 'Add to the member directory'}</h1>
<form method="post" action="${e.id ? `${b}/members/${e.id}` : `${b}/members`}" class="card">
  ${hidden('action', 'save')}
  <label for="name">Name</label><input type="text" id="name" name="name" value="${e.name ?? ''}" required ${invalid(p.error, 'name')}>${errorFor(p.error, 'name')}
  <label for="roleTitle">Role (optional)</label><input type="text" id="roleTitle" name="roleTitle" value="${e.roleTitle ?? ''}" placeholder="Treasurer">
  <label for="email">Email (optional)</label><input type="email" id="email" name="email" value="${e.email ?? ''}" ${invalid(p.error, 'email')}>${errorFor(p.error, 'email')}
  <label for="phone">Phone (optional)</label><input type="tel" id="phone" name="phone" value="${e.phone ?? ''}">
  <fieldset><legend>Who can see the email and phone?</legend>
    <label class="choice"><input type="radio" name="contactVisibility" value="members" ${e.contactVisibility !== 'admins' ? new Raw('checked') : ''}> Everyone in the club workspace</label>
    <label class="choice"><input type="radio" name="contactVisibility" value="admins" ${e.contactVisibility === 'admins' ? new Raw('checked') : ''}> Admins only</label>
  </fieldset>
  <div class="actions"><button class="btn" type="submit">Save</button><a class="btn secondary" href="${b}/members">Cancel</a></div>
</form>
${e.id ? html`<section class="card"><h2>Remove</h2><p class="muted small">Removes ${e.name ?? 'this person'} from the directory. It doesn’t change whether they can sign in.</p><a class="btn danger" href="${b}/members/${e.id}/remove">✕ Remove from directory</a></section>` : ''}`;
}

// ---------------------------------------------------------------------------
// Committees and links
// ---------------------------------------------------------------------------

export function committeesPage(p: { org: Organization; admin: boolean; committees: { id: string; name: string; purpose: string; chair?: DirectoryEntry; members: DirectoryEntry[] }[]; directory: DirectoryEntry[]; error?: FormError }) {
  const b = base(p.org.id);
  return html`
<h1>Committees</h1>
${p.committees.map(
  (c) => html`<section class="card"><h2>${c.name}</h2>${c.purpose ? html`<p>${c.purpose}</p>` : ''}
  ${c.chair ? html`<p><strong>Chair:</strong> ${c.chair.name} <span class="small">${contact(c.chair)}</span></p>` : ''}
  ${c.members.length ? html`<p><strong>Members:</strong> ${c.members.map((m, i) => html`${i ? ', ' : ''}${m.name}`)}</p>` : ''}
  ${p.admin ? html`<a class="btn danger small" href="${b}/committees/${c.id}/remove">✕ Remove committee</a>` : ''}</section>`,
)}
${p.committees.length ? '' : html`<p class="muted">No committees yet.</p>`}
${p.admin
  ? html`<form method="post" action="${b}/committees" class="card" id="add">
      <h2>Add a committee</h2>
      <p class="muted small">Chairing a committee doesn’t give anyone admin rights.</p>
      <label for="cname">Committee name</label><input type="text" id="cname" name="name" required ${invalid(p.error, 'name')}>${errorFor(p.error, 'name')}
      <label for="purpose">What it does (optional)</label><input type="text" id="purpose" name="purpose">
      <label for="chair">Chair (optional)</label>
      <select id="chair" name="chairEntryId"><option value="">No chair yet</option>${p.directory.map((e) => html`<option value="${e.id}">${e.name}</option>`)}</select>
      <fieldset><legend>Members (optional)</legend>${p.directory.map((e) => html`<label class="choice"><input type="checkbox" name="memberEntryIds" value="${e.id}"> ${e.name}</label>`)}</fieldset>
      <div class="actions"><button class="btn" type="submit">Add committee</button></div>
    </form>`
  : ''}`;
}

export function linksPage(p: { org: Organization; admin: boolean; links: ClubLink[]; error?: FormError }) {
  const b = base(p.org.id);
  return html`
<h1>Useful links</h1>
<section class="card">${p.links.length
    ? html`<ul class="plain">${p.links.map(
        (l) => html`<li><div class="row"><div><a href="${l.url}" rel="noopener noreferrer" target="_blank"><strong>${l.title}</strong></a>${l.description ? html`<br><span class="muted small">${l.description}</span>` : ''}</div>
        ${p.admin ? html`<a class="btn danger small" href="${b}/links/${l.id}/remove" aria-label="Remove ${l.title}">✕ Remove</a>` : ''}</div></li>`,
      )}</ul>`
    : html`<p class="muted">No links yet.</p>`}</section>
${p.admin
  ? html`<form method="post" action="${b}/links" class="card"><h2>Add a link</h2>
      <label for="ltitle">Name</label><input type="text" id="ltitle" name="title" placeholder="Club calendar" required ${invalid(p.error, 'title')}>${errorFor(p.error, 'title')}
      <label for="lurl">Web address</label><input type="url" id="lurl" name="url" placeholder="https://" required ${invalid(p.error, 'url')}>${errorFor(p.error, 'url')}
      <label for="ldesc">Short description (optional)</label><input type="text" id="ldesc" name="description">
      <div class="actions"><button class="btn" type="submit">Add link</button></div></form>`
  : ''}`;
}

// ---------------------------------------------------------------------------
// Manage: invitations, people and access, workspace info, club to-do list
// ---------------------------------------------------------------------------

export function inviteForm(p: { org: Organization; values?: { email?: string; name?: string; level?: string }; error?: FormError }) {
  const b = base(p.org.id);
  const v = p.values ?? {};
  return html`
<h1>Invite someone</h1>
<p>They’ll get access to <strong>${p.org.name}</strong> only. No password is needed: they sign in with a code sent to this email address.</p>
<form method="post" action="${b}/invite" class="card">
  <label for="iname">Their name (optional)</label><input type="text" id="iname" name="name" value="${v.name ?? ''}">
  <label for="iemail">Their email address</label><input type="email" id="iemail" name="email" value="${v.email ?? ''}" required autocomplete="off" ${invalid(p.error, 'email')}>${errorFor(p.error, 'email')}
  <fieldset><legend>What can they do?</legend>
    <label class="choice"><input type="radio" name="level" value="member" ${v.level !== 'admin' ? new Raw('checked') : ''}> <span><strong>Member</strong>: read meeting notes, the directory, committees and links.</span></label>
    <label class="choice"><input type="radio" name="level" value="admin" ${v.level === 'admin' ? new Raw('checked') : ''}> <span><strong>Admin</strong>: also add notes, invite people and manage the club.</span></label>
  </fieldset>
  <div class="actions"><button class="btn" type="submit">Create invitation</button><a class="btn secondary" href="${b}">Cancel</a></div>
</form>`;
}

export function inviteCreated(p: { org: Organization; invitation: Invitation; link: string; demo?: boolean }) {
  const i = p.invitation;
  const subject = `You're invited to the ${p.org.name} workspace`;
  const body = `Hello${i.name ? ` ${i.name}` : ''},\n\nYou've been invited to the ${p.org.name} workspace, where you can read meeting notes and find the member directory.\n\n1. Open this link: ${p.link}\n2. Enter this email address: ${i.email}\n3. Type in the code that arrives by email.\n\nNo password needed. Bookmark the link to come back any time. This invitation expires on ${formatDate(i.expiresAt)}.`;
  return html`
<h1>Invitation ready</h1>
${p.demo
  ? html`<p><strong>${i.name ?? i.email}</strong> now appears under <strong>Invitations</strong> for <strong>${p.org.name}</strong>, as ${i.level === 'admin' ? 'an admin' : 'a member'}.</p>`
  : html`<p><strong>${i.name ?? i.email}</strong> can now sign in to <strong>${p.org.name}</strong> as ${i.level === 'admin' ? 'an admin' : 'a member'} using <strong>${i.email}</strong>. The invitation expires on ${formatDate(i.expiresAt)}.</p>`}
${p.demo
  ? html`<p class="note"><strong>This is a demo, so nothing was sent and no one was really invited.</strong> In the real workspace you’d now get a link to send them from your own email, so they know it’s really from you.</p>
<div class="actions"><a class="btn secondary" href="${base(p.org.id)}/manage#invitations">Done</a></div>`
  : html`<p class="note"><strong>No email has been sent yet.</strong> Send them the link below from your own email so they know it’s really from you.</p>
<section class="card">
  <label for="invlink">Workspace link</label>
  <input type="text" id="invlink" value="${p.link}" readonly>
  <div class="actions">
    <button class="btn secondary" type="button" id="copy-link" hidden>Copy link</button>
    <a class="btn" href="mailto:${encodeURIComponent(i.email)}?subject=${encodeURIComponent(subject)}&amp;body=${encodeURIComponent(body)}">Write the invitation email</a>
    <a class="btn secondary" href="${base(p.org.id)}/manage#invitations">Done</a>
  </div>
</section>
<script>
(() => {
  const b = document.getElementById('copy-link');
  if (!b || !navigator.clipboard) return;
  b.hidden = false;
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(document.getElementById('invlink').value); b.textContent = 'Copied ✓'; }
    catch { b.textContent = 'Select the link above and copy it'; }
  });
})();
</script>`}`;
}

export function managePage(p: {
  org: Organization;
  people: { grant: AccessGrant; person: Person; isLastAdmin: boolean }[];
  invitations: (Invitation & { expired: boolean })[];
  todo?: ClubTrackerItem[];
  meId: string;
  error?: FormError;
}) {
  const b = base(p.org.id);
  const label = LEVEL_LABEL[p.org.level].toLowerCase();
  const levelBadge = (l: AccessLevel) => html`<span class="badge ${l === 'admin' ? 'admin' : ''}">${l === 'admin' ? 'Admin' : 'Member'}</span>`;
  const admins = p.people.filter((x) => x.grant.level === 'admin').length;
  return html`
<div class="row"><h1>Manage ${label}</h1><a class="btn" href="${b}/invite">Invite someone</a></div>
<p class="muted">Changes on this page apply to <strong>${p.org.name}</strong>.</p>
<nav aria-label="On this page" class="small" style="margin:0 0 16px">
  <a href="#people">People and access</a> · <a href="#invitations">Invitations</a>${p.todo ? html` · <a href="#todo">To-do list</a>` : ''} · <a href="#about">About this ${label}</a>
</nav>
${admins < 2 ? html`<p class="note">This ${label} has only one admin. Make a second person an admin so someone can take over if needed.</p>` : ''}
<section class="card" id="people" aria-labelledby="people-h"><h2 id="people-h">People and access</h2>
<p class="muted small">Who can sign in. Removing someone takes effect immediately.</p>
<ul class="plain">${p.people.map(
    (x) => html`<li>
      <div class="row"><div><strong>${x.person.name}</strong>${x.person.id === p.meId ? ' (you)' : ''} ${levelBadge(x.grant.level)}<br><span class="muted small">${x.person.email}</span></div></div>
      ${x.isLastAdmin
        ? html`<p class="small" style="margin:8px 0 0">${x.person.id === p.meId ? 'You’re' : 'This is'} the only admin. To step down, first make someone else an admin.</p>`
        : html`<div class="actions">
        ${x.grant.level === 'member'
          ? html`<a class="btn secondary small" href="${b}/access/${x.grant.id}/make-admin">Make admin</a>`
          : html`<form method="post" action="${b}/access/${x.grant.id}" class="inline">${hidden('action', 'make-member')}<button class="btn secondary small" type="submit">Change to member</button></form>`}
        <a class="btn danger small" href="${b}/access/${x.grant.id}/remove">✕ Remove access</a>
      </div>`}
    </li>`,
  )}</ul></section>
<section class="card" id="invitations" aria-labelledby="inv-h"><h2 id="inv-h">Invitations not yet used</h2>
${p.invitations.length
    ? html`<ul class="plain">${p.invitations.map(
        (i) => html`<li><div class="row"><div><strong>${i.name ?? i.email}</strong> ${levelBadge(i.level)}<br><span class="muted small">${i.email} · ${i.expired ? html`<strong>Expired</strong>` : html`Expires ${formatDate(i.expiresAt)}`}</span></div></div>
        <div class="actions">
          ${i.expired ? html`<form method="post" action="${b}/invite" class="inline">${hidden('email', i.email)}${hidden('name', i.name ?? '')}${hidden('level', i.level)}<button class="btn small" type="submit">Send a new invitation</button></form>` : ''}
          <a class="btn danger small" href="${b}/invitations/${i.id}/cancel">✕ Cancel invitation</a>
        </div></li>`,
      )}</ul>`
    : html`<p class="muted">None.</p>`}
</section>
${p.todo
  ? html`<section class="card" id="todo" aria-labelledby="todo-h"><h2 id="todo-h">Club to-do list <span class="badge">Admins only</span></h2>
      <ul class="plain">${p.todo.map(
        (t) => html`<li><form method="post" action="${b}/todo/${t.id}">
          <label for="col-${t.id}" style="margin:0 0 6px">${t.title}</label>
          <div class="row" style="flex-wrap:nowrap"><div><select id="col-${t.id}" name="column">${COLUMNS.map((c) => html`<option value="${c}" ${t.column === c ? new Raw('selected') : ''}>${COLUMN_LABELS[c]}</option>`)}</select></div>
          <button class="btn secondary small" type="submit" aria-label="Save status of ${t.title}">Save</button></div></form></li>`,
      )}</ul>
      <form method="post" action="${b}/todo"><label for="todo-title">Add a task</label><input type="text" id="todo-title" name="title" required ${invalid(p.error, 'title')}>${errorFor(p.error, 'title')}
      <div class="actions"><button class="btn secondary" type="submit">Add task</button></div></form>
    </section>`
  : ''}
<form method="post" action="${b}/info" class="card" id="about"><h2>About this ${label}</h2>
  <label for="desc">Short description</label><input type="text" id="desc" name="description" value="${p.org.description}">
  <label for="cemail">Contact email for “Get help” (optional)</label><input type="email" id="cemail" name="contactEmail" value="${p.org.contactEmail ?? ''}" ${invalid(p.error, 'contactEmail')}>${errorFor(p.error, 'contactEmail')}
  <div class="actions"><button class="btn secondary" type="submit">Save</button></div>
</form>`;
}

/** A plain confirmation step before anything that removes or grants power. Works without JavaScript. */
export function confirmPage(p: { title: string; message: Raw; action: string; fields: Record<string, string>; confirmLabel: string; cancelHref: string; cancelLabel: string; danger: boolean }) {
  return html`
<h1>${p.title}</h1>
<section class="card">
  <p>${p.message}</p>
  <form method="post" action="${p.action}">
    ${Object.entries(p.fields).map(([k, v]) => hidden(k, v))}
    <div class="actions">
      <button class="btn ${p.danger ? 'danger solid' : ''}" type="submit">${p.confirmLabel}</button>
      <a class="btn secondary" href="${p.cancelHref}">${p.cancelLabel}</a>
    </div>
  </form>
</section>`;
}

// ---------------------------------------------------------------------------
// Workspace switcher and status pages
// ---------------------------------------------------------------------------

export function switchPage(workspaces: (Organization & { access: AccessLevel })[], currentId?: string) {
  return html`
<h1>Choose a workspace</h1>
<ul class="plain card">${workspaces.map(
    (w) => html`<li><a class="btn ${w.id === currentId ? '' : 'secondary'} block" href="/w/${w.id}">${w.name}</a><p class="small muted" style="margin:6px 0 0">${LEVEL_LABEL[w.level]} workspace · ${w.access === 'admin' ? 'Admin' : 'Member'}${w.id === currentId ? ' · current' : ''}</p></li>`,
  )}</ul>`;
}

const helpBlock = (help: HelpContact) => html`
<section class="card" id="help"><h2>Get help from your club</h2>
<p>Ask a club admin to send you a new invitation${help.adminNames.length ? html`: ${help.adminNames.join(', ')}` : ''}.</p>
${help.contactEmail ? html`<p>Or email <a href="mailto:${help.contactEmail}">${help.contactEmail}</a>.</p>` : ''}
<p class="muted small">Tell them the email address you use, so they invite the right one.</p></section>`;

export function expiredPage(p: { help: HelpContact; signOutPath: string }) {
  return html`
<h1>Your invitation has expired</h1>
<p>Your invitation to <strong>${p.help.orgName}</strong> was only valid for 14 days. That’s normal, and easy to fix.</p>
${helpBlock(p.help)}
<p><a class="btn secondary" href="${p.signOutPath}">Use a different email address</a></p>`;
}

export function revokedPage(p: { help: HelpContact; signOutPath: string }) {
  return html`
<h1>You no longer have access</h1>
<p>Your access to <strong>${p.help.orgName}</strong> has been removed. If you think this is a mistake, contact the club.</p>
${helpBlock(p.help)}
<p><a class="btn secondary" href="${p.signOutPath}">Sign out</a></p>`;
}

export function noAccessPage(p: { email: string; signOutPath: string }) {
  return html`
<h1>This email address hasn’t been invited</h1>
<p>You signed in as <strong>${p.email}</strong>, but no club has invited that address yet.</p>
<section class="card"><h2>Get help from your club</h2><p>Ask your club secretary or a club admin to invite <strong>${p.email}</strong>. If you usually use a different email address, sign out and try that one.</p></section>
<p><a class="btn secondary" href="${p.signOutPath}">Sign out and try another email</a></p>`;
}

export function signedOutPage(p: { demo: boolean }) {
  return html`
<h1>You’re signed out</h1>
<p>To come back, open your club’s link again. You’ll be asked for your email address and sent a short code. There’s no password to remember.</p>
<div class="actions">
  ${p.demo
    ? html`<a class="btn" href="/__demo">Sign in (demo: choose a fictional person)</a>`
    : html`<a class="btn" href="/">Sign in with my email</a>`}
</div>
<section class="card" style="margin-top:20px"><h2>Code didn’t arrive?</h2>
<p>Check your junk or spam folder. Codes expire after 10 minutes. On the sign-in page, choose <strong>Send a new link/code</strong> to get another one.</p>
${p.demo ? html`<p class="note small">The demo doesn’t send email. In the shared version, the code is emailed by Cloudflare Access.</p>` : ''}
<p>Still stuck? <strong>Get help from your club</strong>: ask your club secretary or the person who invited you.</p></section>`;
}

export function unconfiguredPage(reason: string) {
  return html`
<h1>Sign-in isn’t set up yet</h1>
<p>This workspace is closed until a sign-in provider is configured. Nothing private is shown.</p>
<p class="muted small">${reason}</p>`;
}

export function notFoundPage(homeHref = '/') {
  return html`
<h1>We couldn’t find that page</h1>
<p>It may have been removed, or it isn’t part of your workspace.</p>
<p><a class="btn" href="${homeHref}">Go to my workspace</a></p>`;
}

export function demoPanel(p: { identities: { email: string; label: string; explains: string }[]; invitees: { email: string; orgName: string }[]; current?: string }) {
  const button = (email: string, label: string, explains: string) =>
    html`<li><form method="post" action="/__demo">${hidden('email', email)}<button class="btn ${p.current === email ? '' : 'secondary'} block" type="submit">${label}</button></form><p class="small muted" style="margin:6px 0 0">${explains}${p.current === email ? ' (current)' : ''}</p></li>`;
  return html`
<h1>Developer panel: choose a fictional person</h1>
<p class="note">Local demo only. This panel doesn’t exist in a shared deployment, where people prove their email with a one-time code from Cloudflare Access. Choosing a person here stands in for that step.</p>
<section class="card"><h2>People</h2><ul class="plain">${p.identities.map((i) => button(i.email, i.label, i.explains))}</ul></section>
${p.invitees.length ? html`<section class="card"><h2>Invited addresses (first visit)</h2><ul class="plain">${p.invitees.map((i) => button(i.email, i.email, `Pending invitation to ${i.orgName}.`))}</ul></section>` : ''}
<form method="post" action="/__demo" class="card">${hidden('reset', '1')}<h2>Start over</h2><p class="muted small">Restores all fictional demo data.</p><button class="btn danger" type="submit">Reset demo data</button></form>`;
}

