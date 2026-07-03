import type { Task } from '@/data/types';

/** Minimal valid Task with overridable fields. */
export function mkTask(patch: Partial<Task> & { id: Task['id'] }): Task {
  return {
    title: 'Task',
    source: 'Hand',
    inSources: ['Hand'],
    area: 'ClinDoc',
    prio: 'Med',
    bucket: 'later',
    due: '',
    dueUrgency: '',
    note: '',
    ref: '',
    waiting: '',
    added: '',
    status: 'active',
    archivedAt: '',
    order: 0,
    ...patch,
  };
}

/** ISO date N days before today (local). */
export function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
