import { atomFamily } from 'jotai/utils';
import { Descendant } from 'slate';
import { EncryptedAttachmentInfo } from 'browser-encrypt-attachment';
import { IEventRelation } from 'matrix-js-sdk';
import {
  atomWithLocalStorage,
  getLocalStorageItem,
  setLocalStorageItem,
} from '../utils/atomWithLocalStorage';
import { createUploadAtomFamily } from '../upload';
import { TUploadContent } from '../../utils/matrix';
import { createListAtom } from '../list';

export type TUploadMetadata = {
  markedAsSpoiler: boolean;
};

export type TUploadItem = {
  file: TUploadContent;
  originalFile: TUploadContent;
  metadata: TUploadMetadata;
  encInfo: EncryptedAttachmentInfo | undefined;
};

export type TUploadListAtom = ReturnType<typeof createListAtom<TUploadItem>>;

export const roomIdToUploadItemsAtomFamily = atomFamily<string, TUploadListAtom>(createListAtom);

export const roomUploadAtomFamily = createUploadAtomFamily();

export type RoomIdToMsgAction =
  | {
      type: 'PUT';
      roomId: string;
      msg: Descendant[];
    }
  | {
      type: 'DELETE';
      roomId: string;
    };

const MSG_DRAFT_STORAGE_KEY = 'roomInputDrafts.msg';
const REPLY_DRAFT_STORAGE_KEY = 'roomInputDrafts.reply';

export const getMsgDraftStorageKey = (roomId: string) => `${MSG_DRAFT_STORAGE_KEY}.${roomId}`;
export const getReplyDraftStorageKey = (roomId: string) => `${REPLY_DRAFT_STORAGE_KEY}.${roomId}`;

const createMsgDraftAtom = (roomId: string) =>
  atomWithLocalStorage<Descendant[]>(
    getMsgDraftStorageKey(roomId),
    (key) => getLocalStorageItem<Descendant[]>(key, []),
    setLocalStorageItem
  );
export type TMsgDraftAtom = ReturnType<typeof createMsgDraftAtom>;
export const roomIdToMsgDraftAtomFamily = atomFamily<string, TMsgDraftAtom>((roomId) =>
  createMsgDraftAtom(roomId)
);

export type IReplyDraft = {
  userId: string;
  eventId: string;
  body: string;
  formattedBody?: string | undefined;
  relation?: IEventRelation | undefined;
};
const createReplyDraftAtom = (roomId: string) =>
  atomWithLocalStorage<IReplyDraft | undefined>(
    getReplyDraftStorageKey(roomId),
    (key) => getLocalStorageItem<IReplyDraft | undefined>(key, undefined),
    setLocalStorageItem
  );
export type TReplyDraftAtom = ReturnType<typeof createReplyDraftAtom>;
export const roomIdToReplyDraftAtomFamily = atomFamily<string, TReplyDraftAtom>((roomId) =>
  createReplyDraftAtom(roomId)
);
