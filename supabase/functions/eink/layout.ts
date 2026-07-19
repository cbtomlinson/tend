import { Bitmap } from './raster.ts';
import type { SnapBucket, SnapTask, Snapshot } from '../_shared/boardStore.ts';

/*
 * Draws the two e-ink views (mirrors pwa/src/domain/eink.ts + EinkDisplay).
 * 800×480, 1-bit. Priority is filled / half / empty squares — never color.
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
    .replace(/[\s  ]*AM/i, 'a')
    .replace(/[\s  ]*PM/i, 'p');
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

/** High = filled, Med = left-half filled, Low = outline. */
function prioSquare(bm: Bitmap, x: number, y: number, size: number, prio?: string): void {
  if (prio === 'High') {
    bm.fillRect(x, y, size, size);
  } else if (prio === 'Med') {
    bm.rect(x, y, size, size, 2);
    bm.fillRect(x, y, Math.floor(size / 2), size);
  } else {
    bm.rect(x, y, size, size, 2);
  }
}

function header(bm: Bitmap, sub: string): void {
  const { date, time } = nyParts();
  bm.drawText(MARGIN, 14, 'TEND', 3);
  bm.drawSmall(MARGIN + Bitmap.textW('TEND', 3) + 12, 24, sub);
  const right = `${date} · upd ${time}`;
  bm.drawText(W - MARGIN - Bitmap.textW(right, 2), 20, right, 2);
  bm.hline(MARGIN, HEADER_RULE_Y, W - 2 * MARGIN, 2);
}

function footer(bm: Bitmap): void {
  bm.hline(MARGIN, FOOTER_RULE_Y, W - 2 * MARGIN, 1);
  const labels = ['A · CYCLE VIEW', 'B · REFRESH', 'C · DONE #1 TODAY'];
  const third = (W - 2 * MARGIN) / 3;
  labels.forEach((label, i) => {
    const cx = MARGIN + third * i + third / 2;
    bm.drawSmall(cx - Bitmap.smallTextW(label) / 2, 458, label);
    if (i > 0) bm.vline(MARGIN + third * i, 454, 22, 1);
  });
}

export function drawViewA(snapshot: Snapshot): Bitmap {
  const bm = new Bitmap(W, H);
  const { iso } = nyParts();
  const act = active(snapshot);
  const working = byBucket(act, 'today');

  header(bm, "today's priorities");

  // Full-width task list: longer titles, up to 5 rows (Chelsea, 2026-07-18 —
  // Top 3 box tabled in favor of room).
  const mainX = MARGIN;
  const mainW = W - 2 * MARGIN;
  bm.drawText(mainX, 60, `TODAY'S PRIORITIES - ${working.length}`, 2);
  const ROWS = 5;
  let y = 88;
  const shown = working.slice(0, ROWS);
  for (const t of shown) {
    prioSquare(bm, mainX, y + 2, 18, t.prio);
    bm.drawText(mainX + 30, y, Bitmap.fit(t.title, 2, mainW - 30), 2);
    bm.drawSmall(mainX + 30, y + 32, Bitmap.fitSmall(meta(t), mainW - 30));
    y += 58;
    if (t !== shown[shown.length - 1]) bm.hline(mainX, y - 8, mainW, 1);
  }
  if (working.length > ROWS) {
    bm.drawSmall(mainX + 30, y - 2, `+${working.length - ROWS} more in Tend`);
  }
  if (working.length === 0) {
    bm.drawText(mainX, 100, "Nothing in Today's Priorities.", 2);
  }

  // Bottom stat band: Active · Waiting On · Later · Done today
  const bandTop = 384;
  bm.hline(MARGIN, bandTop, W - 2 * MARGIN, 1);
  const stats: [string, number][] = [
    ['Active', byBucket(act, 'active').length],
    ['Waiting On', byBucket(act, 'waiting').length],
    ['Later', byBucket(act, 'later').length],
    ['Done today', doneToday(snapshot, iso)],
  ];
  const cell = (W - 2 * MARGIN) / stats.length;
  stats.forEach(([label, n], i) => {
    const cx = MARGIN + cell * i + cell / 2;
    const num = String(n);
    bm.drawText(cx - Bitmap.textW(num, 3) / 2, 396, num, 3);
    bm.drawSmall(cx - Bitmap.smallTextW(label) / 2, 422, label);
    if (i > 0) bm.vline(MARGIN + cell * i, bandTop + 8, 48, 1);
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
    bm.drawText(x, 62, Bitmap.fit(b.name.toUpperCase(), 2, colW - 40), 2);
    bm.drawText(x + colW - 16 - Bitmap.textW(count, 2), 62, count, 2);
    bm.hline(x, 84, colW - 16, 2);

    let y = 96;
    for (const t of items.slice(0, 4)) {
      prioSquare(bm, x, y + 2, 14, t.prio);
      bm.drawText(x + 22, y, Bitmap.fit(t.title, 2, colW - 40), 2);
      bm.drawSmall(x + 22, y + 30, Bitmap.fitSmall(meta(t), colW - 40));
      y += 82;
    }
    const more = items.length - 4;
    if (more > 0) bm.drawSmall(x, 424, `+${more} more`);
    if (items.length === 0) bm.drawSmall(x, 100, 'Empty');
  });

  footer(bm);
  return bm;
}

/** Friendly placeholder until the phone pushes its first snapshot. */
export function drawEmpty(): Bitmap {
  const bm = new Bitmap(W, H);
  header(bm, 'waiting for board');
  const msg = 'No board yet - open Tend on your phone';
  bm.drawText((W - Bitmap.textW(msg, 2)) / 2, 220, msg, 2);
  footer(bm);
  return bm;
}
