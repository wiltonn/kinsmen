/**
 * Website Admin: the "What's planned / What's coming" tracker UI.
 * Rendered inside Sanity Studio (as a tool) and by the local demo.
 * It only talks to a TrackerRepository, so it doesn't know which store it uses.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Box, Button, Card, Container, Dialog, Flex, Grid, Heading, Inline, Label, Select, Stack, Tab, TabList, TabPanel, Text, TextArea, TextInput } from '@sanity/ui';
import {
  COLUMNS,
  COLUMN_LABELS,
  PRIORITIES,
  createItem,
  isBlocked,
  moveItem,
  parseChecklist,
  plainText,
  sortItems,
  summarize,
  updateItem,
  validateItem,
  SEED_ITEMS,
  clearBlocker,
  setBlocker,
  type ChecklistEntry,
  type Column,
  type TrackerDraft,
  type TrackerItem,
} from './model';
import { ConflictError, type TrackerRepository } from './repository';

export interface TrackerAppProps {
  repository: TrackerRepository;
  /** Raw docs/launch-checklist.md, bundled at build time. */
  checklistMarkdown: string;
  checklistSourceUrl: string;
  /** The existing /dev/content-review screen on the preview site, if known. */
  contentReviewUrl?: string;
  canEdit: boolean;
  /** Shown above everything, e.g. the local-demo warning. */
  banner?: ReactNode;
  /** Extra controls for the header (e.g. "Reset demo"). */
  headerActions?: ReactNode;
}

type TabId = Column | 'checklist' | 'review';
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const;
const PRIORITY_TONE = { high: 'critical', medium: 'caution', low: 'default' } as const;

