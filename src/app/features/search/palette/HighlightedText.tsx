import React, { Fragment } from 'react';

type HighlightedTextProps = {
  text: string;
  /** индексы символов, совпавших с запросом */
  indices?: number[];
};

/**
 * Подсветка совпавших символов по индексам (fuzzy/subsequence-матчинг).
 */
export function HighlightedText({ text, indices }: HighlightedTextProps) {
  if (!indices || indices.length === 0) return text;

  const matched = new Set(indices);
  const segments: { str: string; hit: boolean }[] = [];
  let current = { str: '', hit: matched.has(0) };

  for (let i = 0; i < text.length; i += 1) {
    const hit = matched.has(i);
    if (hit !== current.hit) {
      segments.push(current);
      current = { str: '', hit };
    }
    current.str += text[i];
  }
  segments.push(current);

  return (
    <>
      {segments.map((segment, i) =>
        segment.hit ? (
          // eslint-disable-next-line react/no-array-index-key
          <b key={i}>{segment.str}</b>
        ) : (
          // eslint-disable-next-line react/no-array-index-key
          <Fragment key={i}>{segment.str}</Fragment>
        )
      )}
    </>
  );
}
