import { describe, expect, it } from 'vitest';
import { fuzzyMatch, fuzzyMatchAny, PALETTE_CATEGORY_LIMIT } from './fuzzy';

describe('fuzzyMatch', () => {
  it('находит точное совпадение с максимальным счётом', () => {
    const exact = fuzzyMatch('General', 'General');
    expect(exact).toBeDefined();
    expect(exact!.indices).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('находит совпадение по подстроке', () => {
    const m = fuzzyMatch('eral', 'General');
    expect(m).toBeDefined();
    expect(m!.indices).toEqual([3, 4, 5, 6]);
  });

  it('находит subsequence-совпадение и подсвечивает символы', () => {
    const m = fuzzyMatch('gnr', 'General');
    expect(m).toBeDefined();
    expect(m!.indices).toEqual([0, 2, 4]);
  });

  it('ранжирует точное совпадение выше подстроки выше subsequence', () => {
    const exact = fuzzyMatch('abc', 'abc')!.score;
    const prefix = fuzzyMatch('abc', 'abcd')!.score;
    const contains = fuzzyMatch('bcd', 'abcde')!.score;
    const sub = fuzzyMatch('ace', 'abcde')!.score;
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(sub);
  });

  it('не находит несовпадение', () => {
    expect(fuzzyMatch('xyz', 'General')).toBeUndefined();
    expect(fuzzyMatch('', 'General')).toBeUndefined();
    expect(fuzzyMatch('abc', '')).toBeUndefined();
  });

  it('регистронезависим', () => {
    expect(fuzzyMatch('GENERAL', 'General')).toBeDefined();
    expect(fuzzyMatch('общ', 'Общие')).toBeDefined();
  });
});

describe('fuzzyMatchAny', () => {
  it('выбирает лучшее совпадение среди строк', () => {
    const m = fuzzyMatchAny('gen', ['Room', 'General']);
    expect(m).toBeDefined();
    expect(m!.indices).toEqual([0, 1, 2]);
  });

  it('ищет по keywords и MXID', () => {
    const m = fuzzyMatchAny('alice:ex', ['Alice', undefined, 'alice:example.org']);
    expect(m).toBeDefined();
  });

  it('возвращает undefined, если совпадений нет', () => {
    expect(fuzzyMatchAny('zzz', ['Alice', 'General'])).toBeUndefined();
  });
});

describe('PALETTE_CATEGORY_LIMIT', () => {
  it('ограничивает вывод', () => {
    expect(PALETTE_CATEGORY_LIMIT).toBeGreaterThan(0);
  });
});
