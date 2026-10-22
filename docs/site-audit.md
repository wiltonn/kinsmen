# Audit of the previous website

Audited 21 October 2026: `https://www.kinsmenfanshawesugarbush.com/` (Wix, site revision 251), including its
sitemap, rendered pages, embedded HTML components and linked files. What happened to each item is tracked in
[content-checklist.md](content-checklist.md).

## Pages and URLs

| URL | What it was | Migrated to |
| --- | --- | --- |
| `/` | One long page. Sections: Maple Syrup Products, Sugar Bush Public Tours (2027 dates), School Tours (2027 dates, pricing, teacher PDF), Best of London badge, About Kin Canada, Objects of the Association, Maple Miracles (video description), Land Acknowledgement (image), Volunteer/Join, Benefactors, “Have Any Questions?” Wix form, Get in Touch | Split across all new routes |
| `/menus` | Wix Restaurants menu: pancakes, drinks, syrup and maple products with prices (sitemap lastmod 2025-03-20) | `/pancake-house#menu`, `/maple-products` |
| `/french` | Embedded PDF, a **Portuguese** self-guided tour brochure (“Mata do Açúcar – Viagem autoguiada”) | `/visit#languages` |
| `/about-1` | Unedited Wix template (placeholder team) | Not migrated → redirect to `/kinsmen` |

The navigation menu items (Services/Book, Sugar Bush Tours, School Tours, About, Maple Miracles, Land Acknowledgement,
Volunteer/Join, Benefactors, Contact) all linked to the homepage and scrolled to sections.

## Seasonal and visitor information found

- **2027 public dates** and **2027 school tour dates + Tour Pricing + “Do I need to book?” note**: inside two
  embedded HTML iframes (`filesusr.com/html/2c371f_56f8…html`, `…_3f00…html`). They are not visible in the page text
  or search results, and are now real HTML on the new site.
- **Not published anywhere:** opening hours, public admission prices, Pancake House dates and hours, accessibility,
  parking, pets, payment methods, OpenTable link.
- “Services/Book” linked to the homepage. **No OpenTable link or widget was present.**

## Downloads

| File | Content |
| --- | --- |
| `/_files/ugd/17f70a_2f49…dab3.pdf` | “Teacher's Guide to the Kinsmen Fanshawe Sugar Bush”, 16 pages, Feb 2015, mostly scanned worksheets; booking-form fields; cheque payable to the Kinsmen Club of Greater London; feedback email `kinsmenfanshawesugarbush@primus.ca` |
| `/_files/ugd/2c371f_2f01…13a2.pdf` | Portuguese self-guided tour brochure, 2 pages, scanned |

## Contact details

21201C Lakeside Dr, Thorndale, ON N0M 2P0 · (519) 461-1073 · `greaterlondonkinsmenclub@primus.ca` · Google Maps
short link · Facebook `KinsmenFanshaweSugarBush` (plus a leftover `facebook.com/wix` template link).

## Forms

| Form | Destination | Status |
| --- | --- | --- |
| “Please contact me” (Volunteer/Join) | Google Form “Friends of the Kinsmen Fanshawe Sugar Bush”: name, phone, date of birth, interests (volunteer / member / updates) | Live. Preserved. |
| “Have Any Questions?” (Name, Email, Message, Phone) | Wix Forms backend | Not migrated (Wix-only). Replaced by phone/email routes. |

## Images

Club photos reused (credits/permission to confirm): visitors at the sugar shack (`_KSB0006.jpg`), syrup shelf,
visitors with draft horses (2015), maple history display boards, Santa Claus Parade float, Stevenson Camp cake.
Reused: the Kin Canada header logo (see Brand). Not reused: Best of London badge and Denny's logo (third-party marks), partner logos, 2014 chainsaw carving photos,
Portraits of Honour, map screenshot (replaced by a Google Maps link), land acknowledgement image (transcribed to text).

## Brand

Wix theme colours in use: Kin red `#ED2025` (headings, links, buttons, footer), purple `#4C2273` (Benefactors
cards), light grey `#E3E3E3` (section bands), white and black. The theme also defined brown `#634624` and tan
`#E8CEB0`, but they weren't visible on the page. The header logo is a red Kin Canada / Kinsmen Club of Greater
London lockup (`17f70a_ed684750212d4835ab289ea1860e312e~mv2.png`, 500 × 500 PNG on white). There was no custom
favicon (Wix default). The fonts were Arial/Helvetica and Futura (the new site keeps its own fonts).

## Accessibility of the old site (for reference)

Key information (dates, prices) was inside iframes and images, many images had file names as alt text (“image.png”),
and the land acknowledgement was only available as an image of text.
