import { describe, expect, it } from 'vitest';
import { buildReconcile } from '@/domain/reconcile';
import type { Extraction } from '@/services/vision';
import { mkTask } from './fixtures';

const cap = (items: Extraction['items'], source: Extraction['source'] = 'Hand') =>
  ({ source, items }) as Extraction;

describe('buildReconcile', () => {
  it('brand-new items land in newItems, included by default', () => {
    const rec = buildReconcile(
      [cap([{ title: 'Buy new stethoscope', area: 'ClinDoc' }])],
      [],
    );
    expect(rec.newItems).toHaveLength(1);
    expect(rec.newItems[0].include).toBe(true);
    expect(rec.newItems[0].bucket).toBe('later'); // review can change it
    expect(rec.dups).toHaveLength(0);
  });

  it('collapses the same task photographed in two lists into one candidate', () => {
    const rec = buildReconcile(
      [
        cap([{ title: 'Update cosign routing', area: 'ClinDoc' }], 'Hand'),
        cap([{ title: 'Update cosign routing', area: 'ClinDoc' }], 'Zoho'),
      ],
      [],
    );
    expect(rec.newItems).toHaveLength(1);
    expect(rec.newItems[0].sources.sort()).toEqual(['Hand', 'Zoho']);
  });

  it('exact board match becomes "already", not a new item', () => {
    const board = [mkTask({ id: 1, title: 'Update cosign routing', area: 'ClinDoc' })];
    const rec = buildReconcile(
      [cap([{ title: 'update cosign routing', area: 'ClinDoc' }])],
      board,
    );
    expect(rec.already).toHaveLength(1);
    expect(rec.newItems).toHaveLength(0);
  });

  it('partial overlap becomes a dup question defaulting to keep', () => {
    const board = [mkTask({ id: 1, title: 'Fix cosign routing', area: 'ClinDoc' })];
    const rec = buildReconcile(
      [cap([{ title: 'Cosign routing fix for Rover', area: 'ClinDoc' }])],
      board,
    );
    expect(rec.dups).toHaveLength(1);
    expect(rec.dups[0].choice).toBe('keep');
    expect(rec.dups[0].matchId).toBe(1);
  });

  it('board tasks from a captured source that were not seen become "gone"', () => {
    const board = [
      mkTask({ id: 1, title: 'Old hand task', source: 'Hand', inSources: ['Hand'] }),
      mkTask({ id: 2, title: 'Zoho ticket', source: 'Zoho', inSources: ['Zoho'] }),
    ];
    const rec = buildReconcile(
      [cap([{ title: 'Something else entirely', area: 'IRF' }], 'Hand')],
      board,
    );
    // Hand was captured -> its unseen task is "gone"; Zoho wasn't -> untouched.
    expect(rec.gone.map((g) => g.id)).toEqual([1]);
    expect(rec.gone[0].choice).toBe('keep');
  });
});
