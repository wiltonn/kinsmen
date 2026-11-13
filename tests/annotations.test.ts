/**
 * Reviewer comments: validation, the production switch, the /api/annotations
 * handler (against an in-memory fake of node-postgres) and the build guard.
 */
import { describe, expect, it } from 'vitest';
import { findReviewToolsInProduction } from '../scripts/private-data-rules';
import { createAnnotationsHandler, type Queryable } from '../src/lib/annotations/api';
import { checkNew, isAnnotationsEnabled, ValidationError } from '../src/lib/annotations/model';

const ID = '3f2c1a9e-8b7d-4c6e-9a1f-0b2c3d4e5f60';
const valid = { id: ID, page: '/visit', author: 'Pat', comment: 'Hours look wrong', target: [{ quote: 'Open daily', start: 10, end: 20 }] };

/** Just enough SQL to exercise the handler's four statements. */
function fakeDb(): Queryable & { rows: Map<string, Record<string, unknown>> } {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    rows,
    async query(text: string, params: unknown[] = []) {
      const sql = text.trim().toLowerCase();
      const now = new Date().toISOString();
      if (sql.startsWith('select')) return { rows: [...rows.values()].filter((r) => r.page === params[0]) as never[] };
      if (sql.startsWith('insert')) {
        const [id, page, quote, target, comment, author] = params as string[];
        if (rows.has(id)) return { rows: [] };
        const row = { id, page, quote, target: JSON.parse(target), comment, author, created_at: now, updated_at: now };
        rows.set(id, row);
        return { rows: [row] as never[] };
      }
      if (sql.startsWith('update')) {
        const row = rows.get(params[0] as string);
        if (!row) return { rows: [] };
        Object.assign(row, { comment: params[1], updated_at: now });
        return { rows: [row] as never[] };
      }
      if (sql.startsWith('delete')) {
        const had = rows.delete(params[0] as string);
        return { rows: (had ? [{ id: params[0] }] : []) as never[] };
      }
      throw new Error(`unexpected SQL: ${text}`);
    },
  };
}

const req = (method: string, path: string, body?: unknown) =>
  new Request(`https://preview.example${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

describe('validation', () => {
  it('accepts a well-formed comment and trims text', () => {
    expect(checkNew({ ...valid, author: '  Pat ' })).toMatchObject({ author: 'Pat', page: '/visit' });
  });
  it.each([
    ['bad id', { ...valid, id: 'abc' }],
    ['page outside the site', { ...valid, page: 'https://evil.example/' }],
    ['page with traversal', { ...valid, page: '/../etc' }],
    ['empty comment', { ...valid, comment: '   ' }],
    ['long comment', { ...valid, comment: 'x'.repeat(2001) }],
    ['missing name', { ...valid, author: '' }],
    ['empty target', { ...valid, target: [] }],
    ['inverted range', { ...valid, target: [{ quote: 'a', start: 5, end: 2 }] }],
  ])('rejects %s', (_, input) => {
    expect(() => checkNew(input)).toThrow(ValidationError);
  });
  it('is disabled only on production', () => {
    expect(isAnnotationsEnabled({})).toBe(true);
    expect(isAnnotationsEnabled({ SITE_ENV: 'preview' })).toBe(true);
    expect(isAnnotationsEnabled({ SITE_ENV: 'Production' })).toBe(false);
  });
});

describe('/api/annotations handler', () => {
  it('returns 404 on production and 503 without a database', async () => {
    expect((await createAnnotationsHandler({ enabled: false, db: fakeDb() })(req('GET', '/api/annotations?page=/'))).status).toBe(404);
    expect((await createAnnotationsHandler({ enabled: true })(req('GET', '/api/annotations?page=/'))).status).toBe(503);
  });

  it('creates, lists, edits and deletes', async () => {
    const db = fakeDb();
    const handle = createAnnotationsHandler({ enabled: true, db });

    const created = await handle(req('POST', '/api/annotations', valid));
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    expect((await created.json()).annotation).toMatchObject({ id: ID, quote: 'Open daily', author: 'Pat' });
    expect((await handle(req('POST', '/api/annotations', valid))).status).toBe(409);

    const listed = await (await handle(req('GET', '/api/annotations?page=/visit'))).json();
    expect(listed.annotations).toHaveLength(1);
    expect((await (await handle(req('GET', '/api/annotations?page=/faq'))).json()).annotations).toHaveLength(0);

    const edited = await handle(req('PUT', `/api/annotations?id=${ID}`, { comment: 'Fixed?' }));
    expect((await edited.json()).annotation.comment).toBe('Fixed?');

    expect((await handle(req('DELETE', `/api/annotations?id=${ID}`))).status).toBe(200);
    expect((await handle(req('DELETE', `/api/annotations?id=${ID}`))).status).toBe(404);
    expect(db.rows.size).toBe(0);
  });

  it('rejects bad input with 400 and unknown methods with 405', async () => {
    const handle = createAnnotationsHandler({ enabled: true, db: fakeDb() });
    expect((await handle(req('POST', '/api/annotations', { ...valid, comment: '' }))).status).toBe(400);
    expect((await handle(new Request('https://preview.example/api/annotations', { method: 'POST', body: '{nope' }))).status).toBe(400);
    expect((await handle(req('GET', '/api/annotations?page=nope'))).status).toBe(400);
    expect((await handle(req('PATCH', '/api/annotations'))).status).toBe(405);
  });
});

describe('production build guard', () => {
  it('flags reviewer-comment code in production files', () => {
    expect(findReviewToolsInProduction([{ path: 'index.html', text: '<p>Welcome</p>' }])).toEqual([]);
    expect(findReviewToolsInProduction([{ path: '_astro/x.js', text: 'fetch("/api/annotations")' }])).toHaveLength(1);
  });
});
