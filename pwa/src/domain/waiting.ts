import type { Task } from '@/data/types';
import { WAIT_REMIND_DEFAULT } from '@/data/store';
import { daysSince } from './dates';

/** Days a task has sat in Waiting On past its threshold (0 = not stale). */
export function staleDays(task: Task): number {
  if (task.bucket !== 'waiting' || !task.waitingSince) return 0;
  const days = daysSince(task.waitingSince);
  return days >= (task.waitRemindDays ?? WAIT_REMIND_DEFAULT) ? days : 0;
}

/**
 * Order for the Waiting On bucket: stale (flagged) tasks first — longest wait
 * on top — then everything else in normal board order.
 */
export function waitingOrder(tasks: Task[]): Task[] {
  return tasks
    .slice()
    .sort((a, b) => staleDays(b) - staleDays(a) || a.order - b.order);
}
