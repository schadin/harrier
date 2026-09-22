import React, { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Editor, Element, Transforms } from 'slate';
import { Box, MenuItem, Text as FoldsText, config } from 'folds';
import { Room } from 'matrix-js-sdk';
import { useAtomValue } from 'jotai';
import { AutocompleteMenu, AutocompleteQuery, BlockType } from '../../components/editor';
import { useKeyDown } from '../../hooks/useKeyDown';
import { onTabPress } from '../../utils/keyboard';
import { dsTaskBotLastTasksAtom, useDsTaskBotSettings } from '../../state/dsTaskBot';
import type { DsTask } from './parser';
import {
  BotCommandSuggestion,
  buildBotCommandSuggestions,
  filterBotCommandSuggestions,
} from './botCommandSuggestions';
import { isDirectRoomWithBot } from './helpers';

type BotCommandAutocompleteProps = {
  room: Room;
  editor: Editor;
  query: AutocompleteQuery<string>;
  requestClose: () => void;
};

const hasBotMention = (editor: Editor, botMxid: string): boolean => {
  const hasMention = Array.from(Editor.nodes(editor, { at: [] })).some(
    ([node]) => Element.isElement(node) && node.type === BlockType.Mention && node.id === botMxid
  );
  return hasMention || Editor.string(editor, []).includes(botMxid);
};

export function BotCommandAutocomplete({
  room,
  editor,
  query,
  requestClose,
}: BotCommandAutocompleteProps) {
  const { t } = useTranslation();
  const settings = useDsTaskBotSettings();
  const lastTasks: DsTask[] = useAtomValue(dsTaskBotLastTasksAtom)[room.roomId] ?? [];

  const enabled = settings.helpersEnabled && settings.botMxid !== '';
  const dm = enabled && isDirectRoomWithBot(room, settings.botMxid);
  // После чипа /dstask упоминание не требуется: sendBotCommand добавит его сам.
  const allowed =
    enabled && (dm || query.viaSlash === true || hasBotMention(editor, settings.botMxid));

  const suggestions = allowed
    ? filterBotCommandSuggestions(
        buildBotCommandSuggestions({
          text: query.text,
          dm,
          lastTasks,
          descriptions: {
            help: t('DsTaskBot.CmdHelp', { defaultValue: 'List bot commands' }),
            list: t('DsTaskBot.CmdList', { defaultValue: 'Your tasks' }),
            all: t('DsTaskBot.CmdAll', { defaultValue: 'Room tasks' }),
            history: t('DsTaskBot.CmdHistory', { defaultValue: 'Closed task history' }),
            close: t('DsTaskBot.CmdClose', { defaultValue: 'Close task by number' }),
            file: t('DsTaskBot.CmdFile', { defaultValue: 'Task files by number' }),
            verify: t('DsTaskBot.CmdVerify', { defaultValue: 'Request bot device verification' }),
            add: t('DsTaskBot.CmdAdd', { defaultValue: 'Create task (in direct chat)' }),
          },
        }),
        query.text
      )
    : [];

  const handleAutocomplete = (suggestion: BotCommandSuggestion) => {
    Transforms.select(editor, query.range);
    Transforms.insertText(editor, suggestion.insert);
    Transforms.collapse(editor, { edge: 'end' });
    requestClose();
  };

  useKeyDown(window, (evt: KeyboardEvent) => {
    onTabPress(evt, () => {
      if (suggestions.length === 0) return;
      handleAutocomplete(suggestions[0]);
    });
  });

  if (suggestions.length === 0) return null;

  return (
    <AutocompleteMenu
      headerContent={
        <Box grow="Yes" direction="Row" justifyContent="SpaceBetween">
          <FoldsText size="L400">DsTaskBot</FoldsText>
        </Box>
      }
      requestClose={requestClose}
    >
      {suggestions.map((suggestion) => (
        <MenuItem
          key={suggestion.key}
          as="button"
          radii="300"
          style={{ height: 'unset' }}
          onKeyDown={(evt: ReactKeyboardEvent<HTMLButtonElement>) =>
            onTabPress(evt, () => handleAutocomplete(suggestion))
          }
          onClick={() => handleAutocomplete(suggestion)}
        >
          <Box
            style={{ padding: `${config.space.S300} 0` }}
            grow="Yes"
            direction="Column"
            gap="100"
            justifyContent="SpaceBetween"
          >
            <FoldsText style={{ flexGrow: 1 }} size="B400" truncate>
              {suggestion.label}
            </FoldsText>
            {suggestion.description && (
              <FoldsText truncate priority="300" size="T200">
                {suggestion.description}
              </FoldsText>
            )}
          </Box>
        </MenuItem>
      ))}
    </AutocompleteMenu>
  );
}
