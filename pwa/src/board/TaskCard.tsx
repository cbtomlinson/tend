import { GripVertical } from 'lucide-react';
import type { Task } from '@/data/types';
import { AreaTag, DueChip, PriorityMark, SourceTag, Waiting } from '@/components/tags';
import s from './TaskCard.module.css';

interface Props {
  task: Task;
  showNote: boolean;
  dimmed: boolean;
  onOpen: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export function TaskCard({ task, showNote, dimmed, onOpen, onDragStart }: Props) {
  const noteOrAdded = task.note || (task.added ? `added ${task.added}` : '');
  return (
    <div
      data-task-id={task.id}
      className={s.card}
      style={{ opacity: dimmed ? 0.35 : 1 }}
    >
      <button type="button" className={s.content} onClick={onOpen}>
        <div className={s.title}>{task.title}</div>
        <div className={s.meta}>
          <SourceTag source={task.source} />
          <AreaTag area={task.area} />
          <span className={s.right}>
            {task.waiting && <Waiting name={task.waiting} />}
            {task.due && <DueChip label={task.due} urgency={task.dueUrgency} />}
            <PriorityMark prio={task.prio} />
          </span>
        </div>
        {showNote && noteOrAdded && <div className={s.note}>{noteOrAdded}</div>}
      </button>
      <div
        className={s.grip}
        onPointerDown={onDragStart}
        role="button"
        aria-label="Drag to move"
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </div>
    </div>
  );
}
