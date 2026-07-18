import { describe, expect, it } from 'vitest';
import { topTask } from '../../supabase/functions/_shared/boardStore';

/*
 * The display's green button completes topTask(). Chelsea 2026-07-18: it must
 * be the FIRST task of Today's Priorities in board order — never a task from
 * another bucket, no matter its priority.
 */

const t = (
  id: number,
  bucket: string,
  order: number,
  prio = 'Med',
  status = 'active',
) => ({ id, title: `t${id}`, bucket, order, prio, status });

describe('topTask (green button target)', () => {
  it('picks the first Today task by board order', () => {
    const snap = {
      tasks: [
        t(1, 'today', 5),
        t(2, 'today', 2), // first in board order
        t(3, 'today', 9),
      ],
    };
    expect(topTask(snap)?.id).toBe(2);
  });

  it('ignores higher-priority tasks in other buckets', () => {
    const snap = {
      tasks: [
        t(1, 'active', 0, 'High'),
        t(2, 'later', 1, 'High'),
        t(3, 'today', 7, 'Low'),
      ],
    };
    expect(topTask(snap)?.id).toBe(3);
  });

  it('skips archived tasks in Today', () => {
    const snap = {
      tasks: [t(1, 'today', 0, 'High', 'archived'), t(2, 'today', 1)],
    };
    expect(topTask(snap)?.id).toBe(2);
  });

  it('is a no-op (null) when Today is empty — never reaches elsewhere', () => {
    const snap = { tasks: [t(1, 'active', 0, 'High'), t(2, 'waiting', 1)] };
    expect(topTask(snap)).toBeNull();
  });
});
