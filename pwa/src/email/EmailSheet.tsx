import { useMemo, useRef, useState } from 'react';
import { DatabaseBackup, Mail } from 'lucide-react';
import { db } from '@/data/db';
import type { Bucket, Task } from '@/data/types';
import {
  backupFilename,
  buildBackup,
  parseBackup,
  restoreBackup,
} from '@/domain/backup';
import {
  brandDate,
  emailHtml,
  emailSubject,
  emailTitle,
  flatList,
  groupBlocks,
  overdueWaiting,
  plainText,
  PRIO_DOT,
  type EmailFormat,
} from '@/domain/emailFormats';
import { sendBoardEmail } from '@/services/email';
import { BottomSheet } from '@/components/BottomSheet';
import { useUI } from '@/app/uiState';
import s from './EmailSheet.module.css';

const TABS: [EmailFormat, string][] = [
  ['priority', 'Priority list'],
  ['full', 'Full board'],
  ['active', 'Active only'],
  ['plain', 'Plain-text'],
];

export function EmailSheet({ tasks, buckets }: { tasks: Task[]; buckets: Bucket[] }) {
  const { closeOverlay, flash, emailFormat, setEmailFormat } = useUI();
  const fmt = emailFormat;
  const [toKindle, setToKindle] = useState(false);

  const plain = useMemo(() => plainText(tasks, buckets), [tasks, buckets]);
  const flat = useMemo(() => flatList(tasks, fmt, buckets), [tasks, fmt, buckets]);
  const groups = useMemo(() => groupBlocks(tasks, buckets), [tasks, buckets]);
  const overdue = useMemo(() => overdueWaiting(tasks), [tasks]);

  const isPlain = fmt === 'plain';
  const isFull = fmt === 'full';
  const isFlat = fmt === 'priority' || fmt === 'active';

  const onSend = async () => {
    const res = await sendBoardEmail({
      subject: emailSubject(fmt),
      html: emailHtml(tasks, buckets, fmt),
      text: plain,
      toKindle,
    });
    closeOverlay();
    flash(res.message);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard?.writeText(plain);
    } catch {
      /* clipboard may be blocked; ignore */
    }
    flash('Copied to clipboard');
  };

  // ---- Backup & restore (protection against the browser clearing storage) ----
  const restoreInput = useRef<HTMLInputElement>(null);

  const onBackupNow = async () => {
    const backup = await buildBackup();
    const res = await sendBoardEmail({
      subject: `Tend backup - ${brandDate()}`,
      html: emailHtml(tasks, buckets, 'full'),
      text: plain,
      toKindle: false,
      backupJson: JSON.stringify(backup),
      backupFilename: backupFilename(),
    });
    if (res.ok) await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
    flash(res.ok ? 'Backup emailed — keep that message' : res.message);
  };

  const onRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      const when = new Date(backup.exportedAt).toLocaleDateString();
      if (
        !window.confirm(
          `Restore ${backup.tasks.length} tasks from the ${when} backup? Existing items with the same ids are overwritten; nothing else is deleted.`,
        )
      )
        return;
      const counts = await restoreBackup(backup);
      closeOverlay();
      flash(`Restored ${counts.tasks} tasks ✓`);
    } catch {
      flash("That file isn't a Tend backup");
    }
  };

  return (
    <BottomSheet onClose={closeOverlay}>
      <div className={s.title}>Email me the board</div>
      <div className={s.sub}>
        Sent via Resend · also a Send-to-Kindle doc for your Scribe.
      </div>

      <div className={s.tabs}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${s.tab} ${fmt === key ? s.tabOn : ''}`}
            onClick={() => setEmailFormat(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={s.preview}>
        <div className={s.previewHead}>{emailTitle(fmt)}</div>
        <div className={s.previewBody}>
          {!isPlain && overdue.length > 0 && (
            <div>
              <div className={s.groupName} style={{ color: '#9a6b15' }}>
                Waiting too long
              </div>
              {overdue.map(({ task, days }) => (
                <div key={task.id} className={s.groupItem}>
                  <span className={s.bullet} style={{ color: '#9a6b15' }}>
                    !
                  </span>
                  <div>
                    <div>{task.title}</div>
                    <div className={s.itemSub}>
                      waiting {days}d{task.waiting ? ` on ${task.waiting}` : ''} ·{' '}
                      {task.area}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isPlain && <pre className={s.plain}>{plain}</pre>}

          {isFull &&
            groups.map((g) => (
              <div key={g.name}>
                <div className={s.groupName}>{g.name}</div>
                {g.items.map((it) => (
                  <div key={it.id} className={s.groupItem}>
                    <span className={s.bullet}>•</span>
                    <div>
                      <div>{it.title}</div>
                      <div className={s.itemSub}>{it.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {isFlat &&
            flat.map((it) => (
              <div key={it.id} className={s.flatRow}>
                <span
                  className={s.flatDot}
                  style={{ background: PRIO_DOT[it.prio] }}
                />
                <div style={{ flex: 1 }}>
                  <div className={s.flatTitle}>{it.title}</div>
                  <div className={s.itemSub}>{it.sub}</div>
                </div>
              </div>
            ))}
        </div>
      </div>

      <label className={s.kindleRow}>
        <input
          type="checkbox"
          checked={toKindle}
          onChange={(e) => setToKindle(e.target.checked)}
        />
        Also send to my Kindle Scribe
      </label>

      <div className={s.actions}>
        <button type="button" className={s.send} onClick={onSend}>
          <Mail size={18} /> Send now
        </button>
        <button type="button" className={s.copy} onClick={onCopy}>
          Copy
        </button>
      </div>

      <div className={s.backupRow}>
        <DatabaseBackup size={14} className={s.backupIcon} />
        <span className={s.backupText}>
          A backup emails itself daily on your first open after 5 pm.
        </span>
        <button type="button" className={s.backupBtn} onClick={onBackupNow}>
          Back up now
        </button>
        <button
          type="button"
          className={s.backupBtn}
          onClick={() => restoreInput.current?.click()}
        >
          Restore
        </button>
        <input
          ref={restoreInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={onRestoreFile}
        />
      </div>
    </BottomSheet>
  );
}
