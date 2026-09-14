import { getDefaultStore } from 'jotai';
import { IContent, MatrixClient } from 'matrix-js-sdk';
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events';
import { sendErrorListAtom } from '../state/sendError';

let sendErrorId = 0;

const formatSendError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const notifySendError = (error: unknown): void => {
  const message = formatSendError(error);
  console.error('Message send failed:', error);
  sendErrorId += 1;
  getDefaultStore().set(sendErrorListAtom, (list) => [
    ...list.slice(-3),
    { id: sendErrorId, message: message.slice(0, 400) },
  ]);
};

export const sendMessageSafely = (
  mx: MatrixClient,
  roomId: string,
  content: RoomMessageEventContent
): void => {
  mx.sendMessage(roomId, content).catch(notifySendError);
};

export const sendEventSafely = (
  mx: MatrixClient,
  roomId: string,
  eventType: string,
  content: IContent
): void => {
  mx.sendEvent(roomId, eventType as any, content).catch(notifySendError);
};
