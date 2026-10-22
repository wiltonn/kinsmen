# Kinsmen Fanshawe Sugar Bush website

Replacement website for [kinsmenfanshawesugarbush.com](https://www.kinsmenfanshawesugarbush.com/), run by the
Kinsmen Club of Greater London. One site with two areas:

- **Visit the Sugar Bush**: dates, Pancake House (OpenTable reservations), school tours, maple products, FAQ.
- **About the Kinsmen**: the club, community impact, volunteering and membership.

| Concern | Choice |
| --- | --- |
| Framework | [Astro 7](https://docs.astro.build/) + TypeScript, static output (`output: 'static'`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), tokens in `src/styles/global.css`, using the old site's Kin red / purple / grey scheme |
| Brand | Kin Canada logo from the old site in `src/assets/brand/` (`Logo.astro`); favicons in `public/` |
| Content | [Sanity](https://www.sanity.io/) (Studio in `studio/`), with a local fixture mode |
| Reservations | OpenTable official booking link and optional official widget |
| Hosting | Cloudflare Pages (primary); `vercel.json` included so Vercel works too |
| Client JS | ~3 KB of progressive enhancement; the OpenTable script only loads on `/pancake-house` when configured |

Not included (by design): Next.js, a reservation database, member accounts, payments, an OpenTable API integration,
or a custom form backend.

## Quick start

Requires Node 22.23+ (Node 24 recommended).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321. With no `.env`, the site runs from **development fixtures**
(`src/lib/content/fixtures.ts`): content copied from the old website, marked _Needs review_, plus a few clearly
labelled _SAMPLE_ placeholders. A green bar at the top of every page says it's a preview, and
`/dev/content-review` lists everything still unconfirmed.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Static build to `dist/`, then checks every internal link, anchor and redirect target |
| `npm run preview` | Serve the built `dist/` |
| `npm run check` | Astro/TypeScript type checks |
| `npm test` | Unit tests (season states, OpenTable validation, config guards, redirects, contrast, fixtures) |
| `npm run verify` | All of the above |

### Previewing seasonal states (fixtures only)

```bash
FIXTURE_SCENARIO=reservations-open SITE_NOW=2027-02-14T10:00:00-05:00 npm run dev
```

Scenarios: `default`, `reservations-opening-soon`, `reservations-open`, `season-active`, `visitor-alert`,
`season-ended`. `SITE_NOW` overrides "today" in non-production builds. Scenario content is labelled as sample.

To try a configured OpenTable state locally, set `FIXTURE_OPENTABLE_BOOKING_URL` and/or
`FIXTURE_OPENTABLE_WIDGET_LOADER_URL` to the values from the OpenTable administrator.

## Environment

See `.env.example`. Nothing in it is secret except an optional `SANITY_READ_TOKEN`.

| Variable | Purpose |
| --- | --- |
| `SITE_ENV` | `production` **only** on the live deployment. Anything else adds `noindex` everywhere, a `Disallow: /` robots.txt and an `X-Robots-Tag` header. |
| `PUBLIC_SITE_URL` | Canonical origin, used for canonical URLs, the sitemap and social images. |
| `CONTENT_SOURCE` | `sanity` or `fixtures`. Defaults to Sanity when `SANITY_PROJECT_ID` is set. **Production builds fail if they would use fixtures.** |
| `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION` | Public Sanity identifiers. |
| `SANITY_READ_TOKEN` | Only if the dataset is private (use a read-only Viewer token). |
| `STRICT_CONTENT_REVIEW` | `true` makes a production build fail while any content is still "Needs review". |
| `SANITY_API_HOST` | Testing only: point the Sanity client at a mock API to rehearse a production build without a real project. |
| `SITE_NOW`, `FIXTURE_SCENARIO`, `FIXTURE_OPENTABLE_*` | Non-production previews only (see above). |

## How it fits together

```
src/
  lib/
    config.ts          env → RuntimeConfig (production/fixture guards)
    content/
      types.ts         the content model every page uses
      fixtures.ts      local development content (migrated + sample, labelled)
      sanity.ts        GROQ query + mapping to the same types
      review.ts        lists unconfirmed content
      index.ts         getContent(): picks the adapter, caches, warns
    season.ts          season + reservation state machine (pure, tested)
    opentable.ts       OpenTable URL validation and controlled widget config
    time.ts, format.ts America/Toronto dates, prices, times
    site.ts            getSiteState(): everything a page needs, computed once
    redirects.ts       old-URL redirects + legacy #anchor map
  components/          OpenTableBooking, SeasonStatus, KeyFacts, DateList, …
  pages/               the 10 routes + 404, robots.txt, preview-only /dev pages
  scripts/enhance.ts   menus, notice expiry, "today" re-check (progressive)
studio/                Sanity Studio (schemas, desk structure, validation)
integrations/          writes _redirects and _headers into dist/
scripts/check-links.mjs post-build link/anchor checker
docs/                  editing guide, checklists, OpenTable setup, redirects
```

**Single source for facts.** Dates, hours and prices live once on the Sanity `season` document (the
current season is chosen in _Site settings_) and are rendered everywhere from there. Pancake House dates can
reference the public dates ("Same as the public dates") rather than repeating them.

**Time-sensitive display.** "Open today", "next public day" and notice expiry use the `America/Toronto`
calendar. They're computed at build time and re-checked in the browser, so a build that's a few days old still
shows the right status. A daily scheduled rebuild is still recommended during the season (see below).

**Reservations.** What the site says about reservations is controlled explicitly by editors (the season's
_Reservations_ state). Booking buttons appear only when the state is _Open_ **and** a valid OpenTable link or
widget is configured. OpenTable is the only source of truth for availability; the site never says "sold out".
See [docs/opentable-setup.md](docs/opentable-setup.md).

## Sanity Studio

```bash
cd studio && cp .env.example .env && npm install
```

```bash
npm run dev --prefix studio
```

Fill in `SANITY_STUDIO_PROJECT_ID` first. Deploy the hosted Studio for volunteers with
`npm run deploy --prefix studio` (`https://<SANITY_STUDIO_HOST>.sanity.studio`). Add the site's production and
preview origins to the project's CORS origins only if you add live preview later. The static build doesn't need
CORS.

**Import the migrated content** instead of retyping it. Every document arrives marked "Needs review", and
sample content is never exported:

```bash
CONTENT_SOURCE=fixtures npm run build
```

```bash
cd studio && npx sanity dataset import ../dist/dev/sanity-seed.ndjson production
```

## Deploying

### Cloudflare Pages (primary)

1. Connect the GitHub repository in Cloudflare Pages.
2. Build command `npm run build`, output directory `dist`, Node version 24 (`NODE_VERSION=24`).
3. Environment variables:
   - **Production:** `SITE_ENV=production`, `PUBLIC_SITE_URL`, `SANITY_PROJECT_ID`, `SANITY_DATASET`.
   - **Preview:** the same, but `SITE_ENV=preview`.
4. `dist/_redirects` and `dist/_headers` are generated on every build.

### Vercel (alternative)

`vercel.json` sets the build, clean URLs, the same redirects and headers. Set the same environment variables,
with `SITE_ENV=production` only on the Production environment.

### Rebuild when content is published

The site is static, so publishing in Sanity has to trigger a rebuild:

1. Cloudflare Pages → Settings → Builds → **Deploy hooks**: create a hook for the production branch and copy its URL.
   On Vercel, use Settings → Git → Deploy Hooks.
2. sanity.io/manage → your project → API → **Webhooks** → Create:
   - URL: the deploy hook URL
   - Dataset: `production`; trigger on create, update and delete
   - Filter: `!(_id in path("drafts.**"))` (published changes only)
   - HTTP method: POST
3. Publish a test change and watch the Pages deployment start (it usually takes 1–3 minutes).

**Daily rebuild during the season** (optional, recommended): `.github/workflows/scheduled-rebuild.yml` calls the
deploy hook every morning if the repository secret `DEPLOY_HOOK_URL` is set.

### CI

`.github/workflows/ci.yml` runs type checks, tests and a fixture build on every push and pull request.

## More documentation

- [Volunteer content-editing guide](docs/content-editing-guide.md)
- [Content verification and migration checklist](docs/content-checklist.md)
- [Redirect mapping](docs/redirects.md)
- [OpenTable setup](docs/opentable-setup.md)
- [Launch checklist](docs/launch-checklist.md)
