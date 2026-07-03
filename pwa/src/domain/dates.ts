const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** "Jun 27" style label used across the board, archive, and e-ink. */
export function fmtShort(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Today as "Jun 27". */
export function today(): string {
  return fmtShort(new Date());
}

/** Weekday abbreviation, e.g. "Fri". */
export function weekday(d = new Date()): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

/** "Due Jun 30" label for a date N days from today. */
export function dueInDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `Due ${fmtShort(d)}`;
}

/** Today as ISO "YYYY-MM-DD" (local time) — used for day math. */
export function isoToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Best-effort parse of a legacy "Jun 25" label into an ISO date. Assumes the
 * most recent past occurrence (a "future" parse means it was last year).
 */
export function shortToIso(label: string): string {
  const m = label.match(/^([A-Z][a-z]{2}) (\d{1,2})$/);
  if (!m) return '';
  const month = MONTHS.indexOf(m[1]);
  if (month < 0) return '';
  const now = new Date();
  const d = new Date(now.getFullYear(), month, Number(m[2]));
  if (d.getTime() > now.getTime()) d.setFullYear(d.getFullYear() - 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Whole days elapsed since an ISO date ('' or invalid -> 0). */
export function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  const then = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(then.getTime())) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - then.getTime()) / 86400000));
}
