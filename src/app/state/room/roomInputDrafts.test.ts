import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMsgDraftStorageKey,
  getReplyDraftStorageKey,
  roomIdToMsgDraftAtomFamily,
  roomIdToReplyDraftAtomFamily,
} from './roomInputDrafts';

let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
  roomIdToMsgDraftAtomFamily.remove('!roomA:example.org');
  roomIdToReplyDraftAtomFamily.remove('!roomA:example.org');
});

describe('roomIdToMsgDraftAtomFamily', () => {
  it('сохраняет черновик в localStorage при set и восстанавливает при новом атоме', () => {
    const draft = [{ type: 'paragraph', children: [{ text: 'черновик' }] }] as any;
    const store = createStore();
    const atom = roomIdToMsgDraftAtomFamily('!roomA:example.org');
    store.set(atom, draft);
    expect(JSON.parse(storage.get(getMsgDraftStorageKey('!roomA:example.org'))!)).toEqual(draft);

    roomIdToMsgDraftAtomFamily.remove('!roomA:example.org');
    const newAtom = roomIdToMsgDraftAtomFamily('!roomA:example.org');
    expect(createStore().get(newAtom)).toEqual(draft);
  });

  it('по умолчанию пустой массив для новой комнаты', () => {
    const atom = roomIdToMsgDraftAtomFamily('!roomA:example.org');
    expect(createStore().get(atom)).toEqual([]);
  });
});

describe('roomIdToReplyDraftAtomFamily', () => {
  it('сохраняет reply-черновик в localStorage и восстанавливает', () => {
    const reply = { userId: '@u:example.org', eventId: '$evt', body: 'цитата' };
    const store = createStore();
    store.set(roomIdToReplyDraftAtomFamily('!roomA:example.org'), reply);
    expect(JSON.parse(storage.get(getReplyDraftStorageKey('!roomA:example.org'))!)).toEqual(reply);

    roomIdToReplyDraftAtomFamily.remove('!roomA:example.org');
    const newAtom = roomIdToReplyDraftAtomFamily('!roomA:example.org');
    expect(createStore().get(newAtom)).toEqual(reply);
  });

  it('очистка черновика (undefined) сохраняется', () => {
    const store = createStore();
    const atom = roomIdToReplyDraftAtomFamily('!roomA:example.org');
    store.set(atom, { userId: '@u:example.org', eventId: '$evt', body: 'цитата' });
    store.set(atom, undefined);
    expect(createStore().get(roomIdToReplyDraftAtomFamily('!roomA:example.org'))).toBeUndefined();
  });
});
