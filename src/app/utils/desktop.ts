import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  disable as disableAutostart,
  enable as enableAutostart,
} from '@tauri-apps/plugin-autostart';
import { StatusPreset } from '../plugins/custom-status';
import { isTauri } from './notification';

export async function setDesktopSettings(showTrayIcon: boolean): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_desktop_settings', { showTray: showTrayIcon });
  } catch (e) {
    console.error('setDesktopSettings failed', e);
  }
}

export async function setStatusPresets(statuses: StatusPreset[]): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_statuses', { statuses });
  } catch (e) {
    console.error('setStatusPresets failed', e);
  }
}

export async function setActiveStatus(active: StatusPreset | null): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_active_status', { active });
  } catch (e) {
    console.error('setActiveStatus failed', e);
  }
}

/**
 * Включает или снимает регистрацию автозапуска в операционной системе.
 * Возвращает false, если операция не выполнена (веб-режим или ошибка плагина):
 * настройка тогда должна быть возвращена в выключенное положение.
 */
export async function applyAutostart(enabled: boolean): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    if (enabled) {
      await enableAutostart();
    } else {
      await disableAutostart();
    }
    return true;
  } catch (e) {
    console.error('applyAutostart failed', e);
    return false;
  }
}

export async function setTrayIcon(bytes: Uint8Array): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke('set_tray_icon', { bytes: Array.from(bytes) });
  } catch (e) {
    console.error('setTrayIcon failed', e);
  }
}

export async function listenTrayStatus(
  handler: (preset: StatusPreset) => void
): Promise<UnlistenFn> {
  if (!isTauri()) return () => undefined;
  try {
    return listen<StatusPreset>('tray-set-status', (event) => handler(event.payload));
  } catch (e) {
    console.error('listenTrayStatus failed', e);
    return () => undefined;
  }
}
