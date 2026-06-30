import {
  Archive as ArchiveIcon,
  Camera,
  LayoutGrid,
  Lock,
  Mail,
  MonitorSmartphone,
} from 'lucide-react';
import { REMOTE, lock } from '@/services/api';
import { useActiveTasks, useBuckets } from '@/data/store';
import { weekday } from '@/domain/dates';
import { AreaTag, SourceTag } from '@/components/tags';
import { Board } from '@/board/Board';
import { useDrag } from '@/board/useDrag';
import { Archive } from '@/archive/Archive';
import { EinkDisplay } from '@/eink/EinkDisplay';
import { CaptureOverlay } from '@/capture/CaptureOverlay';
import { DetailSheet } from '@/detail/DetailSheet';
import { EmailSheet } from '@/email/EmailSheet';
import { NewBucketModal } from '@/board/NewBucketModal';
import { useUI } from './uiState';
import s from './App.module.css';

// Phone-first preference: notes hidden by default (matches prototype showNote=false).
const SHOW_NOTE = false;

export function App() {
  const tasks = useActiveTasks();
  const buckets = useBuckets();
  const ui = useUI();
  const drag = useDrag(ui.groupBy);

  const dragTask = drag.dragId
    ? tasks.find((t) => String(t.id) === String(drag.dragId))
    : undefined;

  return (
    <div className={s.column}>
      {/* HEADER */}
      <div className={s.header}>
        <div>
          <div className={s.wordmark}>Tend</div>
          <div className={s.subline}>
            {weekday()} · {tasks.length} active
          </div>
        </div>
        <div className={s.headerRight}>
          {REMOTE && (
            <button
              type="button"
              className={s.lock}
              aria-label="Lock"
              onClick={() => lock()}
            >
              <Lock size={18} />
            </button>
          )}
          <button
            type="button"
            className={s.fab}
            aria-label="Capture a list"
            onClick={() => ui.startCapture()}
          >
            <Camera size={18} />
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className={s.main}>
        {ui.view === 'board' && (
          <Board tasks={tasks} buckets={buckets} showNote={SHOW_NOTE} drag={drag} />
        )}
        {ui.view === 'archive' && <Archive />}
        {ui.view === 'eink' && <EinkDisplay tasks={tasks} buckets={buckets} />}
      </div>

      {/* BOTTOM NAV */}
      <div className={s.nav}>
        <NavItem
          label="Board"
          icon={<LayoutGrid size={16} />}
          active={ui.view === 'board' && !ui.overlay}
          onClick={() => ui.setView('board')}
        />
        <NavItem
          label="Capture"
          icon={<Camera size={16} />}
          active={ui.overlay === 'capture'}
          onClick={() => ui.startCapture()}
        />
        <NavItem
          label="Email"
          icon={<Mail size={16} />}
          active={ui.overlay === 'email'}
          onClick={() => ui.openOverlay('email')}
        />
        <NavItem
          label="Display"
          icon={<MonitorSmartphone size={16} />}
          active={ui.view === 'eink' && !ui.overlay}
          onClick={() => ui.setView('eink')}
        />
        <NavItem
          label="Archive"
          icon={<ArchiveIcon size={16} />}
          active={ui.view === 'archive' && !ui.overlay}
          onClick={() => ui.setView('archive')}
        />
      </div>

      {/* OVERLAYS */}
      {ui.overlay === 'capture' && <CaptureOverlay />}
      {ui.overlay === 'detail' && <DetailSheet />}
      {ui.overlay === 'email' && <EmailSheet tasks={tasks} buckets={buckets} />}
      {ui.overlay === 'newbucket' && <NewBucketModal />}

      {/* DRAG CLONE */}
      {dragTask && (
        <div ref={drag.cloneRef} className={s.clone}>
          <div className={s.cloneTitle}>{dragTask.title}</div>
          <div className={s.cloneMeta}>
            <SourceTag source={dragTask.source} />
            <AreaTag area={dragTask.area} />
          </div>
        </div>
      )}

      {/* TOAST */}
      {ui.toast && (
        <div className={s.toastWrap}>
          <div className={s.toast}>{ui.toast}</div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${s.navItem} ${active ? s.navOn : ''}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
