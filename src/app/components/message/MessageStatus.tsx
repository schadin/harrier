import React, { useEffect, useState } from 'react';
import { Icon, Icons, color } from 'folds';
import {
  EventStatus,
  MatrixEvent,
  MatrixEventEvent,
  MatrixEventHandlerMap,
  Room,
} from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomEventReaders } from '../../hooks/useRoomEventReaders';
import { mDirectAtom } from '../../state/mDirectList';
import { settingsAtom } from '../../state/settings';
import { useSetting } from '../../state/hooks/settings';

export type MessageStatusProps = {
  room: Room;
  mEvent: MatrixEvent;
};

function MessageStatusIndicator({ room, mEvent }: MessageStatusProps) {
  const mx = useMatrixClient();
  const [sendStatus, setSendStatus] = useState<EventStatus | null>(() =>
    mEvent.getAssociatedStatus()
  );
  const readers = useRoomEventReaders(room, mEvent.getId());

  useEffect(() => {
    const handleStatus: MatrixEventHandlerMap[MatrixEventEvent.Status] = () => {
      setSendStatus(mEvent.getAssociatedStatus());
    };
    mEvent.on(MatrixEventEvent.Status, handleStatus);
    return () => {
      mEvent.removeListener(MatrixEventEvent.Status, handleStatus);
    };
  }, [mEvent]);

  if (sendStatus === EventStatus.NOT_SENT || sendStatus === EventStatus.CANCELLED) {
    return <Icon style={{ color: color.Critical.Main }} size="100" src={Icons.Cross} />;
  }

  if (
    sendStatus === EventStatus.SENDING ||
    sendStatus === EventStatus.QUEUED ||
    sendStatus === EventStatus.ENCRYPTING
  ) {
    return <Icon size="100" src={Icons.Clock} />;
  }

  const isRead = readers.some((userId) => userId !== mx.getUserId());
  if (isRead) {
    return <Icon style={{ color: color.Primary.Main }} size="100" src={Icons.CheckTwice} />;
  }

  return <Icon size="100" src={Icons.Check} />;
}

export function MessageStatus({ room, mEvent }: MessageStatusProps) {
  const mx = useMatrixClient();
  const mDirects = useAtomValue(mDirectAtom);
  const [directReadReceipts] = useSetting(settingsAtom, 'directReadReceipts');

  if (mEvent.getSender() !== mx.getUserId()) return null;

  const sendStatus = mEvent.getAssociatedStatus();
  const isSending =
    sendStatus === EventStatus.SENDING ||
    sendStatus === EventStatus.QUEUED ||
    sendStatus === EventStatus.ENCRYPTING;
  const isFailed = sendStatus === EventStatus.NOT_SENT || sendStatus === EventStatus.CANCELLED;

  if (isSending || isFailed) return <MessageStatusIndicator room={room} mEvent={mEvent} />;

  if (!mDirects.has(room.roomId) || directReadReceipts !== 'checkmark') return null;

  return <MessageStatusIndicator room={room} mEvent={mEvent} />;
}
