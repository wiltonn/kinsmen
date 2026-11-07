/**
 * Production store: tracker items are Sanity documents in the Studio's own
 * project, written directly (no drafts, no publish step).
 *
 * Privacy: every document ID is `admin-tracker.<id>`. Sanity never serves
 * dotted IDs to unauthenticated requests, even from a public dataset, so the
 * public website build (which has no token) cannot read them. The website's
 * GROQ queries also only ask for its own document types.
 */
import { ConflictError, type TrackerRepository } from './repository';
import { COLUMNS, TRACKER_ID_PREFIX, TRACKER_TYPE, documentId, validateItem, type TrackerItem } from './model';

/** The small part of @sanity/client this store uses (keeps it testable with a fake). */
export interface TrackerClient {
  fetch<R>(query: string, params?: Record<string, unknown>): Promise<R>;
  create(doc: { _id: string; _type: string }): Promise<unknown>;
  createIfNotExists(doc: { _id: string; _type: string }): Promise<unknown>;
  patch(id: string): {
    ifRevisionId(rev: string): ReturnType<TrackerClient['patch']>;
    set(attrs: Record<string, unknown>): ReturnType<TrackerClient['patch']>;
    unset(attrs: string[]): ReturnType<TrackerClient['patch']>;
    commit(): Promise<unknown>;
  };
  listen(query: string, params?: Record<string, unknown>, options?: Record<string, unknown>): {
    subscribe(observer: { next?: () => void; error?: (e: unknown) => void } | (() => void)): { unsubscribe(): void };
  };
}

export const TRACKER_QUERY = `*[_type == $type && _id in path($path)]`;
const PARAMS = { type: TRACKER_TYPE, path: `${TRACKER_ID_PREFIX}**` };
const OPTIONAL_FIELDS = ['priority', 'priorityIllustrative', 'owner', 'targetDate', 'blocker', 'sourceUrl', 'checklistRef'] as const;

type TrackerDoc = TrackerItem & { _id: string; _type: string; _rev?: string };

export function toDocument(item: TrackerItem): TrackerDoc {
  return { ...item, _id: documentId(item.id), _type: TRACKER_TYPE };
}

export function fromDocument(doc: Partial<TrackerDoc>): TrackerItem | undefined {
  const item: TrackerItem = {
    id: doc.id ?? '',
    title: doc.title ?? '',
    description: doc.description ?? '',
    column: doc.column as TrackerItem['column'],
    createdAt: doc.createdAt ?? '',
    updatedAt: doc.updatedAt ?? doc.createdAt ?? '',
  };
  for (const f of OPTIONAL_FIELDS) if (doc[f] !== undefined && doc[f] !== null) (item as unknown as Record<string, unknown>)[f] = doc[f];
  // Skip anything malformed or outside the private ID namespace.
  if (doc._id !== documentId(item.id) || !COLUMNS.includes(item.column) || validateItem(item).length) return undefined;
  return item;
}

const isConflict = (e: unknown) => {
  const status = (e as { statusCode?: number })?.statusCode;
  return status === 409 || /revision|mismatch/i.test(String((e as Error)?.message));
};

export function createSanityRepository(client: TrackerClient): TrackerRepository {
  const revisions = new Map<string, string>();

  return {
    kind: 'sanity',
    async list() {
      const docs = await client.fetch<TrackerDoc[]>(TRACKER_QUERY, PARAMS);
      revisions.clear();
      const items: TrackerItem[] = [];
      for (const doc of docs) {
        const item = fromDocument(doc);
        if (!item) continue;
        if (doc._rev) revisions.set(item.id, doc._rev);
        items.push(item);
      }
      return items;
    },
    async create(item) {
      await client.create(toDocument(item));
    },
    async update(item) {
      const rev = revisions.get(item.id);
      const doc = toDocument(item);
      const set: Record<string, unknown> = { title: doc.title, description: doc.description, column: doc.column, updatedAt: doc.updatedAt };
      const unset: string[] = [];
      for (const f of OPTIONAL_FIELDS) {
        if (doc[f] === undefined) unset.push(f);
        else set[f] = doc[f];
      }
      let patch = client.patch(doc._id);
      if (rev) patch = patch.ifRevisionId(rev);
      try {
        await patch.set(set).unset(unset).commit();
      } catch (e) {
        if (isConflict(e)) throw new ConflictError();
        throw e;
      }
    },
    async addStarterItems(items) {
      const existing = new Set((await this.list()).map((i) => i.id));
      const missing = items.filter((i) => !existing.has(i.id));
      for (const item of missing) await client.createIfNotExists(toDocument(item));
      return missing.length;
    },
    subscribe(onChange) {
      // Live updates so a second reviewer sees changes without refreshing.
      const sub = client.listen(TRACKER_QUERY, PARAMS, { visibility: 'query', includeResult: false }).subscribe({
        next: () => onChange(),
        error: () => undefined,
      });
      return () => sub.unsubscribe();
    },
  };
}
