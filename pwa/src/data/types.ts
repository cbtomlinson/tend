// Tend core data model — see README.md "Data model".

/** Display labels for the four source lists. */
export type Source = 'Zoho' | 'Epic SLG' | 'To Do' | 'Hand';

/** Responsibility area — a filter/grouping dimension, NEVER relied on as color. */
export type Area = 'ClinDoc' | 'OP Rehab' | 'Acute Rehab' | 'IRF' | 'Rover';

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
