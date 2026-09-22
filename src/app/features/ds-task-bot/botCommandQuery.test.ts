import { describe, expect, it } from 'vitest';
import { createEditor, Editor, Transforms } from 'slate';
import { BlockType } from '../../components/editor/types';
import { getBotCommandChipQuery } from './botCommandQuery';
import { buildBotCommandSuggestions, filterBotCommandSuggestions } from './botCommandSuggestions';
import type { DsTask } from './parser';

const CHIP_COMMAND = 'dstask';

const makeEditor = (...afterChip: { text: string }[]): Editor => {
  const editor = createEditor();
  editor.isInline = (element) =>
    [BlockType.Mention, BlockType.Emoticon, BlockType.Link, BlockType.Command].includes(
      element.type
    );
  editor.isVoid = (element) =>
    [BlockType.Mention, BlockType.Emoticon, BlockType.Command].includes(element.type);
  editor.children = [
    {
      type: BlockType.Paragraph,
      children: [
        { text: '' },
        { type: BlockType.Command, command: CHIP_COMMAND, children: [{ text: '' }] },
        ...afterChip,
      ],
    },
  ];
  Transforms.select(editor, Editor.end(editor, []));
  return editor;
};

describe('getBotCommandChipQuery', () => {
  it('возвращает undefined без чипа команды', () => {
    const editor = createEditor();
    editor.children = [{ type: BlockType.Paragraph, children: [{ text: 'close ' }] }];
    Transforms.select(editor, Editor.end(editor, []));

    expect(getBotCommandChipQuery(editor)).toBeUndefined();
  });

  it('возвращает undefined при несхлопнутом выделении', () => {
    const editor = makeEditor({ text: ' cl' });
    Transforms.select(editor, {
      anchor: { path: [0, 2], offset: 1 },
      focus: { path: [0, 2], offset: 3 },
    });

    expect(getBotCommandChipQuery(editor)).toBeUndefined();
  });

  it('возвращает undefined, если курсор не после чипа', () => {
    const editor = makeEditor({ text: ' cl' });
    Transforms.select(editor, { path: [0, 0], offset: 0 });

    expect(getBotCommandChipQuery(editor)).toBeUndefined();
  });

  it('после чипа без ввода даёт пустой текст и схлопнутый диапазон', () => {
    const editor = makeEditor({ text: ' ' });
    const query = getBotCommandChipQuery(editor);

    expect(query?.text).toBe('');
    expect(Editor.string(editor, query!.range)).toBe('');
  });

  it('возвращает текст подкоманды', () => {
    const editor = makeEditor({ text: ' cl' });

    expect(getBotCommandChipQuery(editor)?.text).toBe('cl');
  });

  it('срезает ведущий "!"', () => {
    const editor = makeEditor({ text: ' !cl' });

    expect(getBotCommandChipQuery(editor)?.text).toBe('cl');
  });

  it('срезает хвостовой пробел, но оставляет его в диапазоне (сценарий /dstask close )', () => {
    const editor = makeEditor({ text: ' close ' });
    const query = getBotCommandChipQuery(editor)!;

    expect(query.text).toBe('close');
    expect(Editor.string(editor, query.range)).toBe('close ');
  });

  it('диапазон не захватывает разделительный пробел', () => {
    const editor = makeEditor({ text: ' cl' });
    const query = getBotCommandChipQuery(editor)!;

    expect(Editor.string(editor, query.range)).toBe('cl');
  });
});

describe('подсказки после чипа /dstask (связка с фильтром)', () => {
  const tasks: DsTask[] = [
    { id: 144, title: 'Задача 144' },
    { id: 145, title: 'Задача 145' },
  ];

  const labelsFor = (editor: Editor): string[] => {
    const query = getBotCommandChipQuery(editor);
    if (!query) return [];
    return filterBotCommandSuggestions(
      buildBotCommandSuggestions({
        text: query.text,
        dm: false,
        lastTasks: tasks,
        descriptions: {},
      }),
      query.text
    ).map((suggestion) => suggestion.label);
  };

  it('после чипа без ввода предлагает все команды', () => {
    const labels = labelsFor(makeEditor({ text: ' ' }));

    expect(labels).toEqual(['!help', '!list', '!all', '!history', '!close', '!file', '!verify']);
  });

  it('ввод `cl` после чипа предлагает close и номера задач', () => {
    const labels = labelsFor(makeEditor({ text: ' cl' }));

    expect(labels).toEqual(['!close', '!close 144', '!close 145']);
  });

  it('ведущий `!` не мешает фильтрации', () => {
    const labels = labelsFor(makeEditor({ text: ' !cl' }));

    expect(labels).toEqual(['!close', '!close 144', '!close 145']);
  });

  it('`/dstask close ` (с пробелом) предлагает номера задач', () => {
    const labels = labelsFor(makeEditor({ text: ' close ' }));

    expect(labels).toEqual(['!close', '!close 144', '!close 145']);
  });

  it('`/dstask close 1` фильтрует номера задач по числу', () => {
    const labels = labelsFor(makeEditor({ text: ' close 1' }));

    expect(labels).toEqual(['!close 144', '!close 145']);
  });
});
