# Redirect mapping

Source of truth: `src/lib/redirects.ts`. The build writes `dist/_redirects` (Cloudflare Pages) and
`vercel.json` mirrors it. `npm test` fails if they drift, and `npm run build` checks that every target exists.

## Old pages and files → new routes (301 permanent)

| Old URL (Wix) | New URL | Notes |
| --- | --- | --- |
| `/` | `/` | Homepage. Old section anchors handled below. |
| `/menus` (and `/menus?menu=dinner-menu`) | `/pancake-house#menu` | Query strings are ignored by the rule and passed through harmlessly. |
| `/french` | `/visit#languages` | Linked a **Portuguese** brochure, now listed under “Other languages”. |
| `/about-1` | `/kinsmen` | Unedited Wix template page. |
| `/_files/ugd/17f70a_2f498428d478422c8eb9ef61e178dab3.pdf` | `/downloads/kinsmen-fanshawe-sugar-bush-teacher-package.pdf` | Teacher package (12 MB). |
| `/_files/ugd/2c371f_2f011964cc3d4051b4181fce39f813a2.pdf` | `/downloads/self-guided-tour-portuguese.pdf` | Portuguese self-guided tour brochure. |
| `/about` | `/kinsmen` | Likely guess |
| `/home` | `/` | Wix default slug |
| `/menu` | `/pancake-house#menu` | Likely guess |
| `/school-tours` | `/school-group-tours` | Old menu label |
| `/volunteer` | `/kinsmen/get-involved` | Old menu label |

The Wix sitemap listed only `/about-1`, `/menus`, `/french` and the menu URL above.
`https://kinsmenfanshawesugarbush.com` (without `www`) should redirect to `https://www.…`. Set that up at the DNS/host
level when the domain moves (Cloudflare: a Redirect Rule; Vercel: add both domains and mark `www` as primary).

## Old homepage anchors (`/#…`)

The old site was one long page, and its menu scrolled to sections. Fragments (`#…`) are never sent to a server,
so they can't be redirected there. A tiny inline script on the new homepage (`LegacyAnchors.astro`) maps them in
the browser:

| Old fragment | Old section | New URL |
| --- | --- | --- |
| `#comp-lthimuoa`, `#comp-lthimupj` | Maple Syrup Products | `/maple-products` |
| `#comp-lthkyjqn`, `#comp-lthkyjry`, `#anchor-1` | Sugar Bush Public Tours | `/visit#dates` |
| `#comp-lthif79m`, `#comp-lthif7ar` | School Tours | `/school-group-tours` |
| `#comp-lter9u54`, `#comp-ltn84wc5` | About Kin Canada / Objects | `/kinsmen` |
| `#comp-lu63c92a` | Land Acknowledgement | `/kinsmen#land-acknowledgement` |
| `#comp-ltn7d3kn` | Volunteer/Join | `/kinsmen/get-involved` |
| `#comp-ltenix7h` | Benefactors | `/kinsmen/community-impact` |
| `#comp-ltn6fak9`, `#comp-ltn6fam2` | Have Any Questions? / Contact | `/contact` |
| `#tours`, `#school-tours`, `#volunteer`, `#benefactors`, `#contact`, `#menu`, `#land-acknowledgement`, `#maple-miracles` | readable guesses | as above |

If a fragment matches a real element on the new homepage, it isn't redirected.

## After launch

- Submit `https://www.kinsmenfanshawesugarbush.com/sitemap-index.xml` in Google Search Console and Bing Webmaster Tools.
- Watch Search Console's “Not found (404)” report for a few weeks and add rules for anything valuable.
- Update the Google Business Profile, Facebook page and any partner/tourism listings that link to old URLs or PDFs.
