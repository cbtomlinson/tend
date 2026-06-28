/*
 * Dedupe glossary — seeds the synonym expansion used before comparing titles.
 * Source of truth: reference/memory/glossary.md.
 *
 * Two stages:
 *   1. PHRASE_SYNONYMS — multi-word phrases collapsed to a canonical token,
 *      applied to the lowercased raw string BEFORE tokenizing.
 *   2. TOKEN_SYNONYMS — single tokens mapped to a canonical form.
 *
 * STOPWORDS drops filler verbs / glue words so "Build X" ≡ "X update".
 */

/** [pattern, canonical-token]. Order matters; applied top-to-bottom. */
export const PHRASE_SYNONYMS: ReadonlyArray<[RegExp, string]> = [
  // ARU = IRF = IRU — the Inpatient Rehab Unit, interchangeable.
  [/\bacute rehab unit\b/g, 'irf'],
  [/\binpatient rehab (facility|unit)\b/g, 'irf'],
  // SLG = Support Log
  [/\bsupport log\b/g, 'supportlog'],
  // Multi-word domain terms -> single stable token.
  [/\bswing bed\b/g, 'swingbed'],
  [/\border set\b/g, 'orderset'],
  [/\bsmart ?phrase\b/g, 'smartphrase'],
  [/\bflow ?sheet\b/g, 'flowsheet'],
  [/\bsign ?off\b/g, 'signoff'],
  [/\bgo ?live\b/g, 'golive'],
  [/\bge[ -]?psych\b/g, 'gpu'],
];

/** token -> canonical token. */
export const TOKEN_SYNONYMS: Readonly<Record<string, string>> = {
  aru: 'irf',
  iru: 'irf',
  irf: 'irf',
  'irf-pai': 'irfpai', // punctuation is stripped later; kept for clarity
  slg: 'supportlog',
  ge: 'gpu',
  geripsych: 'gpu',
};

/**
 * Filler verbs + stopwords dropped before comparison.
 * "build/update/fix/the/…" per the README, plus common glue.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'build',
  'update',
  'updates',
  'fix',
  'fixes',
  'review',
  'pass',
  'new',
  'add',
  'create',
  'setup',
  'set',
  'change',
  'changes',
  'check',
  'confirm',
  'the',
  'a',
  'an',
  'to',
  'for',
  'of',
  'and',
  'on',
  'in',
  'at',
  'by',
  'with',
  'from',
  'into',
  'request',
  'requested',
]);
