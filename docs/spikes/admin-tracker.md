# Spike: Website Admin tracker

Branch `spike/admin-tracker`, written 2026-11-07. This is a prototype: the production tool is **off** until it's configured (see "Remaining work").

## Try it

```bash
npm ci && npm ci --prefix studio
npm run admin:demo
```

Open **http://127.0.0.1:3334/**. This is the **Local demo**. It uses the same tracker UI as the Studio tool, but stores items in this browser's `localStorage` (key `kfsb-admin-tracker-demo:v1`). Changes survive a refresh, are visible only in this browser, and are never sent to Sanity or the website. **Reset demo** restores the starter items.

## Decision

| | A. Tool inside Sanity Studio | B. Protected Astro `/admin` on Cloudflare | C. GitHub Issues/Projects + summary |
| --- | --- | --- | --- |
| Volunteer usability | Good. Same sign-in and app they already use to edit the site. Simple list UI. | Good UI, but a second place to sign in and learn. | Poor for non-developers: needs GitHub accounts and the GitHub UI. |
| Access control | Sanity project membership. Viewers can read; Administrators (Editors on Growth) can write. Sanity enforces it on the server. | Cloudflare Access (free for teams under 50 users) in front of `/admin/*`, plus JWT checks in every Pages Function. All of this would be new code and config. | Repository permissions. **This repo is public**, so issues are public. Private items would need a private repo or draft-only project items. |
| Where reads and writes happen | Browser → Sanity API using the volunteer's own session. | Browser → Pages Functions → D1/KV. The public site stays static, but `/admin` adds server code. | In GitHub. An admin summary would need a token at build time, which risks publishing items into public HTML. |
| Recurring cost | $0 extra on Sanity Free (20 seats). Growth is $15/seat/month if Editor roles or private datasets are wanted. | $0 on free tiers, but more moving parts. | $0. |
| Maintenance | One React component and one storage module inside the Studio the club must run anyway. | Auth, a database schema, migrations, functions and a second deploy target. | Low code, but process overhead and account management. |
| Local dev without credentials | Studio itself needs a real project. The **same component** runs in a standalone local demo with browser storage. | Possible with `wrangler` and local D1, but auth would be simulated. | Needs a GitHub token or mock data. |
| Effect on public hosting | None. Nothing is added to the Astro build. | Adds Functions and Access rules to the public site's project. | None, unless a summary is built into the site, which is risky. |

**Chosen: A, a custom "Website Admin" tool in Sanity Studio.** It reuses the editing app and sign-in the club already needs. It adds no infrastructure, and it leaves the public site's hosting untouched. B would give the club a nicer standalone page, but at the cost of building and maintaining auth plus a database. C fails the privacy requirement because the repo is public, and it asks volunteers to use GitHub.

### Facts from the official docs that drove the decision

