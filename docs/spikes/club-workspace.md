# Spike: Club workspace (Club → District → Region → National)

Branch `spike/admin-tracker`, written 2026-11-07. This is a **local prototype**. Nothing is deployed, and no email is sent.

## Try it

```bash
npm ci
npm run workspace:demo
```

Open **http://127.0.0.1:4322/**. The demo uses fictional people and clubs, stored in `.workspace-data/demo.sqlite` (gitignored). On first open you're signed out. Choose a person on the **developer panel** (`/__demo`), which also has **Reset demo data**.

`WORKSPACE_AUTH=none npm run workspace:demo` shows the fail-closed behaviour: every private page returns 503.

A public, in-browser version of this demo can also be built into the website (`ENABLE_CLUB_DEMO=true`, at `/club-demo`). See [../club-demo.md](../club-demo.md).

## What was there before

I found no earlier Members, Meetings, Committees or Links code in this checkout, its branches or the remote, so those were built fresh here. The Website Admin tracker (`studio/admin-tracker`, `docs/spikes/admin-tracker.md`) is unchanged and stays in **website administration** (Sanity Studio). The launch checklist and content review stay there too.

**Existing records:** the tracker's items are about the website redesign. They stay in the Sanity tool, owned by the website project, not by any club. They are not copied into a club workspace or shown to members. The local tracker demo's browser storage is untouched. The workspace has its own separate **club to-do list** (admins only), which reuses the tracker's model.

## Two walkthroughs

**As a club member (try on a phone-sized window):** on `/__demo`, choose **Mary Member**.
1. You land in **Maple Ridge Kin Club (demo)**. There's no picker or role choice.
2. Tap **Read the latest meeting notes**. That's the October notes, one tap away.
3. The November draft is never shown. Opening its URL directly gives "not found".
4. **Members**, **Committees** and **Links** are read-only. **Sign out** is at the top of every page.

**As a club admin:** choose **Alex Admin**. The **Manage club** box says which club changes apply to.
1. **Invite someone**: enter a name and email. Member is selected by default. Press **Create invitation**. The confirmation says plainly that no email was sent, and offers **Write the invitation email**, which opens your own email app with the link and instructions.
2. **Add meeting notes**, then **Save draft** ("Draft saved. Members can't see it…"). Then **Finalize and share with members** ("Finalized. Members can now read these notes.").
3. **People and access**: Alex is the only admin, so **Remove access** and **Change to member** are disabled, and there's a nudge to add a second admin. Use **Make admin** on Mary, and both buttons become available. **Remove access** on anyone takes effect on their next click.
4. The invited address appears on the developer panel. Choose it to see their first visit land in the club.

Other people on the panel:
- **Blair Cedar** is Club B's admin.
- **Dana District** sees club names only, until Alex invites dana@example.org as Admin.
- **Rory Region** and **Nadia National** are admins at the upper levels.
- **Erin Late** has an expired invitation.
- **Ray Former** had his access removed.
- **Unknown visitor** was never invited.

## Model

