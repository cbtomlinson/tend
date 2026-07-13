import { describe, expect, it } from 'vitest';
import {
  agoLabel,
  daysSince,
  dueInDays,
  fmtShort,
  isoToday,
  shortToIso,
} from '@/domain/dates';
import { isoDaysAgo } from './fixtures';

describe('agoLabel', () => {
  it('labels today / yesterday / N days ago', () => {
    expect(agoLabel(Date.now())).toBe('today');
    expect(agoLabel(Date.now() - 1 * 86400000)).toBe('yesterday');
    expect(agoLabel(Date.now() - 5 * 86400000)).toBe('5 days ago');
  });
});

describe('isoToday', () => {
  it('is YYYY-MM-DD and round-trips through daysSince as 0', () => {
    expect(isoToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysSince(isoToday())).toBe(0);
  });
});

describe('daysSince', () => {
  it('counts whole days', () => {
    expect(daysSince(isoDaysAgo(9))).toBe(9);
    expect(daysSince(isoDaysAgo(1))).toBe(1);
  });
  it('is 0 for empty/garbage input', () => {
    expect(daysSince('')).toBe(0);
    expect(daysSince(undefined)).toBe(0);
    expect(daysSince('not-a-date')).toBe(0);
  });
});

describe('shortToIso', () => {
  it('parses a recent "Mon D" label to this year', () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const label = fmtShort(d);
    const iso = shortToIso(label);
    expect(daysSince(iso)).toBe(3);
  });
  it('assumes last year when the label would be in the future', () => {
    const d = new Date();
    d.setDate(d.getDate() + 30); // a month ahead -> must be ~11 months ago
    const iso = shortToIso(fmtShort(d));
    expect(daysSince(iso)).toBeGreaterThan(300);
  });
  it('rejects labels it cannot parse', () => {
    expect(shortToIso('yesterday')).toBe('');
    expect(shortToIso('')).toBe('');
  });
});

describe('dueInDays', () => {
  it('renders a Due label', () => {
    expect(dueInDays(0)).toBe(`Due ${fmtShort(new Date())}`);
  });
});
