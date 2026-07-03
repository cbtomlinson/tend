import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive as ArchiveIcon,
  Camera,
  LayoutGrid,
  Lock,
  Mail,
  MonitorSmartphone,
} from 'lucide-react';
import { REMOTE, lock } from '@/services/api';
import { db } from '@/data/db';
import { useActiveTasks, useBuckets } from '@/data/store';
import { backupFilename, buildBackup } from '@/domain/backup';
import { brandDate, emailHtml, plainText } from '@/domain/emailFormats';
import { sendBoardEmail } from '@/services/email';
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
import { NewAreaModal } from '@/board/NewAreaModal';
import { useUI } from './uiState';
import s from './App.module.css';

/** localStorage sentinel: "this device has held real tasks before". */
const HAD_TASKS_KEY = 'tend.hadTasks';

export function App() {
  const tasks = useActiveTasks();
  const buckets = useBuckets();
  const ui = useUI();
  const drag = useDrag(ui.groupBy);
  const [dataMissing, setDataMissing] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  // "New version ready" banner — set by the service worker (see main.tsx).
  useEffect(() => {
    const onNeedRefresh = () => setUpdateReady(true);
    window.addEventListener('tend:need-refresh', onNeedRefresh);
    return () => window.removeEventListener('tend:need-refresh', onNeedRefresh);
  }, []);

  // Data-loss detector: remember (outside IndexedDB) that tasks existed; if the
  // DB later comes up empty, say so loudly instead of showing a silent fresh board.
  useEffect(() => {
    void (async () => {
      const count = await db.tasks.count();
      let had = '';
      try {
        had = localStorage.getItem(HAD_TASKS_KEY) ?? '';
      } catch {
        /* private mode */
      }
      if (count === 0 && had) setDataMissing(true);
    })();
  }, []);
  useEffect(() => {
    if (tasks.length > 0) {
      setDataMissing(false);
      try {
        localStorage.setItem(HAD_TASKS_KEY, String(Date.now()));
      } catch {
        /* private mode */
      }
    }
  }, [tasks.length]);

  // Auto-backup: when deployed, email a restore file DAILY, anchored to 5 pm.
  // The app can only send while open, so the first open (or return to the app)
  // after 5 pm sends it; a missed evening is caught up on the next open.
  const backupInFlight = useRef(false);
  useEffect(() => {
    if (!REMOTE || tasks.length === 0) return;

    const attempt = async () => {
      if (backupInFlight.current) return;
      backupInFlight.current = true;
      try {
        const last = (await db.meta.get('lastBackupAt'))?.value ?? 0;
        // Most recent 5 pm boundary (today's if past it, else yesterday's).
        const cutoff = new Date();
        cutoff.setHours(17, 0, 0, 0);
        if (Date.now() < cutoff.getTime()) cutoff.setDate(cutoff.getDate() - 1);
        if (last >= cutoff.getTime()) return;

        // Read fresh from the DB (not the render closure) — the visibility
        // trigger can fire long after this effect's tasks snapshot was taken.
        const [backup, allTasks, allBuckets] = await Promise.all([
          buildBackup(),
          db.tasks.where('status').equals('active').sortBy('order'),
          db.buckets.orderBy('order').toArray(),
        ]);
        const res = await sendBoardEmail({
          subject: `Tend backup - ${brandDate()}`,
          html: emailHtml(allTasks, allBuckets, 'full'),
          text: plainText(allTasks, allBuckets),
          toKindle: false,
          backupJson: JSON.stringify(backup),
          backupFilename: backupFilename(),
        });
        if (res.ok) {
          await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
          ui.flash('Daily backup emailed ✓');
        }
      } catch {
        /* offline etc. — retry on next open/return */
      } finally {
        backupInFlight.current = false;
      }
    };

    void attempt();
    // Also fire when returning to an already-open app (e.g. it crosses 5 pm
    // in the background and she switches back to it).
    const onVisible = () => {
      if (document.visibilityState === 'visible') void attempt();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

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
        {updateReady && (
          <div className={s.updateBar}>
            <span className={s.updateText}>A new version of Tend is ready.</span>
            <button
              type="button"
              className={s.updateBtn}
              onClick={() =>
                (
                  window as unknown as { __tendApplyUpdate?: () => void }
                ).__tendApplyUpdate?.()
              }
            >
              Update
            </button>
          </div>
        )}
        {dataMissing && (
          <div className={s.dataWarn}>
            <AlertTriangle size={16} className={s.dataWarnIcon} />
            <div className={s.dataWarnText}>
              <b>Your saved tasks are missing from this device.</b> The browser
              may have cleared the app&apos;s storage. Open <b>Email</b> below and
              use <b>Restore backup</b> with the file from your latest
              &ldquo;Tend backup&rdquo; email.
            </div>
            <button
              type="button"
              className={s.dataWarnClose}
              onClick={() => {
                setDataMissing(false);
                try {
                  localStorage.removeItem(HAD_TASKS_KEY);
                } catch {
                  /* ignore */
                }
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {ui.view === 'board' && (
          <Board tasks={tasks} buckets={buckets} drag={drag} />
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
      {ui.overlay === 'newarea' && <NewAreaModal />}

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
          <div className={s.toast}>
            <span>{ui.toast}</span>
            {ui.toastAction && (
              <button
                type="button"
                className={s.toastAction}
                onClick={() => {
                  ui.toastAction?.run();
                  ui.clearToast();
                }}
              >
                {ui.toastAction.label}
              </button>
            )}
          </div>
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
