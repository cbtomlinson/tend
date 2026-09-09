import type { Area, Person } from '@/data/types';

/*
 * Area auto-tagging for MANUALLY typed tasks (photo captures get this from
 * the AI scan; typed entries deserve the same courtesy — Chelsea 2026-09-08:
 * "IRF regulatory checklist" was landing in ClinDoc).
 *
 * Order of evidence:
 *   1. An area's own name appearing in the text ("IRF …" -> IRF) — longest
 *      name wins, so "OP Rehab eval" beats a bare "op" token.
 *   2. A known person's name (from the learned-people table).
 *   3. Domain keywords, mirroring the scanner's area hints.
 *   4. Fallback: the first area (previous behavior).
 */

/** Keyword hints for the seeded areas (single tokens or space phrases). */
const KEYWORDS: [Area, string[]][] = [
  ['Rover', ['rover']],
  ['IRF', ['irf', 'irf-pai', 'irfpai', 'fim', 'gg', 'aru', 'iru', 'inpatient rehab', 'inpatient']],
  ['Acute Rehab', ['acute', 'swing bed', 'swingbed', 'order set', 'therapy charge']],
  ['OP Rehab', ['outpatient', 'op', 'eval template', 'referral']],
  ['ClinDoc', ['clindoc', 'cosign', 'smartphrase', 'smart phrase', 'attestation', 'attest', 'note template', 'hyperspace']],
];

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function hasPhrase(haystackTokens: string[], phrase: string): boolean {
  const parts = phrase.split(' ');
  if (parts.length === 1) return haystackTokens.includes(parts[0]);
  return ` ${haystackTokens.join(' ')} `.includes(` ${phrase} `);
}

export function guessArea(
  title: string,
  areas: Area[],
  people: Person[],
): Area {
  const toks = tokens(title);
  const joined = ` ${toks.join(' ')} `;

  // 1. Explicit area name in the text (longest name first).
  const byLength = areas.slice().sort((a, b) => b.length - a.length);
  for (const a of byLength) {
    if (joined.includes(` ${tokens(a).join(' ')} `)) return a;
  }

  // 2. Known person mentioned (first name is enough).
  for (const p of people) {
    if (!p.area) continue;
    const first = tokens(p.name)[0];
    if (first && toks.includes(first)) return p.area;
  }

  // 3. Domain keywords.
  for (const [area, words] of KEYWORDS) {
    if (!areas.includes(area)) continue;
    if (words.some((w) => hasPhrase(toks, w))) return area;
  }

  // 4. Fallback: first area (previous behavior).
  return areas[0] ?? 'ClinDoc';
}
