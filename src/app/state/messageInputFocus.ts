import { atom, useSetAtom } from 'jotai';
import { useCallback } from 'react';

/**
 * Счётчик запросов фокуса на поле ввода сообщения. Увеличивается
 * при переходе в комнату из Command Palette; RoomView отслеживает
 * изменение и ставит фокус в композер (см. RoomView).
 */
const messageInputFocusAtom = atom(0);

export const useRequestMessageInputFocus = (): (() => void) => {
  const setToken = useSetAtom(messageInputFocusAtom);

  return useCallback(() => setToken((token) => token + 1), [setToken]);
};

export { messageInputFocusAtom };
