# Reviewer comments on preview builds

Reviewers can **select any text** in a page's main content and leave a comment. Comments are shared: everyone looking at a preview build of the same page sees them. This uses [Recogito Text Annotator](https://github.com/recogito/text-annotator-js), and the comments are stored in Neon Postgres.

## Who sees it

- **Preview and development builds only.** `BaseLayout.astro` includes `ReviewAnnotations.astro` only when `showDevNotes` is true, which means `SITE_ENV` is not `production`.
- On production the API returns 404, and the post-build check (`scripts/check-private-data.mjs`) fails the build if any annotator code ends up in `dist/`.
- There are no accounts. Anyone with the preview URL can comment, edit or delete. Reviewers type their name once and the browser remembers it.

## Using it

1. Select some text. A popup shows the quote, a comment box and your name.
2. **Save comment** highlights the text for everyone.
3. Click a highlight to read the comment, see who wrote it and when, or **Edit** / **Delete** it.

The highlight's position and text are saved. If page content changes a lot later, an old highlight can land in the wrong place, but the quoted text is always stored with the comment.

## Pieces

| File | Role |
| --- | --- |
| `src/components/ReviewAnnotations.astro`, `src/scripts/review-annotations.ts` | Popup and annotator wiring |
| `src/lib/annotations/model.ts` | Data shape and validation |
| `src/lib/annotations/api.ts` | `/api/annotations` handler: GET `?page=`, POST, PUT `?id=`, DELETE `?id=` |
| `api/annotations.ts` | Vercel Function: node-postgres with `attachDatabasePool` (Neon's guidance for Vercel) |
| `integrations/review-api.mjs` | Serves the same handler during `astro dev` |
| `db/annotations.sql`, `scripts/db-migrate.mjs` | Table `review_annotations` |
| `neon.ts` | Neon project config (`neon deploy`) |

## Setup

1. `neon deploy` writes `DATABASE_URL` (pooled) into `.env.local`.
2. `npm run db:migrate` creates the table. It's safe to run again.
3. `npm run dev`: the comments API runs inside the dev server.
4. **Vercel:** add `DATABASE_URL` to the project's **Preview** environment variables, or connect the Neon integration. Without it, the API returns 503 and the page says comments are unavailable.
