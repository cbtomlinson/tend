import Anthropic from 'npm:@anthropic-ai/sdk@0.70.1';
import { z } from 'npm:zod@3.25.76';
import {
  DEFAULT_MODEL,
  EXTRACTION_INSTRUCTION,
  SOURCES,
  buildSystem,
  buildTool,
  parsePeople,
  sanitizeAreas,
  sanitizePeople,
} from '../_shared/extraction.ts';
import { authorized, json, preflight } from '../_shared/http.ts';

/*
 * Vision/OCR Edge Function. PHI: the image is in memory only — never logged,
 * never stored. Only the extracted text is returned. Keys come from secrets.
 *
 * The client sends its live `areas` list (custom areas included) and learned
 * `people` (name -> area hints; area:null = known one-off). The model also
 * returns an advisory phiSuspected flag and any unknownPeople it noticed.
 */

const ExtractionSchema = z.object({
  source: z.enum(SOURCES as unknown as [string, ...string[]]),
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);

  // Read the body once. A {ping:true} body is just a password check (used by the
  // login screen) — the password already passed the gate above, so return ok.
  let body: {
    imageBase64?: string;
    mediaType?: string;
    ping?: boolean;
    areas?: unknown;
    people?: unknown;
  } = {};
  try {
    body = await req.json();
  } catch {
    /* empty/invalid body */
  }
  if (body.ping) return json({ ok: true });

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not_configured' }, 503);

  try {
    const { imageBase64, mediaType } = body;
    const model = Deno.env.get('VISION_MODEL') || DEFAULT_MODEL;
    const areas = sanitizeAreas(body.areas);
    // Server-known people (secret) + people the user has taught the app.
    const people = [
      ...parsePeople(Deno.env.get('PEOPLE_JSON')),
      ...sanitizePeople(body.people),
    ];
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: buildSystem(people, areas),
      // deno-lint-ignore no-explicit-any
      tools: [buildTool(areas) as any],
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

    const parsed = ExtractionSchema.parse(block.input);
    // Clamp any off-list area the model invented back onto the allowed list.
    const allowed = new Set(areas);
    parsed.items = parsed.items.map((it) => ({
      ...it,
      area: allowed.has(it.area) ? it.area : areas[0],
    }));
    return json(parsed);
  } catch (err) {
    // Log the error only — never the image payload.
    console.error('[vision]', (err as Error).message);
    return json({ error: 'extraction_failed' }, 502);
  }
});
