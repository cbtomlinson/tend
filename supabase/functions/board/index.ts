import { gate, json, preflight } from '../_shared/http.ts';
import {
  hasServiceKey,
  loadBoardRow,
  saveBoardRow,
  topTask,
  type Snapshot,
} from '../_shared/boardStore.ts';

/*
 * Server-held board copy — the hub for the e-ink display (and multi-device
 * sync). The phone POSTs its full snapshot on changes; the display's render
 * endpoint GETs it; the device's button C POSTs {completeTop:true} to archive
 * the top priority task (device_mutated flags that so phones pull the change).
 */

function isoToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function shortToday(): string {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date();
  return `${M[d.getMonth()]} ${d.getDate()}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  const denied = await gate(req);
  if (denied) return denied;
  if (!hasServiceKey()) return json({ error: 'not_configured' }, 503);

  try {
    if (req.method === 'GET') {
      const row = await loadBoardRow();
      if (!row) return json({ snapshot: null });
      return json({
        snapshot: row.snapshot,
        updatedAt: row.updated_at,
        deviceMutated: row.device_mutated,
      });
    }

    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

    let body: { snapshot?: Snapshot; completeTop?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      /* empty */
    }

    // Button C on the display: archive the current #1 task server-side.
    if (body.completeTop) {
      const row = await loadBoardRow();
      if (!row) return json({ error: 'no_board' }, 404);
      const top = topTask(row.snapshot);
      if (!top) return json({ ok: true, completed: null });
      for (const t of row.snapshot.tasks ?? []) {
        if (String(t.id) === String(top.id)) {
          t.status = 'archived';
          t.archivedAt = shortToday();
          t.archivedIso = isoToday();
        }
      }
      const updatedAt = await saveBoardRow(row.snapshot, true);
      return json({ ok: true, completed: top.title, updatedAt });
    }

    // Phone push: replace the snapshot (clears the device-mutated flag).
    const snap = body.snapshot;
    const size = JSON.stringify(snap ?? {}).length;
    if (!snap || snap.app !== 'tend' || !Array.isArray(snap.tasks) || size > 2_000_000) {
      return json({ error: 'bad_snapshot' }, 400);
    }
    const updatedAt = await saveBoardRow(snap, false);
    return json({ ok: true, updatedAt });
  } catch (err) {
    console.error('[board]', (err as Error).message);
    return json({ error: 'board_failed' }, 502);
  }
});
