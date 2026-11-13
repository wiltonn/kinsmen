/**
 * HTTP handler for /api/annotations (Web Request -> Response).
 * Used by the Vercel function (api/annotations.ts) and by `astro dev`
 * (integrations/review-api.mjs). The database is injected so tests can fake it.
 *
 *   GET    /api/annotations?page=/visit   list a page's comments
 *   POST   /api/annotations               create  {id, page, target, comment, author}
 *   PUT    /api/annotations?id=<uuid>     edit    {comment}
 *   DELETE /api/annotations?id=<uuid>     delete
 */
import { checkComment, checkId, checkNew, checkPage, LIMITS, quoteOf, ValidationError, type ReviewAnnotation } from './model.js';

/** The slice of node-postgres' Pool that the handler needs. */
export interface Queryable {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

interface Row {
  id: string;
  page: string;
  quote: string;
  target: ReviewAnnotation['target'];
  comment: string;
  author: string;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, page, quote, target, comment, author, created_at, updated_at';

const toAnnotation = (r: Row): ReviewAnnotation => ({
  id: r.id,
  page: r.page,
  quote: r.quote,
  target: r.target,
  comment: r.comment,
  author: r.author,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const error = (message: string, status: number) => json({ error: message }, status);

async function readJson(request: Request): Promise<unknown> {
  const raw = await request.text();
  if (raw.length > LIMITS.body) throw new ValidationError('Request is too large.');
  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Request body must be JSON.');
  }
}

export interface HandlerOptions {
  /** False on production builds: the endpoint then behaves as if it doesn't exist. */
  enabled: boolean;
  /** Undefined when DATABASE_URL is not configured. */
  db?: Queryable;
}

export function createAnnotationsHandler({ enabled, db }: HandlerOptions) {
  return async function handle(request: Request): Promise<Response> {
    if (!enabled) return error('Not found.', 404);
    if (!db) return error('Annotation storage is not configured.', 503);
    const url = new URL(request.url);
    try {
      switch (request.method) {
        case 'GET': {
          const page = checkPage(url.searchParams.get('page'));
          const { rows } = await db.query<Row>(`select ${COLUMNS} from review_annotations where page = $1 order by created_at`, [page]);
          return json({ annotations: rows.map(toAnnotation) });
        }
        case 'POST': {
          const a = checkNew(await readJson(request));
          const { rows } = await db.query<Row>(
            `insert into review_annotations (id, page, quote, target, comment, author)
             values ($1, $2, $3, $4::jsonb, $5, $6)
             on conflict (id) do nothing
             returning ${COLUMNS}`,
            [a.id, a.page, quoteOf(a.target), JSON.stringify(a.target), a.comment, a.author],
          );
          if (!rows[0]) return error('An annotation with that id already exists.', 409);
          return json({ annotation: toAnnotation(rows[0]) }, 201);
        }
        case 'PUT': {
          const id = checkId(url.searchParams.get('id'));
          const comment = checkComment(((await readJson(request)) as Record<string, unknown> | null)?.comment);
          const { rows } = await db.query<Row>(
            `update review_annotations set comment = $2, updated_at = now() where id = $1 returning ${COLUMNS}`,
            [id, comment],
          );
          if (!rows[0]) return error('Annotation not found.', 404);
          return json({ annotation: toAnnotation(rows[0]) });
        }
        case 'DELETE': {
          const id = checkId(url.searchParams.get('id'));
          const { rows } = await db.query<{ id: string }>('delete from review_annotations where id = $1 returning id', [id]);
          if (!rows[0]) return error('Annotation not found.', 404);
          return json({ deleted: rows[0].id });
        }
        default:
          return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: { ...HEADERS, allow: 'GET, POST, PUT, DELETE' } });
      }
    } catch (e) {
      if (e instanceof ValidationError) return error(e.message, 400);
      console.error('[annotations]', e);
      return error('Something went wrong saving comments. Please try again.', 500);
    }
  };
}
