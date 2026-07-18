import { describe, expect, it } from 'vitest';
import { serverArchivedIds } from '@/services/boardSync';

describe('serverArchivedIds (button-C merge diff)', () => {
  const local = [
    { id: 1, status: 'active' as const },
    { id: 2, status: 'active' as const },
    { id: 3, status: 'archived' as const },
  ];

  it('finds tasks archived on the server but active locally', () => {
    const server = [
      { id: 1, status: 'archived' },
      { id: 2, status: 'active' },
      { id: 3, status: 'archived' },
    ];
    expect(serverArchivedIds(local, server)).toEqual([1]);
  });

  it('is empty when nothing changed server-side', () => {
    const server = [
      { id: 1, status: 'active' },
      { id: 2, status: 'active' },
    ];
    expect(serverArchivedIds(local, server)).toEqual([]);
  });

  it('matches ids across number/string representations', () => {
    expect(
      serverArchivedIds(
        [{ id: 42, status: 'active' }],
        [{ id: '42', status: 'archived' }],
      ),
    ).toEqual([42]);
  });

  it('ignores server tasks unknown locally', () => {
    expect(
      serverArchivedIds(local, [{ id: 99, status: 'archived' }]),
    ).toEqual([]);
  });
});
