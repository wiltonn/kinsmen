/**
 * HTTP layer: Request → Response using web-standard APIs, so the same code runs
 * in the local Node dev server and in a Cloudflare Worker.
 */
import { DEMO_COOKIE, readCookie, type AuthProvider } from './auth.ts';
import { LEVEL_LABEL, type Organization } from './domain.ts';
import { html, layout, type LayoutContext, Raw } from './html.ts';
import { AccessDenied, type Actor } from './policy.ts';
import { UserError, type WorkspaceService } from './service.ts';
import * as V from './views.ts';

export interface AppOptions {
  service: WorkspaceService;
  auth: AuthProvider;
  /** Demo only: identities for the developer panel, and a data reset. */
  demo?: {
    identities: { email: string; label: string; explains: string }[];
    invitees: () => Promise<{ email: string; orgName: string }[]>;
    /** Every address the panel may act as (defaults to identities + invitees). */
    allowed?: () => Promise<string[]>;
    reset: () => Promise<void>;
  };
  /**
   * The public in-browser demo (/club-demo) only. The app runs inside the
   * visitor's own browser tab on fictional data, and every request is built by
   * the demo's page script, which can't set an Origin header; so the
   * cross-site check is skipped. Invitations say nothing was sent and offer no
   * link or email. Never set by the local server or the Worker.
   */
  publicDemo?: boolean;
}

const LAST_WS_COOKIE = 'kfsb_last_workspace';

const FLASH: Record<string, (ws: string) => string> = {
  'note-draft': () => 'Draft saved. Members can’t see it until you finalize it.',
  'note-final': (ws) => `Finalized. Members of ${ws} can now read these notes.`,
  'note-reopened': () => 'Reopened as a draft. Members can’t see these notes until you finalize them again.',
  'member-saved': (ws) => `Saved to the ${ws} member directory.`,
  'member-removed': (ws) => `Removed from the ${ws} member directory.`,
  'committee-saved': (ws) => `Committee added to ${ws}.`,
  'committee-removed': (ws) => `Committee removed from ${ws}.`,
  'link-saved': (ws) => `Link added for ${ws}.`,
  'link-removed': (ws) => `Link removed from ${ws}.`,
  'access-admin': (ws) => `Saved. They are now an admin of ${ws}.`,
  'access-member': (ws) => `Saved. They now have member access to ${ws}.`,
  'access-removed': (ws) => `Access removed. They can no longer open ${ws}.`,
  'invite-cancelled': (ws) => `Invitation cancelled. The link no longer lets them into ${ws}.`,
  'info-saved': (ws) => `Details saved for ${ws}.`,
  'todo-saved': (ws) => `To-do list saved for ${ws}.`,
};

const htmlResponse = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });

const redirect = (location: string, headers: Record<string, string> = {}) => new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store', ...headers } });

