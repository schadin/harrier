import { IContent, MatrixClient, MatrixEvent, MsgType, Room } from 'matrix-js-sdk';
import { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { MessageEvent } from '../../../types/matrix/room';
import { getMentionContent } from '../../utils/room';
import { getMxIdLocalPart } from '../../utils/matrix';
import { notifySendError } from '../../utils/send';
import { parseBotMessage, parseTaskLines } from './parser';

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

export type BotCommandAction =
  | 'help'
  | 'list'
  | 'all'
  | 'history'
  | 'close'
  | 'file'
  | 'verify'
  | 'create';

const COMMANDS_WITHOUT_ARGS: Partial<Record<BotCommandAction, string>> = {
  help: '!help',
  list: '!list',
  all: '!all',
  verify: '!verify',
};

const getCommandBody = (action: BotCommandAction, params: string): string => {
  const withoutArgs = COMMANDS_WITHOUT_ARGS[action];
  if (withoutArgs) return withoutArgs;

  const args = params.trim();
  switch (action) {
    case 'close':
      return `!close ${args}`;
    case 'file':
      return `!file ${args}`;
    case 'history':
      return args === '' ? '!history' : `!history ${args}`;
    case 'create':
      return args === '' ? '!add' : `!add ${args}`;
    default:
      return args;
  }
};

const extractMentionUserIds = (text: string): string[] =>
  text.split(/\s+/).filter((item) => item.startsWith('@') && item.includes(':'));

export const buildBotCommand = (
  botMxid: string,
  dm: boolean,
  action: BotCommandAction,
  params: string
): { body: string; mentionUserIds: string[] } => {
  if (action === 'create') {
    const mentioned = extractMentionUserIds(params);
    if (dm) {
      return {
        body: getCommandBody('create', params),
        mentionUserIds: mentioned,
      };
    }
    return {
      body: getBotMentionBody(botMxid, params.trim()),
      mentionUserIds: [botMxid, ...mentioned],
    };
  }

  const body = getCommandBody(action, params);
  const mentioned = action === 'history' ? extractMentionUserIds(params) : [];

  if (dm) {
    return { body, mentionUserIds: mentioned };
  }
  return {
    body: getBotMentionBody(botMxid, body),
    mentionUserIds: [botMxid, ...mentioned],
  };
};

export const sendBotCommand = async (
  mx: MatrixClient,
  roomId: string,
  botMxid: string,
  dm: boolean,
  action: BotCommandAction,
  params = ''
): Promise<string | null> => {
  const { body, mentionUserIds } = buildBotCommand(botMxid, dm, action, params);
  return sendBotText(mx, roomId, body, mentionUserIds);
};

const SUBCOMMANDS_WITHOUT_ARGS = ['help', 'verify'];
const SUBCOMMANDS_WITH_FILTER = ['list', 'all'];
const SUBCOMMANDS_WITH_ID = ['close', 'file'];

export const isBotCommandText = (text: string): boolean => {
  const match = /^!([a-z]+)(?:\s+([\s\S]*))?$/.exec(text);
  if (!match) return false;

  const [, name, args] = match;
  if (SUBCOMMANDS_WITHOUT_ARGS.includes(name)) return args === undefined;
  if (SUBCOMMANDS_WITH_FILTER.includes(name)) return true;
  if (SUBCOMMANDS_WITH_ID.includes(name)) return args !== undefined && /^\d+$/.test(args);
  if (name === 'history') return true;
  if (name === 'add') return true;
  return false;
};

export const isBotCommandMessage = (mEvent: MatrixEvent, botMxid: string): boolean => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return false;
  if (mEvent.getSender() === botMxid) return false;

  const { body } = mEvent.getContent();
  if (typeof body !== 'string') return false;

  const text = body.trim();
  if (text === '') return false;

  if (isBotCommandText(text)) return true;

  const local = getBotLocalPart(botMxid);
  const serverPart = botMxid.split(':').slice(1).join(':');
  const mentionPattern = new RegExp(
    `^@${escapeRegExp(local)}(?::${escapeRegExp(serverPart)})?\\s+`
  );
  const withoutMention = text.replace(mentionPattern, '');
  return withoutMention !== text && isBotCommandText(withoutMention);
};

export const BOT_SERVICE_REPLY_MAX_LINES = 2;

const ENVELOPE_COLLAPSIBLE_KINDS = new Set(['notice', 'created', 'closed', 'reminder']);

export const isBotServiceReply = (mEvent: MatrixEvent, botMxid: string): boolean => {
  if (mEvent.getType() !== MessageEvent.RoomMessage) return false;
  if (mEvent.getSender() !== botMxid) return false;

  const parsed = parseBotMessage(mEvent, botMxid);
  if (parsed) {
    if (parsed.origin === 'envelope') return ENVELOPE_COLLAPSIBLE_KINDS.has(parsed.kind);
    return (
      parsed.kind === 'notice' || parsed.kind === 'task_created' || parsed.kind === 'task_closed'
    );
  }

  const { body } = mEvent.getContent();
  if (typeof body !== 'string') return false;

  const text = body.trim();
  if (text === '') return false;

  // Списки задач рендерятся карточками и не сворачиваются.
  if (parseTaskLines(text).length > 0) return false;

  const nonEmptyLines = text.split('\n').filter((line) => line.trim() !== '');
  return nonEmptyLines.length <= BOT_SERVICE_REPLY_MAX_LINES;
};