export function TrackerApp(props: TrackerAppProps) {
  const { repository, canEdit } = props;
  const [items, setItems] = useState<TrackerItem[] | undefined>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [tab, setTab] = useState<TabId>('now');
  const [editing, setEditing] = useState<TrackerItem | 'new' | undefined>();
  const [blocking, setBlocking] = useState<TrackerItem | undefined>();

  const checklist = useMemo(() => parseChecklist(props.checklistMarkdown), [props.checklistMarkdown]);

  const reload = useCallback(async () => {
    try {
      setItems(await repository.list());
      setError(undefined);
    } catch (e) {
      setError(`Couldn't load the tracker: ${(e as Error).message}`);
    }
  }, [repository]);

  useEffect(() => {
    void reload();
    return repository.subscribe(() => void reload());
  }, [repository, reload]);

  const save = async (next: TrackerItem, isNew: boolean, message: string) => {
    try {
      if (isNew) await repository.create(next);
      else await repository.update(next);
      setStatus(message);
      setError(undefined);
    } catch (e) {
      setError(e instanceof ConflictError ? e.message : `Couldn't save: ${(e as Error).message}`);
    }
    await reload();
  };

  const move = (item: TrackerItem, column: Column) => {
    const ref = item.checklistRef && checklist.entries.find((e) => e.slug === item.checklistRef);
    const note = column === 'done' && ref ? ' The linked launch-checklist requirement is unchanged; tick it in docs/launch-checklist.md once it is actually met.' : '';
    void save(moveItem(item, column, new Date()), false, `Moved “${item.title}” to ${COLUMN_LABELS[column]}.${note}`);
  };

  if (!items) {
    return (
      <Shell {...props}>
        <Card padding={4} tone={error ? 'critical' : 'transparent'} radius={2}>
          <Text>{error ?? 'Loading the tracker…'}</Text>
        </Card>
      </Shell>
    );
  }

  const summary = summarize(items);
  const byColumn = (c: Column) => sortItems(items.filter((i) => i.column === c));

  return (
    <Shell {...props}>
      <Stack gap={5}>
        <Grid gridTemplateColumns={[2, 2, 5]} gap={3} as="section" aria-label="Summary">
          {COLUMNS.map((c) => (
            <SummaryCard key={c} label={COLUMN_LABELS[c]} count={summary.counts[c]} />
          ))}
          <SummaryCard label="Blocked" count={summary.blocked.length} tone={summary.blocked.length ? 'critical' : 'default'} />
        </Grid>

        {summary.blocked.length > 0 && (
          <Card padding={4} radius={2} tone="critical" border as="section" aria-labelledby="blocked-heading">
            <Stack gap={3}>
              <Heading as="h2" size={1} id="blocked-heading">
                Blocked
              </Heading>
              {summary.blocked.map((i) => (
                <Text key={i.id} size={1}>
                  <strong>{i.title}</strong> ({COLUMN_LABELS[i.column]}): {i.blocker}
                </Text>
              ))}
            </Stack>
          </Card>
        )}

        {(status || error) && (
          <Card padding={3} radius={2} tone={error ? 'critical' : 'positive'} role="status" aria-live="polite">
            <Text size={1}>{error ?? status}</Text>
          </Card>
        )}

        <Stack gap={3}>
          <Flex gap={2} wrap="wrap" align="center" justify="space-between">
            <TabList gap={1}>
              {[
                ...COLUMNS.map((c) => (
                  <Tab key={c} id={`tab-${c}`} aria-controls={`panel-${c}`} label={`${COLUMN_LABELS[c]} (${summary.counts[c]})`} selected={tab === c} onClick={() => setTab(c)} />
                )),
                <Tab key="checklist" id="tab-checklist" aria-controls="panel-checklist" label={`Launch checklist (${checklist.done}/${checklist.total})`} selected={tab === 'checklist'} onClick={() => setTab('checklist')} />,
                <Tab key="review" id="tab-review" aria-controls="panel-review" label="Content review" selected={tab === 'review'} onClick={() => setTab('review')} />,
              ]}
            </TabList>
            {canEdit && <Button text="New item" tone="primary" onClick={() => setEditing('new')} />}
          </Flex>

          {COLUMNS.map((c) => (
            <TabPanel key={c} id={`panel-${c}`} aria-labelledby={`tab-${c}`} hidden={tab !== c}>
              <Stack gap={3}>
                {byColumn(c).length === 0 && (
                  <Card padding={4} radius={2} border>
                    <Text muted>Nothing in {COLUMN_LABELS[c]}.</Text>
                  </Card>
                )}
                {byColumn(c).map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    checklistEntry={checklist.entries.find((e) => e.slug === item.checklistRef)}
                    canEdit={canEdit}
                    onMove={(col) => move(item, col)}
                    onEdit={() => setEditing(item)}
                    onBlock={() => setBlocking(item)}
                    onClearBlocker={() => void save(clearBlocker(item, new Date()), false, `Cleared the blocker on “${item.title}”.`)}
                  />
                ))}
              </Stack>
            </TabPanel>
          ))}

          <TabPanel id="panel-checklist" aria-labelledby="tab-checklist" hidden={tab !== 'checklist'}>
            <ChecklistPanel checklist={checklist} sourceUrl={props.checklistSourceUrl} />
          </TabPanel>
          <TabPanel id="panel-review" aria-labelledby="tab-review" hidden={tab !== 'review'}>
            <ReviewPanel url={props.contentReviewUrl} />
          </TabPanel>
        </Stack>

        {items.length === 0 && canEdit && (
          <Card padding={4} radius={2} border>
            <Stack gap={3}>
              <Text>The tracker is empty.</Text>
              <Box>
                <Button
                  text="Add starter items"
                  mode="ghost"
                  onClick={async () => {
                    const n = await repository.addStarterItems(SEED_ITEMS);
                    setStatus(`Added ${n} starter item(s). Their priorities are illustrative.`);
                    await reload();
                  }}
                />
              </Box>
            </Stack>
          </Card>
        )}
      </Stack>

      {editing && (
        <ItemForm
          item={editing === 'new' ? undefined : editing}
          defaultColumn={COLUMNS.includes(tab as Column) ? (tab as Column) : 'next'}
          checklist={checklist.entries}
          existingIds={items.map((i) => i.id)}
          onClose={() => setEditing(undefined)}
          onSave={(next, isNew) => {
            setEditing(undefined);
            void save(next, isNew, isNew ? `Created “${next.title}” in ${COLUMN_LABELS[next.column]}.` : `Saved “${next.title}”.`);
          }}
        />
      )}
      {blocking && (
        <BlockerForm
          item={blocking}
          onClose={() => setBlocking(undefined)}
          onSave={(reason) => {
            setBlocking(undefined);
            void save(setBlocker(blocking, reason, new Date()), false, `Marked “${blocking.title}” as blocked.`);
          }}
        />
      )}
    </Shell>
  );
}

