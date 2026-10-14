import FocusTrap from 'focus-trap-react';
import {
  Avatar,
  Box,
  config,
  Icon,
  Icons,
  Input,
  Line,
  MenuItem,
  Modal,
  Overlay,
  OverlayCenter,
  Scroll,
  Spinner,
  Text,
  toRem,
} from 'folds';
import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAllJoinedRoomsSet, useGetRoom } from '../../hooks/useGetRoom';
import { RoomAvatar, RoomIcon } from '../../components/room-avatar';
import { getDirectRoomAvatarUrl, getRoomAvatarUrl } from '../../utils/room';
import { nameInitials } from '../../utils/common';
import { useListFocusIndex } from '../../hooks/useListFocusIndex';
import { roomToUnreadAtom } from '../../state/room/roomToUnread';
import { UnreadBadge, UnreadBadgeCenter } from '../../components/unread-badge';
import { searchModalAtom } from '../../state/searchModal';
import { useKeyDown } from '../../hooks/useKeyDown';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { KeySymbol } from '../../utils/key-symbol';
import { isMacOS } from '../../utils/user-agent';
import { LogoutDialog } from '../../components/LogoutDialog';
import {
  PALETTE_CATEGORY_ORDER,
  PaletteCategory,
  PaletteItem,
  ScoredPaletteItem,
} from './palette/types';
import { fuzzyMatch, fuzzyMatchAny, PALETTE_CATEGORY_LIMIT } from './palette/fuzzy';
import { getRecentPaletteItemIds, pushRecentPaletteItem } from './palette/recent';
import { usePaletteItems } from './palette/usePaletteItems';
import { UnreadPreviewLabels, buildUnreadPaletteItems, matchUnreadItem } from './palette/unread';
import { HighlightedText } from './palette/HighlightedText';

const CATEGORY_LABEL_KEYS: Record<PaletteCategory, [string, string]> = {
  [PaletteCategory.Actions]: ['CommandPalette.categories.actions', 'Actions'],
  [PaletteCategory.Rooms]: ['CommandPalette.categories.rooms', 'Rooms'],
  [PaletteCategory.People]: ['CommandPalette.categories.people', 'People'],
  [PaletteCategory.Spaces]: ['CommandPalette.categories.spaces', 'Spaces'],
  [PaletteCategory.Settings]: ['CommandPalette.categories.settings', 'Settings'],
};

type ParsedQuery = {
  query: string;
  categories: Set<PaletteCategory> | undefined;
};

