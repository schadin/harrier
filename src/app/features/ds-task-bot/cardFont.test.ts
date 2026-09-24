import { describe, expect, it } from 'vitest';
import {
  CARD_FONT_SCALE_MAX,
  CARD_FONT_SCALE_MIN,
  DEFAULT_CARD_FONT_SCALE,
  cardFontFactor,
  clampCardFontScale,
} from './cardFont';

describe('clampCardFontScale', () => {
  it('оставляет значение в допустимом диапазоне', () => {
    expect(clampCardFontScale(100)).toBe(100);
    expect(clampCardFontScale(120)).toBe(120);
  });

  it('ограничивает значение снизу и сверху', () => {
    expect(clampCardFontScale(10)).toBe(CARD_FONT_SCALE_MIN);
    expect(clampCardFontScale(1000)).toBe(CARD_FONT_SCALE_MAX);
  });

  it('округляет дробные значения', () => {
    expect(clampCardFontScale(112.6)).toBe(113);
  });

  it('возвращает значение по умолчанию для нечисловых значений', () => {
    expect(clampCardFontScale(Number.NaN)).toBe(DEFAULT_CARD_FONT_SCALE);
    expect(clampCardFontScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_CARD_FONT_SCALE);
    expect(clampCardFontScale(Number.NEGATIVE_INFINITY)).toBe(DEFAULT_CARD_FONT_SCALE);
  });
});

describe('cardFontFactor', () => {
  it('для 100% даёт множитель 1', () => {
    expect(cardFontFactor(DEFAULT_CARD_FONT_SCALE)).toBe(1);
  });

  it('переводит проценты в множитель', () => {
    expect(cardFontFactor(120)).toBe(1.2);
    expect(cardFontFactor(75)).toBe(0.75);
  });

  it('учитывает клампинг', () => {
    expect(cardFontFactor(1000)).toBe(CARD_FONT_SCALE_MAX / 100);
    expect(cardFontFactor(Number.NaN)).toBe(1);
  });
});
