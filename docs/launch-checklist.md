# Launch checklist

Nothing here has been done yet. The build so far is a local, reviewable implementation. No DNS, hosting,
OpenTable or Sanity account changes have been made.

## Accounts and credentials (club / webmaster)

- [ ] Create the Sanity project (free plan is enough). Record the **project ID** and use dataset `production`.
- [ ] Invite volunteer editors to Sanity (Editor role), and deploy the Studio: `npm run deploy --prefix studio`.
- [ ] Import migrated content: `CONTENT_SOURCE=fixtures npm run build`, then
      `cd studio && npx sanity dataset import ../dist/dev/sanity-seed.ndjson production`.
- [ ] Create the Cloudflare Pages project from the GitHub repo (see README → Deploying).
- [ ] Set Production variables: `SITE_ENV=production`, `PUBLIC_SITE_URL`, `SANITY_PROJECT_ID`, `SANITY_DATASET`.
      Set Preview variables the same but with `SITE_ENV=preview`.
- [ ] Create a deploy hook and the Sanity webhook (README → Rebuild when content is published).
- [ ] Optional: add `DEPLOY_HOOK_URL` as a GitHub secret for the daily in-season rebuild.
- [ ] Get the **OpenTable booking URL** (and optional widget `src`) from the OpenTable administrator
      ([opentable-setup.md](opentable-setup.md)).

## Content (club)

- [ ] Work through [content-checklist.md](content-checklist.md), especially the **required decisions** in section 1.
- [ ] `/dev/content-review` on the preview site shows **0 items**. Optionally set `STRICT_CONTENT_REVIEW=true` on
      Production so unconfirmed content can't publish.
- [ ] Supply a Pancake House photo and confirm photo permissions and credits.
- [ ] Set the reservation state to match reality.

## Pre-launch QA (on the Cloudflare preview URL)

- [ ] Every page at phone (~375 px) and desktop (~1440 px) widths. Menu opens and closes, and Esc closes it.
- [ ] Keyboard only: Tab from the top shows **Skip to main content**, every link and button gets a visible focus
      ring, and dropdowns open with Enter/Space and close with Esc.
- [ ] Season dates, hours and prices are identical on Home, Plan your visit, Pancake House and School tours.
- [ ] Reservations: header and homepage **Reserve a table** appear only when reservations are Open. The
      OpenTable link opens the right restaurant, and the widget loads (if enabled).
- [ ] Forms: each enquiry button reaches a real, monitored destination. Submit a test entry to the Google Form.
- [ ] Old URLs redirect: `/menus`, `/french`, `/about-1`, both old PDF links, and `/#comp-lthkyjqn` → `/visit#dates`.
- [ ] `robots.txt` on the preview disallows everything, and pages have `noindex`.
- [ ] Run Lighthouse or PageSpeed Insights on Home and Pancake House (target ≥ 90 for accessibility and performance).
- [ ] Optional: a screen reader pass (VoiceOver or NVDA) on Home and Pancake House.

## Go live (webmaster, with the club's go-ahead)

- [ ] Add `www.kinsmenfanshawesugarbush.com` and the bare domain to the Cloudflare Pages project. Redirect the bare
      domain to `www`.
- [ ] Update DNS at the registrar, keeping the old Wix site live until DNS has switched over.
- [ ] Confirm the production `robots.txt` allows crawling and lists the sitemap, and pages have `index, follow`.
- [ ] Submit the sitemap in Google Search Console. Update the Google Business Profile and Facebook links.
- [ ] Cancel the Wix plan only after a week of stable traffic, and download any Wix assets you want to keep first.

## After launch

- [ ] Watch Search Console 404s for 2–4 weeks and add redirects as needed ([redirects.md](redirects.md)).
- [ ] Each fall: start the next season ([content-editing-guide.md](content-editing-guide.md)).
- [ ] Keep dependencies current: `npm outdated` and `npm outdated --prefix studio` a few times a year. Run
      `npm run verify` after upgrading.
