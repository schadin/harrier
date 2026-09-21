import { MatrixEvent } from 'matrix-js-sdk';
import { MessageEvent } from '../../../types/matrix/room';

export type DsTask = {
  id: number;
  title: string;
  assignee: string;
};

export type DsTaskCreated = {
  title: string;
  assignee: string;
};

export type ParsedBotMessage =
  | { kind: 'tasks'; tasks: DsTask[] }
  | { kind: 'task_created'; task: DsTaskCreated };

export const TASK_LINE_PATTERN = /^📌 \/(\d+) (.+?) \((@[^\s)]+)\)\s*$/;

export const TASK_CREATED_PATTERN =
  /^⏳ Задача \[(.+)\] для пользователя \[(@[^\s\]]+)\] успешно создана!$/;

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

export const parseBotMessage = (mEvent: MatrixEvent, botMxid: string): ParsedBotMessage | null => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return null;
  if (mEvent.getSender() !== botMxid) return null;

  const { body } = mEvent.getContent();
  if (typeof body !== 'string') return null;

  const tasks = parseTaskLines(body);
  if (tasks.length > 0) return { kind: 'tasks', tasks };

  const created = parseTaskCreated(body);
  if (created) return { kind: 'task_created', task: created };

  return null;
};

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
