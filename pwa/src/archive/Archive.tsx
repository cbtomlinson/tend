import { Check } from 'lucide-react';
import { restoreTask, useArchivedTasks } from '@/data/store';
import { shortSource } from '@/domain/sources';
import { useUI } from '@/app/uiState';
import s from './Archive.module.css';

export function Archive() {
  const items = useArchivedTasks();
  const { flash } = useUI();

  return (
    <div className={s.wrap}>
      <div className={s.title}>Archive</div>
      <div className={s.sub}>Completed tasks, kept for history.</div>
      {items.length === 0 && (
        <div className={s.emptyState}>Nothing archived yet.</div>
      )}
      {items.map((t) => (
        <div key={t.id} className={s.row}>
          <span className={s.check}>
            <Check size={11} strokeWidth={3} />
          </span>
          <div className={s.body}>
            <div className={s.itemTitle}>{t.title}</div>
            <div className={s.meta}>
              {shortSource(t.source)} · {t.area} · done {t.archivedAt}
            </div>
          </div>
          <button
            type="button"
            className={s.restore}
            onClick={async () => {
              await restoreTask(t.id);
              flash('Restored to board');
            }}
          >
            Restore
          </button>
        </div>
      ))}
    </div>
  );
}
