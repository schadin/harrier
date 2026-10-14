import { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { RoomToUnread } from '../../../../types/matrix/room';
import { getMxIdLocalPart } from '../../../utils/matrix';
import { factoryRoomIdByActivity } from '../../../utils/sort';
import { PaletteCategory, PaletteItem, ScoredPaletteItem } from './types';

export type UnreadPreview = {
  sender: string;
  body: string;
};

export type UnreadPreviewLabels = {
  image: string;
  video: string;
  audio: string;
  file: string;
  sticker: string;
  redacted: string;
  encrypted: string;
};

const MESSAGE_EVENT_TYPES = ['m.room.message', 'm.room.encrypted', 'm.sticker'];

const PREVIEW_BODY_LIMIT = 120;
export const UNREAD_LIST_LIMIT = 30;

const msgTypeToLabelKey = (msgtype: unknown): keyof UnreadPreviewLabels | undefined => {
  switch (msgtype) {
    case 'm.image':
      return 'image';
    case 'm.video':
      return 'video';
    case 'm.audio':
      return 'audio';
    case 'm.file':
      return 'file';
    default:
      return undefined;
  }
};

const getMessagePreviewBody = (mEvent: MatrixEvent, labels: UnreadPreviewLabels): string => {
  const content = mEvent.getContent();

  if (mEvent.isRedacted()) return labels.redacted;
  if (mEvent.isDecryptionFailure()) return labels.encrypted;
  if (mEvent.getType() === 'm.sticker') return labels.sticker;

  const labelKey = msgTypeToLabelKey(content.msgtype);
  if (labelKey) return labels[labelKey];

  const body = typeof content.body === 'string' ? content.body : '';
  if (!body) return labels.encrypted;
  return body.length > PREVIEW_BODY_LIMIT ? `${body.slice(0, PREVIEW_BODY_LIMIT)}…` : body;
};

const getEventSenderName = (mx: MatrixClient, room: Room, senderId: string): string => {
  const member = room.getMember(senderId);
  if (member?.name) return member.name;
  const user = mx.getUser(senderId);
  if (user?.displayName) return user.displayName;
  return getMxIdLocalPart(senderId) ?? senderId;
};

/**
 * Первое непрочитанное сообщение комнаты: первое входящее (не своё) событие
 * после прочитанного (read receipt) в живой таймлайн. Собственные сообщения
 * пропускаются — read receipt не сдвигается при их отправке, поэтому они не
 * должны попадать в превью как «непрочитанные».
 */
const getFirstUnreadEvent = (room: Room, myUserId: string): MatrixEvent | undefined => {
  const readUpToId = room.getEventReadUpTo(myUserId);
  const timeline = room.getLiveTimeline().getEvents();

  let startIndex = 0;
  if (readUpToId) {
    const readIndex = timeline.findIndex((ev) => ev.getId() === readUpToId);
    // read receipt вне живой таймлайна (например, в старом сегменте) —
    // в этом случае показываем с начала живой таймлайна
    startIndex = readIndex === -1 ? 0 : readIndex + 1;
  }

  for (let i = startIndex; i < timeline.length; i += 1) {
    const ev = timeline[i];
    const isOwn = ev?.getSender() === myUserId;
    if (ev && !isOwn && MESSAGE_EVENT_TYPES.includes(ev.getType())) {
      return ev;
    }
  }
  return undefined;
};

export const getUnreadPreview = (
  mx: MatrixClient,
  room: Room,
  labels: UnreadPreviewLabels
): UnreadPreview | undefined => {
  const myUserId = mx.getUserId();
  if (!myUserId) return undefined;

  const firstUnread = getFirstUnreadEvent(room, myUserId);
  if (!firstUnread) return undefined;

  return {
    sender: getEventSenderName(mx, room, firstUnread.getSender() ?? ''),
    body: getMessagePreviewBody(firstUnread, labels),
  };
};

/**
 * Список непрочитанных комнат в формате палитры:
 * с превью первого непрочитанного сообщения, сортировка — по highlight,
 * затем по количеству непрочитанных, затем по активности.
 */
export const buildUnreadPaletteItems = (
  items: PaletteItem[],
  mx: MatrixClient,
  roomToUnread: RoomToUnread,
  labels: UnreadPreviewLabels
): ScoredPaletteItem[] => {
  const unreadItems: ScoredPaletteItem[] = [];

  items.forEach((item) => {
    if (item.category !== PaletteCategory.Rooms) return;
    const { roomId } = item;
    if (!roomId) return;

    const unread = roomToUnread.get(roomId);
    if (!unread || (unread.total === 0 && unread.highlight === 0)) return;

    const room = mx.getRoom(roomId);
    const preview = room ? getUnreadPreview(mx, room, labels) : undefined;
    const itemWithPreview: PaletteItem = preview
      ? { ...item, preview: `${preview.sender}: ${preview.body}` }
      : item;

    unreadItems.push({
      item: itemWithPreview,
      score: unread.highlight * 1000 + unread.total,
    });
  });

  unreadItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return factoryRoomIdByActivity(mx)(a.item.roomId ?? '', b.item.roomId ?? '');
  });

  return unreadItems.slice(0, UNREAD_LIST_LIMIT);
};

/** Вхождение строки запроса в заголовке/превью (без fuzzy-ранжирования) */
export const matchUnreadItem = (item: PaletteItem, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [item.title, item.subtitle ?? '', item.preview ?? '', ...item.keywords]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
};
