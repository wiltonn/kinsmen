import type { TrackerItem } from './model';

/** Where tracker items are stored. The UI only talks to this interface. */
export interface TrackerRepository {
  /** "sanity": shared, authoritative store. "local-demo": this browser only. */
  readonly kind: 'sanity' | 'local-demo';
  list(): Promise<TrackerItem[]>;
  create(item: TrackerItem): Promise<void>;
  /** Fails with a ConflictError if someone else changed the item since it was loaded. */
  update(item: TrackerItem): Promise<void>;
  /** Adds any starter items that don't exist yet. Returns how many were added. */
  addStarterItems(items: TrackerItem[]): Promise<number>;
  /** Called when items change elsewhere (another reviewer, another tab). Returns an unsubscribe. */
  subscribe(onChange: () => void): () => void;
}

export class ConflictError extends Error {
  constructor() {
    super('Someone else changed this item while you were editing. The latest version has been loaded; please try again.');
    this.name = 'ConflictError';
  }
}
