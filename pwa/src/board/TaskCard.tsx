import { Check, Circle, GripVertical } from 'lucide-react';
import type { Task } from '@/data/types';
import { WAIT_REMIND_DEFAULT } from '@/data/store';
import { daysSince } from '@/domain/dates';
import { AreaTag, DueChip, PriorityMark, SourceTag, Waiting } from '@/components/tags';
import s from './TaskCard.module.css';

/** Days a task has sat in Waiting On past its threshold (0 = not stale). */
function staleDays(task: Task): number {
  if (task.bucket !== 'waiting' || !task.waitingSince) return 0;
  const days = daysSince(task.waitingSince);
  return days >= (task.waitRemindDays ?? WAIT_REMIND_DEFAULT) ? days : 0;
}

interface Props {
  task: Task;
  dimmed: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

export function TaskCard({ task, dimmed, onOpen, onComplete, onDragStart }: Props) {
  const stale = staleDays(task);
  return (
    <div
      data-task-id={task.id}
      className={`${s.card} ${task.prio === 'High' ? s.cardHigh : ''} ${
        stale ? s.cardStale : ''
      }`}
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
            {stale > 0 && <span className={s.staleChip}>waiting {stale}d</span>}
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
