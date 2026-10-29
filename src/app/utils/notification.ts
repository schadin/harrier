import { MatrixEvent, MsgType } from 'matrix-js-sdk';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
  removeActive,
} from '@tauri-apps/plugin-notification';

let tauriDetected: boolean | undefined;

export function isTauri(): boolean {
  if (tauriDetected !== undefined) return tauriDetected;
  tauriDetected = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  return tauriDetected;
}

export const getNotificationState = (): PermissionState => {
  if ('Notification' in window) {
    if (window.Notification.permission === 'default') {
      return 'prompt';
    }
    return window.Notification.permission;
  }
  return 'denied';
};

export async function getNotificationPermission(): Promise<PermissionState> {
  if (isTauri()) {
    const granted = await isPermissionGranted();
    return granted ? 'granted' : 'prompt';
  }
  return getNotificationState();
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (isTauri()) {
    const result = await requestPermission();
    return result === 'granted' ? 'granted' : 'denied';
  }
  if ('Notification' in window) {
    const result = await window.Notification.requestPermission();
    return result === 'default' ? 'prompt' : result;
  }
  return 'denied';
}

export type ShowNotificationOptions = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  silent?: boolean;
  tag?: string;
  onClick?: () => void;
};

function truncate(str: string, max: number): string {
  const cleaned = str.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trimEnd()}…`;
}

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    hash = (hash << 5) - hash + char;
    // eslint-disable-next-line no-bitwise
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

export function extractMessagePreview(mEvent: MatrixEvent): string {
  const content = mEvent.getContent();
  const msgtype = content?.msgtype;
  const body = content?.body;

  if (mEvent.isRedacted()) return 'Message deleted';

  if (msgtype === MsgType.Text || msgtype === MsgType.Notice) {
    return body ? truncate(body, 100) : 'Sent a message';
  }

  if (msgtype === MsgType.Emote) {
    return body ? truncate(`* ${body}`, 100) : 'Sent an emote';
  }

  if (msgtype === MsgType.Image) return 'Sent an image';
  if (msgtype === MsgType.Video) return 'Sent a video';
  if (msgtype === MsgType.Audio) return 'Sent an audio';
  if (msgtype === MsgType.File) return 'Sent a file';
  if (msgtype === MsgType.Location) return 'Sent a location';

  if (msgtype === 'm.bad.encrypted') return 'Unable to decrypt message';

  return body ? truncate(body, 100) : 'Sent a message';
}

export function showNotification(options: ShowNotificationOptions): { close: () => void } {
  if (isTauri()) {
    const id = options.tag ? hashStringToInt(options.tag) : undefined;

    sendNotification({
      id,
      title: options.title,
      body: options.body,
      icon: options.icon,
      silent: options.silent,
    });

    return {
      close: () => {
        if (id !== undefined) {
          removeActive([{ id }]).catch(() => {
            // Ignore cleanup errors.
          });
        }
      },
    };
  }

  try {
    const notification = new window.Notification(options.title, {
      body: options.body,
      icon: options.icon,
      badge: options.badge,
      silent: options.silent,
    });

    if (options.onClick) {
      notification.onclick = () => {
        options.onClick?.();
      };
    }

    return {
      close: () => notification.close(),
    };
  } catch {
    return {
      close: () => {
        // no-op: permission denied or unsupported.
      },
    };
  }
}
