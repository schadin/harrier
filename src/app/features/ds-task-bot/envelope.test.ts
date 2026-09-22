import { MatrixEvent } from 'matrix-js-sdk';
import { describe, expect, it } from 'vitest';
import {
  DS_BOT_ENVELOPE_KEY,
  parseEnvelope,
  parseEnvelopeFiles,
  parseEnvelopeTask,
  parseEnvelopeTasks,
} from './envelope';

const BOT_MXID = '@dstaskbot:ds-core.ru';
const MY_MXID = '@ashchadin:ds-core.ru';

const makeEvent = (content: Record<string, unknown>): MatrixEvent =>
  new MatrixEvent({
    type: 'm.room.message',
    sender: BOT_MXID,
    content: { msgtype: 'm.text', body: 'text', ...content },
  });

describe('parseEnvelope', () => {
  it('читает конверт ru.ds_core.bot версии 1', () => {
    const mEvent = makeEvent({
      [DS_BOT_ENVELOPE_KEY]: {
        v: 1,
        kind: 'list',
        tasks: {
          scope: 'personal',
          filter_tag: 'срочно',
          items: [{ id: 8, title: 'Отчёт', author: MY_MXID, status: 'open', tags: ['работа'] }],
        },
      },
    });

    expect(parseEnvelope(mEvent)).toMatchObject({
      v: 1,
      kind: 'list',
      tasks: {
        scope: 'personal',
        filterTag: 'срочно',
        items: [{ id: 8, title: 'Отчёт', author: MY_MXID, status: 'open', tags: ['работа'] }],
      },
    });
  });

  it('возвращает null без конверта, при чужой версии и неизвестном kind', () => {
    expect(parseEnvelope(makeEvent({}))).toBeNull();
    expect(parseEnvelope(makeEvent({ [DS_BOT_ENVELOPE_KEY]: { v: 2, kind: 'list' } }))).toBeNull();
    expect(
      parseEnvelope(makeEvent({ [DS_BOT_ENVELOPE_KEY]: { v: 1, kind: 'unknown' } }))
    ).toBeNull();
    expect(parseEnvelope(makeEvent({ [DS_BOT_ENVELOPE_KEY]: 'not an object' }))).toBeNull();
  });

  it('игнорирует необязательные поля, если они не заданы', () => {
    const envelope = parseEnvelope(
      makeEvent({ [DS_BOT_ENVELOPE_KEY]: { v: 1, kind: 'verify_request' } })
    );
    expect(envelope).toEqual({ v: 1, kind: 'verify_request' });
  });
});

describe('parseEnvelopeTask', () => {
  it('приводит снейк-кейс поля к camelCase', () => {
    expect(
      parseEnvelopeTask({
        id: 12,
        title: 'Задача',
        author: MY_MXID,
        assignee: '@other:ds-core.ru',
        status: 'closed',
        chat_id: 42,
        chat_title: 'Комната',
        created_at: '2026-01-01T10:00:00Z',
        due_at: '2026-01-02T10:00:00Z',
        remind_at: '2026-01-02T09:00:00Z',
        closed_at: '2026-01-03T10:00:00Z',
        tags: ['a', 7, 'b'],
      })
    ).toEqual({
      id: 12,
      title: 'Задача',
      author: MY_MXID,
      assignee: '@other:ds-core.ru',
      status: 'closed',
      chatId: 42,
      chatTitle: 'Комната',
      createdAt: '2026-01-01T10:00:00Z',
      dueAt: '2026-01-02T10:00:00Z',
      remindAt: '2026-01-02T09:00:00Z',
      closedAt: '2026-01-03T10:00:00Z',
      tags: ['a', 'b'],
    });
  });

  it('по умолчанию считает задачу открытой', () => {
    expect(parseEnvelopeTask({ id: 1, title: 'T' })).toMatchObject({ status: 'open' });
  });

  it('возвращает null при отсутствии id или title', () => {
    expect(parseEnvelopeTask({ title: 'без id' })).toBeNull();
    expect(parseEnvelopeTask({ id: 1 })).toBeNull();
    expect(parseEnvelopeTask(null)).toBeNull();
  });
});

describe('parseEnvelopeTasks', () => {
  it('пропускает некорректные элементы списка', () => {
    const tasks = parseEnvelopeTasks({
      items: [{ id: 1, title: 'ok' }, { title: 'no id' }, 'garbage'],
    });
    expect(tasks?.items).toHaveLength(1);
    expect(tasks?.items[0]).toMatchObject({ id: 1, title: 'ok' });
  });

  it('возвращает null без массива items', () => {
    expect(parseEnvelopeTasks({ scope: 'room' })).toBeNull();
    expect(parseEnvelopeTasks(null)).toBeNull();
  });
});

describe('parseEnvelopeFiles', () => {
  it('парсит имена, mime-тип и размер', () => {
    expect(
      parseEnvelopeFiles([
        { name: 'a.pdf', mime_type: 'application/pdf', size: 10 },
        { name: 'b.txt' },
        { mime_type: 'text/plain' },
      ])
    ).toEqual([
      { name: 'a.pdf', mimeType: 'application/pdf', size: 10 },
      { name: 'b.txt', mimeType: undefined, size: undefined },
    ]);
  });

  it('возвращает пустой список для не-массива', () => {
    expect(parseEnvelopeFiles(undefined)).toEqual([]);
    expect(parseEnvelopeFiles({ name: 'a' })).toEqual([]);
  });
});
