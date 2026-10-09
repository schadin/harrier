import { useAtomValue } from 'jotai';
import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MatrixEvent,
  MatrixEventEvent,
  Room,
  RoomEvent,
  RoomEventHandlerMap,
  User,
  UserEvent,
} from 'matrix-js-sdk';

import { roomToUnreadAtom, unreadEqual, unreadInfoToUnread } from '../../state/room/roomToUnread';
import LogoSVG from '../../../../public/res/svg/cinny.svg';
import LogoUnreadSVG from '../../../../public/res/svg/cinny-unread.svg';
import LogoHighlightSVG from '../../../../public/res/svg/cinny-highlight.svg';
import NotificationSound from '../../../../public/sound/notification.ogg';
import InviteSound from '../../../../public/sound/invite.ogg';
import { setFavicon } from '../../utils/dom';
import { extractMessagePreview, isTauri, showNotification } from '../../utils/notification';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { allInvitesAtom } from '../../state/room-list/inviteList';
import { usePreviousValue } from '../../hooks/usePreviousValue';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { getInboxInvitesPath, getInboxNotificationsPath } from '../pathUtils';
import {
  getMemberDisplayName,
  getNotificationType,
  getUnreadInfo,
  isNotificationEvent,
} from '../../utils/room';
import { MessageEvent, NotificationType, UnreadInfo } from '../../../types/matrix/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { useSelectedRoom } from '../../hooks/router/useSelectedRoom';
import { useInboxNotificationsSelected } from '../../hooks/router/useInbox';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useCustomStatus } from '../../hooks/useCustomStatus';
import {
  DEFAULT_STATUS_PRESETS,
  restoreCustomStatus,
  setCustomStatusWithTime,
  stripTimeSuffix,
} from '../../plugins/custom-status';
import {
  applyAutostart,
  listenTrayStatus,
  setActiveStatus,
  setDesktopSettings,
  setStatusPresets,
} from '../../utils/desktop';
import { updateTrayIcon } from '../../utils/trayIcon';
import { useRestoreBackupOnStartup } from '../../hooks/useRestoreBackupOnStartup';
import { useRetryDecryptionOnKeyArrival } from '../../hooks/useRetryDecryptionOnKeyArrival';

const PRESENCE_WAIT_TIMEOUT_MS = 15_000;

function CustomStatusRestore() {
  const mx = useMatrixClient();

  useEffect(() => {
    let settled = false;
    let timer: number | undefined;
    const userId = mx.getUserId();
    const user = userId ? mx.getUser(userId) : undefined;

    // решение о восстановлении — только после прихода собственного m.presence
    function handlePresence(_event: MatrixEvent | undefined, u: User) {
      if (u.presenceStatusMsg !== undefined) settle();
    }

    function settle() {
      if (settled) return;
      settled = true;
      user?.removeListener(UserEvent.Presence, handlePresence);
      window.clearTimeout(timer);
      restoreCustomStatus(mx);
    }

    timer = window.setTimeout(settle, PRESENCE_WAIT_TIMEOUT_MS);

    if (user && user.presenceStatusMsg !== undefined) {
      settle();
      return undefined;
    }

    user?.on(UserEvent.Presence, handlePresence);

    return () => {
      settled = true;
      user?.removeListener(UserEvent.Presence, handlePresence);
      window.clearTimeout(timer);
    };
  }, [mx]);

  return null;
}

function AutoRestoreBackup() {
  useRestoreBackupOnStartup();
  return null;
}

function RetryDecryption() {
  useRetryDecryptionOnKeyArrival();
  return null;
}

