# Content verification and migration checklist

The previous website (Wix, audited **21 October 2026**) was treated as _migration input, not verified fact_.
Everything copied from it is marked **Needs review** in the fixtures and in the Sanity seed import. Nothing has
been confirmed by the club yet.

In any preview build, `/dev/content-review` lists every unconfirmed item. A production build with
`STRICT_CONTENT_REVIEW=true` refuses to publish while any remain.

Legend: ☐ to do · **Decision** = the club must choose, not just check.

## 1. Required decisions before launch

| | Item | Why it matters | Where to set it |
| --- | --- | --- | --- |
| ☐ | **Does a Pancake House reservation include a Sugar Bush tour/admission?** | The old site said: “A booking reserves your time in the Pancake House. The walking tour and wagon ride are first come, first served.” This text sat beside the _school_ tour table, so confirm that it applies to public visitors. | Season → Reservations → “Does a table reservation include a tour?” |
| ☐ | **Public admission prices** | Not published on the old site. The only prices found are a “Tour Pricing” table beside the school tour dates ($9.00 / $8.25 / $6.50 / $6.00). Are these per student, school-only, or general? | Season → Dates and prices → Admission; Season → School tours → Pricing |
| ☐ | **Opening hours** (public days) | Not published anywhere on the old site. An older CTV News article mentioned 9 a.m.–4 p.m.; that is _not_ used. | Season → Public opening hours |
| ☐ | **Pancake House dates and serving hours** | Not published. Choose “Same as the public dates” if that's true. | Season → Pancake House |
| ☐ | **OpenTable booking URL and (optional) widget code** | No OpenTable link exists on the old site. These must come from the OpenTable account administrator. | Booking settings (see [opentable-setup.md](opentable-setup.md)) |
| ☐ | **Reservation opening date and state for 2027** | Currently “Not announced”. | Season → Reservations |
| ☐ | **Which email inbox is monitored?** | Site footer: `greaterlondonkinsmenclub@primus.ca`. 2015 PDFs: `kinsmenfanshawesugarbush@primus.ca`. | Site settings → Contact |
| ☐ | **French content** | The old “French” page actually linked a **Portuguese** self-guided tour brochure. No French text was found. Decide whether to commission and review a French translation. Don't publish machine translation as approved content. | Downloads + Site settings → Resources in other languages |

## 2. Season 2027 facts to confirm

| | Fact (as migrated) | Source |
| --- | --- | --- |
| ☐ | Public dates: Family Day weekend Feb 13–15 (Sat–Mon); Feb 27–28; Mar 6–7; Mar 13–14; March Break Mar 15–19 (Mon–Fri); Mar 20–21 | Old homepage, embedded “2027 Public Dates” table |
| ☐ | School tour dates (Tue & Thu): Feb 23, 25; Mar 2, 4; Mar 9, 11; Mar 23, 25 | Old homepage, “2027 School Tour Dates” table |
| ☐ | Tour pricing: 2 pancakes, hot chocolate, maple bud $9.00; 1 pancake, hot chocolate, maple bud $8.25; walking tour + maple bud $6.50; walking tour only $6.00 | Old homepage, “Tour Pricing” table |
| ☐ | “The fee covers parking and the tour, plus your pancake meal if you choose a meal option.” | Old homepage note |
| ☐ | School booking: call (519) 461-1073; cheques payable to the Kinsmen Club of Greater London | 2015 teacher package |
| ☐ | School tour times / duration / group size limits | **Not published**: add if known |
| ☐ | Parking arrangements | **Not published** |
| ☐ | Accessibility (trails, washrooms, parking) | **Not published**. Don't guess; the FAQ has a SAMPLE placeholder question |
| ☐ | Pets, payment methods, what to wear | **Not published**: SAMPLE FAQ placeholders only |

## 3. Pancake House menu (from the old /menus page, last updated March 2025)

☐ Confirm every 2027 price. Migrated items: 2 pancakes + 3 sausages $8.25 · 3 pancakes $5.75 · 2 pancakes $5.25 ·
1 pancake + 2 sausages $4.75 · 1 pancake $3.50 · 3 sausages $4.50 · extra syrup $1.75 · coffee/pop/milk/juice $2.00 ·
tea/hot chocolate/water $1.50. ☐ Add dietary/allergen notes only if confirmed.

## 4. Maple products (from the old /menus page, March 2025; shelf photo labels agree)

☐ Jugs 250 mL $9 · 500 mL $14 · 1 L $23 · 2 L $40 · 4 L $65
☐ Glass 50 mL $6 · 100 mL $9 · 250 mL $12 · 500 mL $18
☐ Maple butter / cinnamon maple butter S $7 · L $11 · Red pepper jelly S $6 · L $9 · Maple mustard S $6 · L $9 ·
BBQ sauce $9 · Maple ice cream $5
☐ Thorndale Hardware sells syrup after the season: add the address and confirm it's still true.

## 5. Contact and location

