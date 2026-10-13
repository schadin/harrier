import { MatrixClient, SetPresence } from 'matrix-js-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decideStatusRestore,
  getActiveStatusMsg,
  restoreCustomStatus,
  saveActiveStatusMsg,
} from './custom-status';

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
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const USER_ID = '@user:example.org';

type ClientStub = {
  getUserId: () => string;
  getPresence: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  setPresence: ReturnType<typeof vi.fn>;
};

const makeClient = (presence: Record<string, unknown>): { mx: MatrixClient; stub: ClientStub } => {
  const user = {
    presence: SetPresence.Unavailable,
    presenceStatusMsg: undefined,
    emit: vi.fn(),
  };
  const stub: ClientStub = {
    getUserId: () => USER_ID,
    getPresence: vi.fn(() => Promise.resolve(presence)),
    getUser: vi.fn(() => user),
    setPresence: vi.fn(() => Promise.resolve({})),
  };
  return { mx: stub as unknown as MatrixClient, stub };
};

describe('decideStatusRestore', () => {
  it('ничего не делает, когда сервер пуст и локальный кэш пуст', () => {
    expect(decideStatusRestore(undefined, undefined)).toEqual({ type: 'noop' });
  });

  it('восстанавливает локальный статус, когда сервер не вернул status_msg', () => {
    expect(decideStatusRestore(undefined, '🟢 На месте')).toEqual({
      type: 'restore',
      statusMsg: '🟢 На месте',
    });
  });

  it('синхронизирует кэш с сервером, когда серверный статус отличается', () => {
    expect(decideStatusRestore('🟢 На месте', '🍴 Обед')).toEqual({
      type: 'adopt-server',
      statusMsg: '🟢 На месте',
    });
  });

  it('берёт серверный статус, когда локального кэша нет', () => {
    expect(decideStatusRestore('🍴 Обед', undefined)).toEqual({
      type: 'adopt-server',
      statusMsg: '🍴 Обед',
    });
  });

  it('только показывает совпадающий серверный статус, не меняя кэш', () => {
    expect(decideStatusRestore('🍴 Обед', '🍴 Обед')).toEqual({
      type: 'show-server',
      statusMsg: '🍴 Обед',
    });
  });
});

describe('restoreCustomStatus', () => {
  it('повторяет запрос и не трогает кэш при ошибке getPresence', async () => {
    saveActiveStatusMsg('🍴 Обед');
    const { mx, stub } = makeClient({});
    stub.getPresence.mockRejectedValueOnce(new Error('network down'));

    await expect(restoreCustomStatus(mx)).resolves.toBe('retry');
    expect(stub.setPresence).not.toHaveBeenCalled();
    expect(getActiveStatusMsg()).toBe('🍴 Обед');
  });

  it('восстанавливает локальный статус, когда сервер вернул пусто, сохраняя presence', async () => {
    saveActiveStatusMsg('🍴 Обед');
    const { mx, stub } = makeClient({});

    await expect(restoreCustomStatus(mx)).resolves.toBe('done');
    expect(stub.setPresence).toHaveBeenCalledWith({
      presence: SetPresence.Unavailable,
      status_msg: '🍴 Обед',
    });
    expect(getActiveStatusMsg()).toBe('🍴 Обед');
  });

  it('синхронизирует локальный кэш с серверным значением без setPresence', async () => {
    saveActiveStatusMsg('🍴 Обед');
    const { mx, stub } = makeClient({ presence: 'online', status_msg: '🟢 На месте' });

    await expect(restoreCustomStatus(mx)).resolves.toBe('done');
    expect(stub.setPresence).not.toHaveBeenCalled();
    expect(getActiveStatusMsg()).toBe('🟢 На месте');
  });

  it('не отправляет setPresence, когда значения совпадают', async () => {
    saveActiveStatusMsg('🟢 На месте');
    const { mx, stub } = makeClient({ presence: 'online', status_msg: '🟢 На месте' });

    await expect(restoreCustomStatus(mx)).resolves.toBe('done');
    expect(stub.setPresence).not.toHaveBeenCalled();
    expect(getActiveStatusMsg()).toBe('🟢 На месте');
  });

  it('не перезаписывает статус, изменённый пользователем за время запроса', async () => {
    saveActiveStatusMsg('🍴 Обед');
    const { mx, stub } = makeClient({ presence: 'online', status_msg: '🟢 На месте' });
    let releasePresence: (value: Record<string, unknown>) => void = () => {};
    stub.getPresence.mockReturnValueOnce(
      new Promise((resolve) => {
        releasePresence = resolve;
      })
    );

    const pending = restoreCustomStatus(mx);
    saveActiveStatusMsg('🏁 Ушел');
    releasePresence({ presence: 'online', status_msg: '🟢 На месте' });

    await expect(pending).resolves.toBe('done');
    expect(stub.setPresence).not.toHaveBeenCalled();
    expect(getActiveStatusMsg()).toBe('🏁 Ушел');
  });
});
