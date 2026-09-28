import type { BotCommandAction } from './helpers';
import type { DsTask } from './parser';

export type BotCommandName =
  | 'help'
  | 'list'
  | 'all'
  | 'history'
  | 'close'
  | 'file'
  | 'verify'
  | 'add';

export type BotCommandSuggestion = {
  key: string;
  match: string;
  label: string;
  description?: string;
  insert: string;
};

// Форма аргументов команды: используется и для вставки в композер, и для
// сворачивания команд в таймлайне (единый источник — новые команды из этого
// списка автоматически попадают в сворачивание).
export type BotCommandArg = 'none' | 'optional' | 'any' | 'numeric';

export const BOT_COMMANDS: readonly {
  name: BotCommandName;
  needsArg: boolean;
  arg: BotCommandArg;
  dmOnly?: boolean;
}[] = [
  { name: 'help', needsArg: false, arg: 'none' },
  { name: 'list', needsArg: false, arg: 'optional' },
  { name: 'all', needsArg: false, arg: 'optional' },
  { name: 'history', needsArg: true, arg: 'optional' },
  { name: 'close', needsArg: true, arg: 'numeric' },
  { name: 'file', needsArg: true, arg: 'numeric' },
  { name: 'verify', needsArg: false, arg: 'none' },
  { name: 'add', needsArg: true, arg: 'any', dmOnly: true },
];

// Единственный источник подписей команд: используется и автодополнением `!`,
// и slash-шорткатами `/dstask_<команда>`.
export const BOT_COMMAND_I18N: Record<BotCommandName, { key: string; defaultValue: string }> = {
  help: { key: 'DsTaskBot.CmdHelp', defaultValue: 'List bot commands' },
  list: { key: 'DsTaskBot.CmdList', defaultValue: 'Your tasks' },
  all: { key: 'DsTaskBot.CmdAll', defaultValue: 'Room tasks' },
  history: { key: 'DsTaskBot.CmdHistory', defaultValue: 'Closed task history' },
  close: { key: 'DsTaskBot.CmdClose', defaultValue: 'Close task by number' },
  file: { key: 'DsTaskBot.CmdFile', defaultValue: 'Task files by number' },
  verify: { key: 'DsTaskBot.CmdVerify', defaultValue: 'Request bot device verification' },
  add: { key: 'DsTaskBot.CmdAdd', defaultValue: 'Create task (in direct chat)' },
};

const BOT_COMMAND_ACTIONS: Record<BotCommandName, BotCommandAction> = {
  help: 'help',
  list: 'list',
  all: 'all',
  history: 'history',
  close: 'close',
  file: 'file',
  verify: 'verify',
  add: 'create',
};

export const DSTASK_SLASH_PREFIX = 'dstask_';

export const getDsTaskSlashCommandName = (name: BotCommandName): string =>
  `${DSTASK_SLASH_PREFIX}${name}`;

export type DsTaskSlashCommand = {
  name: string;
  action: BotCommandAction;
  dmOnly: boolean;
  i18n: { key: string; defaultValue: string };
};

// Набор отдельных slash-шорткатов-помощников `/dstask_<команда>` формируется из
// общего дескриптора команд бота, чтобы не расходиться с автодополнением `!`.
export const DSTASK_SLASH_COMMANDS: readonly DsTaskSlashCommand[] = BOT_COMMANDS.map(
  ({ name, dmOnly }) => ({
    name: getDsTaskSlashCommandName(name),
    action: BOT_COMMAND_ACTIONS[name],
    dmOnly: dmOnly === true,
    i18n: BOT_COMMAND_I18N[name],
  })
);

const NUMERIC_COMMANDS: readonly ('close' | 'file')[] = ['close', 'file'];
export const MAX_TASK_SUGGESTIONS = 5;

export type BuildBotCommandSuggestionsOptions = {
  text: string;
  dm: boolean;
  lastTasks: DsTask[];
  descriptions: Partial<Record<BotCommandName, string>>;
};

export const buildBotCommandSuggestions = ({
  text,
  dm,
  lastTasks,
  descriptions,
}: BuildBotCommandSuggestionsOptions): BotCommandSuggestion[] => {
  const query = text.toLowerCase();
  const suggestions: BotCommandSuggestion[] = [];

  BOT_COMMANDS.forEach(({ name, needsArg, dmOnly }) => {
    if (dmOnly && !dm) return;
    suggestions.push({
      key: `cmd-${name}`,
      match: name,
      label: `!${name}`,
      description: descriptions[name],
      insert: `!${name}${needsArg ? ' ' : ''}`,
    });
  });

  if (query.length === 0) return suggestions;

  NUMERIC_COMMANDS.forEach((name) => {
    const argMatch = new RegExp(`^${name}(?:\\s+(\\d*))?$`).exec(query);
    const matchesName = name.startsWith(query);
    if (!argMatch && !matchesName) return;

    const digitPrefix = argMatch?.[1];
    lastTasks
      .filter((task) => digitPrefix === undefined || String(task.id).startsWith(digitPrefix))
      .slice(0, MAX_TASK_SUGGESTIONS)
      .forEach((task) => {
        suggestions.push({
          key: `${name}-${task.id}`,
          match: `${name} ${task.id}`,
          label: `!${name} ${task.id}`,
          description: task.title,
          insert: `!${name} ${task.id} `,
        });
      });
  });

  return suggestions;
};

export const filterBotCommandSuggestions = (
  suggestions: BotCommandSuggestion[],
  text: string
): BotCommandSuggestion[] => {
  const query = text.toLowerCase();
  return suggestions.filter((suggestion) => suggestion.match.includes(query));
};
