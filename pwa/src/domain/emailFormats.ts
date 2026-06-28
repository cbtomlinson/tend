import type { Bucket, Prio, Task } from '@/data/types';
import { shortSource } from './sources';
import { fmtShort, weekday } from './dates';

/*
 * Builds the four email previews from the current board.
 * The same payloads drive the server-side Resend send + Send-to-Kindle doc.
 */

export type EmailFormat = 'priority' | 'full' | 'active' | 'plain';

const PRANK: Record<Prio, number> = { High: 3, Med: 2, Low: 1 };
export const PRIO_DOT: Record<Prio, string> = {
  High: '#b5402f',
  Med: '#97681a',
  Low: '#9aa3af',
};

export function brandDate(): string {
  const d = new Date();
  return `${weekday(d)}, ${fmtShort(d)}`;
}

function prioritySorted(active: Task[]): Task[] {
  return active
    .slice()
    .sort(
      (a, b) =>
        PRANK[b.prio] - PRANK[a.prio] || (b.due ? 1 : 0) - (a.due ? 1 : 0),
    );
}

export interface FlatItem {
  id: Task['id'];
  title: string;
  sub: string;
  prio: Prio;
}
export interface GroupBlock {
  name: string;
  items: { id: Task['id']; title: string; sub: string }[];
}

const sub = (t: Task) =>
  `${t.area} - ${shortSource(t.source)}${t.due ? ` - ${t.due}` : ''}`;

export function flatList(
  active: Task[],
  format: EmailFormat,
  buckets: Bucket[],
): FlatItem[] {
  const src =
    format === 'active'
      ? active.filter((t) => t.bucket === activeBucketId(buckets))
      : prioritySorted(active);
  return src.slice(0, 12).map((t) => ({
    id: t.id,
    title: t.title,
    sub: sub(t),
    prio: t.prio,
  }));
}

function activeBucketId(buckets: Bucket[]): string {
  return buckets.find((b) => b.id === 'active')?.id ?? buckets[0]?.id ?? 'active';
}

export function groupBlocks(active: Task[], buckets: Bucket[]): GroupBlock[] {
  return buckets
    .map((b) => ({
      name: b.name,
      items: active
        .filter((t) => t.bucket === b.id)
        .map((t) => ({ id: t.id, title: t.title, sub: sub(t) })),
    }))
    .filter((g) => g.items.length > 0);
}

export function plainText(active: Task[], buckets: Bucket[]): string {
  let out = `TEND - ${brandDate()}\n`;
  for (const b of buckets) {
    const items = active.filter((t) => t.bucket === b.id);
    if (!items.length) continue;
    out += `\n${b.name.toUpperCase()}\n`;
    for (const t of items) {
      out += `  - ${t.title}  [${t.area} - ${shortSource(t.source)}${
        t.due ? ` - ${t.due}` : ''
      }]\n`;
    }
  }
  return out;
}

function formatName(format: EmailFormat): string {
  return format === 'priority'
    ? 'Priority'
    : format === 'active'
      ? 'Actively Working'
      : format === 'plain'
        ? 'Plain text'
        : 'Full board';
}

export function emailTitle(format: EmailFormat): string {
  return `${formatName(format)} - ${brandDate()}`;
}

/** Plain ASCII subject — corporate mail gateways are picky about fancy subjects. */
export function emailSubject(format: EmailFormat): string {
  return `Your Tend board - ${formatName(format)}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Renders the chosen format as a plain, deliverable HTML email.
 * Deliberately simple (Arial, basic text, ASCII) — corporate security gateways
 * quarantine heavily-styled mail. Keep it boring on purpose.
 */
export function emailHtml(
  active: Task[],
  buckets: Bucket[],
  format: EmailFormat,
): string {
  const subLine = (s: string) =>
    `<div style="color:#777;font-size:12px">${esc(s)}</div>`;
  const item = (title: string, s: string) =>
    `<div style="margin:0 0 8px"><strong>${esc(title)}</strong>${subLine(s)}</div>`;

  let body: string;
  if (format === 'plain') {
    body = `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px;color:#333;margin:0">${esc(
      plainText(active, buckets),
    )}</pre>`;
  } else if (format === 'full') {
    body = groupBlocks(active, buckets)
      .map(
        (g) =>
          `<h3 style="font-size:14px;color:#222;margin:16px 0 6px">${esc(g.name)}</h3>` +
          g.items.map((it) => item(it.title, it.sub)).join(''),
      )
      .join('');
  } else {
    body = flatList(active, format, buckets)
      .map((it) => item(it.title, it.sub))
      .join('');
  }

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:560px">
  <h2 style="margin:0 0 2px">Tend</h2>
  <p style="color:#777;font-size:13px;margin:0 0 16px">${esc(emailTitle(format))}</p>
  ${body}
  <p style="color:#999;font-size:12px;margin-top:20px">Sent from Tend.</p>
</div>`;
}
