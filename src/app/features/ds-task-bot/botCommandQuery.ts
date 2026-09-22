import { BaseRange, Editor, Element, Path, Range, Text } from 'slate';
import { BlockType } from '../../components/editor/types';

export type BotCommandChipQuery = {
  range: BaseRange;
  text: string;
};

// Структура строки после выбора чипа /dstask: [текст '', Command, текст с подкомандой].
const CHIP_TEXT_INDEX = 2;

/**
 * Возвращает подзапрос подкоманды после чипа `/dstask`: диапазон для замены
 * (от первого непробельного символа до курсора) и текст для фильтрации подсказок
 * (без ведущего `!` и хвостовых пробелов).
 *
 * Диапазон включает хвостовые пробелы (сценарий `/dstask close `), поэтому при
 * выборе пункта меню вставка затирает весь аргумент целиком, а разделительный
 * пробел между чипом и подкомандой сохраняется.
 */
export const getBotCommandChipQuery = (editor: Editor): BotCommandChipQuery | undefined => {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return undefined;

  const lineBlock = editor.children[0];
  if (!Element.isElement(lineBlock) || lineBlock.type !== BlockType.Paragraph) return undefined;

  const command = lineBlock.children[1];
  if (!Element.isElement(command) || command.type !== BlockType.Command) return undefined;

  const textNode = lineBlock.children[CHIP_TEXT_INDEX];
  if (!Text.isText(textNode)) return undefined;

  const focus = Range.end(selection);
  if (!Path.equals(focus.path, [0, CHIP_TEXT_INDEX])) return undefined;

  const firstNonSpace = textNode.text.search(/\S/);
  const offset = firstNonSpace === -1 ? textNode.text.length : firstNonSpace;
  const range: BaseRange = {
    anchor: { path: [0, CHIP_TEXT_INDEX], offset },
    focus,
  };

  return {
    range,
    text: Editor.string(editor, range).replace(/^!/, '').trim(),
  };
};