function Shell(props: TrackerAppProps & { children: ReactNode }) {
  return (
    <Card tone="default" height="fill" padding={[3, 4, 5]} style={{ minHeight: '100%', overflow: 'auto' }}>
      <Container width={3}>
        <Stack gap={5}>
          <Flex align="flex-start" justify="space-between" gap={3} wrap="wrap">
            <Stack gap={3}>
              <Heading as="h1" size={3}>
                Website Admin
              </Heading>
              <Text muted>What we're working on now, what's next, what's still an idea, and what's blocked.</Text>
            </Stack>
            <Inline gap={2}>
              <Badge tone={props.repository.kind === 'local-demo' ? 'caution' : 'positive'} fontSize={1} padding={2}>
                {props.repository.kind === 'local-demo' ? 'Local demo' : 'Shared (Sanity)'}
              </Badge>
              {!props.canEdit && (
                <Badge fontSize={1} padding={2}>
                  Read only
                </Badge>
              )}
              {props.headerActions}
            </Inline>
          </Flex>
          {props.banner}
          {props.children}
        </Stack>
      </Container>
    </Card>
  );
}

function SummaryCard(p: { label: string; count: number; tone?: 'default' | 'critical' }) {
  return (
    <Card padding={3} radius={2} border tone={p.tone ?? 'default'} aria-label={`${p.label}: ${p.count}`} role="group">
      <Stack gap={2}>
        <Text size={1} muted>
          {p.label}
        </Text>
        <Text size={4} weight="semibold">
          {p.count}
        </Text>
      </Stack>
    </Card>
  );
}

