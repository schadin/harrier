import { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  buildBotCommand,
  isBotCommandMessage,
  isBotCommandText,
  isBotServiceReply,
  isCollapseAllowed,
} from './helpers';

const BOT_MXID = '@dstaskbot:ds-core.ru';
const MY_MXID = '@ashchadin:ds-core.ru';
const OTHER_MXID = '@ashumkov:ds-core.ru';

const makeEvent = (sender: string, body: string): MatrixEvent =>
  new MatrixEvent({
    type: 'm.room.message',
    sender,
    content: { msgtype: 'm.text', body },
  });

const makeEnvelopeEvent = (sender: string, body: string, envelope: unknown): MatrixEvent =>
  new MatrixEvent({
    type: 'm.room.message',
    sender,
    content: { msgtype: 'm.text', body, 'ru.ds_core.bot': envelope },
  });

describe('buildBotCommand', () => {
  it('в комнате добавляет упоминание бота к команде с префиксом «!»', () => {
    expect(buildBotCommand(BOT_MXID, false, 'list', '')).toEqual({
      body: `${BOT_MXID} !list`,
      mentionUserIds: [BOT_MXID],
    });
  });

  it('в личке отправляет команду без упоминания бота', () => {
    expect(buildBotCommand(BOT_MXID, true, 'list', '')).toEqual({
      body: '!list',
      mentionUserIds: [],
    });
  });

  it('собирает команды закрытия и вложений с номером', () => {
    expect(buildBotCommand(BOT_MXID, false, 'close', '8').body).toBe(`${BOT_MXID} !close 8`);
    expect(buildBotCommand(BOT_MXID, true, 'file', '8')).toEqual({
      body: '!file 8',
      mentionUserIds: [],
    });
  });

  it('собирает команды без аргументов', () => {
    expect(buildBotCommand(BOT_MXID, true, 'help', '').body).toBe('!help');
    expect(buildBotCommand(BOT_MXID, true, 'verify', '').body).toBe('!verify');
    expect(buildBotCommand(BOT_MXID, false, 'all', '').body).toBe(`${BOT_MXID} !all`);
  });

  it('пробрасывает аргументы истории и добавляет упоминания людей', () => {
    const command = buildBotCommand(BOT_MXID, false, 'history', `${OTHER_MXID} 7 #срочно`);
    expect(command.body).toBe(`${BOT_MXID} !history ${OTHER_MXID} 7 #срочно`);
    expect(command.mentionUserIds).toEqual([BOT_MXID, OTHER_MXID]);
  });

  it('в личке создаёт личную задачу через «!add», сохраняя теги и срок', () => {
    expect(buildBotCommand(BOT_MXID, true, 'create', 'завтра 15:00 #срочно отчёт')).toEqual({
      body: '!add завтра 15:00 #срочно отчёт',
      mentionUserIds: [],
    });
  });

  it('в личке назначает задачу пользователю через «!add @user»', () => {
    const command = buildBotCommand(BOT_MXID, true, 'create', `${OTHER_MXID} отчёт`);
    expect(command.body).toBe(`!add ${OTHER_MXID} отчёт`);
    expect(command.mentionUserIds).toEqual([OTHER_MXID]);
  });

  it('в комнате создаёт задачу упоминанием бота и исполнителя', () => {
    const command = buildBotCommand(BOT_MXID, false, 'create', `${OTHER_MXID} отчёт`);
    expect(command.body).toBe(`${BOT_MXID} ${OTHER_MXID} отчёт`);
    expect(command.mentionUserIds).toEqual([BOT_MXID, OTHER_MXID]);
  });
});

describe('isBotCommandText', () => {
  it('распознаёт команды с префиксом «!»', () => {
    expect(isBotCommandText('!help')).toBe(true);
    expect(isBotCommandText('!verify')).toBe(true);
    expect(isBotCommandText('!list')).toBe(true);
    expect(isBotCommandText('!all #срочно')).toBe(true);
    expect(isBotCommandText('!history')).toBe(true);
    expect(isBotCommandText(`!history ${OTHER_MXID} 7`)).toBe(true);
    expect(isBotCommandText('!close 8')).toBe(true);
    expect(isBotCommandText('!file 8')).toBe(true);
    expect(isBotCommandText('!add завтра 15:00 #срочно отчёт')).toBe(true);
    expect(isBotCommandText(`!add ${OTHER_MXID} отчёт`)).toBe(true);
  });

  it('не распознаёт устаревший синтаксис и произвольный текст', () => {
    expect(isBotCommandText('close 8')).toBe(false);
    expect(isBotCommandText('list')).toBe(false);
    expect(isBotCommandText('/8')).toBe(false);
    expect(isBotCommandText('!close abc')).toBe(false);
    expect(isBotCommandText('!help me')).toBe(false);
    expect(isBotCommandText('!unknown 1')).toBe(false);
    expect(isBotCommandText('@user завтра 15:00 текст')).toBe(false);
  });
});

