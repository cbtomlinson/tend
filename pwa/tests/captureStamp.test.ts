import { describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { commitCapture } from '@/data/store';

describe('commitCapture stamps capture recency', () => {
  it('writes lastCaptureAt and a per-source key', async () => {
    const before = Date.now();
    await commitCapture({
      sources: ['Epic SLG', 'Zoho'],
      newItems: [
        {
          tid: 'n0',
          title: 'Stamped task',
          area: 'ClinDoc',
          bucket: 'active',
          include: true,
          sources: ['Epic SLG'],
        },
      ],
      dups: [],
      already: [],
      gone: [],
    });

    // The review-time bucket choice is honored.
    const made = (await db.tasks.toArray()).find((t) => t.title === 'Stamped task');
    expect(made?.bucket).toBe('active');

    const overall = (await db.meta.get('lastCaptureAt'))?.value ?? 0;
    const slg = (await db.meta.get('lastCapture:Epic SLG'))?.value ?? 0;
    const zoho = (await db.meta.get('lastCapture:Zoho'))?.value ?? 0;
    const hand = await db.meta.get('lastCapture:Hand');

    expect(overall).toBeGreaterThanOrEqual(before);
    expect(slg).toBe(overall);
    expect(zoho).toBe(overall);
    expect(hand).toBeUndefined(); // uncaptured lists stay unstamped
  });
});
