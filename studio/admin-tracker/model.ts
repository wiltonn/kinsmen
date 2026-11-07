/**
 * Website Admin tracker: the data model, pure functions and seed items.
 *
 * No Sanity or browser imports here, so the same rules run in the Studio tool,
 * the local demo, the root unit tests and the post-build privacy check.
 */

export const COLUMNS = ['now', 'next', 'later', 'done'] as const;
export type Column = (typeof COLUMNS)[number];

export const COLUMN_LABELS: Record<Column, string> = {
  now: 'Now',
  next: 'Up next',
  later: 'Later',
  done: 'Done',
};

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Sanity document type and ID namespace for tracker items. */
export const TRACKER_TYPE = 'adminTrackerItem';
/**
 * Every tracker document ID starts with this prefix. Sanity treats any ID that
 * contains a dot as private ("in a path"): it can only be read by a logged-in
 * project member or with a token, even in a public dataset.
 * https://www.sanity.io/docs/content-lake/ids
 */
export const TRACKER_ID_PREFIX = 'admin-tracker.';

/** localStorage key for the LOCAL DEMO only (see localRepository.ts). */
export const DEMO_STORAGE_KEY = 'kfsb-admin-tracker-demo:v1';

export interface TrackerItem {
  /** Stable, human-readable ID (e.g. "t-8k2m4q"). Never changes after creation. */
  id: string;
  title: string;
  description: string;
  column: Column;
  priority?: Priority;
  /** True for starter items whose priority hasn't been set by a person yet. */
  priorityIllustrative?: boolean;
  owner?: string;
  /** YYYY-MM-DD */
  targetDate?: string;
  /** Non-empty means blocked. The item stays in its planning column. */
  blocker?: string;
  sourceUrl?: string;
  /**
   * Optional reference to a launch-checklist requirement (its slug, see
   * `checklistSlug`). Informational only: moving the item to Done never ticks
   * the requirement. Requirements are ticked in docs/launch-checklist.md.
   */
  checklistRef?: string;
  createdAt: string;
  updatedAt: string;
}

export type TrackerDraft = Omit<TrackerItem, 'id' | 'createdAt' | 'updatedAt'>;

export const isBlocked = (item: TrackerItem) => Boolean(item.blocker && item.blocker.trim());

const ID_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Short random ID. Random rather than sequential so two reviewers can't collide. */
export function newItemId(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)];
  return `t-${s}`;
}

export const documentId = (itemId: string) => `${TRACKER_ID_PREFIX}${itemId}`;

export interface ValidationIssue {
  field: keyof TrackerItem;
  message: string;
}

export function validateItem(item: Partial<TrackerItem>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!item.id || !/^[a-z0-9-]{3,40}$/.test(item.id)) issues.push({ field: 'id', message: 'ID must be 3–40 lowercase letters, digits or hyphens.' });
  if (!item.title?.trim()) issues.push({ field: 'title', message: 'Add a title.' });
  else if (item.title.length > 120) issues.push({ field: 'title', message: 'Keep the title under 120 characters.' });
  if ((item.description ?? '').length > 600) issues.push({ field: 'description', message: 'Keep the description short (under 600 characters).' });
  if (!item.column || !COLUMNS.includes(item.column)) issues.push({ field: 'column', message: 'Choose a column.' });
  if (item.priority && !PRIORITIES.includes(item.priority)) issues.push({ field: 'priority', message: 'Unknown priority.' });
  if (item.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.targetDate)) issues.push({ field: 'targetDate', message: 'Use a date like 2027-01-31.' });
  if (item.sourceUrl) {
    try {
      const u = new URL(item.sourceUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    } catch {
      issues.push({ field: 'sourceUrl', message: 'Source link must be a full web address (https://…).' });
    }
  }
  return issues;
}

const clean = (s: string | undefined) => (s && s.trim() ? s.trim() : undefined);

export function createItem(draft: TrackerDraft, now: Date, id = newItemId()): TrackerItem {
  const ts = now.toISOString();
  return normalize({ ...draft, id, createdAt: ts, updatedAt: ts });
}

