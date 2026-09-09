import { describe, expect, it } from 'vitest';
import { guessArea } from '@/domain/autoArea';

const AREAS = ['ClinDoc', 'OP Rehab', 'Acute Rehab', 'IRF', 'Rover'];
const PEOPLE = [
  { name: 'Sushmita Barua', area: 'OP Rehab' },
  { name: 'Kaitlin Clark', area: 'Acute Rehab' },
  { name: 'Chelsea Tomlinson', area: null },
];

describe('guessArea (manual-entry auto-tagging)', () => {
  it('tags by explicit area name — the original complaint', () => {
    // Chelsea 2026-09-08: this was landing in ClinDoc.
    expect(guessArea('IRF regulatory checklist', AREAS, [])).toBe('IRF');
  });

  it('prefers the longest matching area name', () => {
    expect(guessArea('OP Rehab student workflow', AREAS, [])).toBe('OP Rehab');
    expect(guessArea('Rover access for float pool', AREAS, [])).toBe('Rover');
  });

  it('matches custom areas by name too', () => {
    expect(guessArea('Cadence template question', [...AREAS, 'Cadence'], [])).toBe(
      'Cadence',
    );
  });

  it('uses a known person (first name is enough)', () => {
    expect(guessArea('Follow up with Sushmita', AREAS, PEOPLE)).toBe('OP Rehab');
    expect(guessArea('Ask Kaitlin about charges', AREAS, PEOPLE)).toBe('Acute Rehab');
  });

  it('ignores people without an area', () => {
    expect(guessArea('Chelsea to review later', AREAS, PEOPLE)).toBe('ClinDoc');
  });

  it('falls back to domain keywords', () => {
    expect(guessArea('Fix cosign routing', AREAS, [])).toBe('ClinDoc');
    expect(guessArea('Swing bed order cleanup', AREAS, [])).toBe('Acute Rehab');
    expect(guessArea('FIM mapping question', AREAS, [])).toBe('IRF');
    expect(guessArea('New outpatient clinic go-live', AREAS, [])).toBe('OP Rehab');
  });

  it('unmatched text falls back to the first area (old behavior)', () => {
    expect(guessArea('Buy a new stapler', AREAS, [])).toBe('ClinDoc');
  });
});
