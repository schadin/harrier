import { normalize } from '../../../utils/AsyncSearch';

export type FuzzyMatch = {
  score: number;
  indices: number[];
};

const range = (length: number, offset = 0): number[] =>
  Array.from({ length }, (_, i) => i + offset);

/**
 * Subsequence-матчинг: символы запроса идут в тексте по порядку,
 * но не обязательно подряд. Возвращает индексы совпавших символов.
 */
const subsequenceIndices = (query: string, text: string): number[] | undefined => {
  const indices: number[] = [];
  let ti = 0;
  for (let qi = 0; qi < query.length; qi += 1) {
    const ch = query[qi];
    let found = -1;
    while (ti < text.length) {
      if (text[ti] === ch) {
        found = ti;
        ti += 1;
        break;
      }
      ti += 1;
    }
    if (found === -1) return undefined;
    indices.push(found);
  }
  return indices;
};

/**
 * Fuzzy-матчинг с ранжированием:
 * точное совпадение > префикс > подстрока > subsequence.
 * Индексы — в координатах нормализованного текста.
 */
export const fuzzyMatch = (rawQuery: string, rawText: string): FuzzyMatch | undefined => {
  const query = normalize(rawQuery, { ignoreWhitespace: false }).trim();
  const text = normalize(rawText, { ignoreWhitespace: false });
  if (!query || !text) return undefined;

  if (text === query) {
    return { score: 1000 - text.length, indices: range(text.length) };
  }
  if (text.startsWith(query)) {
    return { score: 500 - (text.length - query.length), indices: range(query.length) };
  }
  const idx = text.indexOf(query);
  if (idx !== -1) {
    return { score: 250 - idx, indices: range(query.length, idx) };
  }
  const indices = subsequenceIndices(query, text);
  if (!indices) return undefined;
  const span = indices[indices.length - 1] - indices[0] + 1;
  // чем компактнее совпадение и короче текст, тем выше
  return { score: 100 - span - text.length * 0.1, indices };
};

export const fuzzyMatchAny = (
  query: string,
  texts: (string | undefined)[]
): FuzzyMatch | undefined => {
  let best: FuzzyMatch | undefined;
  texts.forEach((text) => {
    if (text === undefined) return;
    const match = fuzzyMatch(query, text);
    if (match && (!best || match.score > best.score)) best = match;
  });
  return best;
};

/** Максимум результатов на категорию */
export const PALETTE_CATEGORY_LIMIT = 8;
