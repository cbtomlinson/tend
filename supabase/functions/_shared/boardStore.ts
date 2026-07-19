/*
 * Server-held board snapshot storage (single-row `board` table, RLS on).
 * Shared by the `board` function (push/pull/completeTop) and the `eink`
 * renderer. Uses the new-style sb_secret key — this project has legacy JWT
 * keys disabled, so the auto-injected SUPABASE_SERVICE_ROLE_KEY 401s.
 */

const REST = () => `${Deno.env.get('SUPABASE_URL')}/rest/v1/board`;
const SERVICE_KEY = () =>
  Deno.env.get('BOARD_SERVICE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  '';

export function hasServiceKey(): boolean {
  return SERVICE_KEY().length > 0;
}

function restHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = SERVICE_KEY();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
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

export interface SnapTask {
  id: number | string;
  title: string;
  source?: string;
  area?: string;
  prio?: string;
  bucket?: string;
  due?: string;
  waiting?: string;
  waitingSince?: string;
  waitRemindDays?: number;
  note?: string;
  status?: string;
  archivedAt?: string;
  archivedIso?: string;
  /** Board sort key — the order the user arranged on the phone. */
  order?: number;
  [k: string]: unknown;
}
export interface SnapBucket {
  id: string;
  name: string;
  order?: number;
  [k: string]: unknown;
}
export interface Snapshot {
  app?: string;
  tasks?: SnapTask[];
  buckets?: SnapBucket[];
  [k: string]: unknown;
}
export interface BoardRow {
  snapshot: Snapshot;
  updated_at: string;
  device_mutated: boolean;
}

export async function loadBoardRow(): Promise<BoardRow | null> {
  const res = await rest(
    `${REST()}?id=eq.1&select=snapshot,updated_at,device_mutated`,
    { headers: restHeaders() },
  );
  if (!res.ok) throw new Error(`load ${res.status}`);
  const rows = (await res.json()) as BoardRow[];
  return rows[0] ?? null;
}

export async function saveBoardRow(
  snapshot: Snapshot,
  deviceMutated: boolean,
): Promise<string> {
  const updated_at = new Date().toISOString();
  const res = await rest(REST(), {
    method: 'POST',
    headers: restHeaders({ Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify([
      { id: 1, snapshot, updated_at, device_mutated: deviceMutated },
    ]),
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
  return updated_at;
}

/**
 * What the display's green button completes: the FIRST task in the
 * Today's Priorities bucket, in the user's own board order (Chelsea,
 * 2026-07-18). If that bucket is empty, the button is a no-op — it never
 * reaches into other buckets.
 */
export function topTask(snapshot: Snapshot): SnapTask | null {
  const today = (snapshot.tasks ?? [])
    .filter((t) => t.status === 'active' && t.bucket === 'today')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return today[0] ?? null;
}
