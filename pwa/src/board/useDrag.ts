import { useCallback, useEffect, useRef, useState } from 'react';
import { moveTask, type GroupBy } from '@/data/store';
import type { Task } from '@/data/types';

/*
 * Pointer-based drag (touch + mouse), mirroring the prototype:
 *  - drag starts ONLY on a card's grip (touch-action:none) so the board scrolls
 *  - a floating clone follows the pointer
 *  - drop target = nearest [data-group-id] under the pointer (elementFromPoint)
 *  - insertion = before the hovered card if above its vertical midpoint, else append
 */

const HILITE = 'rgba(63,116,166,.06)';

export interface DragApi {
  dragId: Task['id'] | null;
  startDrag: (e: React.PointerEvent, id: Task['id']) => void;
  cloneRef: React.RefObject<HTMLDivElement>;
}

export function useDrag(groupBy: GroupBy): DragApi {
  const [dragId, setDragId] = useState<Task['id'] | null>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<{ group: string | null; before: string | null }>({
    group: null,
    before: null,
  });
  const startPos = useRef({ x: 0, y: 0 });

  const posClone = useCallback((x: number, y: number) => {
    const c = cloneRef.current;
    if (c) c.style.transform = `translate(${x - 150}px, ${y - 22}px)`;
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent, id: Task['id']) => {
      e.stopPropagation();
      dropRef.current = { group: null, before: null };
      startPos.current = { x: e.clientX, y: e.clientY };
      setDragId(id);
    },
    [],
  );

  useEffect(() => {
    if (dragId == null) return;
    posClone(startPos.current.x, startPos.current.y);

    const clearHilite = () =>
      document
        .querySelectorAll<HTMLElement>('[data-group-id]')
        .forEach((n) => (n.style.background = ''));

    const onMove = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      const { clientX: x, clientY: y } = e;
      posClone(x, y);

      const clone = cloneRef.current;
      if (clone) clone.style.visibility = 'hidden';
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      if (clone) clone.style.visibility = 'visible';

      clearHilite();
      const bz = el?.closest<HTMLElement>('[data-group-id]') ?? null;
      if (bz) {
        bz.style.background = HILITE;
        const group = bz.getAttribute('data-group-id');
        const card = el?.closest<HTMLElement>('[data-task-id]') ?? null;
        let before: string | null = null;
        if (
          card &&
          bz.contains(card) &&
          card.getAttribute('data-task-id') !== String(dragId)
        ) {
          const r = card.getBoundingClientRect();
          before =
            y < r.top + r.height / 2 ? card.getAttribute('data-task-id') : null;
        }
        dropRef.current = { group, before };
      } else {
        dropRef.current = { group: null, before: null };
      }
    };

    const onUp = () => {
      clearHilite();
      const { group, before } = dropRef.current;
      const id = dragId;
      setDragId(null);
      if (group) void moveTask(id, group, before, groupBy);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragId, groupBy, posClone]);

  return { dragId, startDrag, cloneRef };
}
