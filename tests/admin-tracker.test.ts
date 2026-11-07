/**
 * Website Admin tracker (studio/admin-tracker): model rules, the launch
 * checklist parser, both stores, and the privacy guarantees the public site
 * relies on. See docs/spikes/admin-tracker.md.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  PRIVATE_MARKERS,
  SEED_ITEMS,
  TRACKER_ID_PREFIX,
  TRACKER_TYPE,
  canEditTracker,
  clearBlocker,
  createItem,
  documentId,
  isBlocked,
  moveItem,
  newItemId,
  parseChecklist,
  setBlocker,
  summarize,
  updateItem,
  validateItem,
} from '../studio/admin-tracker/model';
import { createLocalRepository, DEMO_STORAGE_KEY, type KeyValueStore } from '../studio/admin-tracker/localRepository';
import { createSanityRepository, fromDocument, toDocument, TRACKER_QUERY, type TrackerClient } from '../studio/admin-tracker/sanityRepository';
import { ConflictError } from '../studio/admin-tracker/repository';
import { SITE_QUERY } from '../src/lib/content/sanity';

const CHECKLIST = readFileSync(new URL('../docs/launch-checklist.md', import.meta.url), 'utf8');
const T0 = new Date('2026-11-07T12:00:00Z');
const T1 = new Date('2026-11-08T12:00:00Z');

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};

describe('launch checklist progress', () => {
  it('derives counts from the Markdown instead of hardcoding them', () => {
    const open = CHECKLIST.match(/^\s*- \[ \]/gm)?.length ?? 0;
    const done = CHECKLIST.match(/^\s*- \[[xX]\]/gm)?.length ?? 0;
    const progress = parseChecklist(CHECKLIST);
    expect(progress.total).toBe(open + done);
    expect(progress.done).toBe(done);
    expect(progress.sections.reduce((n, s) => n + s.total, 0)).toBe(progress.total);
  });

  it('counts ticked items, joins wrapped lines and groups by section', () => {
    const md = ['# T', '## A', '- [x] One', '- [ ] Two wraps', '      onto a second line.', '## B', '- [X] Three', 'Not a task.', '- [ ] Four'].join('\n');
    const p = parseChecklist(md);
    expect(p).toMatchObject({ total: 4, done: 2 });
    expect(p.sections).toEqual([
      { title: 'A', total: 2, done: 1 },
      { title: 'B', total: 2, done: 1 },
    ]);
    expect(p.entries[1].text).toBe('Two wraps onto a second line.');
    expect(new Set(p.entries.map((e) => e.slug)).size).toBe(4);
  });

  it('gives every real requirement a unique slug', () => {
    const slugs = parseChecklist(CHECKLIST).entries.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('starter items', () => {
  const checklistSlugs = new Set(parseChecklist(CHECKLIST).entries.map((e) => e.slug));

  it('are valid, unique, and cover the requested examples', () => {
    for (const item of SEED_ITEMS) expect(validateItem(item)).toEqual([]);
    expect(new Set(SEED_ITEMS.map((i) => i.id)).size).toBe(SEED_ITEMS.length);
    expect(SEED_ITEMS.find((i) => i.title === 'Evaluate inline feedback on staging')?.column).toBe('later');
    for (const word of ['Sanity', 'booking URL', 'season content', 'mobile QA']) expect(SEED_ITEMS.some((i) => i.title.includes(word))).toBe(true);
  });

  it('invent no owners or dates, and label priorities as illustrative', () => {
    for (const item of SEED_ITEMS) {
      expect(item.owner).toBeUndefined();
      expect(item.targetDate).toBeUndefined();
      if (item.priority) expect(item.priorityIllustrative).toBe(true);
    }
  });

  it('reference checklist requirements that exist', () => {
    for (const item of SEED_ITEMS.filter((i) => i.checklistRef)) expect(checklistSlugs.has(item.checklistRef!)).toBe(true);
  });
});

describe('tracker items', () => {
  const draft = { title: '  Confirm whether a Pancake House reservation includes tour admission. ', description: '', column: 'next' as const };

  it('creates items with a stable ID and trimmed fields', () => {
    const item = createItem(draft, T0, 't-abc234');
    expect(item).toEqual({
      id: 't-abc234',
      title: 'Confirm whether a Pancake House reservation includes tour admission.',
      description: '',
      column: 'next',
      createdAt: T0.toISOString(),
      updatedAt: T0.toISOString(),
    });
    expect(newItemId(() => 0)).toBe('t-aaaaaa');
    expect(newItemId()).toMatch(/^t-[a-z2-9]{6}$/);
  });

  it('moves between columns and keeps a blocked item in its column', () => {
    let item = createItem(draft, T0, 't-abc234');
    item = moveItem(item, 'now', T1);
    item = setBlocker(item, 'Waiting on the club treasurer', T1);
    expect(item).toMatchObject({ id: 't-abc234', column: 'now', blocker: 'Waiting on the club treasurer', createdAt: T0.toISOString(), updatedAt: T1.toISOString() });
    expect(isBlocked(item)).toBe(true);
    expect(summarize([item]).blocked.map((i) => i.id)).toEqual(['t-abc234']);

    item = moveItem(clearBlocker(item, T1), 'done', T1);
    expect(item.blocker).toBeUndefined();
    expect(summarize([item])).toEqual({ counts: { now: 0, next: 0, later: 0, done: 1 }, blocked: [] });
  });

  it('removes the "illustrative" label once a person sets the priority', () => {
    const seed = SEED_ITEMS.find((i) => i.priority === 'high')!;
    expect(updateItem(seed, { title: 'Renamed' }, T1).priorityIllustrative).toBe(true);
    expect(updateItem(seed, { priority: 'low' }, T1).priorityIllustrative).toBeUndefined();
  });

  it('treats a whitespace-only blocker as not blocked', () => {
    expect(isBlocked(setBlocker(SEED_ITEMS[0], '   ', T1))).toBe(false);
  });

  it('validates input', () => {
    expect(validateItem({ id: 't-abc234', title: ' ', column: 'soon' as never, sourceUrl: 'javascript:alert(1)', targetDate: '31/01/2027' }).map((i) => i.field)).toEqual([
      'title',
      'column',
      'targetDate',
      'sourceUrl',
    ]);
  });

  it('never ticks the launch checklist when an item is Done', () => {
    const before = parseChecklist(CHECKLIST);
    const done = SEED_ITEMS.filter((i) => i.checklistRef).map((i) => moveItem(i, 'done', T1));
    expect(done.every((i) => i.column === 'done')).toBe(true);
    expect(parseChecklist(CHECKLIST)).toEqual(before);
  });
});

describe('local demo store', () => {
  it('seeds on first use and keeps edits across a refresh', async () => {
    const store = memoryStore();
    const first = createLocalRepository(store);
    expect(first.kind).toBe('local-demo');
    expect(first.persistent).toBe(true);
    expect((await first.list()).map((i) => i.id)).toEqual(SEED_ITEMS.map((i) => i.id));

    const created = createItem({ title: 'New', description: '', column: 'next' }, T0, 't-new234');
    await first.create(created);
    await first.update(setBlocker(moveItem(created, 'now', T1), 'Reason', T1));

    const afterRefresh = createLocalRepository(store);
    expect((await afterRefresh.list()).find((i) => i.id === 't-new234')).toMatchObject({ column: 'now', blocker: 'Reason' });
    expect(store.data.has(DEMO_STORAGE_KEY)).toBe(true);
  });

  it('falls back to memory (and says so) when storage is blocked', async () => {
    const blocked: KeyValueStore = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => undefined,
    };
    const repo = createLocalRepository(blocked);
    expect((await repo.list()).length).toBe(SEED_ITEMS.length);
    expect(repo.persistent).toBe(false);
  });

  it('can be reset to the starter items', async () => {
    const store = memoryStore();
    const repo = createLocalRepository(store);
    await repo.create(createItem({ title: 'X', description: '', column: 'later' }, T0, 't-xyz234'));
    await repo.reset();
    expect((await createLocalRepository(store).list()).length).toBe(SEED_ITEMS.length);
  });
});

/** A fake of the few @sanity/client calls the store uses. */
function fakeClient(docs: Record<string, unknown>[] = []) {
  const calls: { op: string; id?: string; rev?: string; set?: Record<string, unknown>; unset?: string[]; query?: string; params?: unknown }[] = [];
  let conflict = false;
  const client: TrackerClient = {
    fetch: async <R,>(query: string, params?: Record<string, unknown>) => {
      calls.push({ op: 'fetch', query, params });
      return docs as R;
    },
    create: async (doc) => void calls.push({ op: 'create', id: doc._id }),
    createIfNotExists: async (doc) => void calls.push({ op: 'createIfNotExists', id: doc._id }),
    patch: (id) => {
      const call: (typeof calls)[number] = { op: 'patch', id };
      const p = {
        ifRevisionId: (rev: string) => ((call.rev = rev), p),
        set: (s: Record<string, unknown>) => ((call.set = s), p),
        unset: (u: string[]) => ((call.unset = u), p),
        commit: async () => {
          calls.push(call);
          if (conflict) throw Object.assign(new Error('Document has unexpected revision ID'), { statusCode: 409 });
        },
      };
      return p;
    },
    listen: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
  };
  return { client, calls, setConflict: (v: boolean) => (conflict = v) };
}

