import { describe, expect, it } from 'vitest';
import { matchesQuery } from '@/domain/search';
import { mkTask } from './fixtures';

describe('matchesQuery', () => {
  const task = mkTask({
    id: 1,
    title: 'Enable 2FA for Rover on SGMC Public',
    note: 'waiting on network team',
    waiting: 'Epic TS',
    ref: 'SLG-4821',
  });

  it('matches case-insensitively across title, note, waiting, and ref', () => {
    expect(matchesQuery(task, 'rover')).toBe(true);
    expect(matchesQuery(task, 'NETWORK')).toBe(true);
    expect(matchesQuery(task, 'epic ts')).toBe(true);
    expect(matchesQuery(task, 'slg-4821')).toBe(true);
  });

  it('requires every word, in any order', () => {
    expect(matchesQuery(task, 'rover 2fa')).toBe(true);
    expect(matchesQuery(task, 'rover kindle')).toBe(false);
  });

  it('empty query matches everything', () => {
    expect(matchesQuery(task, '')).toBe(true);
    expect(matchesQuery(task, '   ')).toBe(true);
  });

  it('non-matching text misses', () => {
    expect(matchesQuery(task, 'swing bed')).toBe(false);
  });
});
