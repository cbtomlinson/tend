import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  addTimeline,
  deleteTimeline,
  updateTimeline,
  useTimelines,
} from '@/data/store';
import { REMOTE, apiGet } from '@/services/api';
import { useUI } from '@/app/uiState';
import s from './EinkDisplay.module.css';

/*
 * Display tab: shows the REAL panel render — the same BMP the reTerminal
 * fetches — not a hand-built imitation. (The old React mock drifted from the
 * server renderer every time the design iterated; Chelsea caught it
 * 2026-09-09. Now the server's pixels are the single source of truth.)
 */

const TABS: ['A' | 'B' | 'C', string][] = [
  ['A', "View 1 · today's priorities"],
  ['B', 'View 2 · waiting on'],
  ['C', 'View 3 · quick wins'],
];

export function EinkDisplay() {
  const { einkView, setEinkView } = useUI();
  const timelines = useTimelines();
  const [img, setImg] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  const load = useCallback(async () => {
    if (!REMOTE) return;
    setState('loading');
    try {
      const res = await apiGet('eink', `?view=${einkView}&format=bmp&cb=${Date.now()}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      setImg((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      setState('ok');
    } catch {
      setState('error');
    }
  }, [einkView]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={s.wrap}>
      <div className={s.title}>On your e-ink display</div>
      <div className={s.sub}>
        The actual render the reTerminal shows (the left button rotates views).
        · app built {__TEND_BUILT__}
      </div>

      <div className={s.tabs}>
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`${s.tab} ${einkView === key ? s.tabOn : ''}`}
            onClick={() => setEinkView(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className={s.tab}
          aria-label="Refresh preview"
          onClick={() => void load()}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {REMOTE ? (
        <div className={s.liveFrame}>
          {state === 'error' ? (
            <div className={s.liveNote}>
              Couldn&rsquo;t reach the display server — check your connection
              and tap refresh.
            </div>
          ) : (
            <>
              {img && (
                <img
                  className={s.liveImg}
                  src={img}
                  alt={`E-ink view ${einkView}`}
                />
              )}
              {state === 'loading' && (
                <div className={s.liveNote}>Rendering…</div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className={s.liveFrame}>
          <div className={s.liveNote}>
            Live preview appears in the deployed app (local dev has no display
            server).
          </div>
        </div>
      )}

      {/* ---- Project timelines editor (rendered on View 1) ---- */}
      <div className={s.tlSection}>
        <div className={s.tlSectionHead}>Project timelines</div>
        <div className={s.tlSectionSub}>
          Shown as a sticky-note box on View 1 of your display. One milestone
          per line — dates however you like (e.g. &ldquo;Reviews 9/16 50%, 9/30
          100%&rdquo;).
        </div>
        {timelines.map((tl) => (
          <div key={tl.id} className={s.tlCard}>
            <div className={s.tlCardHead}>
              <input
                className={s.tlTitle}
                value={tl.title}
                placeholder="Upgrade: Aug 2026"
                onChange={(e) => updateTimeline(tl.id, { title: e.target.value })}
              />
              <button
                type="button"
                className={s.tlDelete}
                aria-label="Delete timeline"
                onClick={() => deleteTimeline(tl.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <textarea
              className={s.tlBody}
              rows={4}
              value={tl.body}
              placeholder={'Reviews 9/16 50%, 9/30 100%\nBuild 10/9 50%, 10/14 100%\nTesting 10/30\nTraining 11/6'}
              onChange={(e) => updateTimeline(tl.id, { body: e.target.value })}
            />
          </div>
        ))}
        <button type="button" className={s.tlAdd} onClick={() => addTimeline()}>
          <Plus size={15} strokeWidth={2.5} /> Add a timeline
        </button>
      </div>
    </div>
  );
}
