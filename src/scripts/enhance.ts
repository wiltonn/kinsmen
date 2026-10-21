/**
 * Progressive enhancements loaded on every page (~2 KB). The site works
 * without JavaScript; this only adds menu toggling and keeps time-sensitive
 * messages accurate if the static build is a few days old.
 */
import { getSeasonView } from '../lib/season';
import type { Season } from '../lib/content/types';

/* ---------- Desktop dropdown menus (disclosure pattern) ---------- */
const disclosures = [...document.querySelectorAll<HTMLElement>('[data-disclosure]')];

function setOpen(item: HTMLElement, open: boolean) {
  const button = item.querySelector<HTMLButtonElement>('[data-disclosure-button]');
  const panel = item.querySelector<HTMLElement>('[data-disclosure-panel]');
  if (!button || !panel) return;
  button.setAttribute('aria-expanded', String(open));
  panel.toggleAttribute('data-open', open);
}

for (const item of disclosures) {
  const button = item.querySelector<HTMLButtonElement>('[data-disclosure-button]');
  button?.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    disclosures.forEach((other) => other !== item && setOpen(other, false));
    setOpen(item, open);
  });
  item.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button?.getAttribute('aria-expanded') === 'true') {
      setOpen(item, false);
      button.focus();
    }
  });
  item.addEventListener('focusout', (event) => {
    if (!item.contains(event.relatedTarget as Node | null)) setOpen(item, false);
  });
}

document.addEventListener('click', (event) => {
  for (const item of disclosures) if (!item.contains(event.target as Node)) setOpen(item, false);
});

/* ---------- Mobile menu ---------- */
const toggle = document.querySelector<HTMLButtonElement>('[data-mobile-toggle]');
const menu = document.querySelector<HTMLElement>('[data-mobile-menu]');
const toggleLabel = document.querySelector<HTMLElement>('[data-mobile-toggle-label]');
if (toggle && menu) {
  toggle.hidden = false;
  const setMenu = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.toggleAttribute('data-open', open);
    if (toggleLabel) toggleLabel.textContent = open ? 'Close' : 'Menu';
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 64rem)').addEventListener('change', (e) => e.matches && setMenu(false));
}

/* ---------- Expired visitor notices ---------- */
for (const notice of document.querySelectorAll<HTMLElement>('[data-expires]')) {
  const expires = Date.parse(notice.dataset.expires ?? '');
  if (!Number.isNaN(expires) && expires <= Date.now()) notice.remove();
}

/* ---------- Season status: re-evaluate against today's date in Toronto ---------- */
for (const el of document.querySelectorAll<HTMLElement>('[data-season-status]')) {
  try {
    const season = JSON.parse(el.dataset.seasonStatus ?? '') as Season;
    const view = getSeasonView(season, new Date());
    if (view.phase === el.dataset.phase) continue;
    el.dataset.phase = view.phase;
    const headline = el.querySelector('[data-season-headline]');
    const detail = el.querySelector('[data-season-detail]');
    if (headline) headline.textContent = view.headline;
    if (detail) detail.textContent = view.detail;
  } catch {
    // Keep the server-rendered message.
  }
}

/* ---------- Highlight today's date in date lists ---------- */
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
for (const row of document.querySelectorAll<HTMLElement>('[data-date-start]')) {
  const start = row.dataset.dateStart!;
  const end = row.dataset.dateEnd || start;
  const isToday = today >= start && today <= end;
  row.toggleAttribute('data-today', isToday);
  const marker = row.querySelector<HTMLElement>('[data-today-marker]');
  if (marker) marker.hidden = !isToday;
}
