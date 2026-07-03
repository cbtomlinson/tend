import { describe, expect, it } from 'vitest';
import type { Bucket } from '@/data/types';
import { emailHtml, overdueWaiting, plainText } from '@/domain/emailFormats';
import { isoDaysAgo, mkTask } from './fixtures';

const buckets: Bucket[] = [
  { id: 'active', name: 'Actively Working', fixed: true, order: 0 },
  { id: 'waiting', name: 'Waiting On', fixed: true, order: 1 },
];

describe('overdueWaiting', () => {
  it('flags waiting tasks at/over their threshold, oldest first', () => {
    const tasks = [
      mkTask({ id: 1, bucket: 'waiting', waitingSince: isoDaysAgo(9), title: 'Old' }),
      mkTask({ id: 2, bucket: 'waiting', waitingSince: isoDaysAgo(2), title: 'Fresh' }),
      mkTask({ id: 3, bucket: 'waiting', waitingSince: isoDaysAgo(30), title: 'Ancient' }),
      mkTask({ id: 4, bucket: 'active', waitingSince: isoDaysAgo(30), title: 'NotWaiting' }),
    ];
    const flagged = overdueWaiting(tasks);
    expect(flagged.map((f) => f.task.title)).toEqual(['Ancient', 'Old']);
    expect(flagged[0].days).toBe(30);
  });

  it('honors a per-task threshold override', () => {
    const tasks = [
      mkTask({ id: 1, bucket: 'waiting', waitingSince: isoDaysAgo(3), waitRemindDays: 2 }),
      mkTask({ id: 2, bucket: 'waiting', waitingSince: isoDaysAgo(3), waitRemindDays: 10 }),
    ];
    expect(overdueWaiting(tasks).map((f) => f.task.id)).toEqual([1]);
  });
});

describe('plainText', () => {
  it('leads with a WAITING TOO LONG section when applicable', () => {
    const tasks = [
      mkTask({
        id: 1,
        bucket: 'waiting',
        waitingSince: isoDaysAgo(8),
        waiting: 'Epic TS',
        title: 'Ticket stuck',
      }),
    ];
    const out = plainText(tasks, buckets);
    expect(out).toContain('WAITING TOO LONG');
    expect(out).toContain('waiting 8d on Epic TS');
  });
});

describe('emailHtml', () => {
  it('escapes HTML in task titles', () => {
    const tasks = [mkTask({ id: 1, title: '<script>alert(1)</script>', bucket: 'active' })];
    const html = emailHtml(tasks, buckets, 'full');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('includes the waiting-too-long block ahead of the body', () => {
    const tasks = [
      mkTask({ id: 1, bucket: 'waiting', waitingSince: isoDaysAgo(10), title: 'Stuck' }),
      mkTask({ id: 2, bucket: 'active', title: 'Normal' }),
    ];
    const html = emailHtml(tasks, buckets, 'full');
    expect(html.indexOf('Waiting too long')).toBeGreaterThan(-1);
    expect(html.indexOf('Waiting too long')).toBeLessThan(html.indexOf('Normal'));
  });
});
