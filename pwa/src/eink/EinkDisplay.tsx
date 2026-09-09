import { Check, Plus, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import type { Bucket, Prio, Task } from '@/data/types';
import { buildEinkA, buildEinkC, buildEinkWaiting } from '@/domain/eink';
import { today, weekday } from '@/domain/dates';
import {
  addTimeline,
  deleteTimeline,
  updateTimeline,
  useArchivedTasks,
  useTimelines,
} from '@/data/store';
import { useUI } from '@/app/uiState';
import s from './EinkDisplay.module.css';

function PrioSquare({ prio, size }: { prio: Prio; size: number }) {
  const cls = prio === 'High' ? s.sqHigh : prio === 'Med' ? s.sqMed : s.sqLow;
  return (
    <div
      className={`${s.sq} ${cls}`}
      style={{ width: size, height: size, marginTop: 2 }}
    />
  );
}

export function EinkDisplay({ tasks, buckets }: { tasks: Task[]; buckets: Bucket[] }) {
  const { einkView, setEinkView } = useUI();
  const archived = useArchivedTasks();
  const timelines = useTimelines();
  const doneToday = archived.filter((t) => t.archivedAt === today()).length;

  const a = buildEinkA(tasks, doneToday);
  const waiting = buildEinkWaiting(tasks);
  const quick = buildEinkC(tasks, buckets);
  const isA = einkView === 'A';
  const isC = einkView === 'C';

  const headDate = `${weekday().toUpperCase()} ${today().toUpperCase()}`;

  return (
    <div className={s.wrap}>
      <div className={s.title}>On your e-ink display</div>
      <div className={s.sub}>
        Read-only mirror on the reTerminal (800×480, B/W). BTN&nbsp;A rotates the two
        views.
      </div>

      <div className={s.tabs}>
        <button
          type="button"
          className={`${s.tab} ${isA ? s.tabOn : ''}`}
          onClick={() => setEinkView('A')}
        >
          View 1 · priority
        </button>
        <button
          type="button"
          className={`${s.tab} ${einkView === 'B' ? s.tabOn : ''}`}
          onClick={() => setEinkView('B')}
        >
          View 2 · waiting on
        </button>
        <button
          type="button"
          className={`${s.tab} ${isC ? s.tabOn : ''}`}
          onClick={() => setEinkView('C')}
        >
          View 3 · quick wins
        </button>
      </div>

      <div className={s.scaler}>
        <div className={s.scale}>
          <div className={s.panel}>
            <div className={s.panelHead}>
              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                <span className={s.brand}>TEND</span>
                <span className={s.brandSub}>
                  {isA ? "today's priorities" : isC ? 'quick wins' : 'waiting on'}
                </span>
              </div>
              <div className={s.clock}>{headDate} · ↻ 7:02a</div>
            </div>

            {isC ? (
              <div className={s.viewA}>
                <div className={s.aMain} style={{ width: '100%' }}>
                  {quick ? (
                    <>
                      <div className={s.aHead}>
                        {quick.name} — {quick.count}
                      </div>
                      {quick.rows.map((r) => (
                        <div key={r.id} className={s.aRow}>
                          <PrioSquare prio={r.prio} size={15} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={s.aRowTitle}>{r.title}</div>
                            <div className={s.aRowMeta}>{r.meta}</div>
                          </div>
                        </div>
                      ))}
                      {quick.more > 0 && (
                        <div className={s.aRowMeta}>+{quick.more} more in Tend</div>
                      )}
                    </>
                  ) : (
                    <div className={s.aHead}>
                      No &lsquo;Quick Wins&rsquo; bucket on the board yet.
                    </div>
                  )}
                </div>
              </div>
            ) : isA ? (
              <div className={s.viewA}>
                <div className={s.aMain}>
                  <div className={s.aHead}>TODAY&rsquo;S PRIORITIES — {a.count}</div>
                  {a.rows.map((r) => (
                    <div key={r.id} className={s.aRow}>
                      <PrioSquare prio={r.prio} size={15} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={s.aRowTitle}>{r.title}</div>
                        <div className={s.aRowMeta}>{r.meta}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={s.aSide}>
                  {timelines.length > 0 && (
                    <div className={s.topBox}>
                      {timelines.map((tl) => (
                        <div key={tl.id} style={{ marginBottom: 8 }}>
                          <div className={s.topHead}>{tl.title || 'Untitled'}</div>
                          {tl.body
                            .split('\n')
                            .filter((l) => l.trim())
                            .map((line, i) => (
                              <div key={i} className={s.tlLine}>
                                {line}
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <div className={s.summaryRow}>
                      <span>Active</span>
                      <span className={s.summaryNum}>{a.active}</span>
                    </div>
                    <div className={s.summaryRow}>
                      <span>Waiting On</span>
                      <span className={s.summaryNum}>{a.waiting}</span>
                    </div>
                    <div className={s.summaryRow}>
                      <span>Later</span>
                      <span className={s.summaryNum}>{a.later}</span>
                    </div>
                    <div className={`${s.summaryRow} ${s.summaryRowLast}`}>
                      <span>Done today</span>
                      <span className={s.summaryNum}>{a.done}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={s.viewA}>
                <div className={s.aMain} style={{ width: '100%' }}>
                  <div className={s.aHead}>WAITING ON — {waiting.length}</div>
                  {waiting.slice(0, 7).map((r) => (
                    <div key={r.id} className={s.aRow}>
                      <div className={s.waitGutter}>
                        <PrioSquare prio={r.prio} size={15} />
                        <span
                          className={`${s.waitDays} ${r.stale ? s.waitChipStale : ''}`}
                        >
                          {r.chip.replace('waiting ', '')}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={s.aRowTitle}>{r.title}</div>
                        {r.note && <div className={s.aRowMeta}>Note: {r.note}</div>}
                      </div>
                    </div>
                  ))}
                  {waiting.length > 7 && (
                    <div className={s.aRowMeta}>+{waiting.length - 7} more in Tend</div>
                  )}
                </div>
              </div>
            )}

            <div className={s.footer}>
              <div className={s.btn}>
                <RotateCw size={14} /> Cycle view
              </div>
              <div className={s.btn}>
                <RotateCcw size={14} /> Refresh
              </div>
              <div className={`${s.btn} ${s.btnLast}`}>
                <Check size={14} /> Done #1
              </div>
            </div>
          </div>
        </div>
      </div>

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
