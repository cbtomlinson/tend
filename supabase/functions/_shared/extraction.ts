/*
 * Shared, dependency-free vision-extraction logic.
 *
 * Imported by BOTH the local dev handler (Node, server/vision/handler.ts) and the
 * deployed Supabase Edge Function (Deno, ../vision/index.ts) so the prompt,
 * schema, and knowledge can never drift between dev and prod. Keep this file free
 * of any runtime imports (no zod, no SDK) — each runtime adds those itself.
 *
 * PRIVACY: no real names here. The people→area list comes from the PEOPLE_JSON
 * secret at runtime via parsePeople().
 */

export type Area = 'ClinDoc' | 'OP Rehab' | 'Acute Rehab' | 'IRF';
export type Source = 'Zoho' | 'Epic SLG' | 'To Do' | 'Hand';

export const SOURCES: Source[] = ['Zoho', 'Epic SLG', 'To Do', 'Hand'];
export const AREAS: Area[] = ['ClinDoc', 'OP Rehab', 'Acute Rehab', 'IRF'];

export type ImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export interface Person {
  name: string;
  area: Area | Area[];
  role?: string;
}

/** Generic clinical/scheduling shorthand (not identifying). */
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
  'OT', 'PT', 'ST', 'SLP', 'eval', 'treat',
  'IRF-PAI', 'SLG', 'GG', 'FIM', 'Rover', 'GPU', 'ARU', 'IRU', 'IRF',
];

/** Tool schema Claude fills with the extracted tasks. Plain JSON (no SDK type). */
export const TOOL = {
  name: 'record_extraction',
  description: 'Record the tasks extracted from the photographed list.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      source: { type: 'string', enum: SOURCES },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            area: { type: 'string', enum: AREAS },
          },
          required: ['title', 'area'],
        },
      },
    },
    required: ['source', 'items'],
  },
};

/** The user-turn instruction sent alongside the image. */
export const EXTRACTION_INSTRUCTION =
  'Extract every task from this list and record it. Discard the image after.';

export const DEFAULT_MODEL = 'claude-opus-4-8';

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

function knowledgePrompt(people: Person[]): string {
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

/** Full system prompt for the extraction call. */
export function buildSystem(people: Person[]): string {
  return `You read a photograph of a personal to-do / ticket list and extract each task as structured text. The user is a clinical analyst who supports rehab applications in an Epic EHR.

Return one item per distinct task. Keep each title short and faithful to what's written — do not invent, merge, or embellish tasks.

For each task, guess its responsibility AREA:
- ClinDoc — clinical documentation, Rover, cosign, smartphrases, note templates
- OP Rehab — outpatient rehab clinics, eval templates, scheduling
- Acute Rehab — acute rehab unit, therapy charges, swing bed, order sets
- IRF — inpatient rehab facility (also called ARU/IRU), IRF-PAI, FIM/GG mapping

For the whole list, guess which SOURCE list it is:
- Zoho (ticketing), Epic SLG (Support Log), To Do (Microsoft To Do), Hand (handwritten)

Glossary: ARU = IRF = IRU; SLG = Support Log; GPU = Geriatric Psych Unit; Rover is an Epic mobile app under ClinDoc.
${knowledgePrompt(people)}

Record your answer by calling the record_extraction tool. If the image is unreadable or has no tasks, return an empty items array.`;
}
