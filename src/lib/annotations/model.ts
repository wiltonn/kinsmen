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
  createdAt: string;
  updatedAt: string;
}

export type NewAnnotation = Pick<ReviewAnnotation, 'id' | 'page' | 'target' | 'comment' | 'author'>;

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
