import React, { useState } from 'react';
import {
  Avatar,
  Box,
  Icon,
  Icons,
  Modal,
  Overlay,
  OverlayBackdrop,
  OverlayCenter,
  Text,
} from 'folds';
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import * as css from './styles.css';
import { UserAvatar } from '../user-avatar';
import colorMXID from '../../../util/colorMXID';
import { getMxIdLocalPart } from '../../utils/matrix';
import { BreakWord, LineClamp3 } from '../../styles/Text.css';
import { UserPresence } from '../../hooks/useUserPresence';
import { getLastActiveLabel } from '../../utils/lastActive';
import { useCustomStatus } from '../../hooks/useCustomStatus';
import { stripTimeSuffix, extractStatusTimeSuffix } from '../../plugins/custom-status';
import { AvatarPresence, PresenceBadge } from '../presence';
import { ImageViewer } from '../image-viewer';
import { stopPropagation } from '../../utils/keyboard';

type UserHeroProps = {
  userId: string;
  avatarUrl?: string;
  presence?: UserPresence;
  action?: React.ReactNode;
};
export function UserHero({ userId, avatarUrl, presence, action }: UserHeroProps) {
  const [viewAvatar, setViewAvatar] = useState<string>();

  return (
    <Box direction="Column" className={css.UserHero}>
      <div
        className={css.UserHeroCoverContainer}
        style={{
          backgroundColor: colorMXID(userId),
          filter: avatarUrl ? undefined : 'brightness(50%)',
        }}
      >
        {avatarUrl && (
          <img className={css.UserHeroCover} src={avatarUrl} alt={userId} draggable="false" />
        )}
      </div>
      <div className={css.UserHeroAvatarContainer}>
        <AvatarPresence
          className={css.UserAvatarContainer}
          badge={
            presence && (
              <PresenceBadge presence={presence.presence} lastActiveTs={presence.lastActiveTs} />
            )
          }
        >
          <Avatar
            as={avatarUrl ? 'button' : 'div'}
            onClick={avatarUrl ? () => setViewAvatar(avatarUrl) : undefined}
            className={css.UserHeroAvatar}
            size="500"
          >
            <UserAvatar
              className={css.UserHeroAvatarImg}
              userId={userId}
              src={avatarUrl}
              alt={userId}
              renderFallback={() => <Icon size="500" src={Icons.User} filled />}
            />
          </Avatar>
        </AvatarPresence>
        {action && <Box className={css.UserHeroAction}>{action}</Box>}
        {viewAvatar && (
          <Overlay open backdrop={<OverlayBackdrop />}>
            <OverlayCenter>
              <FocusTrap
                focusTrapOptions={{
                  initialFocus: false,
                  onDeactivate: () => setViewAvatar(undefined),
                  clickOutsideDeactivates: true,
                  escapeDeactivates: stopPropagation,
                }}
              >
                <Modal size="500" onContextMenu={(evt: any) => evt.stopPropagation()}>
                  <ImageViewer
                    src={viewAvatar}
                    alt={userId}
                    requestClose={() => setViewAvatar(undefined)}
                  />
                </Modal>
              </FocusTrap>
            </OverlayCenter>
          </Overlay>
        )}
      </div>
    </Box>
  );
}

type UserHeroNameProps = {
  displayName?: string;
  userId: string;
  presence?: UserPresence;
};
export function UserHeroName({ displayName, userId, presence }: UserHeroNameProps) {
  const username = getMxIdLocalPart(userId);
  const status = useCustomStatus(userId);

  const lastActiveLabel = presence ? getLastActiveLabel(presence.lastActiveTs) : undefined;
  const statusTime = status?.text ? extractStatusTimeSuffix(status.text) : undefined;
  const customText = status?.text ? stripTimeSuffix(status.text) : undefined;
  const hasStatusLine = lastActiveLabel || status?.emoji || customText;

  return (
    <Box grow="Yes" direction="Column" gap="0">
      <Box alignItems="Baseline" gap="200" wrap="Wrap">
        <Text
          size="H4"
          className={classNames(BreakWord, LineClamp3)}
          title={displayName ?? username}
        >
          {displayName ?? username ?? userId}
        </Text>
      </Box>
      <Box alignItems="Center" gap="100" wrap="Wrap">
        <Text size="T200" className={classNames(BreakWord, LineClamp3)} title={username}>
          @{username}
        </Text>
      </Box>
      {hasStatusLine && (
        <Box alignItems="Center" gap="100" wrap="Wrap">
          {lastActiveLabel && (
            <Text size="T200" priority="300">
              {lastActiveLabel}
            </Text>
          )}
          {lastActiveLabel && (status?.emoji || customText || statusTime) && (
            <Text size="T200" priority="300">
              •
            </Text>
          )}
          {status?.emoji && <Text size="T200">{status.emoji}</Text>}
          {customText && (
            <Text size="T200" priority="300" truncate>
              {customText}
            </Text>
          )}
          {customText && statusTime && (
            <Text size="T200" priority="300">
              •
            </Text>
          )}
          {statusTime && (
            <Text size="T200" priority="300">
              {statusTime}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}