function DesktopFeatures() {
  const mx = useMatrixClient();
  const userId = mx.getUserId()!;
  const currentStatus = useCustomStatus(userId);
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  const [showTrayIcon] = useSetting(settingsAtom, 'showTrayIcon');
  const [customPresets] = useSetting(settingsAtom, 'statusPresets');
  const [statusNoticeRoomId] = useSetting(settingsAtom, 'statusNoticeRoomId');
  const [autostart, setAutostartSetting] = useSetting(settingsAtom, 'autostart');

  useEffect(() => {
    if (!isTauri()) return undefined;
    const timer = setTimeout(() => {
      setDesktopSettings(showTrayIcon);
    }, 100);
    return () => clearTimeout(timer);
  }, [showTrayIcon]);

  useEffect(() => {
    if (!isTauri()) return undefined;
    let disposed = false;
    const timer = setTimeout(() => {
      applyAutostart(autostart).then((applied) => {
        // регистрация не удалась — вернуть переключатель в выключенное положение
        if (!disposed && !applied) setAutostartSetting(false);
      });
    }, 100);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [autostart, setAutostartSetting]);

  useEffect(() => {
    if (!isTauri()) return undefined;
    const presets = [...DEFAULT_STATUS_PRESETS, ...customPresets];
    const timer = setTimeout(() => {
      setStatusPresets(presets);
    }, 100);
    return () => clearTimeout(timer);
  }, [customPresets]);

  useEffect(() => {
    if (!isTauri()) return undefined;
    const emoji = currentStatus?.emoji ?? '';
    const text = currentStatus?.text ? stripTimeSuffix(currentStatus.text) : '';
    const timer = setTimeout(() => {
      setActiveStatus(emoji || text ? { emoji, text } : null);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStatus]);

  useEffect(() => {
    if (!isTauri()) return undefined;
    let disposed = false;
    const disposeFns: Array<() => void> = [];
    listenTrayStatus((preset) => {
      setCustomStatusWithTime(mx, preset.emoji, preset.text, statusNoticeRoomId);
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        disposeFns.push(fn);
      }
    });
    return () => {
      disposed = true;
      disposeFns.forEach((fn) => fn());
    };
  }, [mx, statusNoticeRoomId]);

  useEffect(() => {
    if (!isTauri() || !showTrayIcon) return undefined;
    let total = 0;
    let highlight = 0;
    roomToUnread.forEach((unread, roomId) => {
      if (mx.getRoom(roomId)?.isSpaceRoom()) return;
      total += unread.total;
      highlight += unread.highlight;
    });
    const emoji = currentStatus?.emoji ?? '';
    const timer = setTimeout(() => {
      updateTrayIcon(emoji || null, { total, highlight });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentStatus, roomToUnread, showTrayIcon, mx]);

  return null;
}

function SystemEmojiFeature() {
  const [twitterEmoji] = useSetting(settingsAtom, 'twitterEmoji');

  if (twitterEmoji) {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji');
  } else {
    document.documentElement.style.setProperty('--font-emoji', 'Twemoji_DISABLED');
  }

  return null;
}

function PageZoomFeature() {
  const [pageZoom] = useSetting(settingsAtom, 'pageZoom');

  if (pageZoom === 100) {
    document.documentElement.style.removeProperty('font-size');
  } else {
    document.documentElement.style.setProperty('font-size', `calc(1em * ${pageZoom / 100})`);
  }

  return null;
}

function FaviconUpdater() {
  const mx = useMatrixClient();
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  useEffect(() => {
    let notification = false;
    let highlight = false;
    roomToUnread.forEach((unread, roomId) => {
      if (mx.getRoom(roomId)?.isSpaceRoom()) return;
      if (unread.total > 0) {
        notification = true;
      }
      if (unread.highlight > 0) {
        highlight = true;
      }
    });

    if (notification) {
      setFavicon(highlight ? LogoHighlightSVG : LogoUnreadSVG);
    } else {
      setFavicon(LogoSVG);
    }
  }, [roomToUnread, mx]);

  return null;
}

function InviteNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const invites = useAtomValue(allInvitesAtom);
  const perviousInviteLen = usePreviousValue(invites.length, 0);
  const mx = useMatrixClient();

  const navigate = useNavigate();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');

  const notify = useCallback(
    (count: number) => {
      const noti = showNotification({
        title: 'Invitation',
        icon: LogoSVG,
        badge: LogoSVG,
        body: `You have ${count} new invitation request.`,
        silent: true,
        onClick: () => {
          if (!window.closed) navigate(getInboxInvitesPath());
          noti.close();
        },
      });
    },
    [navigate]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    if (invites.length > perviousInviteLen && mx.getSyncState() === 'SYNCING') {
      if (showNotifications) {
        notify(invites.length - perviousInviteLen);
      }

      if (notificationSound) {
        playSound();
      }
    }
  }, [mx, invites, perviousInviteLen, showNotifications, notificationSound, notify, playSound]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={InviteSound} type="audio/ogg" />
    </audio>
  );
}

function MessageNotifications() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const notifRef = useRef<{ close: () => void }>();
  const unreadCacheRef = useRef<Map<string, UnreadInfo>>(new Map());
  const mx = useMatrixClient();
  const useAuthentication = useMediaAuthentication();
  const [showNotifications] = useSetting(settingsAtom, 'showNotifications');
  const [notificationSound] = useSetting(settingsAtom, 'isNotificationSounds');

  const navigate = useNavigate();
  const notificationSelected = useInboxNotificationsSelected();
  const selectedRoomId = useSelectedRoom();

  const notify = useCallback(
    ({
      roomName,
      roomAvatar,
      username,
      roomId,
      messagePreview,
    }: {
      roomName: string;
      roomAvatar?: string;
      username: string;
      roomId: string;
      eventId: string;
      messagePreview: string;
    }) => {
      const noti = showNotification({
        title: roomName,
        icon: roomAvatar,
        badge: roomAvatar,
        body: `${username}: ${messagePreview}`,
        silent: true,
        tag: roomId,
        onClick: () => {
          if (!window.closed) navigate(getInboxNotificationsPath());
          noti.close();
          notifRef.current = undefined;
        },
      });

      notifRef.current?.close();
      notifRef.current = noti;
    },
    [navigate]
  );

  const notifyForEvent = useCallback(
    (mEvent: MatrixEvent, room: Room) => {
      const sender = mEvent.getSender();
      if (!sender || sender === mx.getUserId()) return;
      const avatarMxc = room.getAvatarFallbackMember()?.getMxcAvatarUrl() ?? room.getMxcAvatarUrl();
      notify({
        roomName: room.name ?? 'Unknown',
        roomAvatar: avatarMxc
          ? mxcUrlToHttp(mx, avatarMxc, useAuthentication, 96, 96, 'crop') ?? undefined
          : undefined,
        username: getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender) ?? sender,
        roomId: room.roomId,
        eventId: mEvent.getId() ?? '',
        messagePreview: extractMessagePreview(mEvent),
      });
    },
    [mx, notify, useAuthentication]
  );

  const playSound = useCallback(() => {
    const audioElement = audioRef.current;
    audioElement?.play();
  }, []);

  useEffect(() => {
    const handleTimelineEvent: RoomEventHandlerMap[RoomEvent.Timeline] = (
      mEvent,
      room,
      toStartOfTimeline,
      removed,
      data
    ) => {
      if (mx.getSyncState() !== 'SYNCING') return;
      if (document.hasFocus() && (selectedRoomId === room?.roomId || notificationSelected)) return;
      if (
        !room ||
        !data.liveEvent ||
        room.isSpaceRoom() ||
        !isNotificationEvent(mEvent) ||
        getNotificationType(mx, room.roomId) === NotificationType.Mute
      ) {
        return;
      }

      const sender = mEvent.getSender();
      const eventId = mEvent.getId();
      if (!sender || !eventId || mEvent.getSender() === mx.getUserId()) return;
      const unreadInfo = getUnreadInfo(room);
      const cachedUnreadInfo = unreadCacheRef.current.get(room.roomId);
      unreadCacheRef.current.set(room.roomId, unreadInfo);

      if (unreadInfo.total === 0) return;
      if (
        cachedUnreadInfo &&
        unreadEqual(unreadInfoToUnread(cachedUnreadInfo), unreadInfoToUnread(unreadInfo))
      ) {
        return;
      }

      if (showNotifications) {
        if (mEvent.getType() === MessageEvent.RoomMessageEncrypted) {
          let notified = false;
          const notifyDecrypted = () => {
            if (notified) return;
            notified = true;
            notifyForEvent(mEvent, room);
          };
          mEvent.once(MatrixEventEvent.Decrypted, notifyDecrypted);
          setTimeout(notifyDecrypted, 5000);
        } else {
          notifyForEvent(mEvent, room);
        }
      }

      if (notificationSound) {
        playSound();
      }
    };
    mx.on(RoomEvent.Timeline, handleTimelineEvent);
    return () => {
      mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
    };
  }, [
    mx,
    notificationSound,
    notificationSelected,
    showNotifications,
    playSound,
    notifyForEvent,
    selectedRoomId,
  ]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <audio ref={audioRef} style={{ display: 'none' }}>
      <source src={NotificationSound} type="audio/ogg" />
    </audio>
  );
}

type ClientNonUIFeaturesProps = {
  children: ReactNode;
};

export function ClientNonUIFeatures({ children }: ClientNonUIFeaturesProps) {
  return (
    <>
      <SystemEmojiFeature />
      <PageZoomFeature />
      <FaviconUpdater />
      <InviteNotifications />
      <MessageNotifications />
      <CustomStatusRestore />
      <AutoRestoreBackup />
      <RetryDecryption />
      <DesktopFeatures />
      {children}
    </>
  );
}
