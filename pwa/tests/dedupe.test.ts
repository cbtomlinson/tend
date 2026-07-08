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

  it('auto-merges identical wording even when the area guesses differ', () => {
    // Chelsea 2026-07-03: literal duplicates were asking just because the
    // scan's area guess disagreed with the board — pure noise.
    const r = classify(
      {
        title: 'Enable 2FA for Rover on SGMC Public but skip on SGMC Data',
        area: 'Rover',
      },
      {
        title: 'Enable 2FA for Rover on SGMC Public but skip on SGMC Data',
        area: 'ClinDoc',
      },
    );
    expect(r.verdict).toBe('auto-merge');
    expect(r.reason).toBe('exact');
  });

  it('still never auto-merges PARTIAL overlap across different areas', () => {
    const r = classify(
      { title: 'Eval template cleanup for clinics', area: 'OP Rehab' },
      { title: 'Eval template rebuild', area: 'IRF' },
    );
    expect(r.verdict).not.toBe('auto-merge');
  });

  it('treats OP and outpatient as the same word', () => {
    const r = classify(
      { title: 'RH - Intake form built into MyChart - SGA outpatient', area: 'OP Rehab' },
      { title: 'RH - Intake form built into MyChart - SGA OP', area: 'OP Rehab' },
    );
    expect(r.verdict).toBe('auto-merge');
  });

  it('ignores a "Rehab:" organizational prefix', () => {
    const r = classify(
      {
        title: 'AMB Referrals to OT, PT, and SLP are not on Office Staff Preference List',
        area: 'OP Rehab',
      },
      {
        title: 'Rehab: AMB Referrals to OT, PT, and SLP are not on Office Staff Preference List',
        area: 'OP Rehab',
      },
    );
    expect(r.verdict).toBe('auto-merge');
  });

  it('treats singular/plural drift as the same wording', () => {
    // Chelsea 2026-07-08: "Providers SER" vs "Provider SER" scored 91% and asked.
    const r = classify(
      {
        title:
          'Rehab: Find OP Plans of Care that need signatures — report shows that POC went to physician via inbasket but Provider SER shows fax as preferred method',
        area: 'OP Rehab',
      },
      {
        title:
          'Rehab: Find OP Plans of Care that need signatures report shows that POC went to physician via inbasket but Providers SER shows fax as preferred method',
        area: 'OP Rehab',
      },
    );
    expect(r.verdict).toBe('auto-merge');
  });

  it('combines the rehab + OP rules ("Rehab: OP…" ≡ "Outpatient…")', () => {
    const r = classify(
      { title: 'Outpatient therapy manager report issues', area: 'OP Rehab' },
      { title: 'Rehab: OP therapy manager report issues', area: 'OP Rehab' },
    );
    expect(r.verdict).toBe('auto-merge');
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
