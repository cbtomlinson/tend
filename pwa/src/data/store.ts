import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { SEED_BUCKETS, SEED_NEXT_ID, SEED_TASKS } from './seed';
import type { Bucket, Source, Task } from './types';
import { today } from '@/domain/dates';
import { winningSource } from '@/domain/sources';

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

/** Ids of the original demo tasks — used to clear them once, on existing installs. */
const SAMPLE_TASK_IDS = SEED_TASKS.map((t) => t.id);

export async function ensureSeeded(): Promise<void> {
  const bucketCount = await db.buckets.count();
  const taskCount = await db.tasks.count();

  // Fresh install: just the default buckets, a clean (empty) board.
  if (bucketCount === 0 && taskCount === 0) {
    await db.transaction('rw', db.buckets, db.meta, async () => {
      await db.buckets.bulkPut(SEED_BUCKETS);
      await db.meta.put({ key: 'nextId', value: SEED_NEXT_ID });
      await db.meta.put({ key: 'samplesCleared', value: 1 });
    });
    return;
  }

  // Existing install: one-time removal of the original demo tasks (keeps any
  // real tasks the user added, which have higher ids).
  const cleared = await db.meta.get('samplesCleared');
  if (!cleared) {
    await db.transaction('rw', db.tasks, db.buckets, db.meta, async () => {
      await db.tasks.bulkDelete(SAMPLE_TASK_IDS);
      if ((await db.buckets.count()) === 0) await db.buckets.bulkPut(SEED_BUCKETS);
      await db.meta.put({ key: 'samplesCleared', value: 1 });
    });
  }

  // Ensure the "Today" bucket exists (added after first release) — at the top.
  if (!(await db.buckets.get('today'))) {
    const all = await db.buckets.orderBy('order').toArray();
    const firstOrder = all.length ? all[0].order : 0;
    await db.buckets.put({
      id: 'today',
      name: 'Today',
      fixed: true,
      order: firstOrder - 1,
    });
  }
}

async function takeId(): Promise<number> {
  const row = await db.meta.get('nextId');
  const value = row?.value ?? SEED_NEXT_ID;
  await db.meta.put({ key: 'nextId', value: value + 1 });
  return value;
}

/* ------------------------------------------------------------------ */
/* Live reads                                                          */
/* ------------------------------------------------------------------ */

export function useBuckets(): Bucket[] {
  return (
    useLiveQuery(() => db.buckets.orderBy('order').toArray(), [], [] as Bucket[]) ??
    []
  );
}

export function useActiveTasks(): Task[] {
  return (
    useLiveQuery(
      () =>
        db.tasks
          .where('status')
          .equals('active')
          .sortBy('order'),
      [],
      [] as Task[],
    ) ?? []
  );
}

export function useArchivedTasks(): Task[] {
  // Newest first (reverse insertion-ish): sort by order desc is fine for personal scale.
  return (
    useLiveQuery(
      () => db.tasks.where('status').equals('archived').reverse().sortBy('order'),
      [],
      [] as Task[],
    ) ?? []
  );
}

/* ------------------------------------------------------------------ */
/* Mutations                                                          */
/* ------------------------------------------------------------------ */

export type GroupBy = 'Buckets' | 'Area';

export async function updateTask(
  id: Task['id'],
  patch: Partial<Task>,
): Promise<void> {
  await db.tasks.update(id, patch);
}

export async function completeTask(id: Task['id']): Promise<void> {
  await db.tasks.update(id, { status: 'archived', archivedAt: today() });
}

export async function restoreTask(id: Task['id']): Promise<void> {
  await db.tasks.update(id, { status: 'active', archivedAt: '' });
}

export async function deleteTask(id: Task['id']): Promise<void> {
  await db.tasks.delete(id);
}

/**
 * Move a task to a target group (bucket or area, per groupBy) and reorder.
 * Insertion: before `beforeId` if given, else appended after the group's last.
 * Active tasks are globally renumbered so `order` stays clean.
 */
export async function moveTask(
  id: Task['id'],
  groupId: string,
  beforeId: Task['id'] | null,
  groupBy: GroupBy,
): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const actives = await db.tasks.where('status').equals('active').sortBy('order');
    const moved = actives.find((t) => String(t.id) === String(id));
    if (!moved) return;

    if (groupBy === 'Area') moved.area = groupId as Task['area'];
    else moved.bucket = groupId;

    const rest = actives.filter((t) => String(t.id) !== String(id));
    const key = groupBy === 'Area' ? 'area' : 'bucket';

    let insertAt: number;
    if (beforeId != null) {
      const j = rest.findIndex((t) => String(t.id) === String(beforeId));
      insertAt = j >= 0 ? j : rest.length;
    } else {
      let last = -1;
      rest.forEach((t, k) => {
        if ((t as Task)[key] === groupId) last = k;
      });
      insertAt = last + 1;
    }
    rest.splice(insertAt, 0, moved);

    await db.tasks.bulkPut(rest.map((t, i) => ({ ...t, order: i })));
  });
}

