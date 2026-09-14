import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  atomWithLocalStorage,
  getLocalStorageItem,
  setLocalStorageItem,
} from './atomWithLocalStorage';

const storeKey = 'test.atomWithLocalStorage';

const getItemMock = (key: string) => getLocalStorageItem<string[]>(key, []);

let storage: Map<string, string>;
const handlers = new Map<string, (evt: StorageEvent) => void>();

beforeEach(() => {
  storage = new Map();
  handlers.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, String(value));
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
  vi.stubGlobal('window', {
    addEventListener: vi.fn((type: string, cb: (evt: StorageEvent) => void) => {
      handlers.set(type, cb);
    }),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('atomWithLocalStorage', () => {
  it('использует значение из localStorage при создании атома', () => {
    storage.set(storeKey, JSON.stringify(['a', 'b']));
    const atom = atomWithLocalStorage<string[]>(storeKey, getItemMock, setLocalStorageItem);
    expect(createStore().get(atom)).toEqual(['a', 'b']);
  });

  it('использует default, когда ключа нет в localStorage', () => {
    const atom = atomWithLocalStorage<string[]>(storeKey, getItemMock, setLocalStorageItem);
    expect(createStore().get(atom)).toEqual([]);
  });

  it('пишет в localStorage при set', () => {
    const atom = atomWithLocalStorage<string[]>(storeKey, getItemMock, setLocalStorageItem);
    const store = createStore();
    store.set(atom, ['c']);
    expect(JSON.parse(storage.get(storeKey)!)).toEqual(['c']);
    expect(store.get(atom)).toEqual(['c']);
  });

  it('переживает roundtrip undefined (случай пустого reply-черновика)', () => {
    const atom = atomWithLocalStorage<string | undefined>(
      storeKey,
      (key) => getLocalStorageItem<string | undefined>(key, undefined),
      setLocalStorageItem
    );
    const store = createStore();
    store.set(atom, undefined);
    expect(store.get(atom)).toBeUndefined();
    const atom2 = atomWithLocalStorage<string | undefined>(
      storeKey,
      (key) => getLocalStorageItem<string | undefined>(key, undefined),
      setLocalStorageItem
    );
    expect(createStore().get(atom2)).toBeUndefined();
  });

  it('синхронизирует значение по storage-событию из другого окна', () => {
    const atom = atomWithLocalStorage<string[]>(storeKey, getItemMock, setLocalStorageItem);
    const store = createStore();
    const unsub = store.sub(atom, () => {});
    storage.set(storeKey, JSON.stringify(['sync']));
    handlers.get('storage')!({ key: storeKey } as StorageEvent);
    expect(store.get(atom)).toEqual(['sync']);
    unsub();
  });
});
