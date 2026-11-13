/**
 * Reviewer comments: validation, the production switch, the /api/annotations
 * handler (against an in-memory fake of node-postgres) and the build guard.
 */
import { describe, expect, it } from 'vitest';
import { findReviewToolsInProduction } from '../scripts/private-data-rules';
import { createAnnotationsHandler, type Queryable } from '../src/lib/annotations/api';
import { checkChanges, checkNew, commentLink, COMMENT_HASH, isAnnotationsEnabled, sortAnnotations, ValidationError, type ReviewAnnotation } from '../src/lib/annotations/model';

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
      if (sql.startsWith('select')) {
        const all = [...rows.values()];
        return { rows: (params.length ? all.filter((r) => r.page === params[0]) : all) as never[] };
      }
      if (sql.startsWith('insert')) {
        const [id, page, quote, target, comment, author] = params as string[];
        if (rows.has(id)) return { rows: [] };
        const row = { id, page, quote, target: JSON.parse(target), comment, author, priority: null, score: null, created_at: now, updated_at: now };
        rows.set(id, row);
        return { rows: [row] as never[] };
      }
      if (sql.startsWith('update')) {
        const row = rows.get(params[0] as string);
        if (!row) return { rows: [] };
        // Mirrors the handler's CASE expressions: [id, setComment, comment, setPriority, priority, setScore, score].
        const [, setComment, comment, setPriority, priority, setScore, score] = params;
        if (setComment && comment !== row.comment) Object.assign(row, { comment, updated_at: new Date(Date.now() + 1000).toISOString() });
        if (setPriority) row.priority = priority;
        if (setScore) row.score = score;
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
    expect((await handle(req('PUT', `/api/annotations?id=${ID}`, { score: 9 }))).status).toBe(400);
    expect((await handle(req('PUT', `/api/annotations?id=${ID}`, {}))).status).toBe(400);
  });
});

describe('triage', () => {
  it('validates partial changes', () => {
    expect(checkChanges({ priority: 'high' })).toEqual({ priority: 'high' });
    expect(checkChanges({ priority: null, score: null })).toEqual({ priority: null, score: null });
    expect(checkChanges({ score: 5 })).toEqual({ score: 5 });
    for (const bad of [{}, { priority: 'urgent' }, { score: 0 }, { score: 6 }, { score: 2.5 }, { score: '3' }, { comment: ' ' }]) {
      expect(() => checkChanges(bad), JSON.stringify(bad)).toThrow(ValidationError);
    }
  });

  it('sets priority and score without marking the comment edited, and lists every page', async () => {
    const db = fakeDb();
    const handle = createAnnotationsHandler({ enabled: true, db });
    await handle(req('POST', '/api/annotations', valid));
    await handle(req('POST', '/api/annotations', { ...valid, id: ID.replace('0', '1'), page: '/faq' }));

    const res = await handle(req('PUT', `/api/annotations?id=${ID}`, { priority: 'high', score: 4 }));
    const { annotation } = await res.json();
    expect(annotation).toMatchObject({ priority: 'high', score: 4 });
    expect(annotation.updatedAt).toBe(annotation.createdAt);

    const cleared = await (await handle(req('PUT', `/api/annotations?id=${ID}`, { score: null }))).json();
    expect(cleared.annotation).toMatchObject({ priority: 'high', score: null });

    const all = await (await handle(req('GET', '/api/annotations'))).json();
    expect(all.annotations.map((a: ReviewAnnotation) => a.page).sort()).toEqual(['/faq', '/visit']);
  });

  it('sorts High → Medium → Low → unset, then by score, then newest', () => {
    const base = { page: '/', quote: 'q', target: [], comment: 'c', author: 'a', updatedAt: '' };
    const mk = (id: string, priority: ReviewAnnotation['priority'], score: number | null, createdAt: string): ReviewAnnotation => ({ ...base, id, priority, score, createdAt });
    const list = [
      mk('unset-new', null, 5, '2026-11-05'),
      mk('low', 'low', null, '2026-11-01'),
      mk('high-3', 'high', 3, '2026-11-01'),
      mk('high-5', 'high', 5, '2026-11-01'),
      mk('medium', 'medium', 1, '2026-11-01'),
    ];
    expect(sortAnnotations(list, 'priority').map((a) => a.id)).toEqual(['high-5', 'high-3', 'medium', 'low', 'unset-new']);
    expect(sortAnnotations(list, 'score').map((a) => a.id)).toEqual(['high-5', 'unset-new', 'high-3', 'medium', 'low']);
    expect(sortAnnotations(list, 'newest')[0].id).toBe('unset-new');
  });

  it('links to a comment in place', () => {
    const link = commentLink({ page: '/visit', id: ID });
    expect(link).toBe(`/visit#comment-${ID}`);
    expect(COMMENT_HASH.exec(link.slice('/visit'.length))?.[1]).toBe(ID);
  });
});

describe('production build guard', () => {
  it('flags reviewer-comment code in production files', () => {
    expect(findReviewToolsInProduction([{ path: 'index.html', text: '<p>Welcome</p>' }])).toEqual([]);
    expect(findReviewToolsInProduction([{ path: '_astro/x.js', text: 'fetch("/api/annotations")' }])).toHaveLength(1);
  });
});
