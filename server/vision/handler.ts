import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { knowledgePrompt, parsePeople, type Person } from './knowledge';

/*
 * Vision/OCR handler — extracts a task list from a photographed list.
 *
 * PHI hard rule: the image is processed IN MEMORY ONLY and discarded the moment
 * this function returns. It is NEVER written to disk, a database, logs, or
 * analytics here. Only the extracted TEXT is returned. Do not add logging that
 * includes `imageBase64`.
 *
 * The API key is read from the environment by the caller and passed in; it never
 * reaches the client. This handler is framework-agnostic so the same code backs
 * the local Vite dev proxy and any future serverless deployment.
 */

const SOURCES = ['Zoho', 'Epic SLG', 'To Do', 'Hand'] as const;
const AREAS = ['ClinDoc', 'OP Rehab', 'Acute Rehab', 'IRF'] as const;

export const ExtractionSchema = z.object({
  source: z.enum(SOURCES),
  items: z.array(
    z.object({
      title: z.string().min(1),
      area: z.enum(AREAS),
    }),
  ),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

export interface ExtractArgs {
  imageBase64: string;
  mediaType: ImageMediaType;
  apiKey: string;
  /** Override the vision model (e.g. 'claude-sonnet-4-6'). Defaults to Opus 4.8. */
  model?: string;
  /** JSON array of {name, area, role?} — real names live in a secret, not in code. */
  peopleJson?: string;
}

const DEFAULT_MODEL = 'claude-opus-4-8';

function buildSystem(people: Person[]): string {
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

const TOOL: Anthropic.Tool = {
  name: 'record_extraction',
  description: 'Record the tasks extracted from the photographed list.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      source: { type: 'string', enum: SOURCES as unknown as string[] },
      items: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            area: { type: 'string', enum: AREAS as unknown as string[] },
          },
          required: ['title', 'area'],
        },
      },
    },
    required: ['source', 'items'],
  },
};

export async function extractFromImage(args: ExtractArgs): Promise<Extraction> {
  const { imageBase64, mediaType, apiKey, model, peopleJson } = args;
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 4096,
    system: buildSystem(parsePeople(peopleJson)),
    tools: [TOOL],
    tool_choice: { type: 'tool', name: 'record_extraction' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Extract every task from this list and record it. Discard the image after.',
          },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('vision: model did not return a structured extraction');
  }
  // zod validates the model's output against our schema before it's trusted.
  return ExtractionSchema.parse(block.input);
}
