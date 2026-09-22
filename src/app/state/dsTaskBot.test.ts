import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DS_TASK_BOT_SETTINGS, dsTaskBotSettingsAtomFamily } from './dsTaskBot';

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
  vi.stubGlobal('window', {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dsTaskBotSettingsAtomFamily', () => {
  it('возвращает один и тот же атом для одного пользователя', () => {
    expect(dsTaskBotSettingsAtomFamily('@user:example.org')).toBe(
      dsTaskBotSettingsAtomFamily('@user:example.org')
    );
  });

  it('даёт разные атомы разным пользователям', () => {
    expect(dsTaskBotSettingsAtomFamily('@a:example.org')).not.toBe(
      dsTaskBotSettingsAtomFamily('@b:example.org')
    );
  });

  it('стартует со значениями по умолчанию', () => {
    const store = createStore();
    expect(store.get(dsTaskBotSettingsAtomFamily('@default:example.org'))).toEqual(
      DEFAULT_DS_TASK_BOT_SETTINGS
    );
  });

  it('запись через один атом видна другому вызову семейства', () => {
    const store = createStore();
    store.set(dsTaskBotSettingsAtomFamily('@sync:example.org'), {
      ...DEFAULT_DS_TASK_BOT_SETTINGS,
      helpersEnabled: true,
    });

    expect(store.get(dsTaskBotSettingsAtomFamily('@sync:example.org')).helpersEnabled).toBe(true);
  });
});