describe('isBotCommandMessage', () => {
  it('распознаёт команду с упоминанием бота', () => {
    expect(isBotCommandMessage(makeEvent(MY_MXID, `${BOT_MXID} !all #срочно`), BOT_MXID)).toBe(
      true
    );
    expect(
      isBotCommandMessage(makeEvent(MY_MXID, '@dstaskbot:ds-core.ru !close 8'), BOT_MXID)
    ).toBe(true);
  });

  it('распознаёт команду без упоминания (для сворачивания)', () => {
    expect(isBotCommandMessage(makeEvent(MY_MXID, '!list'), BOT_MXID)).toBe(true);
    expect(isBotCommandMessage(makeEvent(MY_MXID, '!file 8'), BOT_MXID)).toBe(true);
    expect(isBotCommandMessage(makeEvent(MY_MXID, '!add завтра 15:00 отчёт'), BOT_MXID)).toBe(true);
  });

  it('не сворачивает создание задачи и произвольный текст', () => {
    expect(
      isBotCommandMessage(
        makeEvent(MY_MXID, `${BOT_MXID} ${OTHER_MXID} завтра 15:00 отчёт`),
        BOT_MXID
      )
    ).toBe(false);
    expect(isBotCommandMessage(makeEvent(MY_MXID, 'обычный текст'), BOT_MXID)).toBe(false);
  });

  it('не распознаёт команды от самого бота и устаревший синтаксис', () => {
    expect(isBotCommandMessage(makeEvent(BOT_MXID, '!list'), BOT_MXID)).toBe(false);
    expect(isBotCommandMessage(makeEvent(MY_MXID, 'close 8'), BOT_MXID)).toBe(false);
    expect(isBotCommandMessage(makeEvent(MY_MXID, '/8'), BOT_MXID)).toBe(false);
  });
});

describe('isBotServiceReply', () => {
  it('сворачивает короткие подтверждения и заглушки', () => {
    expect(
      isBotServiceReply(makeEvent(BOT_MXID, '✅ Задача [Дашборд]  успешно закрыта!'), BOT_MXID)
    ).toBe(true);
    expect(isBotServiceReply(makeEvent(BOT_MXID, '🥳 Назначенных вам задач нет!'), BOT_MXID)).toBe(
      true
    );
    expect(
      isBotServiceReply(
        makeEvent(BOT_MXID, '@me Вам назначены задачи:\n🥳 Назначенных вам задач нет!'),
        BOT_MXID
      )
    ).toBe(true);
  });

  it('сворачивает короткие уведомления бота (например, об ошибке)', () => {
    expect(
      isBotServiceReply(makeEvent(BOT_MXID, 'Задача не найдена в этой комнате.'), BOT_MXID)
    ).toBe(true);
  });

  it('не сворачивает списки задач (они рендерятся карточками)', () => {
    expect(
      isBotServiceReply(
        makeEvent(BOT_MXID, '📌 /155 Дашборд поручений (@ashchadin:ds-core.ru)'),
        BOT_MXID
      )
    ).toBe(false);
  });

  it('не сворачивает длинные ответы (например, справку)', () => {
    const help = [
      'Доступные команды:',
      '!help — список команд',
      '!list — ваши задачи',
      '!all — задачи комнаты',
      '!close N — закрыть задачу',
    ].join('\n');
    expect(isBotServiceReply(makeEvent(BOT_MXID, help), BOT_MXID)).toBe(false);
  });

  it('не сворачивает сообщения не от бота', () => {
    expect(isBotServiceReply(makeEvent(MY_MXID, '🥳 Назначенных вам задач нет!'), BOT_MXID)).toBe(
      false
    );
  });

  it('сворачивает конверты created, closed, reminder и notice', () => {
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'создана', {
          v: 1,
          kind: 'created',
          task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' },
        }),
        BOT_MXID
      )
    ).toBe(true);
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'закрыта', {
          v: 1,
          kind: 'closed',
          task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'closed' },
        }),
        BOT_MXID
      )
    ).toBe(true);
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'напоминание', {
          v: 1,
          kind: 'reminder',
          task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' },
        }),
        BOT_MXID
      )
    ).toBe(true);
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, '⛔ Нельзя закрыть', { v: 1, kind: 'error', ok: false }),
        BOT_MXID
      )
    ).toBe(true);
  });

  it('не сворачивает конверты list, file и help', () => {
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'задачи', {
          v: 1,
          kind: 'list',
          tasks: { items: [{ id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' }] },
        }),
        BOT_MXID
      )
    ).toBe(false);
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'файл', {
          v: 1,
          kind: 'file',
          task: { id: 8, title: 'Отчёт', author: MY_MXID, status: 'open' },
          files: [{ name: 'отчёт.pdf' }],
        }),
        BOT_MXID
      )
    ).toBe(false);
    expect(
      isBotServiceReply(
        makeEnvelopeEvent(BOT_MXID, 'Доступные команды:\n!help\n!list\n!all', {
          v: 1,
          kind: 'help',
        }),
        BOT_MXID
      )
    ).toBe(false);
  });
});

describe('isCollapseAllowed', () => {
  it('в обычной комнате разрешает сворачивание', () => {
    expect(isCollapseAllowed(false, false)).toBe(true);
    expect(isCollapseAllowed(false, true)).toBe(true);
  });

  it('в личке с ботом разрешает сворачивание', () => {
    expect(isCollapseAllowed(true, true)).toBe(true);
  });

  it('в личке не с ботом запрещает сворачивание', () => {
    expect(isCollapseAllowed(true, false)).toBe(false);
  });
});
