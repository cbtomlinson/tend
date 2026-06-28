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
  `${t.area} · ${shortSource(t.source)}${t.due ? ` · ${t.due}` : ''}`;

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
  let out = `TEND — ${brandDate()}\n`;
  for (const b of buckets) {
    const items = active.filter((t) => t.bucket === b.id);
    if (!items.length) continue;
    out += `\n${b.name.toUpperCase()}\n`;
    for (const t of items) {
      out += `  - ${t.title}  [${t.area} · ${shortSource(t.source)}${
        t.due ? ` · ${t.due}` : ''
      }]\n`;
    }
  }
  return out;
}

export function emailTitle(format: EmailFormat): string {
  const name =
    format === 'priority'
      ? 'Priority'
      : format === 'active'
        ? 'Actively Working'
        : format === 'plain'
          ? 'Plain text'
          : 'Full board';
  return `${name} — ${brandDate()}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Renders the chosen format as a self-contained HTML email (inline styles). */
export function emailHtml(
  active: Task[],
  buckets: Bucket[],
  format: EmailFormat,
): string {
  const sub = (s: string) =>
    `<div style="font-size:11px;color:#a7aeb7;font-family:ui-monospace,monospace">${esc(s)}</div>`;

  let body: string;
  if (format === 'plain') {
    body = `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:13px;color:#42505e;margin:0">${esc(
      plainText(active, buckets),
    )}</pre>`;
  } else if (format === 'full') {
    body = groupBlocks(active, buckets)
      .map(
        (g) =>
          `<div style="margin-bottom:16px"><div style="font-weight:600;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#8a929c;margin-bottom:6px">${esc(
            g.name,
          )}</div>${g.items
            .map(
              (it) =>
                `<div style="padding:5px 0;border-bottom:1px solid #f4f6f8"><div style="font-size:14px;color:#1c2530">${esc(
                  it.title,
                )}</div>${sub(it.sub)}</div>`,
            )
            .join('')}</div>`,
      )
      .join('');
  } else {
    body = flatList(active, format, buckets)
      .map(
        (it) =>
          `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #f4f6f8"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${
            PRIO_DOT[it.prio]
          };margin-top:6px;flex:none"></span><div style="min-width:0"><div style="font-size:14px;color:#1c2530">${esc(
            it.title,
          )}</div>${sub(it.sub)}</div></div>`,
      )
      .join('');
  }

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c2530;max-width:560px;margin:0 auto;padding:8px">
  <div style="font-weight:700;font-size:20px">Tend</div>
  <div style="color:#8a929c;font-size:13px;margin:2px 0 16px">${esc(emailTitle(format))}</div>
  ${body}
</div>`;
}
