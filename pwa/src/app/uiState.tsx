import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Area, Task } from '@/data/types';
import type { GroupBy, Reconcile } from '@/data/store';
import type { Extraction } from '@/services/vision';

/*
 * Ephemeral UI state — deliberately NOT persisted (README: overlays/filters
 * reset on reload; only tasks/buckets persist, in Dexie).
 */

export type View = 'board' | 'archive' | 'eink';
export type Overlay = null | 'capture' | 'detail' | 'email' | 'newbucket';
export type CaptureStep = 'shoot' | 'scanning' | 'captured' | 'review';
export type EinkView = 'A' | 'B';
export type EmailFormat = 'priority' | 'full' | 'active' | 'plain';
export type AreaFilter = 'All' | Area;

interface UIState {
  view: View;
  setView: (v: View) => void;
  overlay: Overlay;
  openOverlay: (o: Overlay) => void;
  closeOverlay: () => void;

  captureStep: CaptureStep;
  setCaptureStep: (s: CaptureStep) => void;
  /** Opens the capture overlay fresh: empties the pool, starts at "shoot". */
  startCapture: () => void;
  /** Lists captured so far this session, awaiting one combined reconcile. */
  captures: Extraction[];
  addCapture: (e: Extraction) => void;
  removeCapture: (index: number) => void;
  reconcile: Reconcile | null;
  setReconcile: (r: Reconcile | null) => void;

  filterArea: AreaFilter;
  setFilterArea: (a: AreaFilter) => void;
  groupBy: GroupBy;
  setGroupBy: (g: GroupBy) => void;

  detailId: Task['id'] | null;
  openDetail: (id: Task['id']) => void;

  einkView: EinkView;
  setEinkView: (v: EinkView) => void;
  emailFormat: EmailFormat;
  setEmailFormat: (f: EmailFormat) => void;

  toast: string;
  flash: (msg: string) => void;
}

const Ctx = createContext<UIState | null>(null);

export function UIStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('board');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [captureStep, setCaptureStep] = useState<CaptureStep>('shoot');
  const [captures, setCaptures] = useState<Extraction[]>([]);
  const [reconcile, setReconcile] = useState<Reconcile | null>(null);
  const [filterArea, setFilterArea] = useState<AreaFilter>('All');
  const [groupBy, setGroupBy] = useState<GroupBy>('Buckets');
  const [detailId, setDetailId] = useState<Task['id'] | null>(null);
  const [einkView, setEinkView] = useState<EinkView>('A');
  const [emailFormat, setEmailFormat] = useState<EmailFormat>('priority');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const flash = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  const openOverlay = useCallback((o: Overlay) => setOverlay(o), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const startCapture = useCallback(() => {
    setCaptures([]);
    setReconcile(null);
    setCaptureStep('shoot');
    setOverlay('capture');
  }, []);
  const addCapture = useCallback(
    (e: Extraction) => setCaptures((prev) => [...prev, e]),
    [],
  );
  const removeCapture = useCallback(
    (index: number) => setCaptures((prev) => prev.filter((_, i) => i !== index)),
    [],
  );
  const openDetail = useCallback((id: Task['id']) => {
    setDetailId(id);
    setOverlay('detail');
  }, []);

  const value = useMemo<UIState>(
    () => ({
      view,
      setView: (v) => {
        setView(v);
        setOverlay(null);
      },
      overlay,
      openOverlay,
      closeOverlay,
      captureStep,
      setCaptureStep,
      startCapture,
      captures,
      addCapture,
      removeCapture,
      reconcile,
      setReconcile,
      filterArea,
      setFilterArea,
      groupBy,
      setGroupBy,
      detailId,
      openDetail,
      einkView,
      setEinkView,
      emailFormat,
      setEmailFormat,
      toast,
      flash,
    }),
    [
      view,
      overlay,
      captureStep,
      captures,
      reconcile,
      filterArea,
      groupBy,
      detailId,
      einkView,
      emailFormat,
      toast,
      openOverlay,
      closeOverlay,
      startCapture,
      addCapture,
      removeCapture,
      openDetail,
      flash,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI(): UIState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUI must be used within UIStateProvider');
  return ctx;
}
