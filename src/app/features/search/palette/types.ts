import { IconSrc } from 'folds';

export enum PaletteCategory {
  Actions = 'actions',
  Rooms = 'rooms',
  People = 'people',
  Spaces = 'spaces',
  Settings = 'settings',
}

export const PALETTE_CATEGORY_ORDER: PaletteCategory[] = [
  PaletteCategory.Actions,
  PaletteCategory.Rooms,
  PaletteCategory.People,
  PaletteCategory.Spaces,
  PaletteCategory.Settings,
];

export type PaletteItem = {
  id: string;
  category: PaletteCategory;
  title: string;
  subtitle?: string;
  /** дополнительные строки для поиска (алиас, roomId, MXID, EN-название) */
  keywords: string[];
  icon?: IconSrc;
  /** комната для аватара (комнаты, спейсы, DM) */
  roomId?: string;
  dm?: boolean;
  /** не закрывать палитру после выполнения (например, команда открывает диалог) */
  keepOpen?: boolean;
  run: () => void | Promise<void>;
};

export type ScoredPaletteItem = {
  item: PaletteItem;
  score: number;
  /** индексы совпавших символов в title (для подсветки) */
  indices?: number[];
};

export type PaletteProvider = () => PaletteItem[];