/** Apply a change. Changing the priority removes the "illustrative" label. */
export function updateItem(item: TrackerItem, changes: Partial<TrackerDraft>, now: Date): TrackerItem {
  const next: TrackerItem = { ...item, ...changes, id: item.id, createdAt: item.createdAt, updatedAt: now.toISOString() };
  if ('priority' in changes && changes.priority !== item.priority) next.priorityIllustrative = false;
  return normalize(next);
}

export const moveItem = (item: TrackerItem, column: Column, now: Date) => updateItem(item, { column }, now);
export const setBlocker = (item: TrackerItem, reason: string, now: Date) => updateItem(item, { blocker: reason }, now);
export const clearBlocker = (item: TrackerItem, now: Date) => updateItem(item, { blocker: undefined }, now);

function normalize(item: TrackerItem): TrackerItem {
  const out: TrackerItem = {
    id: item.id,
    title: item.title.trim(),
    description: (item.description ?? '').trim(),
    column: item.column,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
  if (item.priority) out.priority = item.priority;
  if (item.priority && item.priorityIllustrative) out.priorityIllustrative = true;
  for (const key of ['owner', 'targetDate', 'blocker', 'sourceUrl', 'checklistRef'] as const) {
    const v = clean(item[key]);
    if (v) out[key] = v;
  }
  return out;
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Blocked first, then by priority, then most recently updated. */
export function sortItems(items: TrackerItem[]): TrackerItem[] {
  return [...items].sort(
    (a, b) =>
      Number(isBlocked(b)) - Number(isBlocked(a)) ||
      (a.priority ? PRIORITY_ORDER[a.priority] : 3) - (b.priority ? PRIORITY_ORDER[b.priority] : 3) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );
}

export interface TrackerSummary {
  counts: Record<Column, number>;
  blocked: TrackerItem[];
}

export function summarize(items: TrackerItem[]): TrackerSummary {
  const counts = { now: 0, next: 0, later: 0, done: 0 } as Record<Column, number>;
  for (const i of items) counts[i.column]++;
  // A blocker on a Done item is history, not a current blocker.
  return { counts, blocked: sortItems(items.filter((i) => isBlocked(i) && i.column !== 'done')) };
}

// ---------------------------------------------------------------------------
// Launch checklist (read-only; docs/launch-checklist.md is the authority)
// ---------------------------------------------------------------------------

export interface ChecklistEntry {
  slug: string;
  text: string;
  section: string;
  done: boolean;
}

export interface ChecklistProgress {
  total: number;
  done: number;
  sections: { title: string; total: number; done: number }[];
  entries: ChecklistEntry[];
}

/** Requirement wording without Markdown links, code ticks or emphasis. */
export const plainText = (markdown: string) => markdown.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '');

/** Stable slug from the requirement's wording (Markdown links and code stripped). */
export function checklistSlug(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/** Parse GitHub-style task list items (`- [ ]` / `- [x]`), including wrapped lines. */
export function parseChecklist(markdown: string): ChecklistProgress {
  const entries: ChecklistEntry[] = [];
  let section = '';
  let current: ChecklistEntry | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^#{2,6}\s+(.+?)\s*$/.exec(line);
    const task = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line);
    if (heading) {
      section = heading[1];
      current = undefined;
    } else if (task) {
      current = { slug: '', text: task[2].trim(), section, done: task[1].toLowerCase() === 'x' };
      entries.push(current);
    } else if (current && /^\s{2,}\S/.test(line)) {
      current.text += ' ' + line.trim();
    } else {
      current = undefined;
    }
  }
  for (const e of entries) e.slug = checklistSlug(e.text);
  const sections: ChecklistProgress['sections'] = [];
  for (const e of entries) {
    let s = sections.find((x) => x.title === e.section);
    if (!s) sections.push((s = { title: e.section, total: 0, done: 0 }));
    s.total++;
    if (e.done) s.done++;
  }
  return { total: entries.length, done: entries.filter((e) => e.done).length, sections, entries };
}

