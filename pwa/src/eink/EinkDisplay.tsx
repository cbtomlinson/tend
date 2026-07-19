import { Check, RotateCcw, RotateCw } from 'lucide-react';
import type { Bucket, Prio, Task } from '@/data/types';
import { buildEinkA, buildEinkC, buildEinkWaiting } from '@/domain/eink';
import { today, weekday } from '@/domain/dates';
import { useArchivedTasks } from '@/data/store';
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
                  <div className={s.topBox}>
                    <div className={s.topHead}>TOP 3 PRIORITIES</div>
                    {a.top3.map((p) => (
                      <div key={p.n} className={s.topRow}>
                        <span className={s.topNum}>{p.n}</span>
                        {p.t}
                      </div>
                    ))}
                  </div>
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
                  {waiting.slice(0, 5).map((r) => (
                    <div key={r.id} className={s.aRow}>
                      <PrioSquare prio={r.prio} size={15} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={s.aRowTitle}>{r.title}</div>
                        <div className={s.aRowMeta}>
                          <span className={r.stale ? s.waitChipStale : undefined}>
                            {r.chip}
                          </span>{' '}
                          {r.rest}
                        </div>
                        {r.note && <div className={s.aRowMeta}>{r.note}</div>}
                      </div>
                    </div>
                  ))}
                  {waiting.length > 5 && (
                    <div className={s.aRowMeta}>+{waiting.length - 5} more in Tend</div>
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
    </div>
  );
}