function ItemCard(p: {
  item: TrackerItem;
  checklistEntry?: ChecklistEntry;
  canEdit: boolean;
  onMove: (c: Column) => void;
  onEdit: () => void;
  onBlock: () => void;
  onClearBlocker: () => void;
}) {
  const { item } = p;
  const blocked = isBlocked(item);
  return (
    <Card padding={4} radius={2} border tone={blocked ? 'critical' : 'default'} as="article" aria-label={item.title}>
      <Stack gap={4}>
        <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
          <Stack gap={2} flex={1} style={{ minWidth: 220 }}>
            <Text weight="semibold" size={2}>
              {item.title}
            </Text>
            <Inline gap={2}>
              <Text size={0} muted>
                {item.id}
              </Text>
              {item.priority && (
                <Badge tone={PRIORITY_TONE[item.priority]}>
                  {PRIORITY_LABEL[item.priority]} priority{item.priorityIllustrative ? ' · illustrative' : ''}
                </Badge>
              )}
              {blocked && <Badge tone="critical">Blocked</Badge>}
            </Inline>
          </Stack>
          {p.canEdit && (
            <Flex gap={2} align="center" wrap="wrap">
              <Select fontSize={1} padding={2} value={item.column} onChange={(e) => p.onMove(e.currentTarget.value as Column)} aria-label={`Column for ${item.title}`}>
                {COLUMNS.map((c) => (
                  <option key={c} value={c}>
                    {COLUMN_LABELS[c]}
                  </option>
                ))}
              </Select>
              {blocked ? <Button fontSize={1} padding={2} mode="ghost" text="Clear blocker" onClick={p.onClearBlocker} /> : <Button fontSize={1} padding={2} mode="ghost" text="Mark blocked" onClick={p.onBlock} />}
              <Button fontSize={1} padding={2} mode="bleed" text="Edit" onClick={p.onEdit} />
            </Flex>
          )}
        </Flex>
        {item.description && <Text size={1}>{item.description}</Text>}
        {blocked && (
          <Text size={1}>
            <strong>Blocked:</strong> {item.blocker}
          </Text>
        )}
        <Stack gap={2}>
          {item.owner && <Meta label="Owner">{item.owner}</Meta>}
          {item.targetDate && <Meta label="Target">{item.targetDate}</Meta>}
          {item.sourceUrl && (
            <Meta label="Source">
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{ overflowWrap: 'anywhere' }}>
                {item.sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </Meta>
          )}
          {item.checklistRef && (
            <Meta label="Launch checklist">
              {p.checklistEntry ? `${p.checklistEntry.done ? '☑' : '☐'} ${truncate(plainText(p.checklistEntry.text), 90)} (ticked only in the checklist file)` : `“${item.checklistRef}” is no longer in the checklist`}
            </Meta>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

const Meta = ({ label, children }: { label: string; children: ReactNode }) => (
  <Text size={1} muted>
    <strong>{label}:</strong> {children}
  </Text>
);

function ItemForm(p: {
  item?: TrackerItem;
  defaultColumn: Column;
  checklist: ChecklistEntry[];
  existingIds: string[];
  onClose: () => void;
  onSave: (item: TrackerItem, isNew: boolean) => void;
}) {
  const [draft, setDraft] = useState<TrackerDraft>(
    p.item ?? { title: '', description: '', column: p.defaultColumn },
  );
  const [issues, setIssues] = useState<string[]>([]);
  const set = <K extends keyof TrackerDraft>(key: K, value: TrackerDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    const now = new Date();
    let next: TrackerItem;
    if (p.item) next = updateItem(p.item, draft, now);
    else {
      next = createItem(draft, now);
      while (p.existingIds.includes(next.id)) next = createItem(draft, now);
    }
    const found = validateItem(next);
    if (found.length) return setIssues(found.map((i) => i.message));
    p.onSave(next, !p.item);
  };

  return (
    <Dialog id="tracker-item-form" header={p.item ? `Edit ${p.item.id}` : 'New item'} onClose={p.onClose} width={1}>
      <Box padding={4}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Stack gap={4}>
            <Field label="Title" id="f-title">
              <TextInput id="f-title" value={draft.title} onChange={(e) => set('title', e.currentTarget.value)} autoFocus />
            </Field>
            <Field label="Short description" id="f-desc">
              <TextArea id="f-desc" rows={3} value={draft.description} onChange={(e) => set('description', e.currentTarget.value)} />
            </Field>
            <Grid gridTemplateColumns={[1, 2]} gap={3}>
              <Field label="Column" id="f-col">
                <Select id="f-col" value={draft.column} onChange={(e) => set('column', e.currentTarget.value as Column)}>
                  {COLUMNS.map((c) => (
                    <option key={c} value={c}>
                      {COLUMN_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority (optional)" id="f-pri">
                <Select id="f-pri" value={draft.priority ?? ''} onChange={(e) => set('priority', (e.currentTarget.value || undefined) as TrackerDraft['priority'])}>
                  <option value="">None</option>
                  {PRIORITIES.map((pr) => (
                    <option key={pr} value={pr}>
                      {PRIORITY_LABEL[pr]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Owner (optional)" id="f-owner">
                <TextInput id="f-owner" value={draft.owner ?? ''} onChange={(e) => set('owner', e.currentTarget.value)} />
              </Field>
              <Field label="Target date (optional)" id="f-date">
                <TextInput id="f-date" type="date" value={draft.targetDate ?? ''} onChange={(e) => set('targetDate', e.currentTarget.value)} />
              </Field>
            </Grid>
            <Field label="Source link (optional)" id="f-src">
              <TextInput id="f-src" type="url" placeholder="https://…" value={draft.sourceUrl ?? ''} onChange={(e) => set('sourceUrl', e.currentTarget.value)} />
            </Field>
            <Field label="Related launch-checklist requirement (optional)" id="f-ref" hint="For reference only. Finishing this item does not tick the requirement.">
              <Select id="f-ref" value={draft.checklistRef ?? ''} onChange={(e) => set('checklistRef', e.currentTarget.value || undefined)}>
                <option value="">None</option>
                {p.checklist.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.section}: {truncate(plainText(c.text), 70)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Blocker (optional)" id="f-block" hint="Leave empty if nothing is blocking it.">
              <TextInput id="f-block" value={draft.blocker ?? ''} onChange={(e) => set('blocker', e.currentTarget.value)} />
            </Field>
            {issues.length > 0 && (
              <Card padding={3} tone="critical" radius={2} role="alert">
                <Stack gap={2}>
                  {issues.map((i) => (
                    <Text key={i} size={1}>
                      {i}
                    </Text>
                  ))}
                </Stack>
              </Card>
            )}
            <Flex gap={2} justify="flex-end">
              <Button mode="bleed" text="Cancel" onClick={p.onClose} />
              <Button type="submit" tone="primary" text={p.item ? 'Save' : 'Create item'} />
            </Flex>
          </Stack>
        </form>
      </Box>
    </Dialog>
  );
}

function BlockerForm(p: { item: TrackerItem; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog id="tracker-blocker-form" header={`What's blocking “${p.item.title}”?`} onClose={p.onClose} width={1}>
      <Box padding={4}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim()) p.onSave(reason);
          }}
        >
          <Stack gap={4}>
            <Field label="Reason" id="f-reason" hint="The item stays in its column and shows this reason.">
              <TextInput id="f-reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)} autoFocus />
            </Field>
            <Flex gap={2} justify="flex-end">
              <Button mode="bleed" text="Cancel" onClick={p.onClose} />
              <Button type="submit" tone="critical" text="Mark blocked" disabled={!reason.trim()} />
            </Flex>
          </Stack>
        </form>
      </Box>
    </Dialog>
  );
}

const Field = ({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) => (
  <Stack gap={2}>
    <Label as="label" htmlFor={id} size={1}>
      {label}
    </Label>
    {children}
    {hint && (
      <Text size={0} muted>
        {hint}
      </Text>
    )}
  </Stack>
);

function ChecklistPanel({ checklist, sourceUrl }: { checklist: ReturnType<typeof parseChecklist>; sourceUrl: string }) {
  return (
    <Stack gap={4}>
      <Card padding={4} radius={2} border>
        <Stack gap={3}>
          <Heading as="h2" size={1}>
            Launch checklist: {checklist.done} of {checklist.total} done
          </Heading>
          <Text size={1}>
            These are the release requirements. They're counted from{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              docs/launch-checklist.md
            </a>{' '}
            and can only be ticked there. Moving a tracker item to Done doesn't tick anything here.
          </Text>
        </Stack>
      </Card>
      {checklist.sections.map((s) => (
        <Card key={s.title} padding={4} radius={2} border>
          <Stack gap={3}>
            <Text weight="semibold">
              {s.title}: {s.done}/{s.total}
            </Text>
            {checklist.entries
              .filter((e) => e.section === s.title)
              .map((e) => (
                <Text key={e.slug} size={1} muted={e.done}>
                  {e.done ? '☑' : '☐'} {plainText(e.text)}
                </Text>
              ))}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function ReviewPanel({ url }: { url?: string }) {
  return (
    <Card padding={4} radius={2} border>
      <Stack gap={3}>
        <Heading as="h2" size={1}>
          Content review
        </Heading>
        <Text size={1}>
          Individual facts (dates, prices, menus, FAQs) are confirmed on each document in the Studio: open it, check it, and set its <strong>Review status</strong> to Confirmed. This tracker doesn't
          duplicate those confirmations.
        </Text>
        {url ? (
          <Text size={1}>
            <a href={url} target="_blank" rel="noreferrer">
              Open the content-review list on the preview site
            </a>{' '}
            to see everything still unconfirmed.
          </Text>
        ) : (
          <Text size={1} muted>
            The content-review list lives at /dev/content-review on the preview site. Set SANITY_STUDIO_PREVIEW_URL to link it here.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
