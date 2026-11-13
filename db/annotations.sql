-- Reviewer comments left on preview builds (see docs/review-annotations.md).
-- Idempotent: applied by `npm run db:migrate`.
create table if not exists review_annotations (
  id          uuid primary key,
  page        text not null,
  quote       text not null,
  target      jsonb not null,
  comment     text not null,
  author      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists review_annotations_page_idx on review_annotations (page, created_at);
