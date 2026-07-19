import { Bitmap } from './raster.ts';
import { F_BIG, F_MED, F_SMALL } from './fonts.ts';
import type { SnapBucket, SnapTask, Snapshot } from '../_shared/boardStore.ts';

/*
 * Draws the e-ink views (mirrors pwa/src/domain/eink.ts + EinkDisplay).
 * 800×480, 1-bit. Text is native-resolution Spleen (no scaling, no staircase).
 * Priority is filled / half / hollow CIRCLES (matches the phone) — never color.
 *   View A — Today's Priorities + stat band
 *   View B — three bucket columns
 *   View C — Quick Wins bucket
 */

export const W = 800;
export const H = 480;
const MARGIN = 16;
const HEADER_RULE_Y = 50;
const FOOTER_RULE_Y = 446;
const TZ = 'America/New_York';

function shortSource(s?: string): string {
  return s === 'Epic SLG' ? 'SLG' : (s ?? '');
}
function meta(t: SnapTask): string {
  return `${shortSource(t.source)} · ${t.area ?? ''} · ${(t.prio ?? 'M')[0]}`;
}
function active(snapshot: Snapshot): SnapTask[] {
  return (snapshot.tasks ?? []).filter((t) => t.status === 'active');
}
function byBucket(tasks: SnapTask[], id: string): SnapTask[] {
  // Same order the user arranged on the phone board.
  return tasks
    .filter((t) => t.bucket === id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function nyParts(): { date: string; time: string; iso: string } {
  const now = new Date();
  const d = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => d.find((p) => p.type === type)?.value ?? '';
  const t = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(now)
    // Intl inserts a narrow no-break space before AM/PM.
    .replace(/[\s  ]*AM/i, 'a')
    .replace(/[\s  ]*PM/i, 'p');
  const isoParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    date: `${get('weekday')} ${get('month')} ${get('day')}`.toUpperCase(),
    time: t,
    iso: isoParts,
  };
}

function doneToday(snapshot: Snapshot, isoToday: string): number {
  return (snapshot.tasks ?? []).filter(
    (t) => t.status === 'archived' && t.archivedIso === isoToday,
  ).length;
}

/**
 * Priority mark, matching the phone app's dots: High = filled circle,
 * Med = left-half filled, Low = hollow ring (circles per Chelsea, 2026-07-18).
 */
function prioMark(bm: Bitmap, x: number, y: number, size: number, prio?: string): void {
  const r = Math.floor(size / 2);
  const cx = x + r;
  const cy = y + r;
  if (prio === 'High') {
    bm.fillCircle(cx, cy, r);
  } else if (prio === 'Med') {
    bm.ring(cx, cy, r, 2);
    bm.fillCircle(cx, cy, r, 'left');
  } else {
    bm.ring(cx, cy, r, 2);
  }
}

function header(bm: Bitmap, sub: string): void {
  const { date, time } = nyParts();
  bm.drawText(F_BIG, MARGIN, 10, 'TEND');
  bm.drawText(F_SMALL, MARGIN + Bitmap.textW(F_BIG, 'TEND') + 12, 22, sub);
  const right = `${date} · upd ${time}`;
  bm.drawText(F_MED, W - MARGIN - Bitmap.textW(F_MED, right), 14, right);
  bm.hline(MARGIN, HEADER_RULE_Y, W - 2 * MARGIN, 2);
}

function footer(bm: Bitmap): void {
  bm.hline(MARGIN, FOOTER_RULE_Y, W - 2 * MARGIN, 1);
  const labels = ['A · CYCLE VIEW', 'B · REFRESH', 'C · DONE #1 TODAY'];
  const third = (W - 2 * MARGIN) / 3;
  labels.forEach((label, i) => {
    const cx = MARGIN + third * i + third / 2;
    bm.drawText(F_SMALL, cx - Bitmap.textW(F_SMALL, label) / 2, 456, label);
    if (i > 0) bm.vline(MARGIN + third * i, 452, 22, 1);
  });
}

/** Full-width task list used by views A and C. Returns nothing drawn below yMax. */
function taskList(
  bm: Bitmap,
  tasks: SnapTask[],
  headLabel: string,
  rowsMax: number,
): void {
  const mainX = MARGIN;
  const mainW = W - 2 * MARGIN;
  bm.drawText(F_MED, mainX, 58, `${headLabel} - ${tasks.length}`);
  if (tasks.length > rowsMax) {
    const more = `+${tasks.length - rowsMax} more in Tend`;
    bm.drawText(F_SMALL, W - MARGIN - Bitmap.textW(F_SMALL, more), 64, more);
  }
  let y = 90;
  const shown = tasks.slice(0, rowsMax);
  for (const t of shown) {
    prioMark(bm, mainX, y + 3, 18, t.prio);
    bm.drawText(F_MED, mainX + 30, y, Bitmap.fit(F_MED, t.title, mainW - 30));
    bm.drawText(F_SMALL, mainX + 30, y + 26, Bitmap.fit(F_SMALL, meta(t), mainW - 30));
    y += 56;
    if (t !== shown[shown.length - 1]) bm.hline(mainX, y - 8, mainW, 1);
  }
  if (tasks.length === 0) {
    bm.drawText(F_MED, mainX, 100, 'Nothing here right now.');
  }
}

export function drawViewA(snapshot: Snapshot): Bitmap {
  const bm = new Bitmap(W, H);
  const { iso } = nyParts();
  const act = active(snapshot);

  header(bm, "today's priorities");
  taskList(bm, byBucket(act, 'today'), "TODAY'S PRIORITIES", 5);

  // Bottom stat band: Active · Waiting On · Later · Total Tasks · Done today
  const bandTop = 384;
  bm.hline(MARGIN, bandTop, W - 2 * MARGIN, 1);
  const stats: [string, number][] = [
    ['Active', byBucket(act, 'active').length],
    ['Waiting On', byBucket(act, 'waiting').length],
    ['Later', byBucket(act, 'later').length],
    ['Total Tasks', act.length],
    ['Done today', doneToday(snapshot, iso)],
  ];
  const cell = (W - 2 * MARGIN) / stats.length;
  stats.forEach(([label, n], i) => {
    const cx = MARGIN + cell * i + cell / 2;
    const num = String(n);
    bm.drawText(F_MED, cx - Bitmap.textW(F_MED, num) / 2, 392, num);
    bm.drawText(F_SMALL, cx - Bitmap.textW(F_SMALL, label) / 2, 420, label);
    if (i > 0) bm.vline(MARGIN + cell * i, bandTop + 8, 46, 1);
  });

  footer(bm);
  return bm;
}

export function drawViewB(snapshot: Snapshot): Bitmap {
  const bm = new Bitmap(W, H);
  const act = active(snapshot);
  const buckets = (snapshot.buckets ?? [])
    .slice()
    .sort((a: SnapBucket, b: SnapBucket) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, 3);

  header(bm, 'buckets');

  const colW = Math.floor((W - 2 * MARGIN) / 3);
  buckets.forEach((b, i) => {
    const x = MARGIN + i * colW;
    if (i > 0) bm.vline(x - 6, HEADER_RULE_Y + 8, FOOTER_RULE_Y - HEADER_RULE_Y - 16, 1);
    const items = byBucket(act, b.id);

    const count = String(items.length);
    bm.drawText(F_MED, x, 58, Bitmap.fit(F_MED, b.name.toUpperCase(), colW - 60));
    bm.drawText(F_MED, x + colW - 16 - Bitmap.textW(F_MED, count), 58, count);
    bm.hline(x, 86, colW - 16, 2);

    let y = 96;
    for (const t of items.slice(0, 4)) {
      prioMark(bm, x, y + 3, 14, t.prio);
      bm.drawText(F_MED, x + 22, y, Bitmap.fit(F_MED, t.title, colW - 40));
      bm.drawText(F_SMALL, x + 22, y + 28, Bitmap.fit(F_SMALL, meta(t), colW - 40));
      y += 84;
    }
    const more = items.length - 4;
    if (more > 0) bm.drawText(F_SMALL, x, 428, `+${more} more`);
    if (items.length === 0) bm.drawText(F_SMALL, x, 100, 'Empty');
  });

  footer(bm);
  return bm;
}

/** View C: the Quick Wins bucket (matched by name), full-width list. */
export function drawViewC(snapshot: Snapshot): Bitmap {
  const bm = new Bitmap(W, H);
  const act = active(snapshot);
  const quick = (snapshot.buckets ?? []).find((b) =>
    b.name.toLowerCase().includes('quick'),
  );

  header(bm, 'quick wins');
  if (!quick) {
    bm.drawText(F_MED, MARGIN, 100, "No 'Quick Wins' bucket on the board yet.");
    bm.drawText(F_SMALL, MARGIN, 132, 'Add a bucket named Quick Wins in Tend and it appears here.');
  } else {
    taskList(bm, byBucket(act, quick.id), quick.name.toUpperCase(), 6);
  }

  footer(bm);
  return bm;
}

/** Friendly placeholder until the phone pushes its first snapshot. */
export function drawEmpty(): Bitmap {
  const bm = new Bitmap(W, H);
  header(bm, 'waiting for board');
  const msg = 'No board yet - open Tend on your phone';
  bm.drawText(F_MED, (W - Bitmap.textW(F_MED, msg)) / 2, 220, msg);
  footer(bm);
  return bm;
}
