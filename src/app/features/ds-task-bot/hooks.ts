import { MatrixClient, MatrixEvent, Room, RoomEvent } from 'matrix-js-sdk';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetAtom } from 'jotai';
import { MessageEvent } from '../../../types/matrix/room';
import { DsTask, parseTaskLines, splitTasksByAssignee } from './parser';
import { BOT_RESPONSE_TIMEOUT_MS, buildBotCommand, getReplyEventId, sendBotText } from './helpers';
import { dsTaskBotLastTasksAtom } from '../../state/dsTaskBot';

export type BotTaskSections = {
  assignedToMe: DsTask[];
  assignedByMe: DsTask[];
};

export type BotTaskListState =
  | { status: 'idle'; sections: BotTaskSections }
  | { status: 'loading'; sections: BotTaskSections }
  | { status: 'done'; sections: BotTaskSections }
  | { status: 'timeout'; sections: BotTaskSections };

const EMPTY_SECTIONS: BotTaskSections = { assignedToMe: [], assignedByMe: [] };

export const useBotTaskList = (
  mx: MatrixClient,
  room: Room,
  botMxid: string,
  dm: boolean,
  myUserId: string,
  refreshToken: number
): { state: BotTaskListState; refresh: () => void } => {
  const [state, setState] = useState<BotTaskListState>({
    status: 'idle',
    sections: EMPTY_SECTIONS,
  });
  const setLastTasks = useSetAtom(dsTaskBotLastTasksAtom);
  const requestRef = useRef<{
    commandEventId: string | undefined;
    expected: number;
    received: number;
    sections: BotTaskSections;
  } | null>(null);

  const refresh = useCallback(() => {
    setState((prev) => ({ status: 'loading', sections: prev.sections }));
  }, []);

  useEffect(
    () => {
      if (!botMxid || !myUserId) return undefined;

      let disposed = false;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const pending = requestRef.current ?? {
        commandEventId: undefined as string | undefined,
        expected: 1,
        received: 0,
        sections: { ...EMPTY_SECTIONS },
      };

      const finish = (status: BotTaskListState['status']) => {
        if (disposed) return;
        if (timer) clearTimeout(timer);
        requestRef.current = null;
        setLastTasks((prev) => ({
          ...prev,
          [room.roomId]: [...pending.sections.assignedToMe, ...pending.sections.assignedByMe],
        }));
        setState({ status, sections: { ...pending.sections } });
      };

      const handleTimelineEvent = (event: MatrixEvent) => {
        if (disposed) return;
        if (pending.commandEventId === undefined) return;
        if (event.getRoomId() !== room.roomId) return;
        if (event.getSender() !== botMxid) return;
        if (event.getType() !== MessageEvent.RoomMessage) return;
        if (getReplyEventId(event) !== pending.commandEventId) return;

        const { body } = event.getContent();
        if (typeof body === 'string') {
          const tasks = parseTaskLines(body);
          if (tasks.length > 0) {
            const { assignedToMe, assignedByMe } = splitTasksByAssignee(tasks, myUserId);
            pending.sections.assignedToMe.push(...assignedToMe);
            pending.sections.assignedByMe.push(...assignedByMe);
          }
        }

        pending.received += 1;
        if (pending.received >= pending.expected) {
          finish('done');
        }
      };

      const run = async () => {
        setState({ status: 'loading', sections: { ...pending.sections } });
        const { body, mentionUserIds, expectedReplies } = buildBotCommand(
          botMxid,
          dm,
          dm ? 'list' : 'all',
          ''
        );
        pending.expected = expectedReplies;

        mx.on(RoomEvent.Timeline, handleTimelineEvent);
        const eventId = await sendBotText(mx, room.roomId, body, mentionUserIds);
        if (disposed) return;
        if (!eventId) {
          mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
          finish('timeout');
          return;
        }

        pending.commandEventId = eventId;
        timer = setTimeout(() => {
          mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
          finish('timeout');
        }, BOT_RESPONSE_TIMEOUT_MS);
      };

      run();

      return function cleanup() {
        disposed = true;
        if (timer) clearTimeout(timer);
        mx.removeListener(RoomEvent.Timeline, handleTimelineEvent);
        requestRef.current = pending;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mx, room, botMxid, dm, myUserId, refreshToken]
  );

  return { state, refresh };
};
