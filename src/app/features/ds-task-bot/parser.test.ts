import { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  canCloseTask,
  parseBotMessage,
  parseHelpEntries,
  parseNotice,
  parseTaskClosed,
  parseTaskCreated,
  parseTaskLines,
  splitTasksByAssignee,
} from './parser';

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

const makeEnvelopeEvent = (sender: string, body: string, envelope: unknown): MatrixEvent =>
  new MatrixEvent({
    type: 'm.room.message',
    sender,
    content: { msgtype: 'm.text', body, 'ru.ds_core.bot': envelope },
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

describe('parseTaskClosed', () => {
  it('парсит подтверждение закрытия задачи (двойной пробел из реального события)', () => {
    expect(
      parseTaskClosed('✅ Задача [Добавить в harrier поддержку DsTaskBot]  успешно закрыта!')
    ).toEqual({
      title: 'Добавить в harrier поддержку DsTaskBot',
    });
  });

  it('не парсит подтверждение создания и списки задач', () => {
    expect(
      parseTaskClosed(
        '⏳ Задача [Завизировать концепцию] для пользователя [@conf-bot:ds-core.ru] успешно создана!'
      )
    ).toBeNull();
    expect(parseTaskClosed('📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)')).toBeNull();
  });
});

describe('parseNotice', () => {
  it('распознаёт однострочные уведомления, завершённые «.» или «!»', () => {
    expect(parseNotice('Задача не найдена в этой комнате.')).toEqual({
      text: 'Задача не найдена в этой комнате.',
    });
    expect(parseNotice('🥳 Назначенных вам задач нет!')).toEqual({
      text: '🥳 Назначенных вам задач нет!',
    });
  });

  it('не распознаёт заголовки, многострочные ответы и списки задач', () => {
    expect(parseNotice('@me Вам назначены задачи:')).toBeNull();
    expect(parseNotice('Строка один\nСтрока два.')).toBeNull();
    expect(parseNotice('📌 /155 Дашборд поручений (@me)')).toBeNull();
  });
});

describe('parseHelpEntries', () => {
  it('парсит строки «!команда — описание»', () => {
    const body = [
      'Доступные команды:',
      '!help — список команд',
      '!add @user текст — создать задачу',
      '!close N – закрыть задачу',
      '!file N - файлы задачи',
    ].join('\n');

    expect(parseHelpEntries(body)).toEqual([
      { command: '!help', description: 'список команд' },
      { command: '!add @user текст', description: 'создать задачу' },
      { command: '!close N', description: 'закрыть задачу' },
      { command: '!file N', description: 'файлы задачи' },
    ]);
  });

  it('принимает строку команды без описания', () => {
    expect(parseHelpEntries('!help')).toEqual([{ command: '!help' }]);
  });

  it('игнорирует строки не начинающиеся с «!»', () => {
    expect(parseHelpEntries('Доступные команды:\nпросто текст')).toEqual([]);
  });
});

describe('parseBotMessage', () => {
  it('распознаёт список задач от бота (текстовый fallback)', () => {
    const mEvent = makeEvent(BOT_MXID, '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)');

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'tasks',
      tasks: [{ id: 155, title: 'Дашборд поручений', assignee: '@ashchadin:ds-core.ru' }],
    });
  });

  it('распознаёт подтверждение создания (текстовый fallback)', () => {
    const mEvent = makeEvent(
      BOT_MXID,
      '⏳ Задача [Завизировать концепцию] для пользователя [@conf-bot:ds-core.ru] успешно создана!'
    );

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'task_created',
      task: { title: 'Завизировать концепцию', assignee: '@conf-bot:ds-core.ru' },
    });
  });

  it('распознаёт подтверждение закрытия (текстовый fallback)', () => {
    const mEvent = makeEvent(BOT_MXID, '✅ Задача [Дашборд поручений]  успешно закрыта!');

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'task_closed',
      task: { title: 'Дашборд поручений' },
    });
  });

  it('не распознаёт сообщение не от бота', () => {
    const mEvent = makeEvent(
      '@other:ds-core.ru',
      '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)'
    );

    expect(parseBotMessage(mEvent, BOT_MXID)).toBeNull();
  });

  it('распознаёт заглушку пустой секции как служебное уведомление', () => {
    const mEvent = makeEvent(BOT_MXID, '🥳 Назначенных вам задач нет!');

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'notice',
      text: '🥳 Назначенных вам задач нет!',
    });
  });

  it('распознаёт служебное уведомление об ошибке', () => {
    const mEvent = makeEvent(BOT_MXID, 'Задача не найдена в этой комнате.');

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'notice',
      text: 'Задача не найдена в этой комнате.',
    });
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

