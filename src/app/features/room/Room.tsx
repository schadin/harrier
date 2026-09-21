import React, { useCallback, useState } from 'react';
import { Badge, Box, Line, Text, config } from 'folds';
import { useParams } from 'react-router-dom';
import { isKeyHotkey } from 'is-hotkey';
import { useAtomValue } from 'jotai';
import { RoomView } from './RoomView';
import { MembersDrawer } from './MembersDrawer';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { PowerLevelsContextProvider, usePowerLevels } from '../../hooks/usePowerLevels';
import { useRoom, useIsDirectRoom } from '../../hooks/useRoom';
import { useKeyDown } from '../../hooks/useKeyDown';
import { markAsRead } from '../../utils/notifications';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { CallView } from '../call/CallView';
import { RoomViewHeader } from './RoomViewHeader';
import { callChatAtom } from '../../state/callEmbed';
import { CallChatView } from './CallChatView';
import { useCallEmbed } from '../../hooks/useCallEmbed';
import { useCallMembers, useCallSession } from '../../hooks/useCall';
import { TasksTab } from '../ds-task-bot/TasksTab';
import { dstaskBotRefreshAtom, useDsTaskBotSettings } from '../../state/dsTaskBot';

export function Room() {
  const { eventId } = useParams();
  const room = useRoom();
  const mx = useMatrixClient();
  const direct = useIsDirectRoom();
  const dsTaskBotSettings = useDsTaskBotSettings();
  const dsTaskBotRefresh = useAtomValue(dstaskBotRefreshAtom);
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks'>('chat');

  const callSession = useCallSession(room);
  const callMembers = useCallMembers(callSession);
  const callEmbed = useCallEmbed();

  const [isDrawer] = useSetting(settingsAtom, 'isPeopleDrawer');
  const [hideActivity] = useSetting(settingsAtom, 'hideActivity');
  const screenSize = useScreenSizeContext();
  const powerLevels = usePowerLevels(room);
  const members = useRoomMembers(mx, room.roomId);
  const chat = useAtomValue(callChatAtom);

  const { botMxid } = dsTaskBotSettings;
  const botInRoom = members.some((member) => member.userId === botMxid);
  const showTasksTab = dsTaskBotSettings.tasksTabEnabled && botMxid !== '' && (botInRoom || direct);

  useKeyDown(
    window,
    useCallback(
      (evt) => {
        if (isKeyHotkey('escape', evt)) {
          markAsRead(mx, room.roomId, hideActivity);
        }
      },
      [mx, room.roomId, hideActivity]
    )
  );

  const callView = callEmbed?.roomId === room.roomId || room.isCallRoom() || callMembers.length > 0;

  return (
    <PowerLevelsContextProvider value={powerLevels}>
      <Box grow="Yes">
        {callView && (screenSize === ScreenSize.Desktop || !chat) && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader callView />
            <Box grow="Yes">
              <CallView />
            </Box>
          </Box>
        )}
        {!callView && (
          <Box grow="Yes" direction="Column">
            <RoomViewHeader />
            {showTasksTab && (
              <Box
                direction="Row"
                gap="100"
                alignItems="Center"
                style={{ padding: `${config.space.S200} ${config.space.S400}` }}
              >
                <Badge
                  as="button"
                  fill={activeTab === 'chat' ? 'Solid' : 'None'}
                  variant="Secondary"
                  radii="400"
                  onClick={() => setActiveTab('chat')}
                >
                  <Text size="T200">Chat</Text>
                </Badge>
                <Badge
                  as="button"
                  fill={activeTab === 'tasks' ? 'Solid' : 'None'}
                  variant="Secondary"
                  radii="400"
                  onClick={() => setActiveTab('tasks')}
                >
                  <Text size="T200">Tasks</Text>
                </Badge>
              </Box>
            )}
            <Box grow="Yes">
              {activeTab === 'chat' || !showTasksTab ? (
                <RoomView eventId={eventId} />
              ) : (
                <TasksTab
                  mx={mx}
                  room={room}
                  botMxid={botMxid}
                  dm={direct}
                  refreshToken={dsTaskBotRefresh}
                />
              )}
            </Box>
          </Box>
        )}

        {callView && chat && (
          <>
            {screenSize === ScreenSize.Desktop && (
              <Line variant="Background" direction="Vertical" size="300" />
            )}
            <CallChatView />
          </>
        )}
        {!callView && screenSize === ScreenSize.Desktop && isDrawer && (
          <>
            <Line variant="Background" direction="Vertical" size="300" />
            <MembersDrawer key={room.roomId} room={room} members={members} />
          </>
        )}
      </Box>
    </PowerLevelsContextProvider>
  );
}
