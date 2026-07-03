import { describe, expect, it } from 'vitest';
import { anchors, classify, normalize, overlapLabel } from '@/domain/dedupe';

describe('normalize', () => {
  it('lowercases, strips punctuation, dedupes tokens', () => {
    const t = normalize('Fix the Fix: cosign!! routing');
    expect(t).toContain('cosign');
    expect(t).toContain('routing');
    expect(new Set(t).size).toBe(t.length); // no duplicate tokens
  });
});

describe('anchors', () => {
  it('extracts ticket refs from title and ref, dash-insensitive', () => {
    const a = anchors('Fix cosign SLG-4821', 'ZOHO-1234');
    expect(a.has('slg4821')).toBe(true);
    expect(a.has('zoho1234')).toBe(true);
  });
  it('ignores plain words and short numbers', () => {
    expect(anchors('Follow up with Tony').size).toBe(0);
  });
});

describe('classify', () => {
  it('auto-merges on a shared ticket anchor even across areas', () => {
    const r = classify(
      { title: 'Cosign fix SLG-4821', area: 'ClinDoc' },
      { title: 'Totally different words', area: 'IRF', ref: 'SLG-4821' },
    );
    expect(r.verdict).toBe('auto-merge');
    expect(r.reason).toBe('anchor');
  });

  it('auto-merges identical wording in the same area', () => {
    const r = classify(
      { title: 'Update OP eval template', area: 'OP Rehab' },
      { title: 'update op eval template', area: 'OP Rehab' },
    );
    expect(r.verdict).toBe('auto-merge');
    expect(r.reason).toBe('exact');
  });

  it('never auto-merges same wording across different areas', () => {
    const r = classify(
      { title: 'Update eval template', area: 'OP Rehab' },
      { title: 'Update eval template', area: 'IRF' },
    );
    expect(r.verdict).not.toBe('auto-merge');
  });

  it('asks on partial same-area overlap', () => {
    const r = classify(
      { title: 'Cosign routing fix for Rover', area: 'ClinDoc' },
      { title: 'Fix cosign routing', area: 'ClinDoc' },
    );
    expect(r.verdict).toBe('ask');
  });

  it('separates weak overlap', () => {
    const r = classify(
      { title: 'Therapy charge reconciliation', area: 'Acute Rehab' },
      { title: 'Swing bed order set', area: 'Acute Rehab' },
    );
    expect(r.verdict).toBe('separate');
  });
});

describe('overlapLabel', () => {
  it('formats as a percent', () => {
    expect(overlapLabel(0.5)).toBe('50%');
  });
});
