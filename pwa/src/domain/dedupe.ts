import type { Area } from '@/data/types';
import { PHRASE_SYNONYMS, STOPWORDS, TOKEN_SYNONYMS } from './glossary';

/*
 * Decoupled dedupe — README "Dedupe policy".
 *
 * Two SEPARATE jobs because the failure costs aren't symmetric:
 *   - a false MERGE hides a real task  -> bad  -> only on strict evidence
 *   - a missed dupe is two cards you merge by hand -> safe
 *
 * Verdicts:
 *   'auto-merge' — strict: normalized-exact token set + same area, OR a shared
 *                  hard anchor (ticket #).
 *   'ask'        — looser keyword/concept + same area overlap. Never silent.
 *   'separate'   — weak overlap, or different area.
 *
 * Tunable thresholds live in DEDUPE_THRESHOLDS so the "auto vs ask" line is a
 * single, reviewable knob (see README open item).
 */

export const DEDUPE_THRESHOLDS = {
  /** Jaccard similarity at/above this + same area => ask. (Open item: tune.) */
  ask: 0.3,
  /** Different area is strong evidence of "genuinely different"; require a much
   *  higher wording overlap before we even ask. Never silent across areas. */
  crossArea: 0.6,
} as const;

export type DedupeVerdict = 'auto-merge' | 'ask' | 'separate';

export interface DedupeResult {
  verdict: DedupeVerdict;
  /** 0..1 Jaccard similarity over content tokens (for "{n}% match"). */
  overlap: number;
  /** What drove the decision — useful for debugging / UI copy. */
  reason: 'exact' | 'anchor' | 'overlap' | 'cross-area' | 'weak';
}

/** Normalize a title to a comparable, glossary-expanded token set. */
export function normalize(title: string): string[] {
  let s = title.toLowerCase();
  for (const [pattern, canonical] of PHRASE_SYNONYMS) {
    s = s.replace(pattern, ` ${canonical} `);
  }
  // Strip punctuation to spaces (keeps anchors extractable separately).
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  const tokens = s
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => TOKEN_SYNONYMS[t] ?? t)
    .filter((t) => !STOPWORDS.has(t));
  // Dedupe tokens — order doesn't matter for set comparison.
  return Array.from(new Set(tokens));
}

/** Extract hard anchors (ticket/log refs like SLG-4821, ZOHO-1234). */
export function anchors(title: string, ref?: string): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => {
    const m = s.toLowerCase().match(/\b[a-z]{2,}-?\d{3,}\b/g);
    m?.forEach((x) => out.add(x.replace('-', '')));
  };
  add(title);
  if (ref) add(ref);
  return out;
}

/** Jaccard similarity: |A ∩ B| / |A ∪ B|. */
function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const inter = a.filter((t) => setB.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

function sameTokenSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((t) => setB.has(t));
}

export interface DedupeInput {
  title: string;
  area: Area;
  ref?: string;
}

/**
 * Compare a candidate against an existing item.
 * @param vsBoard true when the existing item is already on the board (stricter).
 */
export function classify(
  candidate: DedupeInput,
  existing: DedupeInput,
  vsBoard = true,
): DedupeResult {
  const ca = anchors(candidate.title, candidate.ref);
  const ea = anchors(existing.title, existing.ref);
  const sharedAnchor = [...ca].some((x) => ea.has(x));

  const ct = normalize(candidate.title);
  const et = normalize(existing.title);
  const overlap = jaccard(ct, et);
  const sameArea = candidate.area === existing.area;

  // Shared hard anchor => strict match regardless of wording.
  if (sharedAnchor) return { verdict: 'auto-merge', overlap: 1, reason: 'anchor' };

  // Normalized-exact wording => the same task, even when the AREA guesses
  // disagree (the scan's area is a guess; identical words are overwhelming
  // evidence — asking about literal duplicates was pure noise in practice).
  // Anything less than exact still never merges silently. (`vsBoard` reserved
  // for future tuning; the asymmetry is handled by keeping auto-merge strict,
  // not by suppressing the safe "ask".)
  void vsBoard;
  if (sameTokenSet(ct, et) && ct.length > 0) {
    return { verdict: 'auto-merge', overlap: 1, reason: 'exact' };
  }

  // Different area => only ask on very high overlap, never silent.
  if (!sameArea) {
    return overlap >= DEDUPE_THRESHOLDS.crossArea
      ? { verdict: 'ask', overlap, reason: 'cross-area' }
      : { verdict: 'separate', overlap, reason: 'cross-area' };
  }

  if (overlap >= DEDUPE_THRESHOLDS.ask) {
    return { verdict: 'ask', overlap, reason: 'overlap' };
  }
  return { verdict: 'separate', overlap, reason: 'weak' };
}

/** Format an overlap value as the "{n}% match" string shown in the UI. */
export function overlapLabel(overlap: number): string {
  return `${Math.round(overlap * 100)}%`;
}
