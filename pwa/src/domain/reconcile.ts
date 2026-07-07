import type { Area, Source, Task } from '@/data/types';
import type { Reconcile } from '@/data/store';
import type { Extraction } from '@/services/vision';
import { classify, normalize, overlapLabel } from './dedupe';

/*
 * Reconcile one or more captures against the current board (README "Reconcile").
 *
 * Two passes:
 *   1. Dedupe WITHIN the batch — the same task photographed across several lists
 *      collapses into one candidate that records every list it appeared in.
 *   2. Diff each candidate against the board → four outcomes:
 *        New · Already on your board · Possible duplicate · Gone from this list.
 *
 * "Gone" is evaluated per captured source: a board task counts as gone only if
 * its source is among the lists captured this session and it wasn't matched.
 */

interface Candidate {
  title: string;
  area: Area;
  sources: Source[];
}

/** Stable key for exact within-batch matching: token set + area. */
function batchKey(title: string, area: Area): string {
  return `${normalize(title).slice().sort().join('|')}#${area}`;
}

export function buildReconcile(
  captures: Extraction[],
  board: Task[],
): Reconcile {
  const sources = Array.from(new Set(captures.map((c) => c.source)));
  const active = board.filter((t) => t.status === 'active');

  // Pass 1: collapse exact duplicates across the captured lists.
  const byKey = new Map<string, Candidate>();
  for (const cap of captures) {
    for (const item of cap.items) {
      const key = batchKey(item.title, item.area);
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.sources.includes(cap.source)) existing.sources.push(cap.source);
      } else {
        byKey.set(key, { title: item.title, area: item.area, sources: [cap.source] });
      }
    }
  }
  const candidates = [...byKey.values()];

  // Pass 2: diff each candidate against the board.
  const matchedIds = new Set<Task['id']>();
  const newItems: Reconcile['newItems'] = [];
  const dups: Reconcile['dups'] = [];
  const already: Reconcile['already'] = [];
  let n = 0;

  for (const cand of candidates) {
    let auto: Task | null = null;
    let ask: Task | null = null;
    let askOverlap = 0;

    for (const t of active) {
      const r = classify(
        { title: cand.title, area: cand.area },
        { title: t.title, area: t.area, ref: t.ref },
        true,
      );
      if (r.verdict === 'auto-merge') {
        auto = t;
        break;
      }
      if (r.verdict === 'ask' && r.overlap >= askOverlap) {
        ask = t;
        askOverlap = r.overlap;
      }
    }

    if (auto) {
      already.push({ id: auto.id, title: auto.title });
      matchedIds.add(auto.id);
    } else if (ask) {
      dups.push({
        tid: `d${n++}`,
        newTitle: cand.title,
        matchId: ask.id,
        matchTitle: ask.title,
        area: cand.area,
        matchArea: ask.area,
        overlap: overlapLabel(askOverlap),
        choice: 'keep',
        sources: cand.sources,
      });
      matchedIds.add(ask.id);
    } else {
      newItems.push({
        tid: `n${n++}`,
        title: cand.title,
        area: cand.area,
        include: true,
        sources: cand.sources,
      });
    }
  }

  // Gone: tasks on the board from a captured source that weren't seen this session.
  const gone: Reconcile['gone'] = active
    .filter((t) => sources.includes(t.source) && !matchedIds.has(t.id))
    .map((t) => ({ id: t.id, title: t.title, choice: 'keep' as const }));

  return { sources, newItems, dups, already, gone };
}
