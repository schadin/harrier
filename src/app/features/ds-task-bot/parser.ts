import { MatrixEvent } from 'matrix-js-sdk';
import { MessageEvent } from '../../../types/matrix/room';
import { parseEnvelope } from './envelope';
import type { DsEnvelope, DsFile, DsTask } from './envelope';

export type { DsFile, DsTask, DsTaskStatus } from './envelope';

export type DsTaskCreated = {
  title: string;
  assignee: string;
};

export type DsTaskClosed = {
  title: string;
};

export type DsNotice = {
  text: string;
};

export type DsTaskListKind = 'list' | 'history' | 'report';
export type DsTaskCardKind = 'created' | 'closed' | 'reminder';

export type DsHelpEntry = {
  command: string;
  description?: string;
};

export type ParsedBotMessage =
  | {
      origin: 'envelope';
      kind: DsTaskListKind;
      tasks: DsTask[];
      scope?: string;
      filterTag?: string;
    }
  | { origin: 'envelope'; kind: DsTaskCardKind; task: DsTask }
  | { origin: 'envelope'; kind: 'file' | 'file_attached'; task?: DsTask; files: DsFile[] }
  | { origin: 'envelope'; kind: 'notice'; tone: 'info' | 'error'; text: string; task?: DsTask }
  | { origin: 'envelope'; kind: 'help'; entries: DsHelpEntry[] }
  | { origin: 'text'; kind: 'tasks'; tasks: DsTask[] }
  | { origin: 'text'; kind: 'task_created'; task: DsTaskCreated }
  | { origin: 'text'; kind: 'task_closed'; task: DsTaskClosed }
  | { origin: 'text'; kind: 'notice'; text: string };

export const TASK_LINE_PATTERN = /^📌 \/(\d+) (.+?) \((@[^\s)]+)\)\s*$/;

export const TASK_CREATED_PATTERN =
  /^⏳ Задача \[(.+)\] для пользователя \[(@[^\s\]]+)\] успешно создана!$/;

export const TASK_CLOSED_PATTERN = /^✅ Задача \[(.+)\]\s+успешно закрыта!$/;

// Короткое служебное уведомление бота: одна строка, завершившаяся «.» или «!».
export const NOTICE_PATTERN = /^[^\n]+[.!]$/;

export const parseTaskLines = (body: string): DsTask[] =>
  body.split('\n').flatMap((line) => {
    const match = TASK_LINE_PATTERN.exec(line.trim());
    if (!match) return [];
    return [{ id: Number(match[1]), title: match[2].trim(), assignee: match[3] }];
  });

export const parseTaskCreated = (body: string): DsTaskCreated | null => {
  const match = TASK_CREATED_PATTERN.exec(body.trim());
  if (!match) return null;
  return { title: match[1].trim(), assignee: match[2] };
};

export const parseTaskClosed = (body: string): DsTaskClosed | null => {
  const match = TASK_CLOSED_PATTERN.exec(body.trim());
  if (!match) return null;
  return { title: match[1].trim() };
};

export const parseNotice = (body: string): DsNotice | null => {
  const text = body.trim();
  if (!NOTICE_PATTERN.test(text)) return null;
  return { text };
};

// Строка справки: `!команда — описание` (тире может быть —, – или -).
const HELP_LINE_PATTERN = /^(!\S+(?:\s+\S+)*?)\s+[—–-]\s+(.+)$/;
const HELP_COMMAND_PATTERN = /^!\S+(?:\s+\S+)*$/;

export const parseHelpEntries = (body: string): DsHelpEntry[] =>
  body.split('\n').flatMap((line) => {
    const text = line.trim();
    if (!text.startsWith('!')) return [];
    const match = HELP_LINE_PATTERN.exec(text);
    if (match) return [{ command: match[1], description: match[2].trim() }];
    if (HELP_COMMAND_PATTERN.test(text)) return [{ command: text }];
    return [];
  });

export const parseTextMessage = (body: string): ParsedBotMessage | null => {
  const tasks = parseTaskLines(body);
  if (tasks.length > 0) return { origin: 'text', kind: 'tasks', tasks };

  const created = parseTaskCreated(body);
  if (created) return { origin: 'text', kind: 'task_created', task: created };

  const closed = parseTaskClosed(body);
  if (closed) return { origin: 'text', kind: 'task_closed', task: closed };

  const notice = parseNotice(body);
  if (notice) return { origin: 'text', kind: 'notice', text: notice.text };

  return null;
};

export const parseEnvelopeMessage = (
  envelope: DsEnvelope,
  body: string
): ParsedBotMessage | null => {
  switch (envelope.kind) {
    case 'help': {
      const entries = parseHelpEntries(body);
      if (entries.length === 0) return null;
      return { origin: 'envelope', kind: 'help', entries };
    }
    case 'list':
    case 'history':
    case 'report':
      return {
        origin: 'envelope',
        kind: envelope.kind,
        tasks: envelope.tasks?.items ?? [],
        scope: envelope.tasks?.scope,
        filterTag: envelope.tasks?.filterTag,
      };
    case 'created':
    case 'closed':
    case 'reminder':
      if (!envelope.task) return null;
      return { origin: 'envelope', kind: envelope.kind, task: envelope.task };
    case 'file':
    case 'file_attached':
      return {
        origin: 'envelope',
        kind: envelope.kind,
        task: envelope.task,
        files: envelope.files ?? [],
      };
    case 'already_closed':
      if (!body) return null;
      return { origin: 'envelope', kind: 'notice', tone: 'info', text: body, task: envelope.task };
    case 'verify_request':
    case 'verify_started':
    case 'verify_pending':
    case 'verify_approved':
    case 'undecryptable':
      if (!body) return null;
      return { origin: 'envelope', kind: 'notice', tone: 'info', text: body };
    case 'verify_denied':
    case 'error':
      if (!body) return null;
      return { origin: 'envelope', kind: 'notice', tone: 'error', text: body, task: envelope.task };
    default:
      return null;
  }
};

export const parseBotMessage = (mEvent: MatrixEvent, botMxid: string): ParsedBotMessage | null => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return null;
  if (mEvent.getSender() !== botMxid) return null;

  const { body } = mEvent.getContent();
  const text = typeof body === 'string' ? body.trim() : '';

  const envelope = parseEnvelope(mEvent);
  if (envelope) return parseEnvelopeMessage(envelope, text);

  if (typeof body !== 'string') return null;
  return parseTextMessage(body);
};

// Кнопку «Закрыть» показываем только для задач, созданных пользователем или
// назначенных ему. В текстовом fallback author неизвестен — проверяем по assignee.
export const canCloseTask = (task: DsTask, myUserId: string): boolean =>
  task.author === myUserId || task.assignee === myUserId;

export const splitTasksByAssignee = (
  tasks: DsTask[],
  myUserId: string
): { assignedToMe: DsTask[]; assignedByMe: DsTask[] } => {
  const assignedToMe: DsTask[] = [];
  const assignedByMe: DsTask[] = [];

  tasks.forEach((task) => {
    if (task.assignee === myUserId) {
      assignedToMe.push(task);
    } else {
      assignedByMe.push(task);
    }
  });

  return { assignedToMe, assignedByMe };
};
