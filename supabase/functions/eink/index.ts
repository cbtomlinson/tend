import { CORS, gate, json, preflight } from '../_shared/http.ts';
import { hasServiceKey, loadBoardRow } from '../_shared/boardStore.ts';
import { drawEmpty, drawViewA, drawViewB } from './layout.ts';

/*
 * E-ink render endpoint. The reTerminal fetches:
 *   GET /eink?view=A|B&format=raw   -> 48,000-byte packed framebuffer
 *                                      (row-major, MSB = leftmost, 1 = black)
 *   GET /eink?view=A|B&format=bmp   -> 1-bit BMP (browser/debug preview)
 * Auth: x-app-password header, same as everything else.
 */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const denied = await gate(req);
  if (denied) return denied;
  if (!hasServiceKey()) return json({ error: 'not_configured' }, 503);

  try {
    const url = new URL(req.url);
    const view = url.searchParams.get('view') === 'B' ? 'B' : 'A';
    const format = url.searchParams.get('format') === 'bmp' ? 'bmp' : 'raw';

    const row = await loadBoardRow();
    const hasBoard = !!row && (row.snapshot.tasks?.length ?? 0) >= 0 && !!row.snapshot.app;
    const bm = !hasBoard
      ? drawEmpty()
      : view === 'B'
        ? drawViewB(row.snapshot)
        : drawViewA(row.snapshot);

    const body = format === 'bmp' ? bm.toBMP() : bm.toRaw();
    return new Response(body.buffer as ArrayBuffer, {
      headers: {
        ...CORS,
        'content-type': format === 'bmp' ? 'image/bmp' : 'application/octet-stream',
        'cache-control': 'no-store',
        'x-tend-view': view,
        'x-tend-updated': row?.updated_at ?? '',
      },
    });
  } catch (err) {
    console.error('[eink]', (err as Error).message);
    return json({ error: 'render_failed' }, 502);
  }
});
