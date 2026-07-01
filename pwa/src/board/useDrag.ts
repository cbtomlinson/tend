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

/** How close to the top/bottom edge (px) before the board auto-scrolls. */
const EDGE = 90;
/** Max auto-scroll speed (px per frame). */
const SPEED = 14;

/** Nearest vertically-scrollable ancestor (the board's scroll container). */
function findScrollParent(el: Element | null): HTMLElement | null {
  let n = el?.parentElement ?? null;
  while (n) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

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

    // Auto-scroll the board while dragging near its top/bottom edge, so a bucket
    // that's off screen can still be reached without letting go.
    const scroller = findScrollParent(document.querySelector('[data-group-id]'));
    let scrollDir = 0; // -1 up, 1 down, 0 idle
    let rafId = 0;
    const tick = () => {
      if (scrollDir !== 0 && scroller) {
        scroller.scrollTop += scrollDir * SPEED;
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = 0;
      }
    };
    const setScrollDir = (dir: number) => {
      scrollDir = dir;
      if (dir !== 0 && rafId === 0) rafId = requestAnimationFrame(tick);
    };

    const clearHilite = () =>
      document
        .querySelectorAll<HTMLElement>('[data-group-id]')
        .forEach((n) => (n.style.background = ''));

    const onMove = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      const { clientX: x, clientY: y } = e;
      posClone(x, y);

      // Edge-of-container auto-scroll.
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        if (y < r.top + EDGE) setScrollDir(-1);
        else if (y > r.bottom - EDGE) setScrollDir(1);
        else setScrollDir(0);
      }

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
      setScrollDir(0);
      if (rafId) cancelAnimationFrame(rafId);
      clearHilite();
      const { group, before } = dropRef.current;
      const id = dragId;
      setDragId(null);
      if (group) void moveTask(id, group, before, groupBy);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragId, groupBy, posClone]);

  return { dragId, startDrag, cloneRef };
}
