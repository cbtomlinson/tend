import type { Task } from '@/data/types';

/*
 * Board search: every query word must appear somewhere in the task's
 * title / note / waiting / ref (case-insensitive substring). Word order
 * doesn't matter, so "rover 2fa" finds "Enable 2FA for Rover…".
 */
export function matchesQuery(task: Task, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay =
    `${task.title} ${task.note} ${task.waiting} ${task.ref}`.toLowerCase();
  return q.split(/\s+/).every((word) => hay.includes(word));
}
