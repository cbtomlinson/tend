// Tend core data model — see README.md "Data model".

/** Display labels for the four source lists. */
export type Source = 'Zoho' | 'Epic SLG' | 'To Do' | 'Hand';

/**
 * Responsibility area — a filter/grouping dimension, NEVER relied on as color.
 * User-manageable since v2 (stored in the `areas` table); plain string here.
 */
export type Area = string;

/** A user-manageable area definition. `name` doubles as the id. */
export interface AreaDef {
  name: string;
  /** Seeded areas can't be deleted. */
  fixed?: boolean;
  order: number;
  /** Index into the area color palette (tokens.css). */
  color: number;
}

/**
 * A person the scan can use to auto-assign areas. `area: null` means the user
 * marked the name as a one-off — known, but no area hint and never re-asked.
 */
export interface Person {
  name: string;
  area: Area | null;
}

export type Prio = 'High' | 'Med' | 'Low';

export type DueUrgency = '' | 'normal' | 'soon' | 'overdue';

export type TaskStatus = 'active' | 'archived';

export interface Task {
  id: number | string;
  title: string;
  /** The WINNING label: highest-ranked list the task appears in. */
  source: Source;
  /** Every list it appears in — drives the "also in …" line. */
  inSources: Source[];
  area: Area;
  prio: Prio;
  /** Bucket.id */
  bucket: string;
  /** Manual due override, e.g. "Due Jun 30" ('' = none). */
  due: string;
  /** Derived from due date vs today. */
  dueUrgency: DueUrgency;
  /** Next action / free note. */
  note: string;
  /** Reference, e.g. "SLG-4821" ('' = none). */
  ref: string;
  /** Assignee for Waiting On, e.g. "Epic TS" or a teammate's name. */
  waiting: string;
  /** ISO date (YYYY-MM-DD) the task entered the Waiting On bucket ('' = n/a). */
  waitingSince?: string;
  /** Per-task override for the waiting reminder threshold (days). */
  waitRemindDays?: number;
  /** Age / added marker, e.g. "5d" or "now". */
  added: string;
  status: TaskStatus;
  /** Date completed, e.g. "Jun 25". */
  archivedAt: string;
  /** Stable ordering within a group (board sort key). */
  order: number;
}

export interface Bucket {
  id: string;
  name: string;
  fixed?: boolean;
  order: number;
}
