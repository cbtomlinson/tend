import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import {
  DEFAULT_MODEL,
  EXTRACTION_INSTRUCTION,
  SOURCES,
  buildSystem,
  buildTool,
  parsePeople,
  sanitizeAreas,
  sanitizePeople,
  type ImageMediaType,
  type Source,
} from '../../supabase/functions/_shared/extraction';

/*
 * Vision/OCR handler for LOCAL DEV (Node, behind the Vite proxy). Production runs
 * the same prompt/schema via the Supabase Edge Function, which imports the same
 * shared extraction module — so dev and prod never drift.
 *
 * PHI hard rule: the image is processed IN MEMORY ONLY and discarded the moment
 * this returns. Never logged or stored. Only the extracted TEXT is returned.
 */

export type { ImageMediaType };

export const ExtractionSchema = z.object({
  source: z.enum(SOURCES as unknown as [Source, ...Source[]]),
  items: z.array(
    z.object({
      title: z.string().min(1),
      area: z.string().min(1),
    }),
  ),
  phiSuspected: z.boolean().optional().default(false),
  phiReason: z.string().optional(),
  unknownPeople: z.array(z.string()).optional().default([]),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

export interface ExtractArgs {
  imageBase64: string;
  mediaType: ImageMediaType;
  apiKey: string;
  /** Override the vision model (e.g. 'claude-sonnet-4-6'). Defaults to Opus 4.8. */
  model?: string;
  /** JSON array of {name, area, role?} — real names live in a secret, not in code. */
  peopleJson?: string;
  /** The app's live area list (custom areas included). */
  areas?: unknown;
  /** People the user taught the app (name -> area; area:null = one-off). */
  people?: unknown;
}

export async function extractFromImage(args: ExtractArgs): Promise<Extraction> {
  const { imageBase64, mediaType, apiKey, model, peopleJson } = args;
  const areas = sanitizeAreas(args.areas);
  const people = [...parsePeople(peopleJson), ...sanitizePeople(args.people)];
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: model || DEFAULT_MODEL,
    max_tokens: 4096,
    system: buildSystem(people, areas),
    tools: [buildTool(areas) as Anthropic.Tool],
    tool_choice: { type: 'tool', name: 'record_extraction' },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          { type: 'text', text: EXTRACTION_INSTRUCTION },
        ],
      },
    ],
  });

  const block = response.content.find((b) => b.type === 'tool_use');
  if (!block || block.type !== 'tool_use') {
    throw new Error('vision: model did not return a structured extraction');
  }
  // zod validates the model's output against our schema before it's trusted.
  const parsed = ExtractionSchema.parse(block.input);
  const allowed = new Set(areas);
  parsed.items = parsed.items.map((it) => ({
    ...it,
    area: allowed.has(it.area) ? it.area : areas[0],
  }));
  return parsed;
}
