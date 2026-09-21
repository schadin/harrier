import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixClient } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { Box, Button, Icon, Icons, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { ParsedBotMessage, splitTasksByAssignee } from './parser';
import { sendBotText } from './helpers';
import { dsTaskBotLastTasksAtom } from '../../state/dsTaskBot';

type DsTaskBotCardsProps = {
  parsed: ParsedBotMessage;
  mx: MatrixClient;
  roomId: string;
  myUserId: string;
};

function TaskRow({
  id,
  title,
  assignee,
  onClose,
}: {
  id: number;
  title: string;
  assignee: string;
  onClose: () => void;
}) {
  return (
    <Box grow="Yes" alignItems="Center" gap="200">
      <Button
        as="button"
        size="300"
        variant="Secondary"
        fill="None"
        radii="400"
        onClick={onClose}
        title={`/${id}`}
      >
        <Text size="T200" priority="400">
          /{id}
        </Text>
      </Button>
      <Box grow="Yes" direction="Column" gap="100">
        <Text size="T300" truncate>
          {title}
        </Text>
        <Text size="T200" priority="300" truncate>
          {assignee}
        </Text>
      </Box>
      <Button as="button" size="300" variant="Secondary" fill="Soft" radii="400" onClick={onClose}>
        <Text size="T200">Close</Text>
      </Button>
    </Box>
  );
}

export function DsTaskBotCards({ parsed, mx, roomId, myUserId }: DsTaskBotCardsProps) {
  const { t } = useTranslation();
  const setLastTasks = useSetAtom(dsTaskBotLastTasksAtom);

  useEffect(() => {
    if (parsed.kind === 'tasks') {
      setLastTasks((prev) => ({ ...prev, [roomId]: parsed.tasks }));
    }
  }, [parsed, roomId, setLastTasks]);

  const sendClose = (taskId: number) => {
    sendBotText(mx, roomId, `close ${taskId}`);
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
