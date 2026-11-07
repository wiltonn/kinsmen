/**
 * LOCAL DEMO store: browser localStorage. Changes are private to this browser
 * and are never sent anywhere. Only imported by the local demo entry
 * (admin-demo/), never by the Studio config or the public website.
 */
import type { TrackerRepository } from './repository';
import { DEMO_STORAGE_KEY, SEED_ITEMS, type TrackerItem } from './model';

export { DEMO_STORAGE_KEY };

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalRepository extends TrackerRepository {
  /** False when browser storage is blocked: edits then last only until refresh. */
  readonly persistent: boolean;
  reset(): Promise<void>;
}

export function createLocalRepository(store: KeyValueStore | undefined, events?: Pick<Window, 'addEventListener' | 'removeEventListener'>): LocalRepository {
  let memory: TrackerItem[] | undefined;
  let persistent = Boolean(store);

  const read = (): TrackerItem[] => {
    if (persistent) {
      try {
        const raw = store!.getItem(DEMO_STORAGE_KEY);
        if (raw) return JSON.parse(raw) as TrackerItem[];
        write(SEED_ITEMS);
        return structuredClone(SEED_ITEMS);
      } catch {
        persistent = false;
      }
    }
    memory ??= structuredClone(SEED_ITEMS);
    return structuredClone(memory);
  };

  const write = (items: TrackerItem[]) => {
    if (persistent) {
      try {
        store!.setItem(DEMO_STORAGE_KEY, JSON.stringify(items));
        return;
      } catch {
        persistent = false;
      }
    }
    memory = structuredClone(items);
  };

  return {
    kind: 'local-demo',
    get persistent() {
      return persistent;
    },
    async list() {
      return read();
    },
    async create(item) {
      const items = read();
      if (items.some((i) => i.id === item.id)) throw new Error(`Item ${item.id} already exists.`);
      write([...items, item]);
    },
    async update(item) {
      write(read().map((i) => (i.id === item.id ? item : i)));
    },
    async addStarterItems(seeds) {
      const items = read();
      const missing = seeds.filter((s) => !items.some((i) => i.id === s.id));
      write([...items, ...missing]);
      return missing.length;
    },
    async reset() {
      try {
        store?.removeItem(DEMO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      memory = undefined;
    },
    subscribe(onChange) {
      // Another tab of the same browser changed the demo data.
      const handler = (e: Event) => {
        if ((e as StorageEvent).key === DEMO_STORAGE_KEY) onChange();
      };
      events?.addEventListener('storage', handler);
      return () => events?.removeEventListener('storage', handler);
    },
  };
}
