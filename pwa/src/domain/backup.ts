import { db } from '@/data/db';
import type { AreaDef, Bucket, Person, Task } from '@/data/types';

/*
 * Backup & restore. The board lives only in IndexedDB, and a browser/OS can
 * clear that without warning — so the app regularly emails a JSON snapshot
 * (and offers manual export/restore). The backup is the user's own task text,
 * sent to their own inbox; never the capture photos (those are never stored).
 */

export interface Backup {
  app: 'tend';
  version: 1;
  exportedAt: string; // ISO datetime
  tasks: Task[];
  buckets: Bucket[];
  areas: AreaDef[];
  people: Person[];
  nextId: number;
}

export async function buildBackup(): Promise<Backup> {
  const [tasks, buckets, areas, people, nextIdRow] = await Promise.all([
    db.tasks.toArray(),
    db.buckets.toArray(),
    db.areas.toArray(),
    db.people.toArray(),
    db.meta.get('nextId'),
  ]);
  return {
    app: 'tend',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks,
    buckets,
    areas,
    people,
    nextId: nextIdRow?.value ?? 50,
  };
}

export function backupFilename(): string {
  return `tend-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export interface RestoreCounts {
  tasks: number;
  buckets: number;
  areas: number;
  people: number;
}

/** Parse + sanity-check a backup file's text. Throws on anything unusable. */
export function parseBackup(text: string): Backup {
  const data = JSON.parse(text) as Backup;
  if (
    data?.app !== 'tend' ||
    !Array.isArray(data.tasks) ||
    !Array.isArray(data.buckets ?? []) ||
    !Array.isArray(data.areas ?? []) ||
    !Array.isArray(data.people ?? [])
  ) {
    throw new Error('not a Tend backup');
  }
  // Every task must at least be storable and renderable.
  for (const t of data.tasks) {
    const idOk = typeof t?.id === 'number' || typeof t?.id === 'string';
    if (!idOk || typeof t?.title !== 'string') {
      throw new Error('corrupt backup: bad task entry');
    }
  }
  for (const b of data.buckets ?? []) {
    if (typeof b?.id !== 'string' || typeof b?.name !== 'string') {
      throw new Error('corrupt backup: bad bucket entry');
    }
  }
  return data;
}

/**
 * Restore a backup by upserting everything it contains (merge-over semantics:
 * existing rows with the same ids are overwritten, extra rows are kept).
 * nextId is only raised, never lowered, so new tasks can't collide.
 */
export async function restoreBackup(data: Backup): Promise<RestoreCounts> {
  await db.transaction(
    'rw',
    db.tasks,
    db.buckets,
    db.areas,
    db.people,
    db.meta,
    async () => {
      if (data.buckets?.length) await db.buckets.bulkPut(data.buckets);
      if (data.areas?.length) await db.areas.bulkPut(data.areas);
      if (data.people?.length) await db.people.bulkPut(data.people);
      if (data.tasks?.length) await db.tasks.bulkPut(data.tasks);
      const cur = (await db.meta.get('nextId'))?.value ?? 0;
      await db.meta.put({ key: 'nextId', value: Math.max(cur, data.nextId ?? 0) });
      await db.meta.put({ key: 'samplesCleared', value: 1 });
    },
  );
  return {
    tasks: data.tasks?.length ?? 0,
    buckets: data.buckets?.length ?? 0,
    areas: data.areas?.length ?? 0,
    people: data.people?.length ?? 0,
  };
}
