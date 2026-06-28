import { useMemo, useState } from 'react';
import { Mail } from 'lucide-react';
import type { Bucket, Task } from '@/data/types';
import {
  emailHtml,
  emailTitle,
  flatList,
  groupBlocks,
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

  const isPlain = fmt === 'plain';
  const isFull = fmt === 'full';
  const isFlat = fmt === 'priority' || fmt === 'active';

  const onSend = async () => {
    const res = await sendBoardEmail({
      subject: `Tend · ${emailTitle(fmt)}`,
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
    </BottomSheet>
  );
}
