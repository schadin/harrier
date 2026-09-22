import { describe, expect, it } from 'vitest';
import type { DsTask } from './parser';
import {
  MAX_TASK_SUGGESTIONS,
  buildBotCommandSuggestions,
  filterBotCommandSuggestions,
} from './botCommandSuggestions';

const DESCRIPTIONS = {
  help: 'help-desc',
  list: 'list-desc',
  all: 'all-desc',
  history: 'history-desc',
  close: 'close-desc',
  file: 'file-desc',
  verify: 'verify-desc',
  add: 'add-desc',
};

const tasks = (count: number): DsTask[] =>
  Array.from({ length: count }, (_, index) => ({
    id: 100 + index,
    title: `Задача ${100 + index}`,
  }));

const build = (text: string, dm: boolean, lastTasks: DsTask[] = []) =>
  buildBotCommandSuggestions({ text, dm, lastTasks, descriptions: DESCRIPTIONS });

describe('buildBotCommandSuggestions', () => {
  it('в обычной комнате предлагает команды без add', () => {
    const labels = build('', false).map((s) => s.label);

    expect(labels).toEqual(['!help', '!list', '!all', '!history', '!close', '!file', '!verify']);
  });

  it('в личке добавляет команду add', () => {
    const labels = build('', true).map((s) => s.label);

    expect(labels).toContain('!add');
    expect(labels).toEqual([
      '!help',
      '!list',
      '!all',
      '!history',
      '!close',
      '!file',
      '!verify',
      '!add',
    ]);
  });

  it('для команд с аргументом оставляет пробел и курсор', () => {
    const byLabel = Object.fromEntries(build('', true).map((s) => [s.label, s.insert]));

    expect(byLabel['!help']).toBe('!help');
    expect(byLabel['!close']).toBe('!close ');
    expect(byLabel['!history']).toBe('!history ');
    expect(byLabel['!add']).toBe('!add ');
  });

  it('подставляет номера задач для close при вводе префикса', () => {
    const labels = build('cl', false, tasks(2)).map((s) => s.label);

    expect(labels).toContain('!close');
    expect(labels).toContain('!close 100');
    expect(labels).toContain('!close 101');
    expect(labels).not.toContain('!file 100');
  });

  it('подставляет номера задач для file при вводе префикса', () => {
    const labels = build('f', false, tasks(2)).map((s) => s.label);

    expect(labels).toContain('!file 100');
    expect(labels).not.toContain('!close 100');
  });

  it('не подставляет номера без введённого текста', () => {
    const labels = build('', false, tasks(2)).map((s) => s.label);

    expect(labels.some((label) => /\d/.test(label))).toBe(false);
  });

  it('ограничивает число подсказок задач', () => {
    const labels = build('cl', false, tasks(MAX_TASK_SUGGESTIONS + 3)).map((s) => s.label);
    const numbered = labels.filter((label) => label.startsWith('!close '));

    expect(numbered).toHaveLength(MAX_TASK_SUGGESTIONS);
  });

  it('пробрасывает описание задачи', () => {
    const suggestion = build('cl', false, tasks(1)).find((s) => s.label === '!close 100');

    expect(suggestion?.description).toBe('Задача 100');
  });
});

describe('filterBotCommandSuggestions', () => {
  it('фильтрует по введённому тексту', () => {
    const filtered = filterBotCommandSuggestions(build('', false), 'cl').map((s) => s.label);

    expect(filtered).toEqual(['!close']);
  });

  it('фильтрация без учёта регистра', () => {
    const filtered = filterBotCommandSuggestions(build('', false), 'HE').map((s) => s.label);

    expect(filtered).toEqual(['!help']);
  });
});
