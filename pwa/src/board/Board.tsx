import { useMemo } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { Bucket, Task } from '@/data/types';
import { ALL_AREAS } from '@/domain/areas';
import { completeTask, deleteBucket, moveBucket, restoreTask } from '@/data/store';
import { useUI, type AreaFilter } from '@/app/uiState';
import type { DragApi } from './useDrag';
import { TaskCard } from './TaskCard';
import s from './Board.module.css';

interface Group {
  id: string;
  name: string;
  tasks: Task[];
  /** True for fixed/area sections that can't be deleted. */
  fixed: boolean;
}

interface Props {
  tasks: Task[];
  buckets: Bucket[];
  drag: DragApi;
}

const AREA_FILTERS: AreaFilter[] = ['All', ...ALL_AREAS];

export function Board({ tasks, buckets, drag }: Props) {
  const { filterArea, setFilterArea, groupBy, setGroupBy, openOverlay, openDetail, flash } =
    useUI();

  const shown = useMemo(
    () => tasks.filter((t) => filterArea === 'All' || t.area === filterArea),
    [tasks, filterArea],
  );

  const groups: Group[] = useMemo(() => {
    if (groupBy === 'Area') {
      return ALL_AREAS.filter((a) => filterArea === 'All' || filterArea === a).map(
        (a) => ({ id: a, name: a, tasks: shown.filter((t) => t.area === a), fixed: true }),
      );
    }
    return buckets.map((b) => ({
      id: b.id,
      name: b.name,
      tasks: shown.filter((t) => t.bucket === b.id),
      fixed: !!b.fixed,
    }));
  }, [groupBy, filterArea, shown, buckets]);

  const onCompleteTask = async (t: Task) => {
    await completeTask(t.id);
    flash('Completed — kept in history', {
      label: 'Undo',
      run: () => void restoreTask(t.id),
    });
  };

  const onDeleteBucket = async (g: Group) => {
    if (
      !window.confirm(
        `Delete the "${g.name}" bucket? Any tasks in it move to Later — nothing is deleted.`,
      )
    )
      return;
    const moved = await deleteBucket(g.id);
    flash(moved ? `Bucket deleted · ${moved} moved to Later` : 'Bucket deleted');
  };

  return (
    <div className={s.board}>
      <div className={s.chips}>
        {AREA_FILTERS.map((a) => (
          <button
            key={a}
            type="button"
            className={`${s.chip} ${filterArea === a ? s.chipOn : ''}`}
            onClick={() => setFilterArea(a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div className={s.controls}>
        <div className={s.segTrack}>
          <button
            type="button"
            className={`${s.seg} ${groupBy === 'Buckets' ? s.segOn : ''}`}
            onClick={() => setGroupBy('Buckets')}
          >
            Buckets
          </button>
          <button
            type="button"
            className={`${s.seg} ${groupBy === 'Area' ? s.segOn : ''}`}
            onClick={() => setGroupBy('Area')}
          >
            By area
          </button>
        </div>
        <button
          type="button"
          className={s.addBucket}
          onClick={() => openOverlay('newbucket')}
        >
          + Bucket
        </button>
      </div>

      <div className={s.sections}>
        {groups.map((g, i) => (
          <div key={g.id} className={s.section}>
            <div className={s.sectionHead}>
              <span className={s.sectionName}>{g.name}</span>
              <span className={s.count}>{g.tasks.length}</span>
              {groupBy === 'Buckets' && (
                <div className={s.bucketTools}>
                  <button
                    type="button"
                    className={s.bucketArrow}
                    aria-label={`Move ${g.name} up`}
                    disabled={i === 0}
                    onClick={() => moveBucket(g.id, 'up')}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    className={s.bucketArrow}
                    aria-label={`Move ${g.name} down`}
                    disabled={i === groups.length - 1}
                    onClick={() => moveBucket(g.id, 'down')}
                  >
                    <ChevronDown size={16} />
                  </button>
                  {!g.fixed && (
                    <button
                      type="button"
                      className={s.deleteBucket}
                      aria-label={`Delete ${g.name} bucket`}
                      onClick={() => onDeleteBucket(g)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div data-group-id={g.id} className={s.zone}>
              {g.tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  dimmed={String(drag.dragId) === String(t.id)}
                  onOpen={() => openDetail(t.id)}
                  onComplete={() => onCompleteTask(t)}
                  onDragStart={(e) => drag.startDrag(e, t.id)}
                />
              ))}
              {g.tasks.length === 0 && <div className={s.empty}>Drop a task here</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
