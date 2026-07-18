import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Plus, RotateCw, ShieldCheck, X } from 'lucide-react';
import {
  commitCapture,
  definePerson,
  useActiveTasks,
  useBuckets,
  useLastCaptures,
  usePeople,
} from '@/data/store';
import { buildReconcile } from '@/domain/reconcile';
import { extractTasks } from '@/services/vision';
import { areaBgVar, areaTextVar, nextArea, useAreas } from '@/domain/areas';
import { agoLabel, fmtShort } from '@/domain/dates';
import { ALL_SOURCES, shortSource } from '@/domain/sources';
import { SourceTag } from '@/components/tags';
import { useUI } from '@/app/uiState';
import s from './CaptureOverlay.module.css';

export function CaptureOverlay() {
  const board = useActiveTasks();
  const areas = useAreas();
  const buckets = useBuckets();
  const people = usePeople();
  const lastCaptures = useLastCaptures();
  const areaNames = useMemo(() => areas.map((a) => a.name), [areas]);
  // Manual entry (typed, not photographed) — treated as a tiny Hand capture so
  // it flows through the same dedupe/review as everything else.
  const [manualTitle, setManualTitle] = useState('');
  const {
    captureStep,
    setCaptureStep,
    closeOverlay,
    captures,
    addCapture,
    removeCapture,
    reconcile,
    setReconcile,
    setView,
    flash,
  } = useUI();

  // Captured image lives ONLY here, in memory, until extraction completes.
  const blobRef = useRef<Blob | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  // Scanning -> extract the in-memory image -> reconcile -> review.
  // A ~900ms floor lets the scan animation show even if extraction is instant.
  useEffect(() => {
    if (captureStep !== 'scanning') return;
    let cancelled = false;
    void (async () => {
      const blob = blobRef.current;
      if (!blob) {
        setCaptureStep('shoot');
        return;
      }
      try {
        const [{ extraction, sampled }] = await Promise.all([
          extractTasks(blob),
          new Promise((r) => setTimeout(r, 900)),
        ]);
        blobRef.current = null; // drop the image — never stored
        if (cancelled) return;
        addCapture(extraction); // pool it; reconcile happens once, at the end
        setCaptureStep('captured');
        if (sampled) flash('Sample data — vision API not configured');
      } catch {
        blobRef.current = null;
        if (cancelled) return;
        flash('Could not read that photo — try again');
        setCaptureStep('shoot');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureStep]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    blobRef.current = file;
    setCaptureStep('scanning');
  };

  // If the user removes the last captured list, drop back to shooting.
  useEffect(() => {
    if (captureStep === 'captured' && captures.length === 0) setCaptureStep('shoot');
  }, [captureStep, captures.length, setCaptureStep]);

  const totalItems = captures.reduce((sum, c) => sum + c.items.length, 0);
  const reviewAll = () => {
    setReconcile(buildReconcile(captures, board));
    setCaptureStep('review');
  };

  const patchReconcile = (fn: (r: NonNullable<typeof reconcile>) => typeof reconcile) => {
    if (reconcile) setReconcile(fn(reconcile));
  };

  const toggleInclude = (tid: string) =>
    patchReconcile((r) => ({
      ...r,
      newItems: r.newItems.map((n) =>
        n.tid === tid ? { ...n, include: !n.include } : n,
      ),
    }));

  const cycleArea = (tid: string) =>
    patchReconcile((r) => ({
      ...r,
      newItems: r.newItems.map((n) =>
        n.tid === tid ? { ...n, area: nextArea(n.area, areaNames) } : n,
      ),
    }));

  const editTitle = (tid: string, title: string) =>
    patchReconcile((r) => ({
      ...r,
      newItems: r.newItems.map((n) => (n.tid === tid ? { ...n, title } : n)),
    }));

  const cycleBucket = (tid: string) =>
    patchReconcile((r) => ({
      ...r,
      newItems: r.newItems.map((n) => {
        if (n.tid !== tid) return n;
        const i = buckets.findIndex((b) => b.id === n.bucket);
        const next = buckets[(i + 1) % buckets.length];
        return { ...n, bucket: next?.id ?? n.bucket };
      }),
    }));

  const bucketName = (id: string) =>
    buckets.find((b) => b.id === id)?.name ?? 'Later';

  const addManualTask = () => {
    const title = manualTitle.trim();
    if (!title) return;
    addCapture({
      source: 'Hand',
      items: [{ title, area: areaNames[0] ?? 'ClinDoc' }],
      phiSuspected: false,
      unknownPeople: [],
    });
    setManualTitle('');
    setCaptureStep('captured');
  };

  // PHI advisory + names the scan saw that we don't know yet (live: answering
  // a card removes it because the people table updates underneath).
  // "No thanks" only skips a name for THIS capture session — it can ask again.
  const [skippedNames, setSkippedNames] = useState<string[]>([]);
  const phiCaptures = captures.filter((c) => c.phiSuspected);
  const knownNames = useMemo(
    () => new Set(people.map((p) => p.name.toLowerCase())),
    [people],
  );
  const newNames = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of captures) {
      for (const n of c.unknownPeople ?? []) {
        const key = n.trim().toLowerCase();
        if (
          key &&
          !knownNames.has(key) &&
          !skippedNames.includes(key) &&
          !seen.has(key)
        )
          seen.set(key, n.trim());
      }
    }
    return [...seen.values()];
  }, [captures, knownNames, skippedNames]);

  const setDup = (tid: string, choice: 'keep' | 'merge') =>
    patchReconcile((r) => ({
      ...r,
      dups: r.dups.map((d) => (d.tid === tid ? { ...d, choice } : d)),
    }));

  const setGone = (id: string | number, choice: 'keep' | 'done') =>
    patchReconcile((r) => ({
      ...r,
      gone: r.gone.map((g) => (String(g.id) === String(id) ? { ...g, choice } : g)),
    }));

  const commit = async () => {
    if (!reconcile) return;
    const sum = await commitCapture(reconcile);
    setReconcile(null);
    closeOverlay();
    setView('board');
    flash(
      `Added ${sum.added}` +
        (sum.merged ? ` · ${sum.merged} merged` : '') +
        (sum.archived ? ` · ${sum.archived} archived` : ''),
    );
  };

  const incCount = reconcile
    ? reconcile.newItems.filter((n) => n.include).length +
      reconcile.dups.filter((d) => d.choice === 'keep').length
    : 0;

  const accentChoice = { background: 'var(--accent)', color: '#fff', borderColor: 'transparent' };
  const warnChoice = { background: 'var(--warning)', color: '#fff', borderColor: 'transparent' };
  const successChoice = { background: 'var(--success)', color: '#fff', borderColor: 'transparent' };

  return (
    <div className={s.overlay}>
      <div className={s.head}>
        <div className={s.headTitle}>Capture a list</div>
        <button type="button" className={s.cancel} onClick={closeOverlay}>
          Cancel
        </button>
      </div>

      <div className={s.body}>
        {captureStep === 'shoot' && (
          <div className={s.shoot}>
            <div className={s.phi}>
              <span className={s.phiIcon}>
                <ShieldCheck size={14} />
              </span>
              <div className={s.phiText}>
                Scanned in memory — the photo is never saved.
              </div>
            </div>
            <div className={s.lastCapture}>
              {lastCaptures.at == null ? (
                <span className={s.lastCaptureMain}>
                  No captures yet — this will be your first.
                </span>
              ) : (
                <>
                  <span className={s.lastCaptureMain}>
                    Last capture: <b>{agoLabel(lastCaptures.at)}</b> ·{' '}
                    {fmtShort(new Date(lastCaptures.at))}
                  </span>
                  <span className={s.lastCaptureBySrc}>
                    {ALL_SOURCES.map((src) => {
                      const t = lastCaptures.bySource[src];
                      return (
                        <span key={src} className={s.lastCaptureSrc}>
                          {shortSource(src)}{' '}
                          <b>{t ? agoLabel(t).replace(' days ago', 'd') : '—'}</b>
                        </span>
                      );
                    })}
                  </span>
                </>
              )}
            </div>
            <div className={s.viewport}>
              <div className={s.guides} />
              <div className={s.viewportHint}>Point at a task list</div>
            </div>
            <button
              type="button"
              className={s.takePhoto}
              onClick={() => cameraInput.current?.click()}
            >
              Take photo
            </button>
            <button
              type="button"
              className={s.choose}
              onClick={() => libraryInput.current?.click()}
            >
              Choose from library
            </button>
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={onPick}
            />
            <input
              ref={libraryInput}
              type="file"
              accept="image/*"
              hidden
              onChange={onPick}
            />

            <div className={s.manualDivider}>or type one in</div>
            <div className={s.manualRow}>
              <input
                className={s.manualInput}
                value={manualTitle}
                placeholder="Add a task by hand…"
                onChange={(e) => setManualTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addManualTask()}
              />
              <button
                type="button"
                className={s.manualAdd}
                disabled={!manualTitle.trim()}
                onClick={addManualTask}
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {captureStep === 'scanning' && (
          <div className={s.scan}>
            <div className={s.scanCard}>
              <div className={s.scanLines}>
                {[70, 90, 60, 82, 74].map((w, i) => (
                  <div key={i} className={s.scanLine} style={{ width: `${w}%` }} />
                ))}
              </div>
              <div className={s.scanBeam} />
            </div>
            <div className={s.spinner} />
            <div className={s.scanMain}>Reading list…</div>
            <div className={s.scanSub}>Discarding photo</div>
          </div>
        )}

        {captureStep === 'captured' && (
          <div className={s.review}>
            <div className={s.reviewTitle}>Lists captured</div>
            <div className={s.reviewSub}>
              Snap as many lists as you like, then review them together — duplicates
              across lists are caught in one pass.
            </div>
            {captures.map((c, i) => (
              <div key={i} className={s.capturedRow}>
                <SourceTag source={c.source} />
                <span className={s.capturedCount}>
                  {c.items.length} item{c.items.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className={s.capturedRemove}
                  aria-label="Remove this list"
                  onClick={() => removeCapture(i)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={s.choose}
              style={{ marginTop: 16 }}
              onClick={() => setCaptureStep('shoot')}
            >
              <Plus size={16} style={{ marginRight: 6 }} /> Capture another list
            </button>
          </div>
        )}

        {captureStep === 'review' && reconcile && (
          <div className={s.review}>
            <div className={s.reviewTitle}>Review &amp; reconcile</div>
            <div className={s.reviewSub}>
              Read from your{' '}
              <b>{reconcile.sources.map(shortSource).join(' + ')}</b>{' '}
              {reconcile.sources.length === 1 ? 'list' : 'lists'} · checked against
              your board.
            </div>

            {phiCaptures.length > 0 && (
              <div className={s.phiWarn}>
                <AlertTriangle size={15} className={s.phiWarnIcon} />
                <div className={s.phiWarnText}>
                  <b>Possible PHI spotted</b>
                  {phiCaptures[0].phiReason ? ` — ${phiCaptures[0].phiReason}` : ''}.
                  The photo was never stored. Consider rewording the task titles
                  below before adding them.
                </div>
              </div>
            )}

            {newNames.length > 0 && (
              <>
                <div className={`${s.sectionLabel} ${s.labelPeople}`}>
                  NEW NAMES · teach the scanner
                </div>
                {newNames.map((name) => (
                  <div key={name} className={s.personCard}>
                    <div className={s.personAsk}>
                      Who is <b>{name}</b>? Pick their area and future scans will
                      tag their tasks automatically.
                    </div>
                    <div className={s.personChips}>
                      {areaNames.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={s.personChip}
                          style={{ background: areaBgVar(a), color: areaTextVar(a) }}
                          onClick={() => {
                            void definePerson(name, a);
                            flash(`${name} → ${a} — the scanner will remember`);
                          }}
                        >
                          {a}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={s.personOneOff}
                        onClick={() =>
                          setSkippedNames((prev) => [...prev, name.toLowerCase()])
                        }
                      >
                        No thanks
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className={`${s.sectionLabel} ${s.labelNew}`}>NEW · will be added</div>
            {reconcile.newItems.map((n) => (
              <div key={n.tid} className={s.newRow}>
                <span
                  className={s.checkbox}
                  style={{
                    background: n.include ? 'var(--success)' : '#fff',
                    border: `1.5px solid ${n.include ? 'var(--success)' : '#cdd4db'}`,
                  }}
                  onClick={() => toggleInclude(n.tid)}
                >
                  {n.include && <Check size={13} strokeWidth={3} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    className={s.itemTitleInput}
                    value={n.title}
                    aria-label="Edit task title"
                    onChange={(e) => editTitle(n.tid, e.target.value)}
                  />
                  <div className={s.newMeta}>
                    <span
                      className={s.areaCycle}
                      style={{
                        background: areaBgVar(n.area),
                        color: areaTextVar(n.area),
                      }}
                      onClick={() => cycleArea(n.tid)}
                    >
                      {n.area} <RotateCw size={10} />
                    </span>
                    <span
                      className={s.bucketCycle}
                      onClick={() => cycleBucket(n.tid)}
                    >
                      {bucketName(n.bucket)} <RotateCw size={10} />
                    </span>
                    {n.sources.map((src) => (
                      <SourceTag key={src} source={src} />
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {reconcile.dups.map((d) => (
              <div key={d.tid} className={s.dup}>
                <div className={s.dupHead}>
                  <span className={s.dupTag}>POSSIBLE DUPLICATE</span>
                  <span className={s.dupPct}>{d.overlap} match</span>
                </div>
                <div className={s.dupBody}>
                  <div className={s.dupAsk}>
                    {d.area === d.matchArea ? (
                      <>
                        Same area (<b>{d.area}</b>). Is this the same task?
                      </>
                    ) : (
                      <>
                        Areas differ — scan guessed <b>{d.area}</b>, board says{' '}
                        <b>{d.matchArea}</b>. Same task?
                      </>
                    )}
                  </div>
                  <div className={s.dupTitles}>
                    <div className={s.dupLine}>• New: “{d.newTitle}”</div>
                    <div className={s.dupLine}>• On board: “{d.matchTitle}”</div>
                  </div>
                  <div className={s.choiceRow}>
                    <button
                      type="button"
                      className={s.choice}
                      style={d.choice === 'keep' ? accentChoice : undefined}
                      onClick={() => setDup(d.tid, 'keep')}
                    >
                      Keep both
                    </button>
                    <button
                      type="button"
                      className={s.choice}
                      style={d.choice === 'merge' ? warnChoice : undefined}
                      onClick={() => setDup(d.tid, 'merge')}
                    >
                      Merge
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {reconcile.already.length > 0 && (
              <>
                <div className={`${s.sectionLabel} ${s.labelAlready}`}>
                  ALREADY ON YOUR BOARD
                </div>
                {reconcile.already.map((a) => (
                  <div key={a.id} className={s.alreadyRow}>
                    <span className={s.alreadyCheck}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={s.alreadyTitle}>{a.title}</div>
                      <div className={s.alreadyNote}>matched — left untouched</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {reconcile.gone.map((g) => (
              <div key={g.id} className={s.gone}>
                <div className={s.goneHead}>
                  <span className={s.goneTag}>GONE FROM THIS LIST</span>
                </div>
                <div className={s.goneBody}>
                  <div className={s.goneTitle}>{g.title}</div>
                  <div className={s.goneAsk}>
                    On your board but not in this photo. Finished?
                  </div>
                  <div className={s.choiceRow}>
                    <button
                      type="button"
                      className={s.choice}
                      style={g.choice === 'keep' ? accentChoice : undefined}
                      onClick={() => setGone(g.id, 'keep')}
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      className={s.choice}
                      style={g.choice === 'done' ? successChoice : undefined}
                      onClick={() => setGone(g.id, 'done')}
                    >
                      Mark done
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {captureStep === 'captured' && (
        <div className={s.footer}>
          <button
            type="button"
            className={s.commit}
            onClick={reviewAll}
            disabled={totalItems === 0}
          >
            Review {totalItems} item{totalItems === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {captureStep === 'review' && reconcile && (
        <div className={s.footer}>
          <button type="button" className={s.commit} onClick={commit}>
            Add to board{incCount ? ` · ${incCount}` : ''}
          </button>
        </div>
      )}
    </div>
  );
}
