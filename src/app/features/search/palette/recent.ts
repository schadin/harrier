const RECENT_STORAGE_KEY = 'harrier_palette_recent';
const RECENT_LIMIT = 10;

export const getRecentPaletteItemIds = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
};

export const pushRecentPaletteItem = (id: string): void => {
  const ids = getRecentPaletteItemIds().filter((existing) => existing !== id);
  ids.unshift(id);
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)));
  } catch {
    // localStorage недоступен — история просто не сохраняется
  }
};
