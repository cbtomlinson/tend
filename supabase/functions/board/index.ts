import { gate, json, preflight } from '../_shared/http.ts';

/*
 * Server-held board copy — the hub for the e-ink display (and multi-device
 * sync). The phone POSTs its full snapshot on changes; the display's render
 * endpoint GETs it; the device's button C POSTs {completeTop:true} to archive
 * the top priority task (device_mutated flags that so phones pull the change).
 *
 * Storage: single-row `board` table (RLS on, no policies — only the service
 * role used here can touch it). The snapshot is the same shape as the backup
 * files (app:'tend').
 */

const REST = `${Deno.env.get('SUPABASE_URL')}/rest/v1/board`;
// BOARD_SERVICE_KEY is the new-style sb_secret key — this project has legacy
// JWT keys disabled, so the auto-injected SUPABASE_SERVICE_ROLE_KEY 401s.
const SERVICE_KEY =
  Deno.env.get('BOARD_SERVICE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

/** PostgREST fetch with one retry (schema-cache wakeups return 503 briefly). */
async function rest(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(url, init);
  }
  return res;
}

interface BoardRow {
  snapshot: Snapshot;
  updated_at: string;
  device_mutated: boolean;
}
interface SnapTask {
  id: number | string;
  title: string;
  prio?: string;
  due?: string;
  status?: string;
  archivedAt?: string;
  archivedIso?: string;
  [k: string]: unknown;
}
interface Snapshot {
  app?: string;
  tasks?: SnapTask[];
  [k: string]: unknown;
}

async function loadRow(): Promise<BoardRow | null> {
  const res = await rest(`${REST}?id=eq.1&select=snapshot,updated_at,device_mutated`, {
    headers: restHeaders(),
  });
  if (!res.ok) throw new Error(`load ${res.status}`);
  const rows = (await res.json()) as BoardRow[];
  return rows[0] ?? null;
}

async function saveRow(snapshot: Snapshot, deviceMutated: boolean): Promise<string> {
  const updated_at = new Date().toISOString();
  const res = await rest(REST, {
    method: 'POST',
    headers: restHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify([
      { id: 1, snapshot, updated_at, device_mutated: deviceMutated },
    ]),
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
  return updated_at;
}

/** The display's #1 task: highest priority first, due-dated first within it. */
function topTask(snapshot: Snapshot): SnapTask | null {
  const rank: Record<string, number> = { High: 3, Med: 2, Low: 1 };
  const active = (snapshot.tasks ?? []).filter((t) => t.status === 'active');
  active.sort(
    (a, b) =>
      (rank[b.prio ?? ''] ?? 0) - (rank[a.prio ?? ''] ?? 0) ||
      (b.due ? 1 : 0) - (a.due ? 1 : 0),
  );
  return active[0] ?? null;
}

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
  if (!SERVICE_KEY) return json({ error: 'not_configured' }, 503);

  try {
    if (req.method === 'GET') {
      const row = await loadRow();
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
      const row = await loadRow();
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
      const updatedAt = await saveRow(row.snapshot, true);
      return json({ ok: true, completed: top.title, updatedAt });
    }

    // Phone push: replace the snapshot (clears the device-mutated flag).
    const snap = body.snapshot;
    const size = JSON.stringify(snap ?? {}).length;
    if (!snap || snap.app !== 'tend' || !Array.isArray(snap.tasks) || size > 2_000_000) {
      return json({ error: 'bad_snapshot' }, 400);
    }
    const updatedAt = await saveRow(snap, false);
    return json({ ok: true, updatedAt });
  } catch (err) {
    console.error('[board]', (err as Error).message);
    return json({ error: 'board_failed' }, 502);
  }
});
