import { atom } from 'jotai';

export type SendErrorToast = {
  id: number;
  message: string;
};

export const sendErrorListAtom = atom<SendErrorToast[]>([]);
