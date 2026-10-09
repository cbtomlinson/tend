/*
 * Client-side photo normalization for capture (Chelsea, 2026-10-09 — raw
 * camera uploads were intermittently failing: full-res iPhone JPEGs blew past
 * the 5 MB upload/API caps, and library picks could arrive as HEIC, which the
 * server rejects).
 *
 * Every captured image is downscaled to MAX_EDGE and re-encoded as JPEG
 * before upload. Handwriting OCR needs nowhere near full camera resolution —
 * the vision API downscales to ~1600 px internally anyway — so this loses
 * nothing, fixes HEIC (Safari can DECODE it; we just can't UPLOAD it), and
 * makes scans faster and slightly cheaper.
 *
 * PHI note: everything stays in memory (bitmap -> canvas -> blob); nothing is
 * written to storage, same as the rest of the capture path.
 */

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob);
  } catch {
    // Older Safari: fall back to an <img> decode via object URL.
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function normalizeImage(
  blob: Blob,
): Promise<{ blob: Blob; mediaType: string }> {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(blob);
  } catch {
    throw new Error('unreadable_image');
  }

  const w = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const h = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error('unreadable_image');

  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('unreadable_image');
  ctx.drawImage(source, 0, 0, outW, outH);
  if ('close' in source) source.close();

  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!out) throw new Error('unreadable_image');
  return { blob: out, mediaType: 'image/jpeg' };
}
