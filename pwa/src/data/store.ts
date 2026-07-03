import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { SEED_BUCKETS, SEED_NEXT_ID, SEED_TASKS } from './seed';
import type { Area, Bucket, Person, Source, Task } from './types';
import { daysSince, isoToday, shortToIso, today } from '@/domain/dates';
import { AREA_PALETTE_SIZE, DEFAULT_AREAS } from '@/domain/areas';
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

  // Ensure the "Today's Priorities" bucket exists (added after first release) — at the top.
  if (!(await db.buckets.get('today'))) {
    const all = await db.buckets.orderBy('order').toArray();
    const firstOrder = all.length ? all[0].order : 0;
    await db.buckets.put({
      id: 'today',
      name: "Today's Priorities",
      fixed: true,
      order: firstOrder - 1,
    });
  }

  // One-time rename of the default "Today" bucket -> "Today's Priorities".
  // Only touches the untouched default, so a custom rename is preserved.
  const todayBucket = await db.buckets.get('today');
  if (todayBucket && todayBucket.name === 'Today') {
    await db.buckets.update('today', { name: "Today's Priorities" });
  }

  // v2: seed the areas table (fills in any missing defaults, keeps customs).
  for (const a of DEFAULT_AREAS) {
    if (!(await db.areas.get(a.name))) await db.areas.put(a);
  }

  // v2: stamp waitingSince on tasks already sitting in Waiting On.
  const waiting = await db.tasks.where('bucket').equals('waiting').toArray();
  for (const t of waiting) {
    if (t.status === 'active' && !t.waitingSince) {
      await db.tasks.update(t.id, { waitingSince: isoToday() });
    }
  }

  // Archive housekeeping: completed tasks are kept for one month, then removed
  // (they live on in the daily backup emails). Legacy rows without an ISO
  // stamp are dated from their "Jun 25" label, assuming the most recent past.
  const ARCHIVE_KEEP_DAYS = 31;
  const archived = await db.tasks.where('status').equals('archived').toArray();
  for (const t of archived) {
    const iso = t.archivedIso || shortToIso(t.archivedAt);
    if (!t.archivedIso && iso) await db.tasks.update(t.id, { archivedIso: iso });
    if (iso && daysSince(iso) > ARCHIVE_KEEP_DAYS) await db.tasks.delete(t.id);
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

/** Default "waiting too long" threshold (days); per-task override on the task. */
export const WAIT_REMIND_DEFAULT = 7;

/**
 * Change a task's bucket, stamping/clearing waitingSince as it enters/leaves
 * Waiting On. Use this (not raw updateTask) for bucket changes.
 */
export async function setTaskBucket(id: Task['id'], bucket: string): Promise<void> {
  const t = await db.tasks.get(id);
  if (!t || t.bucket === bucket) return;
  const patch: Partial<Task> = { bucket };
  if (bucket === 'waiting') patch.waitingSince = isoToday();
  else if (t.bucket === 'waiting') patch.waitingSince = '';
  await db.tasks.update(id, patch);
}

export async function completeTask(id: Task['id']): Promise<void> {
  await db.tasks.update(id, {
    status: 'archived',
    archivedAt: today(),
    archivedIso: isoToday(),
  });
}

export async function restoreTask(id: Task['id']): Promise<void> {
  await db.tasks.update(id, { status: 'active', archivedAt: '', archivedIso: '' });
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

    if (groupBy === 'Area') {
      moved.area = groupId as Task['area'];
    } else {
      // Stamp/clear the waiting timer as the task enters/leaves Waiting On.
      if (groupId === 'waiting' && moved.bucket !== 'waiting') {
        moved.waitingSince = isoToday();
      } else if (groupId !== 'waiting' && moved.bucket === 'waiting') {
        moved.waitingSince = '';
      }
      moved.bucket = groupId;
    }

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

export async function addBucket(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return db.transaction('rw', db.buckets, db.meta, async () => {
    const all = await db.buckets.toArray();
    if (all.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    const id = `b${await takeId()}`;
    // max+1, not count: after a delete-then-add, count can collide with an
    // existing order, which breaks the up/down reorder swap.
    const maxOrder = Math.max(-1, ...all.map((b) => b.order));
    await db.buckets.put({ id, name: trimmed, order: maxOrder + 1 });
    return true;
  });
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
/* Areas & people                                                     */
/* ------------------------------------------------------------------ */

/** Add a custom area. Returns false if the name is taken/blank. */
export async function addArea(name: string): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return db.transaction('rw', db.areas, async () => {
    const all = await db.areas.toArray();
    if (all.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      return false;
    }
    const maxOrder = Math.max(-1, ...all.map((a) => a.order));
    // Cycle custom colors through the c5–c9 slice of the palette.
    const customCount = all.filter((a) => !a.fixed).length;
    const color = 5 + (customCount % (AREA_PALETTE_SIZE - 5));
    await db.areas.put({ name: trimmed, order: maxOrder + 1, color });
    return true;
  });
}

/**
 * Delete a custom area. Fixed areas can't be deleted. Tasks in the area move
 * to the first area (never lost). Returns the number of tasks moved.
 */
export async function deleteArea(name: string): Promise<number> {
  return db.transaction('rw', db.tasks, db.areas, db.people, async () => {
    const area = await db.areas.get(name);
    if (!area || area.fixed) return 0;
    const first = (await db.areas.orderBy('order').first())!;
    const tasks = await db.tasks.where('area').equals(name).toArray();
    await Promise.all(
      tasks.map((t) => db.tasks.update(t.id, { area: first.name })),
    );
    // Un-point any learned people at the removed area.
    const everyone = await db.people.toArray();
    await Promise.all(
      everyone
        .filter((p) => p.area === name)
        .map((p) => db.people.put({ ...p, area: null })),
    );
    await db.areas.delete(name);
    return tasks.length;
  });
}

/** Live list of learned people (defined + dismissed). */
export function usePeople(): Person[] {
  return useLiveQuery(() => db.people.toArray(), [], [] as Person[]) ?? [];
}

/** Learn a person -> area hint for future scans. */
export async function definePerson(name: string, area: Area): Promise<void> {
  await db.people.put({ name: name.trim(), area });
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
        await db.tasks.update(g.id, {
          status: 'archived',
          archivedAt: today(),
          archivedIso: isoToday(),
        });
      }
    }
  });

  return summary;
}