describe('Sanity store', () => {
  it('stores items under private (dotted) document IDs', () => {
    for (const item of SEED_ITEMS) {
      const doc = toDocument(item);
      expect(doc._id).toBe(`${TRACKER_ID_PREFIX}${item.id}`);
      expect(doc._id).toContain('.');
      expect(doc._type).toBe(TRACKER_TYPE);
      expect(fromDocument(doc)).toEqual(item);
    }
  });

  it('only reads documents in the private namespace', async () => {
    const good = { ...toDocument(SEED_ITEMS[0]), _rev: 'r1' };
    const publicCopy = { ...toDocument(SEED_ITEMS[1]), _id: SEED_ITEMS[1].id };
    const { client, calls } = fakeClient([good, publicCopy, { _id: 'admin-tracker.bad', _type: TRACKER_TYPE }]);
    const items = await createSanityRepository(client).list();
    expect(items.map((i) => i.id)).toEqual([SEED_ITEMS[0].id]);
    expect(calls[0]).toMatchObject({ query: TRACKER_QUERY, params: { type: TRACKER_TYPE, path: 'admin-tracker.**' } });
  });

  it('updates with optimistic locking and unsets cleared fields', async () => {
    const item = SEED_ITEMS.find((i) => i.blocker)!;
    const { client, calls, setConflict } = fakeClient([{ ...toDocument(item), _rev: 'rev-1' }]);
    const repo = createSanityRepository(client);
    await repo.list();
    await repo.update(moveItem(clearBlocker(item, T1), 'now', T1));
    const patch = calls.find((c) => c.op === 'patch')!;
    expect(patch).toMatchObject({ id: documentId(item.id), rev: 'rev-1' });
    expect(patch.set).toMatchObject({ column: 'now', updatedAt: T1.toISOString() });
    expect(patch.unset).toContain('blocker');

    setConflict(true);
    await expect(repo.update(item)).rejects.toBeInstanceOf(ConflictError);
  });

  it('adds only missing starter items, without overwriting', async () => {
    const { client, calls } = fakeClient([{ ...toDocument(SEED_ITEMS[0]), _rev: 'r' }]);
    expect(await createSanityRepository(client).addStarterItems(SEED_ITEMS)).toBe(SEED_ITEMS.length - 1);
    expect(calls.filter((c) => c.op === 'createIfNotExists').map((c) => c.id)).toEqual(SEED_ITEMS.slice(1).map((i) => documentId(i.id)));
  });
});

describe('access and privacy', () => {
  it('lets only administrators/editors change items', () => {
    expect(canEditTracker([{ name: 'administrator' }])).toBe(true);
    expect(canEditTracker([{ name: 'editor' }])).toBe(true);
    expect(canEditTracker([{ name: 'viewer' }])).toBe(false);
    expect(canEditTracker(undefined)).toBe(false);
  });

  it('the public website query never asks for tracker documents', () => {
    expect(SITE_QUERY).not.toContain(TRACKER_TYPE);
    expect(SITE_QUERY).not.toContain('admin-tracker');
    // Every website query filters by its own _type or a fixed _id.
    expect(SITE_QUERY.match(/\*\[(?!_type == "|_id == ")/g)).toBeNull();
  });

  it('checks the build output for every starter item', () => {
    for (const item of SEED_ITEMS) expect(PRIVATE_MARKERS).toEqual(expect.arrayContaining([item.id, item.title]));
    expect(PRIVATE_MARKERS).toEqual(expect.arrayContaining([TRACKER_TYPE, TRACKER_ID_PREFIX, DEMO_STORAGE_KEY]));
  });

  it('has a column for each planning stage', () => {
    expect(COLUMNS).toEqual(['now', 'next', 'later', 'done']);
  });
});
