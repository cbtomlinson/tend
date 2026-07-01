import { Check, Circle, GripVertical } from 'lucide-react';
import type { Task } from '@/data/types';
import { AreaTag, DueChip, PriorityMark, SourceTag, Waiting } from '@/components/tags';
import s from './TaskCard.module.css';

interface Props {
  task: Task;
  dimmed: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export function TaskCard({ task, dimmed, onOpen, onComplete, onDragStart }: Props) {
  return (
    <div
      data-task-id={task.id}
      className={`${s.card} ${task.prio === 'High' ? s.cardHigh : ''}`}
      style={{ opacity: dimmed ? 0.35 : 1 }}
    >
      <button
        type="button"
        className={s.check}
        aria-label={`Complete "${task.title}"`}
        onClick={onComplete}
      >
        <Circle className={s.checkRing} size={22} strokeWidth={1.75} />
        <Check className={s.checkMark} size={14} strokeWidth={3} />
      </button>
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
        {task.note && <div className={s.note}>{task.note}</div>}
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
