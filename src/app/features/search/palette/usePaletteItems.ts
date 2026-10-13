import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { Icons } from 'folds';
import { useMatrixClient } from '../../../hooks/useMatrixClient';
import { useRoomNavigate } from '../../../hooks/useRoomNavigate';
import { useSelectedRoom } from '../../../hooks/router/useSelectedRoom';
import { useDirects, useRooms, useSpaces } from '../../../state/hooks/roomList';
import { mDirectAtom } from '../../../state/mDirectList';
import { allRoomsAtom } from '../../../state/room-list/roomList';
import { roomToUnreadAtom } from '../../../state/room/roomToUnread';
import { useAllJoinedRoomsSet, useGetRoom } from '../../../hooks/useGetRoom';
import { getDMRoomFor, getMxIdLocalPart, guessDmRoomUserId } from '../../../utils/matrix';
import { getDirectCreatePath } from '../../../pages/pathUtils';
import { useOpenSettingsPage } from '../../../state/settingsNav';
import { SettingsPages } from '../../settings';
import { useOpenCreateRoomModal } from '../../../state/hooks/createRoomModal';
import { useOpenCreateSpaceModal } from '../../../state/hooks/createSpaceModal';
import {
  clearCustomStatus,
  DEFAULT_STATUS_PRESETS,
  setCustomStatusWithTime,
} from '../../../plugins/custom-status';
import { useCustomStatus } from '../../../hooks/useCustomStatus';
import { useSetting } from '../../../state/hooks/settings';
import { settingsAtom } from '../../../state/settings';
import {
  getRoomNotificationMode,
  RoomNotificationMode,
  setRoomNotificationPreference,
  useRoomsNotificationPreferences,
} from '../../../hooks/useRoomsNotificationPreferences';
import { markAsRead } from '../../../utils/notifications';
import { PaletteCategory, PaletteItem } from './types';

const useRoomItems = (): PaletteItem[] => {
  const mx = useMatrixClient();
  const { navigateRoom } = useRoomNavigate();
  const allRoomsSet = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allRoomsSet);
  const mDirects = useAtomValue(mDirectAtom);
  const rooms = useRooms(mx, allRoomsAtom, mDirects);
  const directs = useDirects(mx, allRoomsAtom, mDirects);

  return useMemo(() => {
    const myUserId = mx.getSafeUserId();
    const makeItem = (roomId: string, dm: boolean): PaletteItem => {
      const room = getRoom(roomId);
      const title = room?.name ?? roomId;
      const keywords = [roomId];
      const canonicalAlias = room?.getCanonicalAlias();
      if (canonicalAlias) keywords.push(canonicalAlias);
      let subtitle: string | undefined;
      if (dm && room) {
        const dmUserId = guessDmRoomUserId(room, myUserId);
        if (dmUserId) {
          keywords.push(dmUserId, getMxIdLocalPart(dmUserId) ?? '');
          subtitle = dmUserId;
        }
      }
      return {
        id: `room:${roomId}`,
        category: PaletteCategory.Rooms,
        title,
        subtitle,
        keywords,
        roomId,
        dm,
        run: () => navigateRoom(roomId),
      };
    };
    return [
      ...rooms.map((roomId) => makeItem(roomId, false)),
      ...directs.map((roomId) => makeItem(roomId, true)),
    ];
  }, [mx, getRoom, rooms, directs, navigateRoom]);
};

const useSpaceItems = (): PaletteItem[] => {
  const mx = useMatrixClient();
  const { navigateSpace } = useRoomNavigate();
  const spaces = useSpaces(mx, allRoomsAtom);
  const allRoomsSet = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allRoomsSet);

  return useMemo(
    () =>
      spaces.map((roomId) => {
        const room = getRoom(roomId);
        const keywords = [roomId];
        const canonicalAlias = room?.getCanonicalAlias();
        if (canonicalAlias) keywords.push(canonicalAlias);
        return {
          id: `space:${roomId}`,
          category: PaletteCategory.Spaces,
          title: room?.name ?? roomId,
          keywords,
          roomId,
          run: () => navigateSpace(roomId),
        };
      }),
    [getRoom, spaces, navigateSpace]
  );
};

