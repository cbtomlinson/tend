import { CheckSquare, Diamond, PenLine, SquareStack } from 'lucide-react';
import type { Source } from '@/data/types';

const MAP = {
  Zoho: Diamond,
  'Epic SLG': SquareStack,
  'To Do': CheckSquare,
  Hand: PenLine,
} as const;

/** Replaces the prototype's placeholder Unicode glyphs with Lucide icons. */
export function SourceIcon({ source, size = 11 }: { source: Source; size?: number }) {
  const Icon = MAP[source];
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}
