import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MatrixClient } from 'matrix-js-sdk';
import { useSetAtom } from 'jotai';
import { Box, Button, Icon, Icons, Text, config } from 'folds';
import { SequenceCard } from '../../components/sequence-card';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { timeDayMonYear, timeHourMinute } from '../../utils/time';
import { canCloseTask, DsTask, ParsedBotMessage, splitTasksByAssignee } from './parser';
import { sendBotCommand } from './helpers';
import { cardFontFactor } from './cardFont';
import { dsTaskBotLastTasksAtom, useDsTaskBotSettings } from '../../state/dsTaskBot';

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

type TextProps = React.ComponentProps<typeof Text>;

type CardTextProps = {
  size?: TextProps['size'];
  priority?: TextProps['priority'];
  truncate?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

// Текст карточки с учётом настройки размера: масштабируются только размер
// шрифта и высота строки, отступы и иконки остаются неизменными. При 100% стиль
// не задаётся — вид совпадает с обычным текстом folds.
function CardText({ size = 'T200', priority, truncate, style, children }: CardTextProps) {
  const settings = useDsTaskBotSettings();
  const factor = cardFontFactor(settings.cardFontScale);
  const fontSize = config.fontSize[size as keyof typeof config.fontSize];
  const lineHeight = config.lineHeight[size as keyof typeof config.lineHeight];
  const scaledStyle =
    factor === 1 || !fontSize
      ? undefined
      : {
          fontSize: `calc(${fontSize} * ${factor})`,
          lineHeight: lineHeight ? `calc(${lineHeight} * ${factor})` : undefined,
        };

  return (
    <Text size={size} priority={priority} truncate={truncate} style={{ ...scaledStyle, ...style }}>
      {children}
    </Text>
  );
}

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
        <CardText size="T200" priority="300" truncate>
          {parts.join(' · ')}
        </CardText>
      )}
      {tags.length > 0 && (
        <CardText size="T200" priority="300" truncate>
          {tags.map((tag) => `#${tag}`).join(' ')}
        </CardText>
      )}
      {scope === 'personal' && task.chatTitle && (
        <CardText size="T200" priority="300" truncate>
          {task.chatTitle}
        </CardText>
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
        <CardText size="T300" truncate>
          {task.id} {task.title}
        </CardText>
        <TaskMeta task={task} scope={scope} />
      </Box>
      {onFile && (
        <Button as="button" size="300" variant="Secondary" fill="None" radii="400" onClick={onFile}>
          <CardText size="T200">{t('DsTaskBot.TaskFiles', { defaultValue: 'Files' })}</CardText>
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
          <CardText size="T200">{t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}</CardText>
        </Button>
      )}
    </Box>
  );
}