- **Sanity Free plan:** 2 datasets, **public only**, 20 seats, and only the **Administrator and Viewer** roles. Growth adds private datasets and the Editor, Contributor and Developer roles. ([pricing](https://www.sanity.io/pricing))
- **A dotted document ID is private even in a public dataset.** "Any document ID containing a dot is considered private" and can only be read when logged in or with a token. ([IDs and paths](https://www.sanity.io/docs/content-lake/ids), [keeping your data safe](https://www.sanity.io/docs/content-lake/keeping-your-data-safe))
- **Studio tools** take a `name`, `title`, `component` and optional `icon`. `tools` can be an array or a callback. ([custom tool](https://www.sanity.io/docs/studio/custom-studio-tool), [Tool API](https://www.sanity.io/docs/studio/tool-api-reference))
- **GitHub Projects:** project visibility doesn't hide items. Anyone who can see the repository can see its issues. ([project visibility](https://docs.github.com/en/issues/planning-and-tracking-with-projects/managing-your-project/managing-visibility-of-your-projects))

> Side finding: `docs/launch-checklist.md` says to invite volunteers with the **Editor** role, but the Free plan has no Editor
> role. Volunteers would have to be Administrators, or the project would need Growth. The club should decide this before inviting anyone.

## Architecture

```
studio/admin-tracker/
  model.ts             data model, rules, checklist parser, starter items (pure, unit-tested)
  repository.ts        TrackerRepository interface
  sanityRepository.ts  PRODUCTION store: Sanity documents (authoritative)
  localRepository.ts   LOCAL DEMO store: browser localStorage
  TrackerApp.tsx       the UI (@sanity/ui), store-agnostic
  tool.tsx             registers "Website Admin" in Studio (behind SANITY_STUDIO_ADMIN_TRACKER=enabled)
studio/admin-demo/     Vite dev-server harness for the local demo (never built or deployed)
scripts/check-private-data.mjs  post-build check: no tracker data in dist/
```

**Authoritative store: Sanity**, in the same project and dataset as the website content. Each item is a document of type `adminTrackerItem` with the ID `admin-tracker.<itemId>`. The tool writes documents directly (there's no draft or publish step) using the signed-in volunteer's session. Edits use the document revision to detect two people editing at once, and a live listener refreshes the screen when someone else makes a change.

**Why the items stay private on the Free plan's public dataset:**
1. The dotted ID puts each item "in a path", and Sanity never serves those to unauthenticated requests.
2. The website build has no token by default, and its GROQ query only asks for its own types and IDs. A unit test enforces this.
3. `scripts/check-private-data.mjs` runs on every `npm run build`. It fails the build if the public `dist/` contains the tracker type, the ID prefix, the demo storage key, "Website Admin", or any starter item's ID or title.
4. There's no schema type for tracker items. Studio's "Create new" menu and document lists can't create a public (undotted) copy.

**Three lists, three jobs:**
- **Roadmap tracker:** these Sanity items. Columns are Now, Up next, Later and Done. A blocker is a separate field, so a blocked item stays in its column and shows the reason. Items also have an optional priority, owner, target date, source link and checklist reference.
- **Launch checklist:** read-only. Its counts come from `docs/launch-checklist.md`, which is bundled into the Studio at build time with Vite `?raw`. The tool links to the file on GitHub. An item can reference a requirement by slug, but moving that item to Done **never** ticks it. Requirements are ticked only in the Markdown.
- **Content review:** links to the existing `/dev/content-review` page on the preview site (`SANITY_STUDIO_PREVIEW_URL`). Confirmations stay on each document's *Review status* field.

**Starter items:** connect Sanity; confirm the Pancake House booking URL; review season content; mobile QA; and *Evaluate inline feedback on staging* (Later). Their priorities are labelled **illustrative** until someone changes them. They have no owners or dates.

## What was verified (2026-11-07)

- `npm run verify` (root): `astro check` reported 0 errors, **132 tests passed** (the previous 109 plus 23 new in `tests/admin-tracker.test.ts`), the fixture build succeeded, the link check passed, and the private-data check passed.
- `npm run typecheck --prefix studio` passed. `sanity build` passed with the tool enabled (placeholder project ID).
- A browser walkthrough of the local demo in headless Chromium:
  1. The first screen shows the Now/Up next/Later/Done/Blocked counts and a Blocked panel.
  2. Created *Confirm whether a Pancake House reservation includes tour admission.* (defaults to Up next).
  3. Moved it to Now, added a blocker, refreshed: the column, blocker and ID persisted.
  4. Cleared the blocker, moved it to Done, refreshed: the launch checklist still reads **0/29**.
  5. The public build contains no tracker or demo data (private-data check).

  There were no page errors, and no horizontal scroll at 375 px.

**Simulated, not demonstrated:** Sanity sign-in, role checks, shared persistence and live updates between two reviewers. The Sanity store is unit-tested against a fake client (dotted IDs, query namespace, revision-checked patches, conflict errors). It has not run against a real project.

## Remaining work for shared staging

1. Create the Sanity project (it's already on the launch checklist). Decide between Free with all volunteers as Administrators, and Growth with the Editor role.
2. In `studio/.env`, set `SANITY_STUDIO_ADMIN_TRACKER=enabled` and `SANITY_STUDIO_PREVIEW_URL=<preview origin>`. Then run `npm run deploy --prefix studio`.
3. Open *Website Admin* in the hosted Studio and click **Add starter items**.
4. **Second reviewer:** invite a second project member. Both open *Website Admin*, and one edits an item. The other's screen should update live through the listener. Viewers see the list read-only.
5. Change the Sanity → Cloudflare deploy webhook filter so tracker edits don't trigger site rebuilds. The README now shows the filter: `!(_id in path("drafts.**")) && !(_id in path("admin-tracker.**"))`.
6. If the website build ever gets a `SANITY_READ_TOKEN`, keep its query type-filtered (the test enforces this). Never query `*` without a type filter.
7. Optional: on Growth, move tracker items to a separate private dataset. Change `useClient(...).withConfig({ dataset })` in `tool.tsx`.

Out of scope for this spike: inline commenting, drag and drop, notifications, and item history beyond Sanity's own document history.
