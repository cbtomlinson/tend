import type { Area, Source } from '@/data/types';
import { db } from '@/data/db';
import { normalizeImage } from '@/domain/image';
import { apiPost } from './api';

/*
 * Vision / OCR client boundary.
 *
 * PHI hard rule: the captured image is held IN MEMORY ONLY (a Blob), base64-encoded,
 * POSTed once to the /api/vision proxy, and then dropped. It is NEVER written to
 * IndexedDB, localStorage, or anywhere on the client. Only the extracted text is
 * kept (locally, via the normal task store).
 *
 * The proxy holds the API key server-side; the client never sees it. If the proxy
 * isn't configured (no key yet), we fall back to clearly-labeled sample data so the
 * reconcile flow stays demoable.
 */

export interface ExtractedItem {
  title: string;
  area: Area;
}
export interface Extraction {
  source: Source;
  items: ExtractedItem[];
  /** Advisory only: the model thought the photo may contain patient info. */
  phiSuspected?: boolean;
  phiReason?: string;
  /** People named on the list that aren't in the known-people set. */
  unknownPeople?: string[];
}
export interface ExtractResult {
  extraction: Extraction;
  /** True when the vision API wasn't configured and sample data was used. */
  sampled: boolean;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // "data:<type>;base64,<data>"
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function extractTasks(image: Blob): Promise<ExtractResult> {
  // Downscale + re-encode as JPEG first: full-res camera files intermittently
  // blew past the 5 MB caps, and library picks could be HEIC (rejected).
  const normalized = await normalizeImage(image);
  const mediaType = normalized.mediaType;
  const imageBase64 = await blobToBase64(normalized.blob);

  // Send the live area list (so scans can assign custom areas) and the learned
  // people (name -> area hints; area:null = known one-off, don't re-flag).
  const [areaDefs, people] = await Promise.all([
    db.areas.orderBy('order').toArray(),
    db.people.toArray(),
  ]);
  const areas = areaDefs.map((a) => a.name);

  let res: Response;
  try {
    res = await apiPost('vision', { imageBase64, mediaType, areas, people });
  } catch {
    throw new Error('offline'); // fetch itself failed — no connection
  }

  if (res.status === 503) {
    // Proxy reachable but no API key configured — demo with sample data.
    return { extraction: sampleExtraction(), sampled: true };
  }
  if (res.status === 429) throw new Error('rate_limited');
  if (res.status === 400) throw new Error('bad_image');
  if (!res.ok) throw new Error('extraction_failed');
  const extraction = (await res.json()) as Extraction;
  return { extraction, sampled: false };
}

/** Human message for a failed scan, by error code. */
export function captureErrorMessage(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  switch (code) {
    case 'offline':
      return 'No connection — check your signal and try again';
    case 'rate_limited':
      return 'Too many tries too fast — wait a minute, then retry';
    case 'bad_image':
      return "The server couldn't accept that photo — try retaking it";
    case 'unreadable_image':
      return "Couldn't open that photo — try retaking it";
    default:
      return 'The scan failed — try again in a moment';
  }
}

/**
 * Sample extraction used only when the vision API isn't configured. Designed
 * against the seed so the reconcile demo shows one of each outcome.
 */
export function sampleExtraction(): Extraction {
  return {
    source: 'Epic SLG',
    items: [
      { title: 'IRF PAI flowsheet', area: 'IRF' }, // ≡ existing #1 → already
      { title: 'Cosign workflow fix', area: 'ClinDoc' }, // ~ #4 → possible dup
      { title: '2FA reset for Rover users', area: 'ClinDoc' }, // new
      { title: 'Downtime procedure update', area: 'Acute Rehab' }, // new
      { title: 'Therapy minutes audit', area: 'Acute Rehab' }, // new
    ],
  };
}
