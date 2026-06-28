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
