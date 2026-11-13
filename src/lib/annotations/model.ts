/**
 * Reviewer annotations: the shape stored in Neon and exchanged with the
 * browser, plus validation. Pure, so it can be shared by the Vercel function,
 * the dev server and tests.
 */

export const LIMITS = { comment: 2000, author: 80, quote: 2000, target: 20_000, body: 32_000 } as const;

/** A highlighted text range, as recorded by @recogito/text-annotator. */
export interface StoredSelector {
  quote: string;
  start: number;
  end: number;
}

export interface ReviewAnnotation {
  id: string;
  page: string;
  quote: string;
  target: StoredSelector[];
  comment: string;
  author: string;
  /** Triage, set on the /comments page; null until someone sets it. */
  priority: Priority | null;
  /** 1–5 stars; null until someone scores it. */
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

export type NewAnnotation = Pick<ReviewAnnotation, 'id' | 'page' | 'target' | 'comment' | 'author'>;

/** The all-comments page (preview builds only). */
export const COMMENTS_PATH = '/comments';
/** Link to a comment in place: the page opens it from the hash. */
export const commentLink = (a: Pick<ReviewAnnotation, 'page' | 'id'>) => `${a.page}#comment-${a.id}`;
export const COMMENT_HASH = /^#comment-([0-9a-f-]{36})$/i;

export const PRIORITIES = ['high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export class ValidationError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Site pages only: "/", "/visit", "/kinsmen/get-involved". */
const PAGE = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

export function isAnnotationsEnabled(env: Record<string, string | undefined>): boolean {
  return (env.SITE_ENV ?? '').trim().toLowerCase() !== 'production';
}

export function checkId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ValidationError('Invalid annotation id.');
  return value.toLowerCase();
}

export function checkPage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 200 || !PAGE.test(value)) throw new ValidationError('Invalid page.');
  return value;
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new ValidationError(`${field} is required.`);
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${field} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return trimmed;
}

export const checkComment = (v: unknown) => text(v, 'Comment', LIMITS.comment);
export const checkAuthor = (v: unknown) => text(v, 'Name', LIMITS.author);

export function checkTarget(value: unknown): StoredSelector[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) throw new ValidationError('Invalid highlight.');
  const selectors = value.map((s): StoredSelector => {
    const { quote, start, end } = (s ?? {}) as Record<string, unknown>;
    if (typeof quote !== 'string' || !quote.trim() || quote.length > LIMITS.quote) throw new ValidationError('Invalid highlight.');
    if (!Number.isInteger(start) || !Number.isInteger(end) || (start as number) < 0 || (end as number) <= (start as number)) {
      throw new ValidationError('Invalid highlight.');
    }
    return { quote, start: start as number, end: end as number };
  });
  if (JSON.stringify(selectors).length > LIMITS.target) throw new ValidationError('Highlight is too long.');
  return selectors;
}

export function checkNew(body: unknown): NewAnnotation {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    id: checkId(b.id),
    page: checkPage(b.page),
    target: checkTarget(b.target),
    comment: checkComment(b.comment),
    author: checkAuthor(b.author),
  };
}

export const quoteOf = (target: StoredSelector[]) => target.map((s) => s.quote).join(' … ').slice(0, LIMITS.quote);

/** Fields a PUT may change. Omitted fields are left as they are; null clears priority/score. */
export interface AnnotationChanges {
  comment?: string;
  priority?: Priority | null;
  score?: number | null;
}

export function checkChanges(body: unknown): AnnotationChanges {
  const b = (body ?? {}) as Record<string, unknown>;
  const changes: AnnotationChanges = {};
  if ('comment' in b) changes.comment = checkComment(b.comment);
  if ('priority' in b) {
    if (b.priority !== null && !PRIORITIES.includes(b.priority as Priority)) throw new ValidationError('Priority must be high, medium or low.');
    changes.priority = b.priority as Priority | null;
  }
  if ('score' in b) {
    if (b.score !== null && !(Number.isInteger(b.score) && (b.score as number) >= 1 && (b.score as number) <= 5)) {
      throw new ValidationError('Score must be a whole number from 1 to 5.');
    }
    changes.score = b.score as number | null;
  }
  if (!Object.keys(changes).length) throw new ValidationError('Nothing to change.');
  return changes;
}

export type SortKey = 'priority' | 'score' | 'newest' | 'page';
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const rank = (a: ReviewAnnotation) => PRIORITY_RANK[a.priority ?? ''] ?? 3;
const newestFirst = (a: ReviewAnnotation, b: ReviewAnnotation) => b.createdAt.localeCompare(a.createdAt);
const byScore = (a: ReviewAnnotation, b: ReviewAnnotation) => (b.score ?? 0) - (a.score ?? 0);

/** Triage order. "priority": High → Low → unset, then score, then newest. */
export function sortAnnotations(list: ReviewAnnotation[], key: SortKey): ReviewAnnotation[] {
  const compare: Record<SortKey, (a: ReviewAnnotation, b: ReviewAnnotation) => number> = {
    priority: (a, b) => rank(a) - rank(b) || byScore(a, b) || newestFirst(a, b),
    score: (a, b) => byScore(a, b) || rank(a) - rank(b) || newestFirst(a, b),
    newest: newestFirst,
    page: (a, b) => a.page.localeCompare(b.page) || rank(a) - rank(b) || newestFirst(a, b),
  };
  return [...list].sort(compare[key]);
}
