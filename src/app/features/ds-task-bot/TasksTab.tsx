import React from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixClient, Room } from 'matrix-js-sdk';
import { Box, Button, Icon, Icons, Spinner, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { useBotTaskList } from './hooks';
import { DsTask } from './parser';
import { sendBotCommand } from './helpers';
import { bumpDsTaskBotRefresh } from '../../state/dsTaskBot';

type TasksTabProps = {
  mx: MatrixClient;
  room: Room;
  botMxid: string;
  dm: boolean;
  refreshToken: number;
};

function TaskItem({
  mx,
  roomId,
  botMxid,
  dm,
  task,
}: {
  mx: MatrixClient;
  roomId: string;
  botMxid: string;
  dm: boolean;
  task: DsTask;
}) {
  const { t } = useTranslation();
  const handleClose = () => {
    sendBotCommand(mx, roomId, botMxid, dm, 'close', String(task.id)).then(() => {
      bumpDsTaskBotRefresh();
    });
  };
  const handleFile = () => {
    sendBotCommand(mx, roomId, botMxid, dm, 'file', String(task.id));
  };

  return (
    <Box grow="Yes" alignItems="Center" gap="200">
      <Box grow="Yes" direction="Column" gap="100">
        <Text size="T300" truncate>
          {task.id} {task.title}
        </Text>
        <Text size="T200" priority="300" truncate>
          {task.assignee}
        </Text>
      </Box>
      <Button
        as="button"
        size="300"
        variant="Secondary"
        fill="None"
        radii="400"
        onClick={handleFile}
      >
        <Text size="T200">{t('DsTaskBot.TaskFiles', { defaultValue: 'Files' })}</Text>
      </Button>
      <Button
        as="button"
        size="300"
        variant="Secondary"
        fill="Soft"
        radii="400"
        onClick={handleClose}
      >
        <Text size="T200">{t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}</Text>
      </Button>
    </Box>
  );
}

function Section({
  title,
  tasks,
  children,
}: {
  title: string;
  tasks: DsTask[];
  children: (task: DsTask) => React.ReactNode;
}) {
  return (
    <Box direction="Column" gap="100">
      <Text size="T300">{title}</Text>
      {tasks.length === 0 ? (
        <Text size="T200" priority="300">
          —
        </Text>
      ) : (
        <Box direction="Column" gap="300">
          {tasks.map((task) => (
            <Box key={task.id} direction="Column" gap="100">
              {children(task)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function TasksTab({ mx, room, botMxid, dm, refreshToken }: TasksTabProps) {
  const { t } = useTranslation();
  const myUserId = mx.getUserId() ?? '';
  const { state, refresh } = useBotTaskList(mx, room, botMxid, dm, myUserId, refreshToken);

  const { sections } = state;

  return (
    <Box grow="Yes" direction="Column" gap="300" style={{ padding: config.space.S400 }}>
      <Box alignItems="Center" gap="300">
        <Button
          as="button"
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="400"
          onClick={refresh}
        >
          <Icon size="100" src={Icons.Reload} />
          <Text size="T300">{t('DsTaskBot.Refresh', { defaultValue: 'Refresh' })}</Text>
        </Button>
        {state.status === 'loading' && <Spinner size="300" />}
      </Box>
      {state.status === 'timeout' && (
        <Text size="T200" priority="300">
          {t('DsTaskBot.Timeout', {
            defaultValue: 'The bot did not respond. Showing what we have.',
          })}
        </Text>
      )}
      {state.status === 'done' || state.status === 'timeout' ? (
        <SequenceCard variant="SurfaceVariant" radii="500">
          <Box direction="Column" gap="400" style={{ padding: config.space.S400 }}>
            <Section
              title={t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' })}
              tasks={sections.assignedToMe}
            >
              {(task) => (
                <TaskItem mx={mx} roomId={room.roomId} botMxid={botMxid} dm={dm} task={task} />
              )}
            </Section>
            <Section
              title={t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' })}
              tasks={sections.assignedByMe}
            >
              {(task) => (
                <TaskItem mx={mx} roomId={room.roomId} botMxid={botMxid} dm={dm} task={task} />
              )}
            </Section>
          </Box>
        </SequenceCard>
      ) : (
        <Text size="T200" priority="300">
          {t('DsTaskBot.OpenHint', {
            defaultValue: 'Open the tab to load tasks from the bot.',
          })}
        </Text>
      )}
    </Box>
  );
}
