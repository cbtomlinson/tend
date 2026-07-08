import { describe, expect, it } from 'vitest';
import { staleDays, waitingOrder } from '@/domain/waiting';
import { isoDaysAgo, mkTask } from './fixtures';

describe('staleDays', () => {
  it('is 0 under the threshold and outside the waiting bucket', () => {
    expect(
      staleDays(mkTask({ id: 1, bucket: 'waiting', waitingSince: isoDaysAgo(3) })),
    ).toBe(0);
    expect(
      staleDays(mkTask({ id: 2, bucket: 'active', waitingSince: isoDaysAgo(30) })),
    ).toBe(0);
  });
  it('reports days once flagged', () => {
    expect(
      staleDays(mkTask({ id: 1, bucket: 'waiting', waitingSince: isoDaysAgo(9) })),
    ).toBe(9);
  });
});

describe('waitingOrder', () => {
  it('floats flagged tasks to the top, longest wait first', () => {
    // Chelsea 2026-07-08: flagged waiting tasks should move to the top.
    const tasks = [
      mkTask({ id: 1, order: 0, bucket: 'waiting', waitingSince: isoDaysAgo(2), title: 'fresh-a' }),
      mkTask({ id: 2, order: 1, bucket: 'waiting', waitingSince: isoDaysAgo(9), title: 'stale-9' }),
      mkTask({ id: 3, order: 2, bucket: 'waiting', waitingSince: isoDaysAgo(1), title: 'fresh-b' }),
      mkTask({ id: 4, order: 3, bucket: 'waiting', waitingSince: isoDaysAgo(30), title: 'stale-30' }),
    ];
    expect(waitingOrder(tasks).map((t) => t.title)).toEqual([
      'stale-30',
      'stale-9',
      'fresh-a',
      'fresh-b',
    ]);
  });
});
