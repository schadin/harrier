import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixClient } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { Box, Button, Icon, Icons, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { timeDayMonYear, timeHourMinute } from '../../utils/time';
import { DsTask, ParsedBotMessage, splitTasksByAssignee } from './parser';
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

const formatDateTime = (
  value: string | undefined,
  hour24Clock: boolean,
  dateFormatString: string
): string | undefined => {
  if (!value) return undefined;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return undefined;
  return `${timeDayMonYear(ts, dateFormatString)} ${timeHourMinute(ts, hour24Clock)}`;
};

const formatFileSize = (size?: number): string | undefined => {
  if (size === undefined) return undefined;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${Math.round(value * 10) / 10} ${units[unitIndex]}`;
};

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <SequenceCard variant="SurfaceVariant" radii="500">
      <Box direction="Column" gap="200" style={{ padding: config.space.S300 }}>
        {children}
      </Box>
    </SequenceCard>
  );
}

function TaskMeta({ task, scope }: { task: DsTask; scope?: string }) {
  const { t } = useTranslation();
  const [hour24Clock] = useSetting(settingsAtom, 'hour24Clock');
  const [dateFormatString] = useSetting(settingsAtom, 'dateFormatString');

  const due = formatDateTime(task.dueAt, hour24Clock, dateFormatString);
  const remind = formatDateTime(task.remindAt, hour24Clock, dateFormatString);
  const tags = task.tags ?? [];

  const parts: string[] = [];
  if (task.assignee) parts.push(task.assignee);
  if (task.status === 'closed') parts.push(t('DsTaskBot.StatusClosed', { defaultValue: 'Closed' }));
  if (due) parts.push(`${t('DsTaskBot.DueAt', { defaultValue: 'Due' })}: ${due}`);
  if (remind) parts.push(`${t('DsTaskBot.RemindAt', { defaultValue: 'Remind' })}: ${remind}`);

  return (
    <Box direction="Column" gap="100">
      {parts.length > 0 && (
        <Text size="T200" priority="300" truncate>
          {parts.join(' · ')}
        </Text>
      )}
      {tags.length > 0 && (
        <Text size="T200" priority="300" truncate>
          {tags.map((tag) => `#${tag}`).join(' ')}
        </Text>
      )}
      {scope === 'personal' && task.chatTitle && (
        <Text size="T200" priority="300" truncate>
          {task.chatTitle}
        </Text>
      )}
    </Box>
  );
}

function TaskRow({
  task,
  scope,
  onClose,
  onFile,
}: {
  task: DsTask;
  scope?: string;
  onClose?: () => void;
  onFile?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Box grow="Yes" alignItems="Center" gap="200">
      <Box grow="Yes" direction="Column" gap="100">
        <Text size="T300" truncate>
          {task.id} {task.title}
        </Text>
        <TaskMeta task={task} scope={scope} />
      </Box>
      {onFile && (
        <Button as="button" size="300" variant="Secondary" fill="None" radii="400" onClick={onFile}>
          <Text size="T200">{t('DsTaskBot.TaskFiles', { defaultValue: 'Files' })}</Text>
        </Button>
      )}
      {onClose && (
        <Button
          as="button"
          size="300"
          variant="Secondary"
          fill="Soft"
          radii="400"
          onClick={onClose}
        >
          <Text size="T200">{t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}</Text>
        </Button>
      )}
    </Box>
  );
}

function Section({
  title,
  tasks,
  scope,
  onClose,
  onFile,
}: {
  title: string;
  tasks: DsTask[];
  scope?: string;
  onClose?: (task: DsTask) => void;
  onFile?: (task: DsTask) => void;
}) {
  return (
    <Box direction="Column" gap="100">
      <Text size="T200" priority="400">
        {title}
      </Text>
      {tasks.length === 0 ? (
        <Text size="T200" priority="300">
          —
        </Text>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={`${task.id}-${task.title}`}
            task={task}
            scope={scope}
            onClose={onClose && (() => onClose(task))}
            onFile={onFile && (() => onFile(task))}
          />
        ))
      )}
    </Box>
  );
}

function NoticeCard({ tone, text, task }: { tone: 'info' | 'error'; text: string; task?: DsTask }) {
  return (
    <CardShell>
      <Box alignItems="Center" gap="200">
        <Icon size="100" src={tone === 'error' ? Icons.Warning : Icons.Info} />
        <Box grow="Yes" direction="Column" gap="100">
          <Text size="T200" priority="300">
            {text}
          </Text>
          {task && (
            <Text size="T200" priority="400" truncate>
              {task.id} {task.title}
            </Text>
          )}
        </Box>
      </Box>
    </CardShell>
  );
}