| | Item |
| --- | --- |
| ☐ | Address: 21201C Lakeside Drive, Thorndale, ON N0M 2P0 (PDFs say “21201-c Lakeside Dr., Thames Centre”) |
| ☐ | Phone (519) 461-1073 |
| ☐ | Google Maps link `https://maps.app.goo.gl/PLVQeSin3onaFRXy6` |
| ☐ | Directions text: “north shore of Fanshawe Lake … south-west of Thorndale”, written from the old site's map screenshot. Please check it. |
| ☐ | Facebook page `facebook.com/KinsmenFanshaweSugarBush`. (The old footer also linked `facebook.com/wix`, a template leftover. It was not migrated.) |

## 6. About the Kinsmen

| | Item |
| --- | --- |
| ☐ | Kin Canada facts (founded by Hal Rogers, Feb 20, 1920; motto; mission). The old site's figures (“more than $1 billion”, “6,500 members / 480 clubs”, “$41 million for CF”) were **not** migrated as headline numbers. Check current figures at kincanada.ca before adding them. |
| ☐ | Stevenson Children's Camp: “recently celebrated our 75th year”. Add the year. |
| ☐ | Bill Skelly Award, August 2013 (Cystic Fibrosis Canada) |
| ☐ | Best of London 2016 (London Free Press), “Best Kept Tourism Secret”. Confirm the wording. The old site's “NIRVANA FOR PANCAKES” headline with a Denny's logo was **not** migrated (source unclear). |
| ☐ | Supported organizations (old “Benefactors” logos): Stevenson Children's Camp, Cystic Fibrosis Canada, Hal Rogers Endowment Fund, Diabetes Canada, Community Living London (cll.on.ca, name inferred), Ark Aid Street Mission (old site linked both .com and .ca), SARI Therapeutic Riding (sari.ca, name inferred), Anova, Epilepsy Southwestern Ontario. Logos were not migrated: ask before using partner logos. |
| ☐ | Land acknowledgement: transcribed word-for-word from an image. Confirm the wording with the club, and the credit for the turtle artwork (signed “Zana ’23”). |
| ☐ | Meeting time/place for prospective members (not published). |
| ☐ | “Maple Miracles” video: the old site described it but the video could not be located in the page. Find the source file or link. |

## 7. Forms and enquiry routes

| Route | Destination (verified live 21 Oct 2026) | ☐ Confirm someone monitors it |
| --- | --- | --- |
| Volunteering | Google Form “Friends of the Kinsmen Fanshawe Sugar Bush” (`docs.google.com/forms/d/e/1FAIpQLSc…/viewform`). Options: volunteer at the Sugar Bush / other Kin events / both / become a member / monthly updates | ☐ |
| Membership | Same Google Form (the site says so) | ☐ Consider a separate form if membership enquiries should go to different people |
| School tours | Phone (519) 461-1073 | ☐ |
| General | Email (see the inbox decision above) | ☐ |
| Pancake House | OpenTable only | ☐ |

☐ The Google Form asks for **date of birth**. Confirm that's needed (privacy), and that the form says how the
data is used.
The old site's Wix “Have any questions?” contact form was **not** recreated (it depended on Wix's backend). No
form on the new site shows a simulated “message sent” result.

## 8. Downloads

| | File | Notes |
| --- | --- | --- |
| ☐ | `/downloads/kinsmen-fanshawe-sugar-bush-teacher-package.pdf` | 16 pages, 12 MB, dated Feb 2015. Mostly scanned images (not accessible text). Consider a smaller, accessible update. |
| ☐ | `/downloads/self-guided-tour-portuguese.pdf` | 2 pages, scanned (not text-searchable). |

## 9. Photos

All photos come from the old site. ☐ Confirm permission and photographer credits (add them in Sanity).
☐ **No Pancake House photo exists.** The page shows a plain pattern (labelled “photo needed” in previews).
Please supply one.
Not migrated: chainsaw-carving photos (2014), the “Portraits of Honour” photo (context unclear), and partner logos.

## 10. Brand: logo and colours

The colour scheme and logo come from the old site: Kin red `#ED2025`, purple `#4C2273`, light grey `#E3E3E3`,
white and black, plus the red “Kin Canada · Kinsmen Club of Greater London” logo from the old header.
Darker reds are used for small text and buttons so they meet contrast requirements.

| | Item |
| --- | --- |
| ☐ | The Kin Canada emblem is a registered trademark. Confirm the club's use follows Kin Canada's current brand standards. |
| ☐ | The logo was converted from a small PNG (about 360 × 130 px). Ask Kin Canada or the club for the official **vector (SVG/EPS) artwork** and replace the files in `src/assets/brand/` for sharper rendering. |
| ☐ | Favicon and home-screen icon use the Kin emblem (`public/favicon-*.png`, `public/apple-touch-icon.png`). Replace if Kin Canada supplies an official icon. |

## 11. Wix template leftovers (not migrated)

`/about-1` was an unedited Wix template (“Finding Inspiration in Every Turn”, placeholder team members). It now
redirects to `/kinsmen`.
