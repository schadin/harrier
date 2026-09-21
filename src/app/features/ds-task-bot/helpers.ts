import { IContent, MatrixClient, MatrixEvent, MsgType, Room } from 'matrix-js-sdk';
import { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { MessageEvent } from '../../../types/matrix/room';
import { getMentionContent } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { notifySendError } from '../../utils/send';

export const BOT_RESPONSE_TIMEOUT_MS = 15000;

export const getBotLocalPart = (botMxid: string): string => getMxIdLocalPart(botMxid) ?? botMxid;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildBotMentionContent = (body: string, mentionUserIds: string[]): IContent => {
  const content: IContent = { msgtype: MsgType.Text, body };
  if (mentionUserIds.length === 0) return content;

  content['m.mentions'] = getMentionContent(mentionUserIds, false);

  let formatted = body;
  mentionUserIds.forEach((userId) => {
    const pill = `<a href="https://matrix.to/#/${encodeURIComponent(userId)}">${userId}</a>`;
    formatted = formatted.split(userId).join(pill);
  });
  content.format = 'org.matrix.custom.html';
  content.formatted_body = formatted.replace(/\n/g, '<br/>');

  return content;
};

export const sendBotText = async (
  mx: MatrixClient,
  roomId: string,
  body: string,
  mentionUserIds: string[] = []
): Promise<string | null> => {
  const content: RoomMessageEventContent = buildBotMentionContent(
    body,
    mentionUserIds
  ) as RoomMessageEventContent;
  try {
    const response = await mx.sendMessage(roomId, content);
    return response.event_id;
  } catch (error) {
    notifySendError(error);
    return null;
  }
};

export const isDirectRoomWithBot = (room: Room, botMxid: string): boolean => {
  if (!botMxid) return false;
  const joined = room
    .getMembers()
    .filter((member) => member.membership === 'join' || member.membership === 'invite');
  return joined.length === 2 && joined.some((member) => member.userId === botMxid);
};

export const getBotMentionBody = (botMxid: string, command: string): string =>
  `${botMxid} ${command}`;

export type BotCommandAction = 'list' | 'all' | 'close' | 'create';

export const buildBotCommand = (
  botMxid: string,
  dm: boolean,
  action: BotCommandAction,
  params: string
): { body: string; mentionUserIds: string[]; expectedReplies: number } => {
  if (action === 'list' || action === 'all') {
    if (dm) {
      return { body: action, mentionUserIds: [], expectedReplies: action === 'list' ? 2 : 1 };
    }
    return {
      body: getBotMentionBody(botMxid, action),
      mentionUserIds: [botMxid],
      expectedReplies: action === 'list' ? 2 : 1,
    };
  }

  if (action === 'close') {
    return { body: `close ${params}`, mentionUserIds: [], expectedReplies: 1 };
  }

  const mentioned = params
    .split(/\s+/)
    .filter((item) => item.startsWith('@') && item.includes(':'));
  if (dm) {
    return { body: params.trim(), mentionUserIds: mentioned, expectedReplies: 1 };
  }
  return {
    body: getBotMentionBody(botMxid, params.trim()),
    mentionUserIds: [botMxid, ...mentioned],
    expectedReplies: 1,
  };
};

export const isBotCommandMessage = (mEvent: MatrixEvent, botMxid: string): boolean => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return false;
  if (mEvent.getSender() === botMxid) return false;

  const { body } = mEvent.getContent();
  if (typeof body !== 'string') return false;

  const text = body.trim();
  if (text === '') return false;

  const CLOSE_PATTERN = /^(close|!close)\s+\d+$/;
  const SLASH_CLOSE_PATTERN = /^\/\d+$/;
  if (CLOSE_PATTERN.test(text) || SLASH_CLOSE_PATTERN.test(text)) return true;

  const local = getBotLocalPart(botMxid);
  const serverPart = botMxid.split(':').slice(1).join(':');
  const mentionPattern = new RegExp(
    `^@${escapeRegExp(local)}(?::${escapeRegExp(
      serverPart
    )})?\\s+((?:close|!close)\\s+\\d+|list|all|\\/\\d+)$`
  );
  return mentionPattern.test(text);
};

export const getReplyEventId = (mEvent: MatrixEvent): string | undefined =>
  mEvent.getContent()['m.relates_to']?.['m.in_reply_to']?.event_id;
