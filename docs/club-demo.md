# Club workspace demo on the website (`/club-demo`)

A public, try-it-yourself version of the [Club workspace](spikes/club-workspace.md) for club members to review on the proposed redesign. It's **off by default**.

## Turning it on

Build the site with the environment variable `ENABLE_CLUB_DEMO=true`. That adds:

- a **For club members → Try the club workspace** box on `/kinsmen`, below the "More about our club" cards;
- the demo at **`/club-demo`**, which works on the same hostname for direct links and refreshes too.

With the variable unset, or set to anything other than `true`, neither is built. `/club-demo` then gets the site's 404 page. `vercel.json` rewrites `/club-demo/*` to `club-demo.html`, so with that file missing the rewrite also returns 404. The Cloudflare `_redirects` rule is only written when the flag is on.

The flag is read at **build time**, so changing it needs a new deployment.

## What a visitor sees

1. `/club-demo` asks them to choose **View as a member** or **View as a club admin**. No account or password is needed.
2. **Member:** lands on the club's home page, which puts **Read the latest meeting notes** first, followed by the member directory, committees and useful links. Members see finalized notes only, with no editing controls.
3. **Club admin:** the full **Manage club** experience. The bar at the top suggests the main demonstration: add meeting notes, save a draft, finalize it, then switch to the member view.
4. A bar on every page reads **"Demo — sample club information. Try it with made-up names and notes."** It has buttons to switch views and a **Reset demo** link.

## How it works

The demo is the **real workspace app** (`workspace/src`), with the same routes, screens, validation and access rules. It runs inside the visitor's browser tab instead of on a server:

- `workspace/browser/club-demo.ts` turns link clicks and form posts into requests to the app and shows the HTML it returns. Addresses stay under `/club-demo/...`, so Back, Forward and refresh behave normally.
- Data is SQLite compiled to WebAssembly (`sql.js`). It's seeded from the **deliberately public** fixture `workspace/src/public-demo-data.ts`: one fictional club, "Maple Ridge Kin Club (demo)". The second club and the upper-level admins used by the local demo and tests are **not** shipped.
- `workspace/src/public-demo.ts` sets up the app. "Member" and "club admin" just choose which fictional person this tab's copy treats as signed in. The developer panel (`/__demo`) is off, and invitations say that nothing was sent (there's no email link).

## Who sees whose changes

Each browser has its own copy, saved in `localStorage`:

- Changes **survive a refresh** and switching between member and admin in the same browser.
- **Nobody else sees them.** A different browser, device or private window starts fresh.
- **Reset demo** restores the starting data.
- If the browser blocks storage, the demo still works but says changes disappear on refresh.

Nothing is sent to a server. The demo makes no contact with Sanity, Cloudflare Access, D1, OpenTable or any membership data. It can't grant access to the real workspace, which runs separately behind Cloudflare Access.

## Privacy check

`scripts/check-private-data.mjs` runs on every build (rules in `scripts/private-data-rules.ts`):

- Website Admin tracker data and the **non-public** workspace fixtures are refused in **every** file, including the demo's.
- The **public demo** fixtures and the workspace's interface text are refused everywhere when the flag is off. When it's on, they're allowed **only** in `club-demo.html` and `club-demo-assets/`.
- With the flag off, any mention of `/club-demo`, or any demo file, fails the build. With it on, the demo page and script must exist.
