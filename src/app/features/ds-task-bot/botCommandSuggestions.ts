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

export const BOT_COMMANDS: readonly {
  name: BotCommandName;
  needsArg: boolean;
  dmOnly?: boolean;
}[] = [
  { name: 'help', needsArg: false },
  { name: 'list', needsArg: false },
  { name: 'all', needsArg: false },
  { name: 'history', needsArg: true },
  { name: 'close', needsArg: true },
  { name: 'file', needsArg: true },
  { name: 'verify', needsArg: false },
  { name: 'add', needsArg: true, dmOnly: true },
];

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

  NUMERIC_COMMANDS.filter((name) => name.startsWith(query)).forEach((name) => {
    lastTasks.slice(0, MAX_TASK_SUGGESTIONS).forEach((task) => {
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