| Concept | Table | Notes |
|---|---|---|
| Organization | `organizations` | National ⊃ Region ⊃ District ⊃ Club, validated by level. A club may have no parent, which is how the real club would start until its district is verified. Demo units are all marked fictional. |
| Directory record | `directory_entries` | A listing with name, role and contact details, with a choice of whether contacts are shown to members or admins only. **It grants no access.** (Jamie Chair is listed and chairs a committee, but can't sign in.) |
| Workspace access | `access_grants` | A person plus a workspace plus a level, **Member** or **Admin**, either active or revoked. One person can hold different levels in different workspaces. |
| Invitation | `invitations` | Tied to one workspace and level (Member by default). Lasts 14 days, and is accepted when that verified email signs in. |
| Private records | `meeting_notes` (draft/final), `committees`, `links`, `tracker_items` | Each has an owning `org_id`. |

**Rules (enforced in `workspace/src/service.ts` and `policy.ts` before any read or write, never just by hiding buttons):**
- Read requires an active grant on **exactly** that workspace. There's no inheritance from district, region or national.
- Writes, drafts, invitations, access changes and the club to-do list require Admin on exactly that workspace.
- Upper-level admins see the **names** of units below them, and nothing private.
- Every private query also filters `WHERE org_id = ?`. A record ID from another club is simply "not found", and that is the response everywhere (no hint that it exists).
- Removing or demoting the **last active admin** is refused.
- Removing access also cancels that person's pending invitations to the same workspace. Every request re-checks grants, so an old session or old invitation stops working immediately.

## Sign-in decision

There was no existing member sign-in. Sanity Studio logins are for editors, and the public site is static. The intended host is Cloudflare, so the shared design is:

**Cloudflare Access with One-time PIN.** The member opens the bookmark, enters their email, and types the code Cloudflare emails them. There's no password, no GitHub account, no Studio and no shared club login. I chose it because:
- It reuses the planned host.
- Cloudflare sends the codes, so there's no email service to run.
- Sessions can be set to last up to a month, so a returning member usually just opens the bookmark.
- Sign-out (`/cdn-cgi/access/logout`) ends the session.

Access proves the email address. **The app decides access**: it verifies the signed `Cf-Access-Jwt-Assertion` token (RS256, the team's certs, audience, issuer and expiry), then looks up the person's invitations and grants.

Facts from the official docs:
- One-time PIN codes expire after 10 minutes and are single-use. Requesting a new code invalidates the old one.
- Cloudflare **only emails a code to addresses the Access policy allows**.
- Sessions can be set from 15 minutes to 1 month.

Sources: [One-time PIN](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/), [validating the JWT](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [session management](https://developers.cloudflare.com/cloudflare-one/identity/users/session-management).

**Invitations don't send email from the app.** The admin sends the link from their own email ("Write the invitation email"), so members recognise the sender. A future version could add an email service.

## What was tested, and how

| Behaviour | Unit/HTTP tests (`tests/workspace.test.ts`, 31) | Browser (local demo) | Real Cloudflare Access |
|---|---|---|---|
| 1. Member lands in their club and reads finalized notes; no picker, role choice or edit controls | ✓ | ✓ phone viewport, 52 px main button, no horizontal scroll | — |
| 2. Admin invites (Member default), saves a draft, finalizes; member can't fetch the draft or edit either version | ✓ | ✓ | — |
| 3. Club A admin can't reach Club B records by changing the URL or ID (service and HTTP) | ✓ | — | — |
| 4. District admin sees names only; an explicit Club A grant unlocks Club A only; switcher appears | ✓ | ✓ | — |
| 5. Expired invitation, cancelled invitation, revocation with a live session, last-admin protection, second admin | ✓ | ✓ | — |
| Fail closed: no provider, demo outside local, Worker without D1 or Access config | ✓ | — | — |
| Access JWT: valid, tampered, wrong audience/issuer, expired, unknown key | ✓ with locally generated RSA keys | — | **Not tested** |
| 6. No workspace data in the public Astro build | ✓ post-build check (40 markers incl. the tracker's) | — | — |

A mutation check confirmed the tests have teeth. Making `requireRead` allow everyone fails 5 tests.

**Simulated in the demo:** proving your email. The developer panel stands in for the Cloudflare code step. It exists only on the local server (bound to 127.0.0.1). The Worker hard-codes `local: false`, so demo sign-in can't be turned on there. No typed email is ever treated as proof of identity.

**Not exercised with real services:** Cloudflare Access sign-in, code email delivery, Access session length and logout, and D1. The D1 adapter uses the same SQL as the demo. A D1-shaped wrapper over SQLite was used in one test, but real D1 was not.

## Design review (2026-11-07)

A designer-agent review of both admin areas, at phone and desktop widths in light and dark mode, made 14 recommendations. All were applied:

- **Spacing:** fixed a CSS bug that removed the space below the header. Tidied grid and row spacing.
- **Destructive actions:** now look different (tinted red with ✕) and go through a confirmation page that works without JavaScript. This covers remove access, make admin, cancel invitation, and removing a directory entry, committee or link.
- **Form fields:** borders meet 3:1 contrast. Radios are larger and use the brand colour. Errors are marked on the field (`aria-invalid` plus a message under it) as well as in the banner.
- **Phone header:** more compact, with "Sign out" on the same row. Tabs have visible outlines.
- **Last admin:** shows an explanation instead of greyed-out buttons.
- **One name throughout:** "Manage club" is used for the tab, the heading and the home box. The Manage page has sections for people and access, invitations, the to-do list and club details, with links to each.
- **Invitation ready:** the page now comes from a redirect, so refreshing it doesn't invite twice. It has a "Copy link" button when JavaScript is available.
- **To-do status:** saved with an explicit Save button instead of saving as soon as the selection changes.
- **Save messages:** name the workspace and return you to the section you edited.
- **Tracker:** has a root theme card, so dark mode and badges render outside Studio. The count cards have borders. Blocked items use one consistent colour, and long links wrap.

## Remaining setup for real shared access

1. Create a Cloudflare Worker from `workspace/worker.ts`, plus a D1 database bound as `DB`. Apply `SCHEMA` from `workspace/src/db.ts`. Use its own hostname, separate from the public site.
2. Set up Zero Trust: enable **One-time PIN**, then create an Access application for that hostname. Set the session duration (for example 1 month) and copy its **AUD** tag.
3. Set `WORKSPACE_AUTH=cloudflare-access`, `CF_ACCESS_TEAM_DOMAIN=<team>.cloudflareaccess.com` and `CF_ACCESS_AUD=<aud>`.
4. **Decide the Access policy.** Either:
   - **(a)** "Everyone" may request a code, and the app refuses anyone not invited. Simple, but anyone can trigger a code email, and every login may use a Zero Trust seat. The Free plan is reported to suit teams under 50 users; I couldn't confirm the exact limit on an official page, so verify it.
   - **(b) Recommended:** an Access group listing invited emails, kept in sync by the Worker through the Cloudflare API on invite and revoke. This needs an API token secret. It isn't built yet.
5. Create the real club with **no parent** until its district and region are confirmed. Create the first two named admins with a one-off seed. There is no shared credential for this.
6. Optional: an email service, so invitations can be sent from the app.

Out of scope here: national reporting, inherited access to private data, a permissions editor, and file uploads.