export function createApp(opts: AppOptions) {
  const { service, auth } = opts;
  const isDemo = auth.mode === 'demo' && Boolean(opts.demo);

  async function demoWho(request: Request) {
    if (!isDemo) return undefined;
    const email = readCookie(request, DEMO_COOKIE);
    return { who: opts.demo!.identities.find((i) => i.email === email)?.label ?? email };
  }

  async function page(request: Request, ctx: Omit<LayoutContext, 'demo' | 'signOutPath'>, body: Raw, status = 200, headers: Record<string, string> = {}) {
    return htmlResponse(layout({ ...ctx, demo: await demoWho(request), signOutPath: auth.signOutPath }, body), status, headers);
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'POST' && !opts.publicDemo) {
      // Reject cross-site form posts.
      const origin = request.headers.get('origin');
      if (!origin || origin !== url.origin) return new Response('Forbidden', { status: 403 });
    }

    // Developer panel (demo only; 404 everywhere else).
    if (path === '/__demo') {
      if (!isDemo) return page(request, { title: 'Not found' }, V.notFoundPage(), 404);
      if (request.method === 'POST' && !opts.publicDemo) {
        const form = await request.formData();
        if (form.get('reset')) {
          await opts.demo!.reset();
          return redirect('/__demo', { 'set-cookie': `${DEMO_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` });
        }
        const email = String(form.get('email') ?? '').toLowerCase();
        const allowed = opts.demo!.allowed ? await opts.demo!.allowed() : [...opts.demo!.identities.map((i) => i.email), ...(await opts.demo!.invitees()).map((i) => i.email)];
        if (!allowed.includes(email)) return new Response('Unknown demo identity', { status: 400 });
        return redirect('/', { 'set-cookie': `${DEMO_COOKIE}=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax` });
      }
      return page(request, { title: 'Developer panel' }, V.demoPanel({ identities: opts.demo!.identities, invitees: await opts.demo!.invitees(), current: readCookie(request, DEMO_COOKIE) }));
    }

    if (path === '/sign-out') {
      return page(request, { title: 'Signed out' }, V.signedOutPage({ demo: isDemo }), 200, {
        'set-cookie': `${DEMO_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
      });
    }

    // Everything else is private: identify, then authorize.
    const identity = await auth.identify(request);
    if (identity.kind === 'unconfigured') return page(request, { title: 'Sign-in not set up' }, V.unconfiguredPage(identity.reason), 503);
    if (identity.kind === 'signed-out') return page(request, { title: 'Signed out' }, V.signedOutPage({ demo: isDemo }), 401);

    const result = await service.signIn(identity.email);
    const signedIn = { signedIn: true };
    if (result.kind === 'expired') return page(request, { title: 'Invitation expired', ...signedIn }, V.expiredPage({ help: result.help, signOutPath: auth.signOutPath }), 403);
    if (result.kind === 'revoked') return page(request, { title: 'No access', ...signedIn }, V.revokedPage({ help: result.help, signOutPath: auth.signOutPath }), 403);
    if (result.kind === 'no-access') return page(request, { title: 'Not invited', ...signedIn }, V.noAccessPage({ email: result.email, signOutPath: auth.signOutPath }), 403);

    const actor = result.actor;
    const workspaces = await service.workspaces(actor);
    const canSwitch = workspaces.length > 1;

    if (path === '/') {
      if (workspaces.length === 1) return redirect(`/w/${workspaces[0].id}`);
      const last = readCookie(request, LAST_WS_COOKIE);
      if (last && workspaces.some((w) => w.id === last)) return redirect(`/w/${last}`);
      return page(request, { title: 'Choose a workspace', ...signedIn, canSwitch }, V.switchPage(workspaces));
    }
    if (path === '/switch') {
      return page(request, { title: 'Switch workspace', ...signedIn, canSwitch }, V.switchPage(workspaces, readCookie(request, LAST_WS_COOKIE)));
    }

    const m = /^\/w\/([^/]+)(?:\/(.*))?$/.exec(path);
    if (!m) return page(request, { title: 'Not found', ...signedIn, canSwitch }, V.notFoundPage(), 404);
    const orgId = decodeURIComponent(m[1]);
    const rest = (m[2] ?? '').split('/').filter(Boolean).map(decodeURIComponent);

    try {
      return await workspaceRoute(request, url, actor, orgId, rest, canSwitch);
    } catch (e) {
      if (e instanceof AccessDenied) return page(request, { title: 'Not found', ...signedIn, canSwitch }, V.notFoundPage(), 404);
      throw e;
    }
  }

  async function workspaceRoute(request: Request, url: URL, actor: Actor, orgId: string, rest: string[], canSwitch: boolean): Promise<Response> {
    const { org, access } = await service.workspace(actor, orgId);
    const admin = access === 'admin';
    const b = `/w/${encodeURIComponent(org.id)}`;
    const isClub = org.level === 'club';
    const section = rest[0] ?? '';
    const nav = isClub
      ? [
          { href: b, label: 'Home', current: section === '' },
          { href: `${b}/notes`, label: 'Meeting notes', current: section === 'notes' },
          { href: `${b}/members`, label: 'Members', current: section === 'members' },
          { href: `${b}/committees`, label: 'Committees', current: section === 'committees' },
          { href: `${b}/links`, label: 'Links', current: section === 'links' },
          ...(admin ? [{ href: `${b}/manage`, label: 'Manage club', current: ['manage', 'invite', 'access', 'invitations'].includes(section) }] : []),
        ]
      : [{ href: b, label: 'Home', current: section === '' }, ...(admin ? [{ href: `${b}/manage`, label: `Manage ${LEVEL_LABEL[org.level].toLowerCase()}`, current: ['manage', 'invite', 'access', 'invitations'].includes(section) }] : [])];
    const ctx = (title: string, extra: Partial<LayoutContext> = {}): Omit<LayoutContext, 'demo' | 'signOutPath'> => ({
      title,
      workspace: { id: org.id, name: org.name, levelLabel: `${LEVEL_LABEL[org.level]} workspace` },
      nav,
      canSwitch,
      signedIn: true,
      flash: FLASH[url.searchParams.get('done') ?? '']?.(org.name),
      ...extra,
    });
    const remember = { 'set-cookie': `${LAST_WS_COOKIE}=${encodeURIComponent(org.id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` };
    const done = (where: string, key: string, hash = '') => redirect(`${where}${where.includes('?') ? '&' : '?'}done=${key}${hash}`);
    const post = request.method === 'POST';
    const form = post ? await request.formData() : undefined;
    const field = (k: string) => (form?.get(k) ?? undefined) as string | undefined;
    /** Re-show the form with the problem: a banner, and the field marked when known. */
    const fail = (title: string, body: (error: V.FormError) => Raw | Promise<Raw>, e: unknown) => {
      if (!(e instanceof UserError)) throw e;
      const error = { field: e.field, message: e.message };
      return Promise.resolve(body(error)).then((b) => page(request, ctx(title, { error: e.message }), b, 422));
    };
    const confirm = (title: string, c: Omit<Parameters<typeof V.confirmPage>[0], 'title'>) => page(request, ctx(title), V.confirmPage({ title, ...c }));
    const today = new Date().toISOString().slice(0, 10);

    // Home
    if (section === '' && !post) {
      if (isClub) {
        const [latest, directory, committees, links, notes, invitations] = await Promise.all([
          service.latestFinalNote(actor, org.id),
          service.directory(actor, org.id),
          service.committees(actor, org.id),
          service.links(actor, org.id),
          admin ? service.notes(actor, org.id) : Promise.resolve({ drafts: [] }),
          admin ? service.invitations(actor, org.id) : Promise.resolve([]),
        ]);
        return page(
          request,
          ctx('Club workspace'),
          V.clubHome({ org, admin, latest, memberCount: directory.length, committees, links, draftCount: notes.drafts.length, pendingInvites: invitations.filter((i) => !i.expired).length }),
          200,
          remember,
        );
      }
      return page(request, ctx(`${LEVEL_LABEL[org.level]} workspace`), V.upperHome({ org, admin, above: await service.unitsAbove(actor, org.id), below: admin ? await service.unitsBelow(actor, org.id) : undefined }), 200, remember);
    }

    // Meeting notes
    if (section === 'notes') {
      const id = rest[1];
      if (!id && !post) return page(request, ctx('Meeting notes'), V.notesList({ org, admin, ...(await service.notes(actor, org.id)) }));
      if (id === 'new' && !post) {
        if (!admin) throw new AccessDenied();
        return page(request, ctx('Add meeting notes'), V.noteForm({ org, today }));
      }
      if (!id && post) {
        const input = { title: field('title'), meetingDate: field('meetingDate'), body: field('body'), finalize: field('action') === 'final' };
        try {
          const note = await service.saveNote(actor, org.id, input);
          return done(`${b}/notes/${note.id}`, note.status === 'final' ? 'note-final' : 'note-draft');
        } catch (e) {
          return fail('Add meeting notes', (error) => V.noteForm({ org, today, error, note: { title: input.title, meetingDate: input.meetingDate, body: input.body } }), e);
        }
      }
      if (id && rest[2] === 'edit' && !post) {
        const note = await service.note(actor, org.id, id);
        if (!admin) throw new AccessDenied();
        return page(request, ctx('Edit notes'), V.noteForm({ org, today, note }));
      }
      if (id && post) {
        const action = field('action');
        if (action === 'finalize') {
          await service.finalizeNote(actor, org.id, id);
          return done(`${b}/notes/${id}`, 'note-final');
        }
        if (action === 'reopen') {
          await service.reopenNote(actor, org.id, id);
          return done(`${b}/notes/${id}`, 'note-reopened');
        }
        const input = { id, title: field('title'), meetingDate: field('meetingDate'), body: field('body'), finalize: action === 'final' };
        try {
          const note = await service.saveNote(actor, org.id, input);
          return done(`${b}/notes/${note.id}`, note.status === 'final' ? 'note-final' : 'note-draft');
        } catch (e) {
          return fail('Edit notes', (error) => V.noteForm({ org, today, error, note: { id, title: input.title, meetingDate: input.meetingDate, body: input.body } }), e);
        }
      }
      if (id && !post) return page(request, ctx('Meeting notes'), V.noteView({ org, admin, note: await service.note(actor, org.id, id) }));
    }

    // Member directory
    if (section === 'members') {
      const id = rest[1];
      if (!id && !post) return page(request, ctx('Member directory'), V.directoryList({ org, admin, entries: await service.directory(actor, org.id) }));
      if (id === 'new' && !post) {
        if (!admin) throw new AccessDenied();
        return page(request, ctx('Add to directory'), V.directoryForm({ org }));
      }
      if (id && rest[2] === 'edit' && !post) {
        if (!admin) throw new AccessDenied();
        return page(request, ctx('Edit directory entry'), V.directoryForm({ org, entry: await service.directoryEntry(actor, org.id, id) }));
      }
      if (id && rest[2] === 'remove' && !post) {
        if (!admin) throw new AccessDenied();
        const entry = await service.directoryEntry(actor, org.id, id);
        return confirm('Remove from directory?', {
          message: html`Remove <strong>${entry.name}</strong> from the <strong>${org.name}</strong> member directory? This doesn’t change whether they can sign in.`,
          action: `${b}/members/${id}`,
          fields: { action: 'remove' },
          confirmLabel: 'Yes, remove from directory',
          cancelHref: `${b}/members/${id}/edit`,
          cancelLabel: 'Keep them listed',
          danger: true,
        });
      }
      if (post) {
        if (id && field('action') === 'remove') {
          await service.removeDirectoryEntry(actor, org.id, id);
          return done(`${b}/members`, 'member-removed');
        }
        const input = { id, name: field('name'), roleTitle: field('roleTitle'), email: field('email'), phone: field('phone'), contactVisibility: field('contactVisibility') };
        try {
          await service.saveDirectoryEntry(actor, org.id, input);
          return done(`${b}/members`, 'member-saved');
        } catch (e) {
          return fail('Member directory', (error) => V.directoryForm({ org, error, entry: input as never }), e);
        }
      }
    }

    // Committees
    if (section === 'committees') {
      const id = rest[1];
      if (id && rest[2] === 'remove' && !post) {
        if (!admin) throw new AccessDenied();
        const committee = (await service.committees(actor, org.id)).find((c) => c.id === id);
        if (!committee) throw new AccessDenied();
        return confirm('Remove committee?', {
          message: html`Remove the <strong>${committee.name}</strong> committee from <strong>${org.name}</strong>? The people stay in the member directory.`,
          action: `${b}/committees/${id}`,
          fields: { action: 'remove' },
          confirmLabel: 'Yes, remove committee',
          cancelHref: `${b}/committees`,
          cancelLabel: 'Keep committee',
          danger: true,
        });
      }
      if (post) {
        if (id && field('action') === 'remove') {
          await service.removeCommittee(actor, org.id, id);
          return done(`${b}/committees`, 'committee-removed');
        }
        try {
          await service.saveCommittee(actor, org.id, { name: field('name'), purpose: field('purpose'), chairEntryId: field('chairEntryId'), memberEntryIds: form!.getAll('memberEntryIds') });
          return done(`${b}/committees`, 'committee-saved');
        } catch (e) {
          return fail('Committees', async (error) => V.committeesPage({ org, admin, error, committees: await service.committees(actor, org.id), directory: await service.directory(actor, org.id) }), e);
        }
      }
      return page(request, ctx('Committees'), V.committeesPage({ org, admin, committees: await service.committees(actor, org.id), directory: admin ? await service.directory(actor, org.id) : [] }));
    }

    // Links
    if (section === 'links') {
      const id = rest[1];
      if (id && rest[2] === 'remove' && !post) {
        if (!admin) throw new AccessDenied();
        const link = (await service.links(actor, org.id)).find((l) => l.id === id);
        if (!link) throw new AccessDenied();
        return confirm('Remove link?', {
          message: html`Remove the link <strong>${link.title}</strong> from <strong>${org.name}</strong>?`,
          action: `${b}/links/${id}`,
          fields: { action: 'remove' },
          confirmLabel: 'Yes, remove link',
          cancelHref: `${b}/links`,
          cancelLabel: 'Keep link',
          danger: true,
        });
      }
      if (post) {
        if (id && field('action') === 'remove') {
          await service.removeLink(actor, org.id, id);
          return done(`${b}/links`, 'link-removed');
        }
        try {
          await service.saveLink(actor, org.id, { title: field('title'), url: field('url'), description: field('description') });
          return done(`${b}/links`, 'link-saved');
        } catch (e) {
          return fail('Useful links', async (error) => V.linksPage({ org, admin, error, links: await service.links(actor, org.id) }), e);
        }
      }
      return page(request, ctx('Useful links'), V.linksPage({ org, admin, links: await service.links(actor, org.id) }));
    }

    // Everything below is admin-only (the service enforces it too).
    if (!admin) throw new AccessDenied();

    const manage = async (error?: UserError) =>
      page(
        request,
        ctx(`Manage ${LEVEL_LABEL[org.level].toLowerCase()}`, error ? { error: error.message } : {}),
        V.managePage({ org, error: error && { field: error.field, message: error.message }, people: await service.people(actor, org.id), invitations: await service.invitations(actor, org.id), todo: isClub ? await service.trackerItems(actor, org.id) : undefined, meId: actor.person.id }),
        error ? 422 : 200,
      );

    if (section === 'manage' && !post) return manage();

    if (section === 'invite') {
      if (!post && rest[1]) {
        const invitation = await service.invitation(actor, org.id, rest[1]);
        return page(request, ctx('Invitation ready', { flash: undefined }), V.inviteCreated({ org, invitation, link: `${url.origin}/`, demo: opts.publicDemo }));
      }
      if (!post) return page(request, ctx('Invite someone'), V.inviteForm({ org }));
      const values = { email: field('email'), name: field('name'), level: field('level') };
      try {
        const invitation = await service.invite(actor, org.id, values);
        return redirect(`${b}/invite/${encodeURIComponent(invitation.id)}`);
      } catch (e) {
        return fail('Invite someone', (error) => V.inviteForm({ org, values, error }), e);
      }
    }

    // Confirmation steps (GET), each posting to the existing action.
    if (section === 'access' && !post && rest[1] && (rest[2] === 'remove' || rest[2] === 'make-admin')) {
      const row = (await service.people(actor, org.id)).find((x) => x.grant.id === rest[1]);
      if (!row) throw new AccessDenied();
      const name = row.person.name;
      return rest[2] === 'remove'
        ? confirm('Remove access?', {
            message: html`Remove <strong>${name}</strong>’s access to <strong>${org.name}</strong>? They’ll lose access straight away. Their directory listing isn’t changed.`,
            action: `${b}/access/${rest[1]}`,
            fields: { action: 'remove' },
            confirmLabel: 'Yes, remove access',
            cancelHref: `${b}/manage#people`,
            cancelLabel: 'Keep access',
            danger: true,
          })
        : confirm('Make admin?', {
            message: html`Make <strong>${name}</strong> an admin of <strong>${org.name}</strong>? They’ll be able to add notes, invite people and remove access.`,
            action: `${b}/access/${rest[1]}`,
            fields: { action: 'make-admin' },
            confirmLabel: 'Yes, make admin',
            cancelHref: `${b}/manage#people`,
            cancelLabel: 'Not now',
            danger: false,
          });
    }
    if (section === 'invitations' && !post && rest[1] && rest[2] === 'cancel') {
      const inv = await service.invitation(actor, org.id, rest[1]);
      return confirm('Cancel invitation?', {
        message: html`Cancel the invitation for <strong>${inv.name ?? inv.email}</strong> (${inv.email}) to <strong>${org.name}</strong>? Their link will stop working.`,
        action: `${b}/invitations/${rest[1]}`,
        fields: { action: 'revoke' },
        confirmLabel: 'Yes, cancel invitation',
        cancelHref: `${b}/manage#invitations`,
        cancelLabel: 'Keep invitation',
        danger: true,
      });
    }

    if (section === 'access' && post && rest[1]) {
      const action = field('action');
      try {
        if (action === 'make-admin') await service.setAccessLevel(actor, org.id, rest[1], 'admin');
        else if (action === 'make-member') await service.setAccessLevel(actor, org.id, rest[1], 'member');
        else if (action === 'remove') await service.revokeAccess(actor, org.id, rest[1]);
        else throw new AccessDenied();
      } catch (e) {
        if (e instanceof UserError) return manage(e);
        throw e;
      }
      // If you removed your own admin access, you can't come back here.
      const after = await service.signIn(actor.person.email);
      const stillAdmin = after.kind === 'ok' && service.isAdmin(after.actor, org.id);
      const key = action === 'make-admin' ? 'access-admin' : action === 'make-member' ? 'access-member' : 'access-removed';
      return done(stillAdmin ? `${b}/manage` : '/', key, stillAdmin ? '#people' : '');
    }

    if (section === 'invitations' && post && rest[1] && field('action') === 'revoke') {
      await service.revokeInvitation(actor, org.id, rest[1]);
      return done(`${b}/manage`, 'invite-cancelled', '#invitations');
    }

    if (section === 'info' && post) {
      try {
        await service.updateWorkspaceInfo(actor, org.id, { description: field('description'), contactEmail: field('contactEmail') });
        return done(`${b}/manage`, 'info-saved', '#about');
      } catch (e) {
        if (e instanceof UserError) return manage(e);
        throw e;
      }
    }

    if (section === 'todo' && post) {
      try {
        if (rest[1]) await service.moveTrackerItem(actor, org.id, rest[1], field('column'));
        else await service.addTrackerItem(actor, org.id, { title: field('title'), column: 'next' });
        return done(`${b}/manage`, 'todo-saved', '#todo');
      } catch (e) {
        if (e instanceof UserError) return manage(e);
        throw e;
      }
    }

    throw new AccessDenied();
  }

  return { handle };
}

export type App = ReturnType<typeof createApp>;
export type { Organization };
