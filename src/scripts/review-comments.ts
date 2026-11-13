/**
 * /comments: lists every reviewer comment from /api/annotations, with
 * filters, sorting, and triage (priority + 1–5 stars) saved via PUT.
 * Builds DOM with textContent only — comment text is untrusted input.
 */
import {
  commentLink,
  sortAnnotations,
  type Priority,
  type ReviewAnnotation,
  type SortKey,
} from '../lib/annotations/model';

const API = '/api/annotations';
const SORT_KEY = 'kfsb-comments-sort';
const dateFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

const remember = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* not remembered */
    }
  },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

export function startCommentsPage() {
  const root = document.querySelector<HTMLElement>('[data-comments-app]');
  const template = document.querySelector<HTMLTemplateElement>('#comment-card');
  if (!root || !template) return;
  const list = root.querySelector<HTMLOListElement>('[data-list]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const summary = root.querySelector<HTMLElement>('[data-summary]')!;
  const pageFilter = root.querySelector<HTMLSelectElement>('[data-filter-page]')!;
  const priorityFilter = root.querySelector<HTMLSelectElement>('[data-filter-priority]')!;
  const sortSelect = root.querySelector<HTMLSelectElement>('[data-sort]')!;

  const saved = remember.get(SORT_KEY);
  if (saved && [...sortSelect.options].some((o) => o.value === saved)) sortSelect.value = saved;

  let all: ReviewAnnotation[] = [];

  function visible() {
    const page = pageFilter.value;
    const priority = priorityFilter.value;
    const filtered = all.filter(
      (a) => (!page || a.page === page) && (!priority || (priority === 'none' ? a.priority === null : a.priority === priority)),
    );
    return sortAnnotations(filtered, sortSelect.value as SortKey);
  }

  function updateSummary(shown: number) {
    const triaged = all.filter((a) => a.priority || a.score).length;
    const high = all.filter((a) => a.priority === 'high').length;
    summary.textContent =
      `${shown === all.length ? `${all.length}` : `${shown} of ${all.length}`} comment${all.length === 1 ? '' : 's'}` +
      ` · ${high} high priority · ${all.length - triaged} not yet triaged`;
  }

  async function save(a: ReviewAnnotation, changes: { priority?: Priority | null; score?: number | null }, card: HTMLElement) {
    const before = { priority: a.priority, score: a.score };
    Object.assign(a, changes);
    const error = card.querySelector<HTMLElement>('[data-error]')!;
    error.textContent = '';
    paintTriage(card, a);
    try {
      const { annotation } = await api<{ annotation: ReviewAnnotation }>(`${API}?id=${encodeURIComponent(a.id)}`, {
        method: 'PUT',
        body: JSON.stringify(changes),
      });
      Object.assign(a, annotation);
    } catch (e) {
      Object.assign(a, before);
      error.textContent = `Not saved: ${(e as Error).message}`;
    }
    paintTriage(card, a);
    updateSummary(visible().length);
  }

  function paintTriage(card: HTMLElement, a: ReviewAnnotation) {
    card.dataset.priority = a.priority ?? '';
    card.querySelector<HTMLSelectElement>('[data-priority]')!.value = a.priority ?? '';
    card.querySelectorAll<HTMLButtonElement>('[data-star]').forEach((star) => {
      const n = Number(star.dataset.star);
      const on = a.score !== null && n <= a.score;
      star.toggleAttribute('data-on', on);
      star.textContent = on ? '★' : '☆';
      star.setAttribute('aria-pressed', String(a.score === n));
    });
    card.querySelector<HTMLElement>('[data-score-label]')!.textContent = a.score ? `Score ${a.score}/5` : 'Score';
  }

  function card(a: ReviewAnnotation): HTMLElement {
    const li = (template!.content.firstElementChild as HTMLElement).cloneNode(true) as HTMLElement;
    const open = li.querySelector<HTMLAnchorElement>('[data-open]')!;
    open.href = commentLink(a);
    open.textContent = `Open on ${a.page === '/' ? 'the home page' : a.page}`;
    li.querySelector('[data-quote]')!.textContent = a.quote;
    li.querySelector('[data-comment]')!.textContent = a.comment;
    li.querySelector('[data-meta]')!.textContent =
      `${a.author} · ${dateFormat.format(new Date(a.createdAt))}${a.updatedAt !== a.createdAt ? ' (edited)' : ''}`;

    const select = li.querySelector<HTMLSelectElement>('[data-priority]')!;
    select.setAttribute('aria-label', `Priority for comment by ${a.author}`);
    select.addEventListener('change', () => save(a, { priority: (select.value || null) as Priority | null }, li));

    const stars = li.querySelector<HTMLElement>('[data-stars]')!;
    stars.setAttribute('aria-label', `Score for comment by ${a.author}`);
    for (let n = 1; n <= 5; n++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'comment-star';
      star.dataset.star = String(n);
      star.textContent = '★';
      star.title = `${n} star${n === 1 ? '' : 's'} (click again to clear)`;
      star.setAttribute('aria-label', `${n} star${n === 1 ? '' : 's'}`);
      // Clicking the current score clears it.
      star.addEventListener('click', () => save(a, { score: a.score === n ? null : n }, li));
      stars.append(star);
    }
    paintTriage(li, a);
    return li;
  }

  function render() {
    const shown = visible();
    list.replaceChildren(...shown.map(card));
    empty.classList.toggle('hidden', shown.length > 0);
    empty.textContent = all.length
      ? 'No comments match these filters.'
      : 'No comments yet. Select any text on a page to leave the first one.';
    updateSummary(shown.length);
  }

  pageFilter.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);
  sortSelect.addEventListener('change', () => {
    remember.set(SORT_KEY, sortSelect.value);
    render();
  });

  api<{ annotations: ReviewAnnotation[] }>(API)
    .then(({ annotations }) => {
      all = annotations;
      const pages = [...new Set(all.map((a) => a.page))].sort();
      pageFilter.append(...pages.map((p) => new Option(`${p} (${all.filter((a) => a.page === p).length})`, p)));
      render();
    })
    .catch((e) => {
      summary.textContent = '';
      empty.textContent = `Comments couldn't be loaded: ${(e as Error).message}`;
      empty.classList.remove('hidden');
    });
}
