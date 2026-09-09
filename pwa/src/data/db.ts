import Dexie, { type Table } from 'dexie';
import type { AreaDef, Bucket, Person, Task, TimelineNote } from './types';

/*
 * Local-first store. Tasks + buckets live ONLY on-device (IndexedDB).
 * PHI rule: capture images are NEVER written here (or anywhere) — only the
 * extracted task TEXT is persisted. No cloud task sync.
 */
export class TendDB extends Dexie {
  tasks!: Table<Task, number | string>;
  buckets!: Table<Bucket, string>;
  /** User-manageable areas (v2). */
  areas!: Table<AreaDef, string>;
  /** Learned people → area hints for scan auto-assignment (v2). */
  people!: Table<Person, string>;
  /** Project timeline "sticky notes" shown on the e-ink display (v3). */
  timelines!: Table<TimelineNote, string>;
  /** key/value for small app metadata (e.g. nextId). */
  meta!: Table<{ key: string; value: number }, string>;

  constructor() {
    super('tend.v1');
    this.version(1).stores({
      tasks: 'id, bucket, area, status, order',
      buckets: 'id, order',
      meta: 'key',
    });
    this.version(2).stores({
      tasks: 'id, bucket, area, status, order',
      buckets: 'id, order',
      areas: 'name, order',
      people: 'name',
      meta: 'key',
    });
    this.version(3).stores({
      tasks: 'id, bucket, area, status, order',
      buckets: 'id, order',
      areas: 'name, order',
      people: 'name',
      timelines: 'id, order',
      meta: 'key',
    });
  }
}

export const db = new TendDB();
