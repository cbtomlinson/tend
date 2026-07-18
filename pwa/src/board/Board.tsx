import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Search, Trash2, X } from 'lucide-react';
import type { Bucket, Task } from '@/data/types';
import { useAreas } from '@/domain/areas';
import {
  completeTask,
  deleteArea,
  deleteBucket,
  moveBucket,
  restoreTask,
} from '@/data/store';
import { useUI, type AreaFilter } from '@/app/uiState';
import { matchesQuery } from '@/domain/search';
import { waitingOrder } from '@/domain/waiting';
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

export function Board({ tasks, buckets, drag }: Props) {
  const { filterArea, setFilterArea, groupBy, setGroupBy, openOverlay, openDetail, flash } =
    useUI();
  const areas = useAreas();

  const areaFilters: AreaFilter[] = useMemo(
    () => ['All', ...areas.map((a) => a.name)],
    [areas],
  );

  // Search: opens a bar under the filters; every query word must match.
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  const searching = searchOpen && query.trim().length > 0;

  const shown = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (filterArea === 'All' || t.area === filterArea) &&
          (!searching || matchesQuery(t, query)),
      ),
    [tasks, filterArea, searching, query],
  );

  const groups: Group[] = useMemo(() => {
    const all =
      groupBy === 'Area'
        ? areas
            .filter((a) => filterArea === 'All' || filterArea === a.name)
            .map((a) => ({
              id: a.name,
              name: a.name,
              tasks: shown.filter((t) => t.area === a.name),
              fixed: !!a.fixed,
            }))
        : buckets.map((b) => ({
            id: b.id,
            name: b.name,
            // Waiting On floats its flagged (waited-too-long) tasks to the top.
            tasks:
              b.id === 'waiting'
                ? waitingOrder(shown.filter((t) => t.bucket === b.id))
                : shown.filter((t) => t.bucket === b.id),
            fixed: !!b.fixed,
          }));
    // While searching, empty groups are noise — hide them.
    return searching ? all.filter((g) => g.tasks.length > 0) : all;
  }, [groupBy, filterArea, shown, buckets, areas, searching]);

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

  const onDeleteArea = async (g: Group) => {
    const dest = areas[0]?.name ?? 'ClinDoc';
    if (
      !window.confirm(
        `Delete the "${g.name}" area? Any tasks tagged with it move to ${dest} — nothing is deleted.`,
      )
    )
      return;
    if (filterArea === g.name) setFilterArea('All');
    const moved = await deleteArea(g.id);
    flash(moved ? `Area deleted · ${moved} moved to ${dest}` : 'Area deleted');
  };

  return (
    <div className={s.board}>
      <div className={s.chips}>
        <button
          type="button"
          className={`${s.chip} ${s.chipSearch} ${searchOpen ? s.chipOn : ''}`}
          aria-label="Search tasks"
          onClick={() => {
            if (searchOpen) setQuery('');
            setSearchOpen(!searchOpen);
          }}
        >
          <Search size={12} strokeWidth={2.5} />
        </button>
        {areaFilters.map((a) => (
          <button
            key={a}
            type="button"
            className={`${s.chip} ${filterArea === a ? s.chipOn : ''}`}
            onClick={() => setFilterArea(a)}
          >
            {a}
          </button>
        ))}
        <button
          type="button"
          className={`${s.chip} ${s.chipAdd}`}
          aria-label="Add an area"
          onClick={() => openOverlay('newarea')}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>

      {searchOpen && (
        <div className={s.searchRow}>
          <Search size={14} className={s.searchIcon} />
          <input
            ref={searchRef}
            className={s.searchInput}
            value={query}
            placeholder="Search tasks…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {searching && (
            <span className={s.searchCount}>
              {shown.length} match{shown.length === 1 ? '' : 'es'}
            </span>
          )}
          <button
            type="button"
            className={s.searchClose}
            aria-label="Close search"
            onClick={() => {
              setQuery('');
              setSearchOpen(false);
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

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
              {groupBy === 'Area' && !g.fixed && (
                <div className={s.bucketTools}>
                  <button
                    type="button"
                    className={s.deleteBucket}
                    aria-label={`Delete ${g.name} area`}
                    onClick={() => onDeleteArea(g)}
                  >
                    <Trash2 size={14} />
                  </button>
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
