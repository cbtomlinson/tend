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

export type Area = string;
export type Source = 'Zoho' | 'Epic SLG' | 'To Do' | 'Hand';

export const SOURCES: Source[] = ['Zoho', 'Epic SLG', 'To Do', 'Hand'];
/** Default areas — used when the client doesn't send its live list. */
export const AREAS: Area[] = ['ClinDoc', 'OP Rehab', 'Acute Rehab', 'IRF', 'Rover'];

/** Collapse control chars/newlines — these strings are spliced into the prompt. */
function oneLine(s: string): string {
  // deno-lint-ignore no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Clamp a client-supplied area list to something sane (or fall back). */
export function sanitizeAreas(input: unknown): string[] {
  if (!Array.isArray(input)) return AREAS;
  const clean = input
    .filter((a): a is string => typeof a === 'string')
    .map((a) => oneLine(a))
    .filter((a) => a.length > 0 && a.length <= 40)
    .slice(0, 20);
  return clean.length ? clean : AREAS;
}

export type ImageMediaType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp';

export interface Person {
  name: string;
  /** null = known one-off (no area hint, but don't flag as unknown). */
  area: Area | Area[] | null;
  role?: string;
}

/** Clamp a client-supplied learned-people list. */
export function sanitizePeople(input: unknown): Person[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (p): p is { name: string; area: string | null } =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as { name?: unknown }).name === 'string' &&
        ((p as { area?: unknown }).area === null ||
          typeof (p as { area?: unknown }).area === 'string'),
    )
    .map((p) => ({ name: oneLine(p.name).slice(0, 60), area: p.area }))
    .filter((p) => p.name.length > 0)
    .slice(0, 100);
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
export function buildTool(areas: string[] = AREAS) {
  return {
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
              area: { type: 'string', enum: areas },
            },
            required: ['title', 'area'],
          },
        },
        phiSuspected: {
          type: 'boolean',
          description:
            'True if the photo appears to contain patient-identifying info (patient names, MRN, DOB, room/bed numbers).',
        },
        phiReason: {
          type: 'string',
          description:
            "If phiSuspected, a short generic description of what was seen (e.g. 'a name with a room number'). NEVER repeat the identifier itself.",
        },
        unknownPeople: {
          type: 'array',
          items: { type: 'string' },
          description:
            'First names / names of people mentioned in tasks who are NOT in the KNOWN PEOPLE list and do not appear to be patients.',
        },
      },
      required: ['source', 'items', 'phiSuspected', 'unknownPeople'],
    },
  };
}

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

/** Built-in guidance for the seeded areas; customs get a generic line. */
const AREA_HINTS: Record<string, string> = {
  ClinDoc: 'clinical documentation, Rover, cosign, smartphrases, note templates',
  'OP Rehab': 'outpatient rehab clinics, eval templates, scheduling',
  'Acute Rehab': 'acute rehab unit, therapy charges, swing bed, order sets',
  IRF: 'inpatient rehab facility (also called ARU/IRU), IRF-PAI, FIM/GG mapping',
  Rover: "Epic's mobile app — Rover access, Rover setup, Rover workflows",
};

function knowledgePrompt(people: Person[]): string {
  const abbr = ABBREVIATIONS.map((a) => `  ${a.short} = ${a.long}`).join('\n');
  const withArea = people.filter((p) => p.area != null && p.area !== '');
  const oneOffs = people.filter((p) => p.area == null || p.area === '');
  const peopleBlock = people.length
    ? `

KNOWN PEOPLE — if a task names one of these people, use that as a strong signal for the AREA:
${withArea
  .map(
    (p) =>
      `  ${p.name}${p.role ? ` (${p.role})` : ''} → ${
        Array.isArray(p.area) ? p.area.join(' or ') : p.area
      }`,
  )
  .join('\n')}${
        oneOffs.length
          ? `\nAlso known (no specific area): ${oneOffs.map((p) => p.name).join(', ')}`
          : ''
      }
(First-name-only matches are fine when unambiguous. A person named in a task usually means the task belongs to their area.)`
    : '';

  return `
SHORTHAND — expand these into normal words in the cleaned-up task title (keep the title natural and faithful):
${abbr}
Keep these proper terms/acronyms exactly as written (do NOT expand): ${KEEP_AS_IS.join(', ')}.${peopleBlock}`;
}

/** Full system prompt for the extraction call. */
export function buildSystem(people: Person[], areas: string[] = AREAS): string {
  const areaLines = areas
    .map((a) => `- ${a} — ${AREA_HINTS[a] ?? 'a user-defined area (match by name)'}`)
    .join('\n');

  return `You read a photograph of a personal to-do / ticket list and extract each task as structured text. The user is a clinical analyst who supports rehab applications in an Epic EHR.

Return one item per distinct task. Keep each title short and faithful to what's written — do not invent, merge, or embellish tasks.

For each task, guess its responsibility AREA:
${areaLines}

For the whole list, guess which SOURCE list it is:
- Zoho (ticketing), Epic SLG (Support Log), To Do (Microsoft To Do), Hand (handwritten)

Glossary: ARU = IRF = IRU; SLG = Support Log; GPU = Geriatric Psych Unit; Rover is an Epic mobile app.
${knowledgePrompt(people)}

PHI CHECK — the user must never photograph patient information. If the image appears to contain patient-identifying info (patient names in a clinical context, MRNs, DOBs, room/bed numbers, account numbers), set phiSuspected true with a short GENERIC phiReason (never repeat the identifier). Known people and obvious coworkers are NOT PHI.

NEW NAMES — list in unknownPeople any person named in a task who is NOT in the KNOWN PEOPLE list and does not appear to be a patient, so the user can teach the scanner who they are. Use the name exactly as written.

Record your answer by calling the record_extraction tool. If the image is unreadable or has no tasks, return an empty items array.`;
}
