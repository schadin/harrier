import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixClient } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { Box, Button, Icon, Icons, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { ParsedBotMessage, splitTasksByAssignee } from './parser';
import { sendBotCommand } from './helpers';
import { dsTaskBotLastTasksAtom } from '../../state/dsTaskBot';

type DsTaskBotCardsProps = {
  parsed: ParsedBotMessage;
  mx: MatrixClient;
  roomId: string;
  myUserId: string;
  botMxid: string;
  dm: boolean;
};

function TaskRow({
  id,
  title,
  assignee,
  onClose,
  onFile,
}: {
  id: number;
  title: string;
  assignee: string;
  onClose: () => void;
  onFile: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box grow="Yes" alignItems="Center" gap="200">
      <Box grow="Yes" direction="Column" gap="100">
        <Text size="T300" truncate>
          {id} {title}
        </Text>
        <Text size="T200" priority="300" truncate>
          {assignee}
        </Text>
      </Box>
      <Button as="button" size="300" variant="Secondary" fill="None" radii="400" onClick={onFile}>
        <Text size="T200">{t('DsTaskBot.TaskFiles', { defaultValue: 'Files' })}</Text>
      </Button>
      <Button as="button" size="300" variant="Secondary" fill="Soft" radii="400" onClick={onClose}>
        <Text size="T200">{t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}</Text>
      </Button>
    </Box>
  );
}

export function DsTaskBotCards({ parsed, mx, roomId, myUserId, botMxid, dm }: DsTaskBotCardsProps) {
  const { t } = useTranslation();
  const setLastTasks = useSetAtom(dsTaskBotLastTasksAtom);

  useEffect(() => {
    if (parsed.kind === 'tasks') {
      setLastTasks((prev) => ({ ...prev, [roomId]: parsed.tasks }));
    }
  }, [parsed, roomId, setLastTasks]);

  const sendClose = (taskId: number) => {
    sendBotCommand(mx, roomId, botMxid, dm, 'close', String(taskId));
  };

  const sendFile = (taskId: number) => {
    sendBotCommand(mx, roomId, botMxid, dm, 'file', String(taskId));
  };

  if (parsed.kind === 'task_created') {
    const { title, assignee } = parsed.task;
    return (
      <SequenceCard variant="SurfaceVariant" radii="500">
        <Box direction="Column" gap="100" style={{ padding: config.space.S300 }}>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Check} />
            <Text size="T300">{t('DsTaskBot.TaskCreated', { defaultValue: 'Task created' })}</Text>
          </Box>
          <Text size="T200" priority="300" truncate>
            {title} → {assignee}
          </Text>
        </Box>
      </SequenceCard>
    );
  }

  if (parsed.kind === 'task_closed') {
    return (
      <SequenceCard variant="SurfaceVariant" radii="500">
        <Box direction="Column" gap="100" style={{ padding: config.space.S300 }}>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Check} />
            <Text size="T300">{t('DsTaskBot.TaskClosed', { defaultValue: 'Task closed' })}</Text>
          </Box>
          <Text size="T200" priority="300" truncate>
            {parsed.task.title}
          </Text>
        </Box>
      </SequenceCard>
    );
  }

  if (parsed.kind === 'notice') {
    return (
      <SequenceCard variant="SurfaceVariant" radii="500">
        <Box alignItems="Center" gap="200" style={{ padding: config.space.S300 }}>
          <Icon size="100" src={Icons.Info} />
          <Text size="T200" priority="300">
            {parsed.notice.text}
          </Text>
        </Box>
      </SequenceCard>
    );
  }

  const { assignedToMe, assignedByMe } = splitTasksByAssignee(parsed.tasks, myUserId);

  const renderSection = (title: string, tasks: typeof parsed.tasks) => {
    if (tasks.length === 0) return null;
    return (
      <Box direction="Column" gap="100">
        <Text size="T200" priority="400">
          {title}
        </Text>
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            id={task.id}
            title={task.title}
            assignee={task.assignee}
            onClose={() => sendClose(task.id)}
            onFile={() => sendFile(task.id)}
          />
        ))}
      </Box>
    );
  };

  return (
    <SequenceCard variant="SurfaceVariant" radii="500">
      <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
        <Text size="T300">{t('DsTaskBot.Tasks', { defaultValue: 'Tasks' })}</Text>
        {renderSection(
          t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' }),
          assignedToMe
        )}
        {renderSection(
          t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' }),
          assignedByMe
        )}
      </Box>
    </SequenceCard>
  );
}
