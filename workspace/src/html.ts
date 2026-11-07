/** Minimal HTML templating with automatic escaping, plus the page layout. */

export class Raw {
  readonly value: string;
  constructor(value: string) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);

type Value = string | number | boolean | null | undefined | Raw | Value[];

const render = (v: Value): string => {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return escape(String(v));
};

/** Tagged template: interpolated values are escaped unless they're Raw (or nested html``). */
export function html(strings: TemplateStringsArray, ...values: Value[]): Raw {
  let out = strings[0];
  values.forEach((v, i) => (out += render(v) + strings[i + 1]));
  return new Raw(out);
}

export const formatDate = (ymd: string) => {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : d.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
};

export interface LayoutContext {
  title: string;
  /** The current workspace: always shown, so admins know where changes land. */
  workspace?: { id: string; name: string; levelLabel: string };
  nav?: { href: string; label: string; current?: boolean }[];
  canSwitch?: boolean;
  signedIn?: boolean;
  signOutPath?: string;
  flash?: string;
  error?: string;
  demo?: { who?: string };
}

const CSS = `
:root{--red:#a6192e;--red-dark:#7d1222;--ink:#1d1d1f;--muted:#55555a;--line:#d9d6d0;--bg:#faf8f5;--card:#fff;--ok:#1f6f43;--ok-bg:#e7f4ec;--warn-bg:#fff4d6;--err:#a3131f;--err-bg:#fde8ea;--focus:#1a5fb4}
@media (prefers-color-scheme:dark){:root{--ink:#f2f2f2;--muted:#b8b8bd;--line:#3a3a3e;--bg:#141416;--card:#1e1e21;--red:#e0485c;--red-dark:#ff7a8a;--ok:#7fd3a0;--ok-bg:#16301f;--warn-bg:#3a3015;--err:#ff8a94;--err-bg:#3b1519;--focus:#8ab4ff}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;font:18px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--red-dark)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.wrap{max-width:860px;margin:0 auto;padding:0 16px}
.demo{background:#3b2a00;color:#ffe9a8;font-size:15px;padding:8px 0}.demo a{color:#fff}
header.top{background:var(--card);border-bottom:1px solid var(--line)}
.bar{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;padding:14px 0}
.where{min-width:0}.where .level{font-size:14px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:0}
.where .name{font-size:22px;font-weight:700;margin:0;line-height:1.25}
.top-actions{display:flex;gap:8px;flex-wrap:wrap}
nav.tabs{display:flex;flex-wrap:wrap;gap:4px;padding:0 0 10px}
nav.tabs a{padding:8px 12px;border-radius:10px;text-decoration:none;color:var(--ink);font-weight:500}
nav.tabs a[aria-current=page]{background:var(--red);color:#fff}
main{padding:20px 0 48px}
h1{font-size:28px;line-height:1.2;margin:0 0 12px}h2{font-size:22px;margin:0 0 10px}h3{font-size:19px;margin:0 0 6px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px;margin:0 0 16px}
.grid{display:grid;gap:16px}@media(min-width:720px){.grid.two{grid-template-columns:1fr 1fr}}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 18px;border-radius:12px;border:2px solid var(--red);background:var(--red);color:#fff;font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn.secondary{background:transparent;color:var(--red-dark)}.btn.small{min-height:40px;padding:6px 12px;font-size:16px}
.btn.danger{background:transparent;color:var(--err);border-color:var(--err)}.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn.block{display:flex;width:100%}
.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.flash{border-radius:12px;padding:14px 16px;margin:0 0 16px;font-weight:600}
.flash.ok{background:var(--ok-bg);color:var(--ok);border:1px solid var(--ok)}
.flash.err{background:var(--err-bg);color:var(--err);border:1px solid var(--err)}
.note{background:var(--warn-bg);border-radius:12px;padding:12px 14px;margin:0 0 16px}
.muted{color:var(--muted)}.small{font-size:15px}
label{display:block;font-weight:600;margin:14px 0 6px}
input[type=text],input[type=email],input[type=url],input[type=date],input[type=tel],select,textarea{width:100%;font:inherit;padding:12px;border:2px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink);min-height:48px}
textarea{min-height:220px}
fieldset{border:0;padding:0;margin:14px 0 0}legend{font-weight:600;margin-bottom:6px}
.choice{display:flex;gap:10px;align-items:flex-start;font-weight:400;margin:8px 0}.choice input{width:22px;height:22px;margin-top:3px}
ul.plain{list-style:none;padding:0;margin:0}ul.plain>li{padding:12px 0;border-top:1px solid var(--line)}ul.plain>li:first-child{border-top:0}
.badge{display:inline-block;font-size:14px;font-weight:600;border-radius:999px;padding:2px 10px;background:var(--bg);border:1px solid var(--line)}
.badge.admin{background:var(--red);color:#fff;border-color:var(--red)}.badge.draft{background:var(--warn-bg)}
.notes-body{white-space:pre-wrap}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px 6px;border-top:1px solid var(--line);vertical-align:top}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}
form.inline{display:inline}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;

export function layout(ctx: LayoutContext, body: Raw): string {
  return (
    '<!doctype html>' +
    html`<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${ctx.title}${ctx.workspace ? ` · ${ctx.workspace.name}` : ''}</title>
<link rel="icon" href="data:,">
<style>${new Raw(CSS)}</style>
</head>
<body>
${ctx.demo ? html`<div class="demo" role="note"><div class="wrap"><strong>Local demo</strong> with fictional people. Nothing is shared or emailed. ${ctx.demo.who ? html`Viewing as <strong>${ctx.demo.who}</strong>. ` : ''}<a href="/__demo">Switch person (developer only)</a></div></div>` : ''}
<header class="top">
  <div class="wrap">
    <div class="bar">
      <div class="where">
        ${ctx.workspace ? html`<p class="level">${ctx.workspace.levelLabel}</p><p class="name">${ctx.workspace.name}</p>` : html`<p class="name">Kin workspace</p>`}
      </div>
      ${ctx.signedIn ? html`<div class="top-actions">
        ${ctx.canSwitch ? html`<a class="btn secondary small" href="/switch">Switch workspace</a>` : ''}
        <a class="btn secondary small" href="${ctx.signOutPath ?? '/sign-out'}">Sign out</a>
      </div>` : ''}
    </div>
    ${ctx.nav?.length ? html`<nav class="tabs" aria-label="Workspace">${ctx.nav.map((n) => html`<a href="${n.href}" ${n.current ? new Raw('aria-current="page"') : ''}>${n.label}</a>`)}</nav>` : ''}
  </div>
</header>
<main class="wrap" id="main">
${ctx.flash ? html`<div class="flash ok" role="status">${ctx.flash}</div>` : ''}
${ctx.error ? html`<div class="flash err" role="alert">${ctx.error}</div>` : ''}
${body}
</main>
</body>
</html>`.value
  );
}