const usePeopleItems = (): PaletteItem[] => {
  const mx = useMatrixClient();
  const navigate = useNavigate();
  const { navigateRoom } = useRoomNavigate();
  const allRoomsSet = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allRoomsSet);
  const mDirects = useAtomValue(mDirectAtom);
  const directs = useDirects(mx, allRoomsAtom, mDirects);
  // mx.getUsers() меняется по мере синка; пересчитываем при смене списка комнат
  // как дешёвый индикатор обновления известных пользователей
  const rooms = useRooms(mx, allRoomsAtom, mDirects);

  return useMemo(() => {
    const myUserId = mx.getSafeUserId();
    const dmPartnerIds = new Set<string>();
    directs.forEach((roomId) => {
      const room = getRoom(roomId);
      if (room) dmPartnerIds.add(guessDmRoomUserId(room, myUserId));
    });
    const users = mx
      .getUsers()
      .filter(
        (user) => user.userId !== myUserId && (dmPartnerIds.has(user.userId) || !!user.displayName)
      );

    return users.map((user) => {
      const { userId } = user;
      const localPart = getMxIdLocalPart(userId) ?? userId;
      return {
        id: `user:${userId}`,
        category: PaletteCategory.People,
        title: user.displayName ?? localPart,
        subtitle: userId,
        keywords: [userId, localPart],
        dm: dmPartnerIds.has(userId),
        run: () => {
          const dmRoom = getDMRoomFor(mx, userId);
          if (dmRoom) {
            navigateRoom(dmRoom.roomId);
          } else {
            navigate(`${getDirectCreatePath()}?userId=${encodeURIComponent(userId)}`);
          }
        },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mx, directs, rooms, getRoom, navigate, navigateRoom]);
};

type SettingsPageDef = {
  page: SettingsPages;
  nameKey: string;
  fallback: string;
};

const SETTINGS_PAGES: SettingsPageDef[] = [
  {
    page: SettingsPages.GeneralPage,
    nameKey: 'CommandPalette.settings.general',
    fallback: 'General',
  },
  {
    page: SettingsPages.AccountPage,
    nameKey: 'CommandPalette.settings.account',
    fallback: 'Account',
  },
  { page: SettingsPages.StatusPage, nameKey: 'CommandPalette.settings.status', fallback: 'Status' },
  {
    page: SettingsPages.NotificationPage,
    nameKey: 'CommandPalette.settings.notifications',
    fallback: 'Notifications',
  },
  {
    page: SettingsPages.DevicesPage,
    nameKey: 'CommandPalette.settings.devices',
    fallback: 'Devices',
  },
  {
    page: SettingsPages.EmojisStickersPage,
    nameKey: 'CommandPalette.settings.emojisStickers',
    fallback: 'Emojis & Stickers',
  },
  {
    page: SettingsPages.DeveloperToolsPage,
    nameKey: 'CommandPalette.settings.developerTools',
    fallback: 'Developer Tools',
  },
  { page: SettingsPages.AboutPage, nameKey: 'CommandPalette.settings.about', fallback: 'About' },
];

const useSettingsItems = (): PaletteItem[] => {
  const { t } = useTranslation();
  const openSettingsPage = useOpenSettingsPage();

  return useMemo(
    () =>
      SETTINGS_PAGES.map((def) => ({
        id: `settings:${def.page}`,
        category: PaletteCategory.Settings,
        title: t(def.nameKey, def.fallback),
        keywords: [def.fallback],
        icon: Icons.Setting,
        run: () => openSettingsPage(def.page),
      })),
    [t, openSettingsPage]
  );
};

export type PaletteActionHandlers = {
  onLogout: () => void;
  onShowUnread: () => void;
};

const useActionItems = ({ onLogout, onShowUnread }: PaletteActionHandlers): PaletteItem[] => {
  const mx = useMatrixClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openCreateRoomModal = useOpenCreateRoomModal();
  const openCreateSpaceModal = useOpenCreateSpaceModal();
  const [customPresets] = useSetting(settingsAtom, 'statusPresets');
  const [statusNoticeRoomId] = useSetting(settingsAtom, 'statusNoticeRoomId');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const currentStatus = useCustomStatus(mx.getSafeUserId());
  const roomToUnread = useAtomValue(roomToUnreadAtom);
  const selectedRoomId = useSelectedRoom();
  const notificationPreferences = useRoomsNotificationPreferences();

  return useMemo(() => {
    const items: PaletteItem[] = [];

    const presets = [...DEFAULT_STATUS_PRESETS, ...customPresets];
    presets.forEach((preset) => {
      items.push({
        id: `action:status:${preset.emoji}:${preset.text}`,
        category: PaletteCategory.Actions,
        title: t('CommandPalette.actions.setStatus', 'Set status: {{status}}', {
          status: `${preset.emoji} ${preset.text}`,
        }),
        keywords: ['status', 'статус', preset.text],
        icon: Icons.Heart,
        run: () => setCustomStatusWithTime(mx, preset.emoji, preset.text, statusNoticeRoomId),
      });
    });

    if (currentStatus?.emoji) {
      items.push({
        id: 'action:status:clear',
        category: PaletteCategory.Actions,
        title: t('CommandPalette.actions.clearStatus', 'Clear status'),
        keywords: ['status', 'clear', 'статус'],
        icon: Icons.Cross,
        run: () => clearCustomStatus(mx),
      });
    }

    if (selectedRoomId) {
      const previousMode = getRoomNotificationMode(notificationPreferences, selectedRoomId);
      const muted = previousMode === RoomNotificationMode.Mute;
      const nextMode = muted ? RoomNotificationMode.Unset : RoomNotificationMode.Mute;
      items.push({
        id: muted ? 'action:room:unmute' : 'action:room:mute',
        category: PaletteCategory.Actions,
        title: muted
          ? t('CommandPalette.actions.unmuteRoom', 'Unmute this room')
          : t('CommandPalette.actions.muteRoom', 'Mute this room'),
        keywords: ['mute', 'unmute', 'notifications', 'уведомления'],
        icon: muted ? Icons.BellRing : Icons.BellMute,
        run: () => setRoomNotificationPreference(mx, selectedRoomId, nextMode, previousMode),
      });
    }

    const unreadRoomIds = Array.from(roomToUnread.keys()).filter((roomId) => {
      const unread = roomToUnread.get(roomId);
      return unread && (unread.total > 0 || unread.highlight > 0);
    });
    if (unreadRoomIds.length > 0) {
      items.push({
        id: 'action:markAllRead',
        category: PaletteCategory.Actions,
        title: t('CommandPalette.actions.markAllRead', 'Mark all as read'),
        keywords: ['read', 'unread', 'прочитать'],
        icon: Icons.CheckTwice,
        run: async () => {
          await Promise.all(unreadRoomIds.map((roomId) => markAsRead(mx, roomId, hideActivity)));
        },
      });
    }

    items.push({
      id: 'action:createRoom',
      category: PaletteCategory.Actions,
      title: t('CommandPalette.actions.createRoom', 'Create room'),
      keywords: ['create', 'room', 'создать'],
      icon: Icons.Plus,
      run: () => openCreateRoomModal(),
    });
    items.push({
      id: 'action:createDm',
      category: PaletteCategory.Actions,
      title: t('CommandPalette.actions.createDm', 'Create direct message'),
      keywords: ['create', 'dm', 'chat', 'direct', 'создать', 'чат'],
      icon: Icons.Message,
      run: () => navigate(getDirectCreatePath()),
    });
    items.push({
      id: 'action:createSpace',
      category: PaletteCategory.Actions,
      title: t('CommandPalette.actions.createSpace', 'Create space'),
      keywords: ['create', 'space', 'создать'],
      icon: Icons.PlusCircle,
      run: () => openCreateSpaceModal(),
    });
    items.push({
      id: 'action:logout',
      category: PaletteCategory.Actions,
      title: t('CommandPalette.actions.logout', 'Log out'),
      keywords: ['logout', 'exit', 'выйти'],
      icon: Icons.Power,
      keepOpen: true,
      run: () => onLogout(),
    });
    items.push({
      id: 'action:showUnread',
      category: PaletteCategory.Actions,
      title: t('CommandPalette.actions.unread', 'Show unread chats'),
      keywords: ['unread', 'badge', 'непрочитанные', 'входящие'],
      icon: Icons.MessageUnread,
      keepOpen: true,
      run: () => onShowUnread(),
    });

    return items;
  }, [
    mx,
    t,
    navigate,
    customPresets,
    statusNoticeRoomId,
    hideActivity,
    currentStatus,
    roomToUnread,
    selectedRoomId,
    notificationPreferences,
    openCreateRoomModal,
    openCreateSpaceModal,
    onLogout,
    onShowUnread,
  ]);
};

export const usePaletteItems = (handlers: PaletteActionHandlers): PaletteItem[] => {
  const roomItems = useRoomItems();
  const spaceItems = useSpaceItems();
  const peopleItems = usePeopleItems();
  const settingsItems = useSettingsItems();
  const actionItems = useActionItems(handlers);

  return useMemo(
    () => [...actionItems, ...roomItems, ...peopleItems, ...spaceItems, ...settingsItems],
    [actionItems, roomItems, peopleItems, spaceItems, settingsItems]
  );
};
