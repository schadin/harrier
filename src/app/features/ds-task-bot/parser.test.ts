import { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import { parseBotMessage, parseTaskCreated, parseTaskLines, splitTasksByAssignee } from './parser';

const BOT_MXID = '@dstaskbot:ds-core.ru';
const MY_MXID = '@ashchadin:ds-core.ru';

const makeEvent = (sender: string, body: string, replyEventId?: string): MatrixEvent =>
  new MatrixEvent({
    type: 'm.room.message',
    sender,
    content: {
      msgtype: 'm.text',
      body,
      ...(replyEventId ? { 'm.relates_to': { 'm.in_reply_to': { event_id: replyEventId } } } : {}),
    },
  });

describe('parseTaskLines', () => {
  it('парсит строки задач из ответа list (два сообщения)', () => {
    const body =
      '@ashumkov:ds-core.ru Вам назначены задачи:\n' +
      '📌 /145 Заполнить чеклист к Продуктовому замыслу (@ashumkov:ds-core.ru)\n' +
      '📌 /144 Заполнить чеклист к Машине состояний (@ashumkov:ds-core.ru)\n';

    expect(parseTaskLines(body)).toEqual([
      {
        id: 145,
        title: 'Заполнить чеклист к Продуктовому замыслу',
        assignee: '@ashumkov:ds-core.ru',
      },
      {
        id: 144,
        title: 'Заполнить чеклист к Машине состояний',
        assignee: '@ashumkov:ds-core.ru',
      },
    ]);
  });

  it('парсит строки задач из комбинированного ответа all', () => {
    const body =
      '@ashchadin:ds-core.ru Вам назначены задачи:\n' +
      '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)\n' +
      '📌 /153 Добавить в harrier поддержку DsTaskBot (@ashchadin:ds-core.ru)\n\n' +
      '@ashchadin:ds-core.ru Вы назначали задачи:\n' +
      '📌 /152 Завизировать концепцию (@conf-bot:ds-core.ru)\n';

    expect(parseTaskLines(body)).toEqual([
      { id: 155, title: 'Дашборд поручений', assignee: '@ashchadin:ds-core.ru' },
      {
        id: 153,
        title: 'Добавить в harrier поддержку DsTaskBot',
        assignee: '@ashchadin:ds-core.ru',
      },
      { id: 152, title: 'Завизировать концепцию', assignee: '@conf-bot:ds-core.ru' },
    ]);
  });

  it('возвращает пустой массив для сообщений-заглушек', () => {
    expect(parseTaskLines('🥳 Назначенных вам задач нет!')).toEqual([]);
    expect(parseTaskLines('🥳 Вы не назначали задач.')).toEqual([]);
  });

  it('не парсит посторонние тексты', () => {
    expect(parseTaskLines('просто текст')).toEqual([]);
    expect(parseTaskLines('📌 задача без номера')).toEqual([]);
  });
});

describe('parseTaskCreated', () => {
  it('парсит подтверждение создания задачи', () => {
    expect(
      parseTaskCreated(
        '⏳ Задача [Завизировать концепцию] для пользователя [@conf-bot:ds-core.ru] успешно создана!'
      )
    ).toEqual({
      title: 'Завизировать концепцию',
      assignee: '@conf-bot:ds-core.ru',
    });
  });

  it('парсит подтверждение создания на себя в личке', () => {
    expect(
      parseTaskCreated(
        '⏳ Задача [Дашборд поручений] для пользователя [@ashchadin:ds-core.ru] успешно создана!'
      )
    ).toEqual({
      title: 'Дашборд поручений',
      assignee: '@ashchadin:ds-core.ru',
    });
  });

  it('не парсит списки задач', () => {
    expect(parseTaskCreated('📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)')).toBeNull();
  });
});

describe('parseBotMessage', () => {
  it('распознаёт список задач от бота', () => {
    const mEvent = makeEvent(BOT_MXID, '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)');

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      kind: 'tasks',
      tasks: [{ id: 155, title: 'Дашборд поручений', assignee: '@ashchadin:ds-core.ru' }],
    });
  });

  it('распознаёт подтверждение создания', () => {
    const mEvent = makeEvent(
      BOT_MXID,
      '⏳ Задача [Завизировать концепцию] для пользователя [@conf-bot:ds-core.ru] успешно создана!'
    );

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      kind: 'task_created',
      task: { title: 'Завизировать концепцию', assignee: '@conf-bot:ds-core.ru' },
    });
  });

  it('не распознаёт сообщение не от бота', () => {
    const mEvent = makeEvent(
      '@other:ds-core.ru',
      '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)'
    );

    expect(parseBotMessage(mEvent, BOT_MXID)).toBeNull();
  });

  it('не распознаёт пустые заглушки как списки (null → обычный рендер)', () => {
    const mEvent = makeEvent(BOT_MXID, '🥳 Назначенных вам задач нет!');

    expect(parseBotMessage(mEvent, BOT_MXID)).toBeNull();
  });

  it('не распознаёт не-сообщения', () => {
    const mEvent = new MatrixEvent({
      type: 'm.room.encrypted',
      sender: BOT_MXID,
      content: { algorithm: 'm.megolm.v1.aes-sha2' },
    });

    expect(parseBotMessage(mEvent, BOT_MXID)).toBeNull();
  });
});

describe('splitTasksByAssignee', () => {
  it('распределяет задачи по секциям по assignee', () => {
    const tasks = [
      { id: 155, title: 'Дашборд поручений', assignee: MY_MXID },
      { id: 152, title: 'Завизировать концепцию', assignee: '@conf-bot:ds-core.ru' },
    ];

    expect(splitTasksByAssignee(tasks, MY_MXID)).toEqual({
      assignedToMe: [tasks[0]],
      assignedByMe: [tasks[1]],
    });
  });
});
