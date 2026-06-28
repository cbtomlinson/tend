/*
 * Domain knowledge injected into the vision prompt so it reads lists the way a
 * colleague would:
 *   - expands shorthand / clinical abbreviations into readable titles
 *   - infers a task's area from a named person
 *
 * PRIVACY: the abbreviations below are generic and safe to ship publicly. The
 * PEOPLE list (real names → area) is identifying, so it is NOT stored here — it
 * is supplied at runtime from the PEOPLE_JSON secret (a Supabase function secret
 * in prod, a local .env value in dev) and passed into knowledgePrompt(people).
 */

export type Area = 'ClinDoc' | 'OP Rehab' | 'Acute Rehab' | 'IRF';

export interface Person {
  name: string;
  /** Area(s) a task is likely about when it names this person. */
  area: Area | Area[];
  role?: string;
}

/** Shorthand → expansion. Generic clinical/scheduling shorthand (not identifying). */
export const ABBREVIATIONS: { short: string; long: string }[] = [
  { short: 'w/ , c̄', long: 'with' },
  { short: 'w/o , s̄', long: 'without' },
  { short: 'f/u , f-u , fu', long: 'follow up' },
  { short: 're:', long: 'regarding' },
  { short: 'appt', long: 'appointment' },
  { short: 'mtg', long: 'meeting' },
  { short: 'Tx', long: 'treat' },
  { short: 'dx', long: 'diagnosis' },
  { short: 'hx', long: 'history' },
  { short: 'd/c', long: 'discharge (or discontinue, by context)' },
  { short: 'IP', long: 'inpatient' },
  { short: 'OP', long: 'outpatient' },
  { short: 'OS', long: 'order set' },
  { short: 'SP', long: 'smartphrase' },
];

/** Proper terms/acronyms to KEEP as-is (do not expand). */
export const KEEP_AS_IS = [
  'OT',
  'PT',
  'ST',
  'SLP',
  'eval',
  'treat',
  'IRF-PAI',
  'SLG',
  'GG',
  'FIM',
  'Rover',
  'GPU',
  'ARU',
  'IRU',
  'IRF',
];

/** Parse the PEOPLE_JSON secret into a Person[]. Tolerant of empty/missing. */
export function parsePeople(json: string | undefined): Person[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Person[]) : [];
  } catch {
    return [];
  }
}

/** Renders the knowledge as a prompt block appended to the vision system prompt. */
export function knowledgePrompt(people: Person[] = []): string {
  const abbr = ABBREVIATIONS.map((a) => `  ${a.short} = ${a.long}`).join('\n');
  const peopleBlock = people.length
    ? `

PEOPLE — if a task names one of these people, use that as a strong signal for the AREA:
${people
  .map(
    (p) =>
      `  ${p.name}${p.role ? ` (${p.role})` : ''} → ${
        Array.isArray(p.area) ? p.area.join(' or ') : p.area
      }`,
  )
  .join('\n')}
(First-name-only matches are fine when unambiguous. A person named in a task usually means the task belongs to their area.)`
    : '';

  return `
SHORTHAND — expand these into normal words in the cleaned-up task title (keep the title natural and faithful):
${abbr}
Keep these proper terms/acronyms exactly as written (do NOT expand): ${KEEP_AS_IS.join(', ')}.${peopleBlock}`;
}
