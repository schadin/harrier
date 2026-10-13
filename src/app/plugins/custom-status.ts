import { MatrixClient, MsgType, SetPresence, UserEvent } from 'matrix-js-sdk';

export type CustomStatus = {
  emoji?: string;
  text?: string;
};

export type StatusPreset = {
  emoji: string;
  text: string;
};

export const DEFAULT_STATUS_PRESETS: StatusPreset[] = [
  { emoji: '🟢', text: 'На месте' },
  { emoji: '🙅‍♂️', text: 'Отошел' },
  { emoji: '🍴', text: 'Обед' },
  { emoji: '🏁', text: 'Ушел' },
];

const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined;

const getFirstGrapheme = (value: string): string | undefined => {
  if (!value) return undefined;
  if (graphemeSegmenter) {
    const [first] = graphemeSegmenter.segment(value);
    return first?.segment;
  }
  const [first] = value.match(/./su) ?? [];
  return first;
};

export const parseStatusMsg = (statusMsg?: string): CustomStatus => {
  const status = statusMsg?.trim();
  if (!status) return {};

  const firstGrapheme = getFirstGrapheme(status);
  if (!firstGrapheme || !EMOJI_REGEX.test(firstGrapheme)) {
    return { text: status };
  }

  const text = status.slice(firstGrapheme.length).trim();
  return {
    emoji: firstGrapheme,
    text: text || undefined,
  };
};

export const formatStatusMsg = (emoji: string, text?: string): string => {
  const trimmedText = text?.trim();
  return trimmedText ? `${emoji} ${trimmedText}` : emoji;
};

const TIME_SUFFIX_REGEX = / · \d{2}:\d{2}$/;
const TIME_SEPARATOR = ' · ';

const ACTIVE_STATUS_STORAGE_KEY = 'cinny_active_status_msg';

export const saveActiveStatusMsg = (statusMsg: string | undefined): void => {
  if (statusMsg === undefined || statusMsg === '') {
    localStorage.removeItem(ACTIVE_STATUS_STORAGE_KEY);
  } else {
    localStorage.setItem(ACTIVE_STATUS_STORAGE_KEY, statusMsg);
  }
};

export const getActiveStatusMsg = (): string | undefined => {
  const value = localStorage.getItem(ACTIVE_STATUS_STORAGE_KEY);
  return value || undefined;
};

export const stripTimeSuffix = (text: string): string => text.replace(TIME_SUFFIX_REGEX, '').trim();

export const extractStatusTimeSuffix = (text?: string): string | undefined => {
  if (!text) return undefined;
  const match = text.match(TIME_SUFFIX_REGEX);
  return match ? match[0].slice(TIME_SEPARATOR.length) : undefined;
};

export const formatStatusMsgWithTime = (emoji: string, text?: string): string => {
  const base = formatStatusMsg(emoji, text);
  const timeStr = new Date().toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${base}${TIME_SEPARATOR}${timeStr}`;
};

function updateLocalPresence(mx: MatrixClient, statusMsg: string | undefined): void {
  const userId = mx.getUserId();
  if (!userId) return;
  const user = mx.getUser(userId);
  if (!user) return;
  user.presenceStatusMsg = statusMsg;
  user.emit(UserEvent.Presence, undefined, user);
}

const sendStatusNotice = (
  mx: MatrixClient,
  noticeRoomId: string | undefined,
  emoji: string,
  text?: string
): void => {
  if (!noticeRoomId) return;
  const body = formatStatusMsg(emoji, text);
  if (!body) return;
  mx.sendMessage(noticeRoomId, { msgtype: MsgType.Notice, body }).catch(() => undefined);
};

export const setCustomStatus = (
  mx: MatrixClient,
  emoji: string,
  text?: string,
  noticeRoomId?: string
): Promise<void> => {
  const statusMsg = formatStatusMsg(emoji, text);
  updateLocalPresence(mx, statusMsg);
  saveActiveStatusMsg(statusMsg);
  sendStatusNotice(mx, noticeRoomId, emoji, text);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const setCustomStatusWithTime = (
  mx: MatrixClient,
  emoji: string,
  text?: string,
  noticeRoomId?: string
): Promise<void> => {
  const statusMsg = formatStatusMsgWithTime(emoji, text);
  updateLocalPresence(mx, statusMsg);
  saveActiveStatusMsg(statusMsg);
  sendStatusNotice(mx, noticeRoomId, emoji, text);
  return mx.setPresence({ presence: 'online', status_msg: statusMsg });
};

export const clearCustomStatus = (mx: MatrixClient): Promise<void> => {
  updateLocalPresence(mx, undefined);
  saveActiveStatusMsg(undefined);
  return mx.setPresence({ presence: 'online', status_msg: '' });
};

export type StatusRestoreAction =
  | { type: 'noop' }
  | { type: 'show-server'; statusMsg: string }
  | { type: 'adopt-server'; statusMsg: string }
  | { type: 'restore'; statusMsg: string };

/**
 * Матрица решений восстановления. `serverMsg` — серверное значение, полученное
 * явным presence-запросом (`undefined` — сервер вернул пустой статус), `saved` —
 * локальный кэш активного статуса.
 */
export const decideStatusRestore = (
  serverMsg: string | undefined,
  saved: string | undefined
): StatusRestoreAction => {
  // значения совпали (в том числе оба пусты) — отправлять на сервер нечего,
  // но непустое серверное значение нужно показать в UI
  if (serverMsg === saved) {
    return serverMsg ? { type: 'show-server', statusMsg: serverMsg } : { type: 'noop' };
  }

  // сервер новее (например, статус сменён с другого устройства) — приоритет
  // у сервера, локальный кэш синхронизируется
  if (serverMsg) return { type: 'adopt-server', statusMsg: serverMsg };

  // локального значения нет — восстанавливать нечего
  if (!saved) return { type: 'noop' };

  // серверное значение пустое (утеряно/истекло) — восстанавливаем локальное
  return { type: 'restore', statusMsg: saved };
};

export type StatusRestoreResult = 'done' | 'retry';

export const restoreCustomStatus = async (mx: MatrixClient): Promise<StatusRestoreResult> => {
  const userId = mx.getUserId();
  if (!userId) return 'done';

  const saved = getActiveStatusMsg();

  // авторитетный источник серверного значения — явный запрос presence;
  // собственное m.presence не подходит: у Synapse статус не переживает offline,
  // а matrix-js-sdk не различает «пустой status_msg» и «события не было»
  let serverMsg: string | undefined;
  try {
    const response = await mx.getPresence(userId);
    serverMsg = response.status_msg || undefined;
  } catch {
    // недоступность сервера — не признак пустого статуса; нужен повтор
    return 'retry';
  }

  // пользователь изменил или снял статус, пока шёл запрос — его выбор важнее
  if (getActiveStatusMsg() !== saved) return 'done';

  const action = decideStatusRestore(serverMsg, saved);

  switch (action.type) {
    case 'show-server':
      updateLocalPresence(mx, action.statusMsg);
      break;
    case 'adopt-server':
      saveActiveStatusMsg(action.statusMsg);
      updateLocalPresence(mx, action.statusMsg);
      break;
    case 'restore': {
      const user = mx.getUser(userId);
      updateLocalPresence(mx, action.statusMsg);
      mx.setPresence({
        presence: (user?.presence as SetPresence) ?? SetPresence.Online,
        status_msg: action.statusMsg,
      }).catch(() => undefined);
      break;
    }
    case 'noop':
    default:
      break;
  }

  return 'done';
};
