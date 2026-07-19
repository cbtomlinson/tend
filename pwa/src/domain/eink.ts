import type { Bucket, Prio, Task } from '@/data/types';
import { shortSource } from './sources';

/*
 * Builds the two read-only e-ink views (rendered at 800×480, 1-bit B/W).
 * This is the spec the firmware/render endpoint reproduces. Priority is shown
 * as filled / half / empty SQUARES — never color — so it survives 1-bit.
 */

const PRANK: Record<Prio, number> = { High: 3, Med: 2, Low: 1 };

function byBucket(active: Task[], id: string): Task[] {
  return active.filter((t) => t.bucket === id);
}
function prioritySorted(active: Task[]): Task[] {
  return active
    .slice()
    .sort(
      (a, b) => PRANK[b.prio] - PRANK[a.prio] || (b.due ? 1 : 0) - (a.due ? 1 : 0),
    );
}
export function einkMeta(t: Task): string {
  return `${shortSource(t.source)} · ${t.area} · ${t.prio[0]}`;
}

export interface EinkRow {
  id: Task['id'];
  title: string;
  meta: string;
  prio: Prio;
}
export interface EinkViewA {
  count: number;
  rows: EinkRow[];
  top3: { n: number; t: string }[];
  active: number;
  waiting: number;
  later: number;
  done: number;
}
export interface EinkCol {
  name: string;
  count: number;
  rows: EinkRow[];
  more: number;
}

const row = (t: Task): EinkRow => ({
  id: t.id,
  title: t.title,
  meta: einkMeta(t),
  prio: t.prio,
});

export function buildEinkA(active: Task[], doneToday: number): EinkViewA {
  // Main list = Today's Priorities (per Chelsea, 2026-07-18).
  const working = byBucket(active, 'today');
  return {
    count: working.length,
    rows: working.slice(0, 4).map(row),
    top3: prioritySorted(active)
      .slice(0, 3)
      .map((t, i) => ({ n: i + 1, t: t.title })),
    active: byBucket(active, 'active').length,
    waiting: byBucket(active, 'waiting').length,
    later: byBucket(active, 'later').length,
    done: doneToday,
  };
}

/** View C: the Quick Wins bucket (matched by name), as one full-width list. */
export function buildEinkC(active: Task[], buckets: Bucket[]): EinkCol | null {
  const quick = buckets.find((b) => b.name.toLowerCase().includes('quick'));
  if (!quick) return null;
  const items = byBucket(active, quick.id);
  return {
    name: quick.name.toUpperCase(),
    count: items.length,
    rows: items.slice(0, 6).map(row),
    more: Math.max(0, items.length - 6),
  };
}

export function buildEinkB(active: Task[], buckets: Bucket[]): EinkCol[] {
  return buckets.slice(0, 3).map((b) => {
    const items = byBucket(active, b.id);
    return {
      name: b.name.toUpperCase(),
      count: items.length,
      rows: items.slice(0, 4).map(row),
      more: Math.max(0, items.length - 4),
    };
  });
}
