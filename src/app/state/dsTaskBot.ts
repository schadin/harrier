import { atom, useAtomValue, useSetAtom, WritableAtom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import { useCallback } from 'react';
import { useMatrixClient } from '../hooks/useMatrixClient';
import {
  atomWithLocalStorage,
  getLocalStorageItem,
  setLocalStorageItem,
} from './utils/atomWithLocalStorage';
import { DsTask } from '../features/ds-task-bot/parser';

export type DsTaskBotSettings = {
  botMxid: string;
  helpersEnabled: boolean;
  cardsEnabled: boolean;
  collapseCommandsEnabled: boolean;
};

export const DEFAULT_DS_TASK_BOT_SETTINGS: DsTaskBotSettings = {
  botMxid: '@dstaskbot:ds-core.ru',
  helpersEnabled: false,
  cardsEnabled: false,
  collapseCommandsEnabled: false,
};

const DS_TASK_BOT_SETTINGS = 'dsTaskBotSettings';

export type DsTaskBotSettingsAtom = WritableAtom<DsTaskBotSettings, [DsTaskBotSettings], undefined>;

const makeDsTaskBotSettingsAtom = (userId: string): DsTaskBotSettingsAtom => {
  const storeKey = `${DS_TASK_BOT_SETTINGS}${userId}`;

  return atomWithLocalStorage<DsTaskBotSettings>(
    storeKey,
    (key) => {
      const v = getLocalStorageItem<Partial<DsTaskBotSettings>>(key, {});
      return { ...DEFAULT_DS_TASK_BOT_SETTINGS, ...v };
    },
    (key, value) => {
      setLocalStorageItem(key, value);
    }
  );
};

export const dsTaskBotSettingsAtomFamily = atomFamily<string, DsTaskBotSettingsAtom>(
  makeDsTaskBotSettingsAtom
);

export const useDsTaskBotSettingsAtom = (): DsTaskBotSettingsAtom => {
  const mx = useMatrixClient();
  const userId = mx.getUserId() ?? '';

  return dsTaskBotSettingsAtomFamily(userId);
};

export const useDsTaskBotSettings = (): DsTaskBotSettings => {
  const settingsAtom = useDsTaskBotSettingsAtom();
  return useAtomValue(settingsAtom);
};

export const useSetDsTaskBotSettings = (): ((patch: Partial<DsTaskBotSettings>) => void) => {
  const settingsAtom = useDsTaskBotSettingsAtom();
  const settings = useAtomValue(settingsAtom);
  const setSettings = useSetAtom(settingsAtom);

  return useCallback(
    (patch: Partial<DsTaskBotSettings>) => {
      setSettings({ ...settings, ...patch });
    },
    [setSettings, settings]
  );
};

export const dsTaskBotLastTasksAtom = atom<Record<string, DsTask[]>>({});
