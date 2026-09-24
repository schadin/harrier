export const CARD_FONT_SCALE_MIN = 75;
export const CARD_FONT_SCALE_MAX = 150;
export const DEFAULT_CARD_FONT_SCALE = 100;

// Приводит процент масштаба текста карточек к допустимому целому значению.
export const clampCardFontScale = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_CARD_FONT_SCALE;
  return Math.max(CARD_FONT_SCALE_MIN, Math.min(CARD_FONT_SCALE_MAX, Math.round(value)));
};

// Множитель размера текста: 100% → 1 (размер не меняется).
export const cardFontFactor = (percent: number): number => clampCardFontScale(percent) / 100;