function Section({
  title,
  tasks,
  scope,
  myUserId,
  onClose,
  onFile,
}: {
  title: string;
  tasks: DsTask[];
  scope?: string;
  myUserId: string;
  onClose?: (task: DsTask) => void;
  onFile?: (task: DsTask) => void;
}) {
  return (
    <Box direction="Column" gap="100">
      <CardText size="T200" priority="400">
        {title}
      </CardText>
      {tasks.length === 0 ? (
        <CardText size="T200" priority="300">
          —
        </CardText>
      ) : (
        tasks.map((task) => (
          <TaskRow
            key={`${task.id}-${task.title}`}
            task={task}
            scope={scope}
            onClose={onClose && canCloseTask(task, myUserId) ? () => onClose(task) : undefined}
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
          <CardText size="T200" priority="300">
            {text}
          </CardText>
          {task && (
            <CardText size="T200" priority="400" truncate>
              {task.id} {task.title}
            </CardText>
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

    if (parsed.kind === 'help') {
      return (
        <CardShell>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Bulb} />
            <CardText size="T300">
              {t('DsTaskBot.HelpTitle', { defaultValue: 'Bot commands' })}
            </CardText>
          </Box>
          {parsed.entries.map((entry) => (
            <Box key={entry.command} direction="Column" gap="100">
              <CardText size="T200" priority="400">
                {entry.command}
              </CardText>
              {entry.description && (
                <CardText size="T200" priority="300">
                  {entry.description}
                </CardText>
              )}
            </Box>
          ))}
        </CardShell>
      );
    }

    if (parsed.kind === 'file' || parsed.kind === 'file_attached') {
      const { task, files } = parsed;
      return (
        <CardShell>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={Icons.Attachment} />
            <CardText size="T300">
              {parsed.kind === 'file'
                ? t('DsTaskBot.FileSent', { defaultValue: 'Task file' })
                : t('DsTaskBot.FileAttached', { defaultValue: 'File attached to task' })}
            </CardText>
          </Box>
          {task && (
            <>
              <CardText size="T200" priority="300" truncate>
                {task.id} {task.title}
              </CardText>
              <TaskMeta task={task} />
            </>
          )}
          {files.map((file) => {
            const size = formatFileSize(file.size);
            return (
              <CardText key={file.name} size="T200" priority="300" truncate>
                {file.name}
                {size ? ` · ${size}` : ''}
              </CardText>
            );
          })}
          {task && task.status !== 'closed' && canCloseTask(task, myUserId) && (
            <Box>
              <Button
                as="button"
                size="300"
                variant="Secondary"
                fill="Soft"
                radii="400"
                onClick={() => sendClose(task.id)}
              >
                <CardText size="T200">
                  {t('DsTaskBot.CloseTask', { defaultValue: 'Close' })}
                </CardText>
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

      const canFile = parsed.kind !== 'closed' && task.status !== 'closed';
      const canClose = canFile && canCloseTask(task, myUserId);

      return (
        <CardShell>
          <Box alignItems="Center" gap="200">
            <Icon size="100" src={icon} />
            <CardText size="T300">{label}</CardText>
          </Box>
          <TaskRow
            task={task}
            onClose={canClose ? () => sendClose(task.id) : undefined}
            onFile={canFile ? () => sendFile(task.id) : undefined}
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
          <CardText size="T300">
            {title}
            {parsed.filterTag ? ` #${parsed.filterTag}` : ''}
          </CardText>
          <Section
            title={t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' })}
            tasks={assignedToMe}
            scope={parsed.scope}
            myUserId={myUserId}
            onClose={closeHandler}
            onFile={(task) => sendFile(task.id)}
          />
          <Section
            title={t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' })}
            tasks={assignedByMe}
            scope={parsed.scope}
            myUserId={myUserId}
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
          <CardText size="T300">
            {t('DsTaskBot.TaskCreated', { defaultValue: 'Task created' })}
          </CardText>
        </Box>
        <CardText size="T200" priority="300" truncate>
          {title} → {assignee}
        </CardText>
      </CardShell>
    );
  }

  if (parsed.kind === 'task_closed') {
    return (
      <CardShell>
        <Box alignItems="Center" gap="200">
          <Icon size="100" src={Icons.Check} />
          <CardText size="T300">
            {t('DsTaskBot.TaskClosed', { defaultValue: 'Task closed' })}
          </CardText>
        </Box>
        <CardText size="T200" priority="300" truncate>
          {parsed.task.title}
        </CardText>
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
      <CardText size="T300">{t('DsTaskBot.Tasks', { defaultValue: 'Tasks' })}</CardText>
      <Section
        title={t('DsTaskBot.AssignedToMe', { defaultValue: 'Assigned to me' })}
        tasks={assignedToMe}
        myUserId={myUserId}
        onClose={(task) => sendClose(task.id)}
        onFile={(task) => sendFile(task.id)}
      />
      <Section
        title={t('DsTaskBot.AssignedByMe', { defaultValue: 'Assigned by me' })}
        tasks={assignedByMe}
        myUserId={myUserId}
        onClose={(task) => sendClose(task.id)}
        onFile={(task) => sendFile(task.id)}
      />
    </CardShell>
  );
}