const parseQuery = (rawValue: string): ParsedQuery => {
  const value = rawValue.trim();
  const prefix = value.match(/^[#@*]/)?.[0];
  if (prefix === '#') {
    return { query: value.slice(1).trim(), categories: new Set([PaletteCategory.Rooms]) };
  }
  if (prefix === '*') {
    return { query: value.slice(1).trim(), categories: new Set([PaletteCategory.Spaces]) };
  }
  if (prefix === '@') {
    return {
      query: value.slice(1).trim(),
      categories: new Set([PaletteCategory.People, PaletteCategory.Rooms]),
    };
  }
  return { query: value, categories: undefined };
};

const searchItems = (
  items: PaletteItem[],
  { query, categories }: ParsedQuery
): ScoredPaletteItem[] => {
  const scored: ScoredPaletteItem[] = [];
  items.forEach((item) => {
    if (categories && !categories.has(item.category)) return;
    // '@' среди комнат оставляет только DM
    if (
      categories?.has(PaletteCategory.People) &&
      item.category === PaletteCategory.Rooms &&
      !item.dm
    )
      return;

    const best = fuzzyMatchAny(query, [item.title, item.subtitle, ...item.keywords]);
    if (!best) return;
    const titleMatch = fuzzyMatch(query, item.title);
    scored.push({ item, score: best.score, indices: titleMatch?.indices });
  });

  const categoryOrder = (category: PaletteCategory) => PALETTE_CATEGORY_ORDER.indexOf(category);
  scored.sort((a, b) => {
    const byCategory = categoryOrder(a.item.category) - categoryOrder(b.item.category);
    if (byCategory !== 0) return byCategory;
    return b.score - a.score;
  });

  const perCategory = new Map<PaletteCategory, number>();
  return scored.filter(({ item }) => {
    const count = perCategory.get(item.category) ?? 0;
    if (count >= PALETTE_CATEGORY_LIMIT) return false;
    perCategory.set(item.category, count + 1);
    return true;
  });
};

type DefaultResults = {
  entries: ScoredPaletteItem[];
  isRecent: boolean;
};

const getDefaultItems = (items: PaletteItem[]): DefaultResults => {
  const byId = new Map(items.map((item) => [item.id, item]));

  // история: невалидные элементы (покинутые комнаты, удалённые пресеты)
  // молча отфильтровываются — их нет среди текущих items
  const recent = getRecentPaletteItemIds()
    .map((id) => byId.get(id))
    .filter((item): item is PaletteItem => !!item)
    .map((item) => ({ item, score: 0, indices: undefined }));

  if (recent.length > 0) return { entries: recent, isRecent: true };

  // истории нет — показываем действия как отправную точку
  return {
    entries: items
      .filter((item) => item.category === PaletteCategory.Actions)
      .slice(0, 6)
      .map((item) => ({ item, score: 0, indices: undefined })),
    isRecent: false,
  };
};

type SearchProps = {
  requestClose: () => void;
};
export function Search({ requestClose }: SearchProps) {
  const mx = useMatrixClient();
  const { t } = useTranslation();
  const useAuthentication = useMediaAuthentication();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const roomToUnread = useAtomValue(roomToUnreadAtom);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unreadMode, setUnreadMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const handleLogout = useCallback(() => setLogoutOpen(true), []);

  const allRoomsSet = useAllJoinedRoomsSet();
  const getRoom = useGetRoom(allRoomsSet);

  const [parsedQuery, setParsedQuery] = useState<ParsedQuery>({
    query: '',
    categories: undefined,
  });

  const handleShowUnread = useCallback(() => {
    setUnreadMode(true);
    setInputValue('');
    setParsedQuery({ query: '', categories: undefined });
  }, []);

  const items = usePaletteItems({ onLogout: handleLogout, onShowUnread: handleShowUnread });

  const unreadPreviewLabels = useMemo<UnreadPreviewLabels>(
    () => ({
      image: t('CommandPalette.unreadPreview.image', '[Photo]'),
      video: t('CommandPalette.unreadPreview.video', '[Video]'),
      audio: t('CommandPalette.unreadPreview.audio', '[Audio]'),
      file: t('CommandPalette.unreadPreview.file', '[File]'),
      sticker: t('CommandPalette.unreadPreview.sticker', '[Sticker]'),
      redacted: t('CommandPalette.unreadPreview.redacted', '[Deleted message]'),
      encrypted: t('CommandPalette.unreadPreview.encrypted', '[Encrypted message]'),
    }),
    [t]
  );

  const defaultResults = useMemo(() => getDefaultItems(items), [items]);

  const results = useMemo(() => {
    if (unreadMode) {
      const unreadItems = buildUnreadPaletteItems(items, mx, roomToUnread, unreadPreviewLabels);
      if (parsedQuery.query === '') return unreadItems;
      return unreadItems.filter((scored) => matchUnreadItem(scored.item, parsedQuery.query));
    }
    return parsedQuery.query === '' ? defaultResults.entries : searchItems(items, parsedQuery);
  }, [items, mx, roomToUnread, unreadPreviewLabels, unreadMode, parsedQuery, defaultResults]);

  const listFocus = useListFocusIndex(results.length, 0);

  const runItem = useCallback(
    async (scored: ScoredPaletteItem) => {
      if (busy) return;
      pushRecentPaletteItem(scored.item.id);
      const result = scored.item.run();
      if (result instanceof Promise) {
        setBusy(true);
        try {
          await result;
        } catch {
          // ошибка действия — палитру всё равно закрываем
        }
        setBusy(false);
      }
      if (!scored.item.keepOpen) requestClose();
    },
    [busy, requestClose]
  );

  const handleInputChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    listFocus.reset();
    const { value } = evt.currentTarget;
    setInputValue(value);
    setParsedQuery(parseQuery(value));
  };

  const handleInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (evt.key === 'Enter' && results[listFocus.index]) {
      evt.preventDefault();
      runItem(results[listFocus.index]);
      return;
    }
    if (evt.key === 'ArrowDown') {
      evt.preventDefault();
      listFocus.next();
      return;
    }
    if (evt.key === 'ArrowUp') {
      evt.preventDefault();
      listFocus.previous();
      return;
    }
    if (unreadMode && evt.key === 'Backspace' && inputValue === '') {
      setUnreadMode(false);
    }
  };

  useEffect(() => {
    const scrollView = scrollRef.current;
    const focusedItem = scrollView?.querySelector(`[data-focus-index="${listFocus.index}"]`);

    if (focusedItem && scrollView) {
      focusedItem.scrollIntoView({
        block: 'center',
      });
    }
  }, [listFocus.index]);

  if (logoutOpen) {
    return (
      <Overlay open>
        <OverlayCenter>
          <FocusTrap
            focusTrapOptions={{
              returnFocusOnDeactivate: false,
              allowOutsideClick: true,
              clickOutsideDeactivates: true,
              onDeactivate: requestClose,
            }}
          >
            <LogoutDialog handleClose={requestClose} />
          </FocusTrap>
        </OverlayCenter>
      </Overlay>
    );
  }

  const renderInputBefore = () => {
    if (busy) return <Spinner size="200" variant="Secondary" />;
    if (unreadMode) return <Icon size="200" src={Icons.MessageUnread} />;
    return <Icon size="200" src={Icons.Search} />;
  };

  let lastCategory: PaletteCategory | 'recent' | undefined;

  return (
    <Overlay open>
      <OverlayCenter>
        <FocusTrap
          focusTrapOptions={{
            initialFocus: () => inputRef.current,
            returnFocusOnDeactivate: false,
            allowOutsideClick: true,
            clickOutsideDeactivates: true,
            onDeactivate: requestClose,
            escapeDeactivates: (evt) => {
              evt.stopPropagation();
              return true;
            },
          }}
        >
          <Modal size="400" style={{ maxHeight: toRem(400), borderRadius: config.radii.R500 }}>
            <Box
              shrink="No"
              style={{ padding: config.space.S400, paddingBottom: 0 }}
              direction="Column"
            >
              <Input
                ref={inputRef}
                size="500"
                variant="Background"
                radii="400"
                outlined
                value={inputValue}
                placeholder={
                  unreadMode
                    ? t('CommandPalette.unreadPlaceholder', 'Unread chats')
                    : t('CommandPalette.placeholder', 'Search rooms, people, actions…')
                }
                before={renderInputBefore()}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
              />
            </Box>
            <Box grow="Yes">
              {results.length === 0 && (
                <Box
                  style={{ paddingTop: config.space.S700 }}
                  grow="Yes"
                  alignItems="Center"
                  justifyContent="Center"
                  direction="Column"
                  gap="100"
                >
                  <Text size="H6" align="Center">
                    {unreadMode
                      ? t('CommandPalette.noUnread', 'No unread chats')
                      : t('CommandPalette.noResults', 'No match found')}
                  </Text>
                  <Text size="T200" align="Center">
                    {unreadMode
                      ? t('CommandPalette.noUnreadDescription', 'All your chats are read.')
                      : t('CommandPalette.noResultsFor', 'No match found for "{{query}}".', {
                          query: parsedQuery.query,
                        })}
                  </Text>
                </Box>
              )}
              {results.length > 0 && (
                <Scroll ref={scrollRef} size="300" hideTrack>
                  <div style={{ padding: config.space.S400, paddingRight: config.space.S200 }}>
                    {results.map((scored, index) => {
                      const { item } = scored;
                      const group: PaletteCategory | 'recent' =
                        parsedQuery.query === '' && defaultResults.isRecent
                          ? 'recent'
                          : item.category;
                      const showHeader = group !== lastCategory;
                      lastCategory = group;

                      const room = item.roomId ? getRoom(item.roomId) : undefined;
                      const unread = item.roomId ? roomToUnread.get(item.roomId) : undefined;

                      return (
                        <React.Fragment key={item.id}>
                          {showHeader && (
                            <Box
                              style={{
                                padding: `${config.space.S200} ${config.space.S200} ${config.space.S100}`,
                              }}
                            >
                              <Text size="T200" priority="300">
                                {group === 'recent'
                                  ? t('CommandPalette.recent', 'Recent')
                                  : t(...CATEGORY_LABEL_KEYS[group])}
                              </Text>
                            </Box>
                          )}
                          <MenuItem
                            as="button"
                            data-focus-index={index}
                            data-item-id={item.id}
                            onClick={() => runItem(scored)}
                            variant={listFocus.index === index ? 'Primary' : 'Surface'}
                            aria-pressed={listFocus.index === index}
                            radii="400"
                            after={
                              unread && (
                                <UnreadBadgeCenter>
                                  <UnreadBadge
                                    highlight={unread.highlight > 0}
                                    count={unread.total}
                                  />
                                </UnreadBadgeCenter>
                              )
                            }
                            before={
                              room ? (
                                <Avatar size="200" radii={item.dm ? '400' : '300'}>
                                  {item.dm || room.isSpaceRoom() ? (
                                    <RoomAvatar
                                      roomId={room.roomId}
                                      src={
                                        item.dm
                                          ? getDirectRoomAvatarUrl(mx, room, 32, useAuthentication)
                                          : getRoomAvatarUrl(mx, room, 32, useAuthentication)
                                      }
                                      alt={room.name}
                                      renderFallback={() => (
                                        <Text as="span" size="H6">
                                          {nameInitials(room.name)}
                                        </Text>
                                      )}
                                    />
                                  ) : (
                                    <RoomIcon
                                      size="100"
                                      joinRule={room.getJoinRule()}
                                      roomType={room.getType()}
                                    />
                                  )}
                                </Avatar>
                              ) : (
                                <Avatar size="200" radii="300">
                                  <Icon size="100" src={item.icon ?? Icons.Search} />
                                </Avatar>
                              )
                            }
                          >
                            <Box grow="Yes" direction="Column">
                              <Box alignItems="Center" gap="100">
                                <Text size="T400" truncate>
                                  <HighlightedText text={item.title} indices={scored.indices} />
                                </Text>
                                {item.subtitle && (
                                  <Text as="span" size="T200" priority="300" truncate>
                                    {item.subtitle}
                                  </Text>
                                )}
                              </Box>
                              {item.preview && (
                                <Text size="T200" priority="300" truncate>
                                  {item.preview}
                                </Text>
                              )}
                            </Box>
                          </MenuItem>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </Scroll>
              )}
            </Box>
            <Line size="300" />
            <Box shrink="No" justifyContent="Center" style={{ padding: config.space.S200 }}>
              <Text size="T200" priority="300">
                {unreadMode ? (
                  <>
                    {t('CommandPalette.unreadFooter', 'Unread chats')} —{' '}
                    {t('CommandPalette.unreadFooterHint', 'Backspace to go back, Esc to close')}
                  </>
                ) : (
                  <>
                    {t('CommandPalette.hint', 'Type')} <b>#</b>{' '}
                    {t('CommandPalette.hintRooms', 'for rooms')}, <b>@</b>{' '}
                    {t('CommandPalette.hintPeople', 'for people')}, <b>*</b>{' '}
                    {t('CommandPalette.hintSpaces', 'for spaces')}.{' '}
                    {t('CommandPalette.hotkey', 'Hotkey')}:{' '}
                    <b>{isMacOS() ? KeySymbol.Command : 'Ctrl'} + P</b>
                  </>
                )}
              </Text>
            </Box>
          </Modal>
        </FocusTrap>
      </OverlayCenter>
    </Overlay>
  );
}

/**
 * Шорткат по физической клавише (event.code), а не по символу (event.key) —
 * работает в любой раскладке клавиатуры (например, Ctrl+P в русской раскладке).
 */
const isPaletteHotkey = (event: KeyboardEvent): boolean =>
  (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.code === 'KeyP';

export function SearchModalRenderer() {
  const [opened, setOpen] = useAtom(searchModalAtom);

  useKeyDown(
    window,
    useCallback(
      (event) => {
        if (isPaletteHotkey(event)) {
          event.preventDefault();
          if (opened) {
            setOpen(false);
            return;
          }

          const portalContainer = document.getElementById('portalContainer');
          if (portalContainer && portalContainer.children.length > 0) {
            return;
          }
          setOpen(true);
        }
      },
      [opened, setOpen]
    )
  );

  return opened && <Search requestClose={() => setOpen(false)} />;
}
