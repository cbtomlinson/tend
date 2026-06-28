import Anthropic from 'npm:@anthropic-ai/sdk@0.70.1';
import { z } from 'npm:zod@3.25.76';
import {
  AREAS,
  DEFAULT_MODEL,
  EXTRACTION_INSTRUCTION,
  SOURCES,
  TOOL,
  buildSystem,
  parsePeople,
} from '../_shared/extraction.ts';
import { authorized, json, preflight } from '../_shared/http.ts';

/*
 * Vision/OCR Edge Function. PHI: the image is in memory only — never logged,
 * never stored. Only the extracted text is returned. Keys come from secrets.
 */

const ExtractionSchema = z.object({
  source: z.enum(SOURCES as unknown as [string, ...string[]]),
  items: z.array(
    z.object({
      title: z.string().min(1),
      area: z.enum(AREAS as unknown as [string, ...string[]]),
    }),
  ),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  try {
    const { imageBase64, mediaType } = await req.json();
    const model = Deno.env.get('VISION_MODEL') || DEFAULT_MODEL;
    const people = parsePeople(Deno.env.get('PEOPLE_JSON'));
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildSystem(people),
      // deno-lint-ignore no-explicit-any
      tools: [TOOL as any],
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

    const block = response.content.find(
      (b: { type: string }) => b.type === 'tool_use',
    ) as { input: unknown } | undefined;
    if (!block) return json({ error: 'extraction_failed' }, 502);
    return json(ExtractionSchema.parse(block.input));
  } catch (err) {
    // Log the error only — never the image payload.
    console.error('[vision]', (err as Error).message);
    return json({ error: 'extraction_failed' }, 502);
  }
});
