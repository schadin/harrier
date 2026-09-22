import { MatrixEvent } from 'matrix-js-sdk';

export const DS_BOT_ENVELOPE_KEY = 'ru.ds_core.bot';

export type DsTaskStatus = 'open' | 'closed';

export type DsTask = {
  id: number;
  title: string;
  author?: string;
  assignee?: string;
  status?: DsTaskStatus;
  chatId?: number;
  chatTitle?: string;
  createdAt?: string;
  dueAt?: string;
  remindAt?: string;
  closedAt?: string;
  tags?: string[];
};

export type DsFile = {
  name: string;
  mimeType?: string;
  size?: number;
};

export const DS_BOT_KINDS = [
  'help',
  'created',
  'closed',
  'already_closed',
  'list',
  'history',
  'report',
  'reminder',
  'file',
  'file_attached',
  'verify_request',
  'verify_started',
  'verify_pending',
  'verify_approved',
  'verify_denied',
  'undecryptable',
  'error',
] as const;

export type DsEnvelopeKind = typeof DS_BOT_KINDS[number];

const KIND_SET = new Set<string>(DS_BOT_KINDS);

export type DsEnvelope = {
  v: 1;
  kind: DsEnvelopeKind;
  task?: DsTask;
  tasks?: {
    items: DsTask[];
    scope?: string;
    filterTag?: string;
  };
  files?: DsFile[];
  user?: string;
  ok?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseTaskStatus = (value: unknown): DsTaskStatus => (value === 'closed' ? 'closed' : 'open');

const parseTags = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];

export const parseEnvelopeTask = (value: unknown): DsTask | null => {
  if (!isRecord(value)) return null;

  const id = asNumber(value.id);
  const title = asString(value.title);
  if (id === undefined || title === undefined) return null;

  return {
    id,
    title,
    author: asString(value.author),
    assignee: asString(value.assignee),
    status: parseTaskStatus(value.status),
    chatId: asNumber(value.chat_id),
    chatTitle: asString(value.chat_title),
    createdAt: asString(value.created_at),
    dueAt: asString(value.due_at),
    remindAt: asString(value.remind_at),
    closedAt: asString(value.closed_at),
    tags: parseTags(value.tags),
  };
};

export const parseEnvelopeFiles = (value: unknown): DsFile[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = asString(item.name);
    if (name === undefined) return [];
    return [{ name, mimeType: asString(item.mime_type), size: asNumber(item.size) }];
  });
};

export const parseEnvelopeTasks = (
  value: unknown
): { items: DsTask[]; scope?: string; filterTag?: string } | null => {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.items)) return null;

  return {
    items: value.items.flatMap((item) => {
      const task = parseEnvelopeTask(item);
      return task ? [task] : [];
    }),
    scope: asString(value.scope),
    filterTag: asString(value.filter_tag),
  };
};

export const parseEnvelope = (mEvent: MatrixEvent): DsEnvelope | null => {
  const content = mEvent.getContent() as Record<string, unknown>;
  const raw = content[DS_BOT_ENVELOPE_KEY];
  if (!isRecord(raw)) return null;
  if (raw.v !== 1) return null;

  const kind = asString(raw.kind);
  if (kind === undefined || !KIND_SET.has(kind)) return null;

  const envelope: DsEnvelope = { v: 1, kind: kind as DsEnvelopeKind };

  const task = parseEnvelopeTask(raw.task);
  if (task) envelope.task = task;

  const tasks = parseEnvelopeTasks(raw.tasks);
  if (tasks) envelope.tasks = tasks;

  const files = parseEnvelopeFiles(raw.files);
  if (files.length > 0) envelope.files = files;

  const user = asString(raw.user);
  if (user !== undefined) envelope.user = user;

  if (typeof raw.ok === 'boolean') envelope.ok = raw.ok;

  return envelope;
};
