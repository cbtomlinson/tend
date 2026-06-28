import type { Source } from '@/data/types';

/**
 * Source ranking for dedupe label-keeping: Zoho ▸ Epic SLG ▸ To Do ▸ Hand.
 * When a task appears in multiple lists, it keeps the highest-ranked label.
 */
export const SOURCE_RANK: Record<Source, number> = {
  Zoho: 4,
  'Epic SLG': 3,
  'To Do': 2,
  Hand: 1,
};

export const ALL_SOURCES: Source[] = ['Zoho', 'Epic SLG', 'To Do', 'Hand'];

/** Pick the winning (highest-ranked) source label from a set of lists. */
export function winningSource(sources: Source[]): Source {
  return sources.reduce((best, s) =>
    SOURCE_RANK[s] > SOURCE_RANK[best] ? s : best,
  );
}

/**
 * Prototype uses Unicode glyphs as placeholders; production maps each source
 * to a Lucide icon. Keys map Source -> lucide-react icon name.
 */
export const SOURCE_ICON: Record<Source, string> = {
  Zoho: 'Diamond',
  'Epic SLG': 'SquareStack',
  'To Do': 'CheckSquare',
  Hand: 'PenLine',
};

/** Short label used in dense contexts (e-ink meta, email). */
export function shortSource(source: Source): string {
  return source === 'Epic SLG' ? 'SLG' : source;
}