export function DsTaskBotCards({ parsed, mx, roomId, myUserId, botMxid, dm }: DsTaskBotCardsProps) {
  const { t } = useTranslation();
  const setLastTasks = useSetAtom(dsTaskBotLastTasksAtom);

  useEffect(() => {
    let tasks: DsTask[] | undefined;
    if (parsed.origin === 'envelope') {
      if (parsed.kind === 'list' || parsed.kind === 'history' || parsed.kind === 'report') {
        tasks = parsed.tasks;
      }
    } else if (parsed.kind === 'tasks') {
      tasks = parsed.tasks;
    }

    if (!tasks) return;

    setLastTasks((prev) => {
      const existing = prev[roomId];
      const isSame =
        existing !== undefined &&
        existing.length === tasks.length &&
        existing.every((task, index) => task.id === tasks[index].id);
      if (isSame) return prev;
      return { ...prev, [roomId]: tasks };
    });
  }, [parsed, roomId, setLastTasks]);

  const sendClose = (taskId: number) => {
    sendBotCommand(mx, roomId, botMxid, dm, 'close', String(taskId));
  };

  const sendFile = (taskId: number) => {
    sendBotCommand(mx, roomId, botMxid, dm, 'file', String(taskId));
  };

  if (parsed.origin === 'envelope') {
    if (parsed.kind === 'notice') {
      return <NoticeCard tone={parsed.tone} text={parsed.text} task={parsed.task} />;
    }

    if (parsed.kind === 'file' || parsed.kind === 'file_attached') {
      const { task, files } = parsed;
      return (
        <CardShell>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Attachment} />
            <Text size="T300">
              {parsed.kind === 'file'
                ? t('DsTaskBot.FileSent', { defaultValue: 'Task file' })
                : t('DsTaskBot.FileAttached', { defaultValue: 'File attached to task' })}
            </Text>
          </Box>
          {task && (
            <>
              <Text size="T200" priority="300" truncate>
                {task.id} {task.title}
              </Text>
              <TaskMeta task={task} />
            </>
          )}
          {files.map((file) => {
            const size = formatFileSize(file.size);
            return (
              <Text key={file.name} size="T200" priority="300" truncate>
                {file.name}
                {size ? ` · ${size}` : ''}
              </Text>
            );
          })}
          {task && task.status !== 'closed' && (
            <Box>
              <Button
                as="button"
                size="300"
                variant="Secondary"
                fill="Soft"
                radii="400"
                onClick={() => sendClose(task.id)}
              >
                <Text size="T200">{t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}</Text>
              </Button>
            </Box>
          )}
        </CardShell>
      );
    }

    if (parsed.kind === 'created' || parsed.kind === 'closed' || parsed.kind === 'reminder') {
      const { task } = parsed;
      const icon = parsed.kind === 'reminder' ? Icons.BellRing : Icons.Check;
      let label = t('DsTaskBot.TaskCreated', { defaultValue: 'Task created' });
      if (parsed.kind === 'reminder') {
        label = t('DsTaskBot.Reminder', { defaultValue: 'Task reminder' });
      } else if (parsed.kind === 'closed') {
        label = t('DsTaskBot.TaskClosed', { defaultValue: 'Task closed' });
      }

      const canAct = parsed.kind !== 'closed' && task.status !== 'closed';

      return (
        <CardShell>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={icon} />
            <Text size="T300">{label}</Text>
          </Box>
          <TaskRow
            task={task}
            onClose={canAct ? () => sendClose(task.id) : undefined}
            onFile={canAct ? () => sendFile(task.id) : undefined}
          />
        </CardShell>
      );
    }

    if (parsed.kind === 'list' || parsed.kind === 'history' || parsed.kind === 'report') {
      const { assignedToMe, assignedByMe } = splitTasksByAssignee(parsed.tasks, myUserId);
      let title = t('DsTaskBot.Tasks', { defaultValue: 'Tasks' });
      if (parsed.kind === 'history') {
        title = t('DsTaskBot.History', { defaultValue: 'Closed tasks' });
      } else if (parsed.kind === 'report') {
        title = t('DsTaskBot.Report', { defaultValue: 'Task report' });
      }
      const closeHandler =
        parsed.kind === 'history' ? undefined : (task: DsTask) => sendClose(task.id);

      return (
        <CardShell>
          <Text size="T300">
            {title}
            {parsed.filterTag ? ` #${parsed.filterTag}` : ''}
          </Text>
          <Section
            title={t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' })}
            tasks={assignedToMe}
            scope={parsed.scope}
            onClose={closeHandler}
            onFile={(task) => sendFile(task.id)}
          />
          <Section
            title={t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' })}
            tasks={assignedByMe}
            scope={parsed.scope}
            onClose={closeHandler}
            onFile={(task) => sendFile(task.id)}
          />
        </CardShell>
      );
    }

    return null;
  }

  if (parsed.kind === 'task_created') {
    const { title, assignee } = parsed.task;
    return (
      <CardShell>
        <Box alignItems="Center" gap="200">
          <Icon size="100" src={Icons.Check} />
          <Text size="T300">{t('DsTaskBot.TaskCreated', { defaultValue: 'Task created' })}</Text>
        </Box>
        <Text size="T200" priority="300" truncate>
          {title} → {assignee}
        </Text>
      </CardShell>
    );
  }

  if (parsed.kind === 'task_closed') {
    return (
      <CardShell>
        <Box alignItems="Center" gap="200">
          <Icon size="100" src={Icons.Check} />
          <Text size="T300">{t('DsTaskBot.TaskClosed', { defaultValue: 'Task closed' })}</Text>
        </Box>
        <Text size="T200" priority="300" truncate>
          {parsed.task.title}
        </Text>
      </CardShell>
    );
  }

  if (parsed.kind === 'notice') {
    return <NoticeCard tone="info" text={parsed.text} />;
  }

  // text origin: tasks (no status/metadata available)
  const { assignedToMe, assignedByMe } = splitTasksByAssignee(parsed.tasks, myUserId);
  return (
    <CardShell>
      <Text size="T300">{t('DsTaskBot.Tasks', { defaultValue: 'Tasks' })}</Text>
      <Section
        title={t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' })}
        tasks={assignedToMe}
        onClose={(task) => sendClose(task.id)}
        onFile={(task) => sendFile(task.id)}
      />
      <Section
        title={t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' })}
        tasks={assignedByMe}
        onClose={(task) => sendClose(task.id)}
        onFile={(task) => sendFile(task.id)}
      />
    </CardShell>
  );
}
