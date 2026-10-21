# OpenTable setup

The Pancake House keeps using **OpenTable** for reservations. This website only links to OpenTable, or embeds
OpenTable's official widget. It never stores booking details and has no reservation database, and OpenTable stays
the source of truth for tables, dates and times.

Nothing in the OpenTable account needs to change. You only need two values from the **OpenTable account
administrator**. The previous website had no OpenTable link, so these values were not available during the build.
**Don't guess them or build a URL by hand.**

## 1. Values to request

| Value | Required? | Where the administrator finds it | Example _format_ (not real) |
| --- | --- | --- | --- |
| **Booking page URL** | Yes | The restaurant's public OpenTable reservation link, as shared with guests, or from OpenTable for Restaurants → marketing/booking links | `https://www.opentable.ca/r/<restaurant-name>` or `https://www.opentable.ca/restref/client/?rid=<id>` |
| **Widget script address** | Optional | OpenTable for Restaurants → widget / “Reservation widget” embed code. Copy only the address inside `src="…"` | `//www.opentable.ca/widget/reservation/loader?rid=<id>&type=standard&theme=standard&iframe=true&domain=ca&lang=en-CA&…` |

## 2. Enter them in Sanity

Studio → **Booking settings (OpenTable)**:

1. **OpenTable booking page**: paste the booking URL.
2. Optional: tick **Show the OpenTable booking widget**, then paste the widget script address (only the
   `src` value, not the whole `<script>` tag).
3. Publish.

Then open the current **Season** → **Reservations** and set the state:

| State | What visitors see |
| --- | --- |
| Not announced | “Reservation details for 2027 haven't been announced yet.” No booking buttons. |
| Opening soon | “Online reservations open on [date]” (only if you enter a confirmed date), otherwise “will open soon”. No booking buttons. |
| **Open** | The OpenTable widget (if enabled) and a **Reserve on OpenTable** button, plus **Reserve a table** in the site header and on the homepage. |
| Closed | “Online Pancake House reservations for 2027 are closed.” No booking buttons. |

Booking buttons appear only when **both** are true: the state is _Open_ **and** a valid OpenTable link or widget is
saved. Entering an opening date never switches booking on by itself. Switch the state to _Open_ when OpenTable is
actually taking bookings.

The site never says “sold out”. If a date is full, OpenTable shows that itself.

## 3. How the integration is protected

- **Validated fields, not code.** Sanity and the website both check that the booking URL is `https` on
  `opentable.ca`/`opentable.com`, and that the widget address is OpenTable's `/widget/reservation/loader` with a
  numeric `rid`. Unknown widget parameters are dropped. Arbitrary HTML or script can't be entered.
  (`src/lib/opentable.ts`, mirrored in `studio/lib/opentableValidation.ts`; tests keep them in sync.)
- **Loaded only where needed.** The widget script loads only on `/pancake-house`, only when the widget is enabled,
  and only as the booking panel scrolls near the screen. It is never initialised twice on a page.
- **No layout jump.** Space is reserved for the widget's approximate height (standard 320 px, tall 500 px,
  wide 170 px, button 120 px).
- **Fallback.** If the widget doesn't load within 15 seconds, or JavaScript is off, visitors are told to use the
  **Reserve on OpenTable** button, which is always shown when a booking URL exists.
- **Styling boundary.** The widget renders inside OpenTable's own iframe. We only style the white box around it.
- **Misconfiguration.** If reservations are _Open_ but no valid link exists, visitors are asked to call, and the
  build log prints a warning. Preview builds show a dashed "Development notice" box explaining what's missing.
  This notice never appears in production.

## 4. Test before launch

1. Locally, without touching Sanity:
   ```bash
   FIXTURE_SCENARIO=reservations-open FIXTURE_OPENTABLE_BOOKING_URL="<url from admin>" npm run dev
   ```
   Add `FIXTURE_OPENTABLE_WIDGET_LOADER_URL="<src from admin>"` to test the widget.
2. On a preview deployment, check `/pancake-house` at phone and desktop widths: the widget loads, the
   **Reserve on OpenTable** button opens the right restaurant, and keyboard Tab reaches both.
3. Make a test reservation only if the OpenTable administrator agrees, and cancel it in OpenTable.

**Known limitation:** the widget's behaviour could not be tested during development because no real OpenTable
configuration was available. OpenTable's loader script inserts its iframe next to the script tag. This site adds
that script into the reserved box at runtime, which is the standard pattern, but confirm it on a preview
deployment. If the widget doesn't render, leave it disabled: the booking link alone is a complete integration.
