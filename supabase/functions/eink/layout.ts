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

const rank: Record<string, number> = { High: 3, Med: 2, Low: 1 };

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
function prioritySorted(tasks: SnapTask[]): SnapTask[] {
  return tasks
    .slice()
    .sort(
      (a, b) =>
        (rank[b.prio ?? ''] ?? 0) - (rank[a.prio ?? ''] ?? 0) ||
        (b.due ? 1 : 0) - (a.due ? 1 : 0) ||
        (a.order ?? 0) - (b.order ?? 0),
    );
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
  bm.drawText(MARGIN + Bitmap.textW('TEND', 3) + 12, 26, sub, 1);
  const right = `${date} · upd ${time}`;
  bm.drawText(W - MARGIN - Bitmap.textW(right, 2), 20, right, 2);
  bm.hline(MARGIN, HEADER_RULE_Y, W - 2 * MARGIN, 2);
}

function footer(bm: Bitmap): void {
  bm.hline(MARGIN, FOOTER_RULE_Y, W - 2 * MARGIN, 1);
  const labels = ['A · CYCLE VIEW', 'B · REFRESH', 'C · DONE #1'];
  const third = (W - 2 * MARGIN) / 3;
  labels.forEach((label, i) => {
    const cx = MARGIN + third * i + third / 2;
    bm.drawText(cx - Bitmap.textW(label, 1) / 2, 458, label, 1);
    if (i > 0) bm.vline(MARGIN + third * i, 452, 24, 1);
  });
}

export function drawViewA(snapshot: Snapshot): Bitmap {
  const bm = new Bitmap(W, H);
  const { iso } = nyParts();
  const act = active(snapshot);
  const working = byBucket(act, 'today');
  const top3 = prioritySorted(act).slice(0, 3);

  header(bm, 'priority + summary');

  // Main column: Today's Priorities (per Chelsea, 2026-07-18)
  const mainX = MARGIN;
  const mainW = 470;
  bm.drawText(mainX, 62, `TODAY'S PRIORITIES - ${working.length}`, 2);
  let y = 92;
  for (const t of working.slice(0, 4)) {
    prioSquare(bm, mainX, y + 2, 18, t.prio);
    bm.drawText(mainX + 30, y, Bitmap.fit(t.title, 2, mainW - 30), 2);
    bm.drawText(mainX + 30, y + 32, meta(t), 1);
    y += 62;
    if (t !== working[Math.min(3, working.length - 1)]) {
      bm.hline(mainX, y - 10, mainW, 1);
    }
  }
  if (working.length === 0) {
    bm.drawText(mainX, 100, "Nothing in Today's Priorities.", 2);
  }

  // Side column
  const sideX = 516;
  const sideW = W - MARGIN - sideX;
  bm.vline(504, HEADER_RULE_Y + 8, FOOTER_RULE_Y - HEADER_RULE_Y - 16, 1);

  // Top 3 box
  const boxY = 60;
  const boxH = 140;
  bm.rect(sideX, boxY, sideW, boxH, 2);
  bm.drawText(sideX + 12, boxY + 10, 'TOP 3 PRIORITIES', 1);
  top3.forEach((t, i) => {
    const ry = boxY + 28 + i * 34;
    bm.fillRect(sideX + 12, ry, 18, 18);
    bm.drawText(sideX + 17, ry + 2, String(i + 1), 2, true);
    bm.drawText(
      sideX + 40,
      ry + 2,
      Bitmap.fit(t.title, 2, sideW - 52),
      2,
    );
  });

  // Summary counts
  const rows: [string, number][] = [
    ['Active', byBucket(act, 'active').length],
    ['Waiting On', byBucket(act, 'waiting').length],
    ['Later', byBucket(act, 'later').length],
    ['Done today', doneToday(snapshot, iso)],
  ];
  let sy = boxY + boxH + 22;
  for (const [label, n] of rows) {
    bm.drawText(sideX + 4, sy, label, 2);
    const num = String(n);
    bm.drawText(W - MARGIN - Bitmap.textW(num, 3), sy - 4, num, 3);
    sy += 40;
    bm.hline(sideX + 4, sy - 12, sideW - 8, 1);
  }

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
      bm.drawText(x + 22, y + 30, Bitmap.fit(meta(t), 1, colW - 40), 1);
      y += 82;
    }
    const more = items.length - 4;
    if (more > 0) bm.drawText(x, 424, `+${more} more`, 1);
    if (items.length === 0) bm.drawText(x, 100, 'Empty', 1);
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
