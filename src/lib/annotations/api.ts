/**
 * HTTP handler for /api/annotations (Web Request -> Response).
 * Used by the Vercel function (api/annotations.ts) and by `astro dev`
 * (integrations/review-api.mjs). The database is injected so tests can fake it.
 *
 *   GET    /api/annotations?page=/visit   list a page's comments
 *   GET    /api/annotations               list every comment (the /comments page)
 *   POST   /api/annotations               create  {id, page, target, comment, author}
 *   PUT    /api/annotations?id=<uuid>     change  {comment?, priority?, score?}
 *   DELETE /api/annotations?id=<uuid>     delete
 */
import { checkChanges, checkId, checkNew, checkPage, LIMITS, quoteOf, ValidationError, type ReviewAnnotation } from './model.js';

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
  priority: ReviewAnnotation['priority'];
  score: number | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const COLUMNS = 'id, page, quote, target, comment, author, priority, score, created_at, updated_at';
/** Safety cap for the all-comments list. */
const MAX_LIST = 2000;

const toAnnotation = (r: Row): ReviewAnnotation => ({
  id: r.id,
  page: r.page,
  quote: r.quote,
  target: r.target,
  comment: r.comment,
  author: r.author,
  priority: r.priority ?? null,
  score: r.score ?? null,
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
          if (!url.searchParams.has('page')) {
            const { rows } = await db.query<Row>(`select ${COLUMNS} from review_annotations order by created_at desc limit ${MAX_LIST}`);
            return json({ annotations: rows.map(toAnnotation) });
          }
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
          const c = checkChanges(await readJson(request));
          // Only a changed comment counts as an edit (updated_at); triage doesn't.
          const { rows } = await db.query<Row>(
            `update review_annotations set
               updated_at = case when $2 and comment is distinct from $3::text then now() else updated_at end,
               comment    = case when $2 then $3::text else comment end,
               priority   = case when $4 then $5::text else priority end,
               score      = case when $6 then $7::smallint else score end
             where id = $1 returning ${COLUMNS}`,
            [id, 'comment' in c, c.comment ?? null, 'priority' in c, c.priority ?? null, 'score' in c, c.score ?? null],
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
