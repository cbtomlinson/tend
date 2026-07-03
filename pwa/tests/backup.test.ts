import { describe, expect, it } from 'vitest';
import { backupFilename, parseBackup } from '@/domain/backup';
import { mkTask } from './fixtures';

const valid = () =>
  JSON.stringify({
    app: 'tend',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: [mkTask({ id: 1, title: 'A' }), mkTask({ id: 'x2', title: 'B' })],
    buckets: [{ id: 'later', name: 'Later', order: 0 }],
    areas: [{ name: 'ClinDoc', order: 0, color: 0 }],
    people: [{ name: 'Kaitlin', area: 'Acute Rehab' }],
    nextId: 60,
  });

describe('parseBackup', () => {
  it('accepts a valid backup', () => {
    const b = parseBackup(valid());
    expect(b.tasks).toHaveLength(2);
    expect(b.nextId).toBe(60);
  });

  it('rejects non-Tend JSON', () => {
    expect(() => parseBackup('{"foo":1}')).toThrow();
    expect(() => parseBackup('[]')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
  });

  it('rejects tasks without an id or title', () => {
    const bad = JSON.parse(valid());
    bad.tasks.push({ note: 'no title or id' });
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/bad task/);
  });

  it('rejects malformed buckets', () => {
    const bad = JSON.parse(valid());
    bad.buckets.push({ id: 42 });
    expect(() => parseBackup(JSON.stringify(bad))).toThrow(/bad bucket/);
  });
});

describe('backupFilename', () => {
  it('is date-stamped json', () => {
    expect(backupFilename()).toMatch(/^tend-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
