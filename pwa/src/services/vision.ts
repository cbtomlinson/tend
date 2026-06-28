import type { Area, Source } from '@/data/types';

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
  const mediaType = image.type || 'image/jpeg';
  const imageBase64 = await blobToBase64(image);

  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, mediaType }),
  });

  if (res.status === 503) {
    // Proxy reachable but no API key configured — demo with sample data.
    return { extraction: sampleExtraction(), sampled: true };
  }
  if (!res.ok) {
    throw new Error('extraction_failed');
  }
  const extraction = (await res.json()) as Extraction;
  return { extraction, sampled: false };
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