export async function addBucket(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const id = `b${await takeId()}`;
  const count = await db.buckets.count();
  await db.buckets.put({ id, name: trimmed, order: count });
}

/** Move a bucket one step up or down by swapping its order with its neighbor. */
export async function moveBucket(id: string, dir: 'up' | 'down'): Promise<void> {
  await db.transaction('rw', db.buckets, async () => {
    const all = await db.buckets.orderBy('order').toArray();
    const i = all.findIndex((b) => b.id === id);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    await db.buckets.update(all[i].id, { order: all[j].order });
    await db.buckets.update(all[j].id, { order: all[i].order });
  });
}

/**
 * Delete a custom bucket. Fixed buckets (Today / Actively Working / Waiting On /
 * Later) can't be deleted. Any tasks in the bucket are moved to "Later" — never
 * lost. Returns the number of tasks that were moved.
 */
export async function deleteBucket(id: string): Promise<number> {
  return db.transaction('rw', db.tasks, db.buckets, async () => {
    const bucket = await db.buckets.get(id);
    if (!bucket || bucket.fixed) return 0;
    const tasks = await db.tasks.where('bucket').equals(id).toArray();
    await Promise.all(tasks.map((t) => db.tasks.update(t.id, { bucket: 'later' })));
    await db.buckets.delete(id);
    return tasks.length;
  });
}

/* ------------------------------------------------------------------ */
/* Capture commit                                                     */
/* ------------------------------------------------------------------ */

export interface ReconcileNew {
  tid: string;
  title: string;
  area: Task['area'];
  include: boolean;
  /** Every captured list this item appeared in (≥1; >1 when seen across lists). */
  sources: Source[];
}
export interface ReconcileDup {
  tid: string;
  newTitle: string;
  matchId: Task['id'] | null;
  matchTitle: string;
  area: Task['area'];
  overlap: string;
  choice: 'keep' | 'merge';
  sources: Source[];
}
export interface ReconcileGone {
  id: Task['id'];
  title: string;
  choice: 'keep' | 'done';
}
export interface Reconcile {
  /** All lists captured in this session. */
  sources: Source[];
  newItems: ReconcileNew[];
  dups: ReconcileDup[];
  already: { id: Task['id']; title: string }[];
  gone: ReconcileGone[];
}

export interface CommitSummary {
  added: number;
  merged: number;
  archived: number;
}

/**
 * Apply the user's reconcile choices.
 * - includes -> new tasks (source = the captured list)
 * - merge    -> union inSources onto the matched board task (keep winning label)
 * - gone+done -> archive
 */
export async function commitCapture(rec: Reconcile): Promise<CommitSummary> {
  const summary: CommitSummary = { added: 0, merged: 0, archived: 0 };

  await db.transaction('rw', db.tasks, db.meta, async () => {
    const tailOrder = (await db.tasks.count()) + 1000;
    let n = 0;

    const newTask = async (
      title: string,
      area: Task['area'],
      sources: Source[],
    ): Promise<Task> => {
      const id = await takeId();
      const inSources = Array.from(new Set(sources)) as Source[];
      return {
        id,
        title,
        source: winningSource(inSources),
        area,
        prio: 'Med',
        bucket: 'later',
        order: tailOrder + n++,
        due: '',
        dueUrgency: '',
        note: '',
        ref: '',
        waiting: '',
        inSources,
        added: 'now',
        status: 'active',
        archivedAt: '',
      };
    };

    for (const item of rec.newItems) {
      if (!item.include) continue;
      await db.tasks.put(await newTask(item.title, item.area, item.sources));
      summary.added++;
    }

    for (const dup of rec.dups) {
      if (dup.choice === 'merge') {
        summary.merged++;
        if (dup.matchId != null) {
          const t = await db.tasks.get(dup.matchId);
          if (t) {
            const inSources = Array.from(
              new Set([...(t.inSources ?? [t.source]), ...dup.sources]),
            ) as Source[];
            await db.tasks.update(dup.matchId, {
              inSources,
              source: winningSource(inSources),
            });
          }
        }
      } else {
        await db.tasks.put(await newTask(dup.newTitle, dup.area, dup.sources));
        summary.added++;
      }
    }

    for (const g of rec.gone) {
      if (g.choice === 'done') {
        summary.archived++;
        await db.tasks.update(g.id, { status: 'archived', archivedAt: today() });
      }
    }
  });

  return summary;
}