// ---------------------------------------------------------------------------
// Starter items (taken from the repo's own docs; no invented owners or dates)
// ---------------------------------------------------------------------------

export const REPO_URL = 'https://github.com/wiltonn/kinsmen';
const docUrl = (path: string) => `${REPO_URL}/blob/main/${path}`;

export const SEED_CREATED_AT = '2026-11-07T00:00:00.000Z';

type SeedInput = Omit<TrackerItem, 'createdAt' | 'updatedAt' | 'priorityIllustrative'>;

const seed = (s: SeedInput): TrackerItem => ({
  ...s,
  priorityIllustrative: Boolean(s.priority),
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_CREATED_AT,
});

/**
 * Starter items. Priorities are illustrative (shown with an "Illustrative"
 * label until someone changes them). No owners or target dates are invented.
 */
export const SEED_ITEMS: TrackerItem[] = [
  seed({
    id: 'seed-connect-sanity',
    title: 'Connect the website to Sanity',
    description:
      'Create the Sanity project, set SANITY_PROJECT_ID on Cloudflare Pages, and import the migrated content so the site stops using development fixtures.',
    column: 'now',
    priority: 'high',
    sourceUrl: docUrl('docs/launch-checklist.md'),
    checklistRef: 'create-the-sanity-project-free-plan-is-enough-record-the-pro',
  }),
  seed({
    id: 'seed-opentable-url',
    title: 'Confirm the Pancake House booking URL',
    description: 'Get the official OpenTable booking link (and optional widget address) from the OpenTable administrator.',
    column: 'next',
    priority: 'high',
    blocker: 'Waiting for the OpenTable administrator to supply the booking link.',
    sourceUrl: docUrl('docs/opentable-setup.md'),
    checklistRef: 'get-the-opentable-booking-url-and-optional-widget-src-from-t',
  }),
  seed({
    id: 'seed-season-content',
    title: 'Review season content',
    description:
      'Confirm season dates, hours, prices and the menu, then mark each item Confirmed in Studio. Individual confirmations stay in the content-review workflow.',
    column: 'next',
    priority: 'medium',
    sourceUrl: docUrl('docs/content-checklist.md'),
  }),
  seed({
    id: 'seed-mobile-qa',
    title: 'Run mobile QA on the preview site',
    description: 'Check every page at phone (~375 px) and desktop widths, including the menu and keyboard focus.',
    column: 'later',
    priority: 'medium',
    sourceUrl: docUrl('docs/launch-checklist.md'),
    checklistRef: 'every-page-at-phone-375-px-and-desktop-1440-px-widths-menu-o',
  }),
  seed({
    id: 'seed-inline-feedback',
    title: 'Evaluate inline feedback on staging',
    description: 'Feature idea: let reviewers leave comments directly on the staging site. Not started; needs a decision first.',
    column: 'later',
    priority: 'low',
  }),
];

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/**
 * Who may change tracker items, by Sanity project role. Sanity enforces the
 * same thing server-side (Viewers can't write), so this only hides controls.
 * Free plan roles: Administrator, Viewer. Growth adds Editor, Developer, Contributor.
 */
export const TRACKER_EDIT_ROLES = ['administrator', 'editor', 'developer'];

export const canEditTracker = (roles: { name: string }[] | undefined) =>
  Boolean(roles?.some((r) => TRACKER_EDIT_ROLES.includes(r.name)));

// ---------------------------------------------------------------------------
// Privacy check
// ---------------------------------------------------------------------------

/**
 * Strings that must never appear in the public website's build output
 * (checked by scripts/check-private-data.mjs after every `npm run build`).
 */
export const PRIVATE_MARKERS: string[] = [
  TRACKER_TYPE,
  TRACKER_ID_PREFIX,
  DEMO_STORAGE_KEY,
  'Website Admin',
  ...SEED_ITEMS.flatMap((i) => [i.id, i.title]),
];
