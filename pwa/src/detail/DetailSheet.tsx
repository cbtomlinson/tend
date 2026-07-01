import { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import {
  completeTask,
  deleteTask,
  updateTask,
  useBuckets,
} from '@/data/store';
import type { Area, Prio } from '@/data/types';
import { ALL_AREAS } from '@/domain/areas';
import { fmtShort } from '@/domain/dates';
import { SourceTag } from '@/components/tags';
import { BottomSheet } from '@/components/BottomSheet';
import { useUI } from '@/app/uiState';
import s from './DetailSheet.module.css';

const PRIOS: Prio[] = ['High', 'Med', 'Low'];

function tomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `Due ${fmtShort(d)}`;
}
function nextTueLabel(): string {
  const d = new Date();
  let add = (2 - d.getDay() + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return `Due ${fmtShort(d)}`;
}

export function DetailSheet() {
  const { detailId, closeOverlay, flash } = useUI();
  const buckets = useBuckets();
  const task = useLiveQuery(
    () => (detailId != null ? db.tasks.get(detailId) : undefined),
    [detailId],
  );

  // Local copies so typing never fights the live DB read (no cursor jumps).
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNote(task.note);
    }
    // Re-seed only when a different task opens, not on every keystroke write-back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;

  const tomorrow = tomorrowLabel();
  const nextTue = nextTueLabel();
  const alsoIn = (task.inSources ?? []).filter((x) => x !== task.source);
  const set = (patch: Parameters<typeof updateTask>[1]) => updateTask(task.id, patch);

  return (
    <BottomSheet onClose={closeOverlay}>
      <div className={s.titleRow}>
        <input
          ref={titleRef}
          className={s.titleInput}
          value={title}
          aria-label="Task name"
          onChange={(e) => {
            setTitle(e.target.value);
            set({ title: e.target.value });
          }}
        />
        <button
          type="button"
          className={s.editHint}
          aria-label="Edit task name"
          onClick={() => titleRef.current?.focus()}
        >
          <Pencil size={15} />
        </button>
      </div>
      <div className={s.srcRow}>
        <SourceTag source={task.source} />
        {task.ref && <span className={s.ref}>{task.ref}</span>}
        {alsoIn.length > 0 && (
          <span className={s.alsoIn}>also in {alsoIn.join(', ')}</span>
        )}
      </div>

      <div className={s.label}>AREA</div>
      <div className={s.chipWrap}>
        {ALL_AREAS.map((a: Area) => (
          <button
            key={a}
            type="button"
            className={`${s.mini} ${task.area === a ? s.miniOn : ''}`}
            onClick={() => set({ area: a })}
          >
            {a}
          </button>
        ))}
      </div>

      <div className={s.label}>PRIORITY</div>
      <div className={s.segTrack}>
        {PRIOS.map((p) => (
          <button
            key={p}
            type="button"
            className={`${s.seg} ${task.prio === p ? s.segOn : ''}`}
            onClick={() => set({ prio: p })}
          >
            {p}
          </button>
        ))}
      </div>

      <div className={s.dueHead}>
        <span className={s.label} style={{ marginBottom: 0 }}>
          DUE DATE
        </span>
        {task.due && (
          <button
            type="button"
            className={s.clear}
            onClick={() => set({ due: '', dueUrgency: '' })}
          >
            Clear
          </button>
        )}
      </div>
      <div className={s.dueRow}>
        <button
          type="button"
          className={`${s.due} ${task.due === 'Due today' ? s.dueOn : ''}`}
          onClick={() => set({ due: 'Due today', dueUrgency: 'soon' })}
        >
          Today
        </button>
        <button
          type="button"
          className={`${s.due} ${task.due === tomorrow ? s.dueOn : ''}`}
          onClick={() => set({ due: tomorrow, dueUrgency: 'soon' })}
        >
          Tomorrow
        </button>
        <button
          type="button"
          className={`${s.due} ${task.due === nextTue ? s.dueOn : ''}`}
          onClick={() => set({ due: nextTue, dueUrgency: 'normal' })}
        >
          Next Tue
        </button>
      </div>
      <div className={s.help}>A due you set here overrides the source list’s field.</div>

      <div className={s.label}>NEXT ACTION / NOTE</div>
      <textarea
        className={s.note}
        rows={2}
        placeholder="Add a note…"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          set({ note: e.target.value });
        }}
      />

      <div className={s.label}>BUCKET</div>
      <div className={s.chipWrap}>
        {buckets.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`${s.mini} ${task.bucket === b.id ? s.miniOn : ''}`}
            onClick={() => set({ bucket: b.id })}
          >
            {b.name}
          </button>
        ))}
      </div>

      {/* "Accept Changes" just closes — your edits already saved as you typed. */}
      <button type="button" className={s.done} onClick={closeOverlay}>
        Accept Changes
      </button>
      <div className={s.secondaryActions}>
        <button
          type="button"
          className={s.complete}
          onClick={async () => {
            await completeTask(task.id);
            closeOverlay();
            flash('Archived — kept in history');
          }}
        >
          <Check size={16} strokeWidth={3} /> Mark complete
        </button>
        <button
          type="button"
          className={s.delete}
          aria-label="Delete task"
          onClick={async () => {
            await deleteTask(task.id);
            closeOverlay();
            flash('Deleted');
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </BottomSheet>
  );
}
