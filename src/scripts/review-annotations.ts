/**
 * Reviewer comments on preview builds, using @recogito/text-annotator.
 * Select text in <main> → write a comment → saved to /api/annotations (Neon).
 * Click a highlight to read, edit or delete its comment.
 */
import { createTextAnnotator, type TextAnnotation, type TextAnnotator } from '@recogito/text-annotator';
import { pagePath } from '../lib/navigation';
import { COMMENT_HASH, PRIORITY_LABELS, type ReviewAnnotation } from '../lib/annotations/model';

const API = '/api/annotations';
const NAME_KEY = 'kfsb-reviewer-name';

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage blocked: the name just isn't remembered */
    }
  },
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status}).`);
  return body;
}

/** Stored row → the annotator's model. */
const toTextAnnotation = (a: ReviewAnnotation): TextAnnotation => ({
  id: a.id,
  bodies: [{ id: `${a.id}-comment`, annotation: a.id, purpose: 'commenting', value: a.comment }],
  target: { annotation: a.id, selector: a.target.map((s) => ({ quote: s.quote, start: s.start, end: s.end })) },
});

const dateFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

export function startReviewAnnotations() {
  const container = document.querySelector<HTMLElement>('#main');
  const popup = document.querySelector<HTMLElement>('#review-popup');
  const status = document.querySelector<HTMLElement>('#review-status');
  if (!container || !popup || !status) return;

  const page = pagePath(location.pathname);
  const saved = new Map<string, ReviewAnnotation>();
  const anno: TextAnnotator = createTextAnnotator(container, {
    style: { fill: '#eeb359', fillOpacity: 0.35, underlineColor: '#a6550f', underlineThickness: 2 },
  });

  const newForm = popup.querySelector<HTMLFormElement>('[data-review-new]')!;
  const view = popup.querySelector<HTMLElement>('[data-review-view]')!;
  const editForm = popup.querySelector<HTMLFormElement>('[data-review-edit]')!;
  const viewActions = popup.querySelector<HTMLElement>('[data-review-view-actions]')!;
  let current: string | undefined;

  let statusTimer: number | undefined;
  const say = (message: string) => {
    status.textContent = message;
    status.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => (status.hidden = true), 4000);
  };
  const setError = (scope: HTMLElement, message = '') => {
    popup.querySelectorAll<HTMLElement>('[data-review-error]').forEach((el) => {
      if (scope.contains(el) || el.parentElement === scope) el.textContent = message;
    });
  };
  const busy = (form: HTMLElement, on: boolean) => form.querySelectorAll('button').forEach((b) => (b.disabled = on));

  function place(id: string) {
    // Measure the live highlighted range (viewport coordinates).
    const selector = anno.state.store.getAnnotation(id)?.target.selector.at(-1) as { range?: Range } | undefined;
    const selection = window.getSelection();
    const rect = selector?.range?.getBoundingClientRect() ?? (selection?.rangeCount ? selection.getRangeAt(0).getBoundingClientRect() : undefined);
    popup!.hidden = false;
    if (!rect) return;
    const width = popup!.offsetWidth;
    const left = Math.max(16, Math.min(rect.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - width - 16));
    popup!.style.left = `${left}px`;
    popup!.style.top = `${rect.bottom + window.scrollY + 8}px`;
  }

  function hide() {
    popup!.hidden = true;
    current = undefined;
  }

  /** Drop an unsaved highlight (user cancelled or clicked away). */
  function discardDraft(id: string | undefined) {
    if (id && !saved.has(id)) anno.removeAnnotation(id);
  }

  function showNew(annotation: TextAnnotation) {
    current = annotation.id;
    newForm.hidden = false;
    view.hidden = true;
    setError(newForm);
    newForm.querySelector<HTMLElement>('[data-review-quote]')!.textContent = annotation.target.selector.map((s) => s.quote).join(' … ');
    newForm.comment.value = '';
    newForm.author.value = storage.get(NAME_KEY);
    place(annotation.id);
    newForm.comment.focus();
  }

  function showSaved(a: ReviewAnnotation) {
    current = a.id;
    newForm.hidden = true;
    view.hidden = false;
    editForm.hidden = true;
    viewActions.hidden = false;
    setError(view);
    view.querySelector<HTMLElement>('[data-review-quote]')!.textContent = a.quote;
    view.querySelector<HTMLElement>('[data-review-comment]')!.textContent = a.comment;
    const edited = a.updatedAt !== a.createdAt ? ' (edited)' : '';
    const triage = [a.priority && `${PRIORITY_LABELS[a.priority]} priority`, a.score && `${'★'.repeat(a.score)}${'☆'.repeat(5 - a.score)}`].filter(Boolean);
    view.querySelector<HTMLElement>('[data-review-meta]')!.textContent =
      `${a.author} · ${dateFormat.format(new Date(a.createdAt))}${edited}${triage.length ? ` · ${triage.join(' · ')}` : ''}`;
    place(a.id);
  }

  anno.on('selectionChanged', (selected) => {
    const next = selected[0];
    if (current && current !== next?.id) discardDraft(current);
    if (!next) return hide();
    const stored = saved.get(next.id);
    if (stored) showSaved(stored);
    else showNew(next as TextAnnotation);
  });

  newForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = current;
    const annotation = id ? (anno.getAnnotationById(id) as TextAnnotation | undefined) : undefined;
    if (!id || !annotation) return;
    const author = String(newForm.author.value).trim();
    storage.set(NAME_KEY, author);
    busy(newForm, true);
    try {
      const { annotation: row } = await api<{ annotation: ReviewAnnotation }>(API, {
        method: 'POST',
        body: JSON.stringify({
          id,
          page,
          author,
          comment: newForm.comment.value,
          target: annotation.target.selector.map((s) => ({ quote: s.quote, start: s.start, end: s.end })),
        }),
      });
      saved.set(row.id, row);
      anno.updateAnnotation(toTextAnnotation(row));
      hide();
      anno.cancelSelected();
      say('Comment saved.');
    } catch (e) {
      setError(newForm, (e as Error).message);
    } finally {
      busy(newForm, false);
    }
  });

  newForm.querySelector('[data-review-cancel]')!.addEventListener('click', () => {
    const id = current;
    hide();
    anno.cancelSelected();
    discardDraft(id);
  });

  view.querySelector('[data-review-close]')!.addEventListener('click', () => {
    hide();
    anno.cancelSelected();
  });

  view.querySelector('[data-review-edit-start]')!.addEventListener('click', () => {
    const a = current && saved.get(current);
    if (!a) return;
    editForm.hidden = false;
    viewActions.hidden = true;
    editForm.comment.value = a.comment;
    editForm.comment.focus();
  });

  view.querySelector('[data-review-edit-cancel]')!.addEventListener('click', () => {
    const a = current && saved.get(current);
    if (a) showSaved(a);
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = current;
    if (!id) return;
    busy(editForm, true);
    try {
      const { annotation: row } = await api<{ annotation: ReviewAnnotation }>(`${API}?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ comment: editForm.comment.value }),
      });
      saved.set(row.id, row);
      anno.updateAnnotation(toTextAnnotation(row));
      showSaved(row);
      say('Comment updated.');
    } catch (e) {
      setError(view, (e as Error).message);
    } finally {
      busy(editForm, false);
    }
  });

  view.querySelector('[data-review-delete]')!.addEventListener('click', async (event) => {
    const id = current;
    if (!id || !confirm('Delete this comment for everyone?')) return;
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      await api(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      saved.delete(id);
      hide();
      anno.cancelSelected();
      anno.removeAnnotation(id);
      say('Comment deleted.');
    } catch (e) {
      setError(view, (e as Error).message);
    } finally {
      button.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popup.hidden) {
      const id = current;
      hide();
      anno.cancelSelected();
      discardDraft(id);
    }
  });

  api<{ annotations: ReviewAnnotation[] }>(`${API}?page=${encodeURIComponent(page)}`)
    .then(({ annotations }) => {
      for (const a of annotations) saved.set(a.id, a);
      anno.setAnnotations(annotations.map(toTextAnnotation), true);
      const linked = COMMENT_HASH.exec(location.hash)?.[1]?.toLowerCase();
      const target = linked ? saved.get(linked) : undefined;
      if (target) {
        // Arrived from /comments: scroll to the highlight and open it.
        anno.scrollIntoView(target.id);
        requestAnimationFrame(() => {
          anno.setSelected(target.id);
          if (current !== target.id) showSaved(target);
        });
      } else if (linked) {
        say('That comment was deleted or is on another page.');
      } else if (annotations.length) {
        say(`${annotations.length} reviewer comment${annotations.length === 1 ? '' : 's'} on this page.`);
      }
    })
    .catch((e) => say(`Reviewer comments unavailable: ${(e as Error).message}`));
}