describe('parseBotMessage с конвертом ru.ds_core.bot', () => {
  it('классифицирует список задач по kind, а не по тексту', () => {
    const mEvent = makeEnvelopeEvent(BOT_MXID, 'любой текст', {
      v: 1,
      kind: 'list',
      tasks: {
        scope: 'room',
        items: [{ id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' }],
      },
    });

    expect(parseBotMessage(mEvent, BOT_MXID)).toMatchObject({
      origin: 'envelope',
      kind: 'list',
      scope: 'room',
      tasks: [{ id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' }],
    });
  });

  it('распознаёт закрытие, напоминание и вложения', () => {
    const closed = parseBotMessage(
      makeEnvelopeEvent(BOT_MXID, 'closed', {
        v: 1,
        kind: 'closed',
        task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'closed' },
      }),
      BOT_MXID
    );
    expect(closed).toMatchObject({ origin: 'envelope', kind: 'closed', task: { id: 8 } });

    const reminder = parseBotMessage(
      makeEnvelopeEvent(BOT_MXID, 'reminder', {
        v: 1,
        kind: 'reminder',
        task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' },
      }),
      BOT_MXID
    );
    expect(reminder).toMatchObject({ origin: 'envelope', kind: 'reminder' });

    const file = parseBotMessage(
      makeEnvelopeEvent(BOT_MXID, 'file', {
        v: 1,
        kind: 'file',
        task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' },
        files: [{ name: 'отчёт.pdf', mime_type: 'application/pdf', size: 12345 }],
      }),
      BOT_MXID
    );
    expect(file).toMatchObject({
      origin: 'envelope',
      kind: 'file',
      files: [{ name: 'отчёт.pdf', mimeType: 'application/pdf', size: 12345 }],
    });
  });

  it('ошибку и проверку устройства отображает уведомлением', () => {
    const error = parseBotMessage(
      makeEnvelopeEvent(BOT_MXID, '⛔ Нельзя закрыть', { v: 1, kind: 'error', ok: false }),
      BOT_MXID
    );
    expect(error).toMatchObject({ origin: 'envelope', kind: 'notice', tone: 'error' });

    const verify = parseBotMessage(
      makeEnvelopeEvent(BOT_MXID, '✅ Проверка одобрена.', {
        v: 1,
        kind: 'verify_approved',
        user: MY_MXID,
      }),
      BOT_MXID
    );
    expect(verify).toMatchObject({ origin: 'envelope', kind: 'notice', tone: 'info' });
  });

  it('справку превращает в карточку со списком команд', () => {
    const body = [
      'Доступные команды:',
      '!help — список команд',
      '!list — ваши задачи',
      '!close N — закрыть задачу',
    ].join('\n');
    const mEvent = makeEnvelopeEvent(BOT_MXID, body, { v: 1, kind: 'help' });

    expect(parseBotMessage(mEvent, BOT_MXID)).toEqual({
      origin: 'envelope',
      kind: 'help',
      entries: [
        { command: '!help', description: 'список команд' },
        { command: '!list', description: 'ваши задачи' },
        { command: '!close N', description: 'закрыть задачу' },
      ],
    });
  });

  it('справка без строк команд остаётся обычным текстом', () => {
    const mEvent = makeEnvelopeEvent(BOT_MXID, 'Помощь недоступна.', { v: 1, kind: 'help' });

    expect(parseBotMessage(mEvent, BOT_MXID)).toBeNull();
  });

  it('неизвестный kind или чужая версия — текстовый fallback', () => {
    const unknownKind = makeEnvelopeEvent(BOT_MXID, 'Задача не найдена в этой комнате.', {
      v: 1,
      kind: 'something_new',
    });
    expect(parseBotMessage(unknownKind, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'notice',
      text: 'Задача не найдена в этой комнате.',
    });

    const otherVersion = makeEnvelopeEvent(BOT_MXID, '🥳 Назначенных вам задач нет!', {
      v: 2,
      kind: 'list',
    });
    expect(parseBotMessage(otherVersion, BOT_MXID)).toEqual({
      origin: 'text',
      kind: 'notice',
      text: '🥳 Назначенных вам задач нет!',
    });
  });
});

describe('canCloseTask', () => {
  it('разрешает закрытие задачи, созданной мной', () => {
    expect(
      canCloseTask(
        { id: 1, title: 'Задача', author: MY_MXID, assignee: '@other:ds-core.ru' },
        MY_MXID
      )
    ).toBe(true);
  });

  it('разрешает закрытие задачи, назначенной мне', () => {
    expect(
      canCloseTask(
        { id: 1, title: 'Задача', author: '@other:ds-core.ru', assignee: MY_MXID },
        MY_MXID
      )
    ).toBe(true);
  });

  it('запрещает закрытие чужой задачи', () => {
    expect(
      canCloseTask(
        { id: 1, title: 'Задача', author: '@other:ds-core.ru', assignee: '@third:ds-core.ru' },
        MY_MXID
      )
    ).toBe(false);
  });

  it('в текстовом fallback без author проверяет только assignee', () => {
    expect(canCloseTask({ id: 1, title: 'Задача', assignee: MY_MXID }, MY_MXID)).toBe(true);
    expect(canCloseTask({ id: 1, title: 'Задача', assignee: '@other:ds-core.ru' }, MY_MXID)).toBe(
      false
    );
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
