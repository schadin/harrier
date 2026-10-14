import { describe, expect, it } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import { RoomToUnread } from '../../../../types/matrix/room';
import { PaletteCategory, PaletteItem } from './types';
import { buildUnreadPaletteItems, matchUnreadItem, UNREAD_LIST_LIMIT } from './unread';

const labels = {
  image: '[Photo]',
  video: '[Video]',
  audio: '[Audio]',
  file: '[File]',
  sticker: '[Sticker]',
  redacted: '[Deleted message]',
  encrypted: '[Encrypted message]',
};

type FakeEvent = {
  id: string;
  type: string;
  sender?: string;
  content?: Record<string, unknown>;
  decryptionFailure?: boolean;
};

const makeRoom = (
  events: FakeEvent[],
  readUpToId?: string,
  members: Record<string, string> = {}
) => ({
  getEventReadUpTo: () => readUpToId,
  getLiveTimeline: () => ({
    getEvents: () =>
      events.map((ev) => ({
        getId: () => ev.id,
        getType: () => ev.type,
        getSender: () => ev.sender,
        getContent: () => ev.content ?? {},
        isRedacted: () => false,
        isDecryptionFailure: () => ev.decryptionFailure ?? false,
        getRelation: () => undefined,
      })),
  }),
  getMember: (userId: string) => (members[userId] ? { name: members[userId] } : undefined),
});

const makeMx = (rooms: Record<string, ReturnType<typeof makeRoom>>) =>
  ({
    getUserId: () => '@me:example.org',
    getUser: () => undefined,
    getRoom: (roomId: string) => rooms[roomId],
  } as unknown as MatrixClient);

const makeRoomItem = (roomId: string, title = roomId): PaletteItem => ({
  id: `room:${roomId}`,
  category: PaletteCategory.Rooms,
  title,
  keywords: [roomId],
  roomId,
  run: () => undefined,
});

describe('getUnreadPreview через buildUnreadPaletteItems', () => {
  it('показывает первое непрочитанное сообщение с отправителем', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          { id: 'e1', type: 'm.room.message', sender: '@bob:example.org', content: { body: 'Hi' } },
          { id: 'e2', type: 'm.room.message', sender: '@al:example.org', content: { body: 'Yo' } },
        ],
        'e1',
        { '@al:example.org': 'Al' }
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const result = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );

    expect(result).toHaveLength(1);
    expect(result[0].item.preview).toBe('Al: Yo');
  });

  it('медиа показывает плейсхолдер вместо тела', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          {
            id: 'e1',
            type: 'm.room.message',
            sender: '@bob:example.org',
            content: { msgtype: 'm.image', body: 'image.png' },
          },
        ],
        undefined
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBe('@bob:example.org: [Photo]'.replace('@bob:example.org', 'bob'));
  });

  it('без read receipt показывает с начала живой таймлайна', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom([
        { id: 'e0', type: 'm.room.member' },
        {
          id: 'e1',
          type: 'm.room.message',
          sender: '@bob:example.org',
          content: { body: 'First' },
        },
      ]),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBe('bob: First');
  });

  it('пропускает свои сообщения и берёт первое входящее', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          {
            id: 'e1',
            type: 'm.room.message',
            sender: '@me:example.org',
            content: { body: 'My own' },
          },
          {
            id: 'e2',
            type: 'm.room.message',
            sender: '@al:example.org',
            content: { body: 'Reply' },
          },
        ],
        'e0',
        { '@al:example.org': 'Al' }
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBe('Al: Reply');
  });

  it('только свои сообщения после receipt — без превью', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          {
            id: 'e2',
            type: 'm.room.message',
            sender: '@me:example.org',
            content: { body: 'Mine' },
          },
        ],
        'e1'
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBeUndefined();
  });

  it('шифрованное сообщение показывает расшифрованное тело', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          {
            id: 'e1',
            type: 'm.room.encrypted',
            sender: '@al:example.org',
            content: { msgtype: 'm.text', body: 'Secret' },
          },
        ],
        'e0',
        { '@al:example.org': 'Al' }
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBe('Al: Secret');
  });

  it('нерасшифрованное сообщение показывает плейсхолдер', () => {
    const mx = makeMx({
      '!a:example.org': makeRoom(
        [
          {
            id: 'e1',
            type: 'm.room.encrypted',
            sender: '@al:example.org',
            content: {},
            decryptionFailure: true,
          },
        ],
        'e0'
      ),
    });
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 1, highlight: 0, from: null }],
    ]);

    const [entry] = buildUnreadPaletteItems(
      [makeRoomItem('!a:example.org')],
      mx,
      roomToUnread,
      labels
    );
    expect(entry.item.preview).toBe('al: [Encrypted message]');
  });

  it('отбрасывает комнаты без непрочитанных', () => {
    const mx = makeMx({});
    const roomToUnread: RoomToUnread = new Map([
      ['!a:example.org', { total: 0, highlight: 0, from: null }],
    ]);

    expect(
      buildUnreadPaletteItems([makeRoomItem('!a:example.org')], mx, roomToUnread, labels)
    ).toHaveLength(0);
  });

  it('сортирует по highlight, затем по total и ограничивает список', () => {
    const mx = makeMx({});
    const rooms = Array.from({ length: UNREAD_LIST_LIMIT + 5 }, (_, i) => `!r${i}:example.org`);
    const items = rooms.map((roomId) => makeRoomItem(roomId));
    const roomToUnread: RoomToUnread = new Map(
      rooms.map((roomId, i) => [roomId, { total: i + 1, highlight: 0, from: null }])
    );
    roomToUnread.set(rooms[0], { total: 1, highlight: 5, from: null });

    const result = buildUnreadPaletteItems(items, mx, roomToUnread, labels);

    expect(result).toHaveLength(UNREAD_LIST_LIMIT);
    expect(result[0].item.roomId).toBe(rooms[0]); // highlight выше всех
  });

  it('не включает пространства', () => {
    const mx = makeMx({});
    const spaceItem: PaletteItem = {
      id: 'space:!s:example.org',
      category: PaletteCategory.Spaces,
      title: 'Space',
      keywords: [],
      roomId: '!s:example.org',
      run: () => undefined,
    };
    const roomToUnread: RoomToUnread = new Map([
      ['!s:example.org', { total: 3, highlight: 0, from: null }],
    ]);

    expect(buildUnreadPaletteItems([spaceItem], mx, roomToUnread, labels)).toHaveLength(0);
  });
});

describe('matchUnreadItem', () => {
  const item: PaletteItem = {
    ...makeRoomItem('!a:example.org', 'General'),
    subtitle: '@bob:example.org',
    preview: 'Al: Yo',
  };

  it('матчит по заголовку, описанию и превью', () => {
    expect(matchUnreadItem(item, 'gen')).toBe(true);
    expect(matchUnreadItem(item, 'bob')).toBe(true);
    expect(matchUnreadItem(item, 'Yo')).toBe(true);
  });

  it('не матчит при отсутствии совпадения', () => {
    expect(matchUnreadItem(item, 'zzz')).toBe(false);
  });

  it('пустой запрос матчит всё', () => {
    expect(matchUnreadItem(item, '  ')).toBe(true);
  });
});
