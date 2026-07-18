import { liveQuery } from 'dexie';
import { db } from '@/data/db';
import type { Task } from '@/data/types';
import { buildBackup } from '@/domain/backup';
import { REMOTE, apiGet, apiPost } from './api';

/*
 * Board sync with the server-held copy (the e-ink display's data source).
 *
 * - PUSH: any local change (tasks/buckets/areas/people) debounces a full
 *   snapshot POST to /board. Last-writer-wins; the phone is the editor.
 * - PULL-MERGE: the ONLY server-side mutation is the display's button C
 *   (archive top task). On launch/return, if the server copy is flagged
 *   device_mutated, tasks archived there but still active here get archived
 *   locally, then a fresh push clears the flag.
 */

interface ServerTask {
  id: number | string;
  title?: string;
  status?: string;
  archivedAt?: string;
  archivedIso?: string;
}
interface ServerBoard {
  snapshot: { tasks?: ServerTask[] } | null;
  updatedAt?: string;
  deviceMutated?: boolean;
}

/** Ids archived on the server but still active locally (the button-C diff). */
export function serverArchivedIds(
  local: Pick<Task, 'id' | 'status'>[],
  serverTasks: ServerTask[],
): (number | string)[] {
  const archivedOnServer = new Map(
    serverTasks.filter((t) => t.status === 'archived').map((t) => [String(t.id), t]),
  );
  return local
    .filter((t) => t.status === 'active' && archivedOnServer.has(String(t.id)))
    .map((t) => t.id);
}

export async function pushBoard(): Promise<boolean> {
  try {
    const snapshot = await buildBackup();
    const res = await apiPost('board', { snapshot });
    if (res.ok) {
      await db.meta.put({ key: 'lastBoardPushAt', value: Date.now() });
      return true;
    }
  } catch {
    /* offline — next change or launch retries */
  }
  return false;
}

/** Apply display-made completions locally. Returns the completed titles. */
export async function pullMergeBoard(): Promise<string[]> {
  try {
    const res = await apiGet('board');
    if (!res.ok) return [];
    const data = (await res.json()) as ServerBoard;
    if (!data.snapshot || !data.deviceMutated) return [];

    const serverTasks = data.snapshot.tasks ?? [];
    const local = await db.tasks.toArray();
    const ids = serverArchivedIds(local, serverTasks);
    const titles: string[] = [];
    for (const id of ids) {
      const st = serverTasks.find((t) => String(t.id) === String(id));
      await db.tasks.update(id, {
        status: 'archived',
        archivedAt: st?.archivedAt ?? '',
        archivedIso: st?.archivedIso ?? '',
      });
      const t = local.find((x) => String(x.id) === String(id));
      if (t) titles.push(t.title);
    }
    // Fresh push clears device_mutated (and syncs anything else local).
    await pushBoard();
    return titles;
  } catch {
    return [];
  }
}

/**
 * Start the sync loop (deployed app only): initial pull-merge + push, push on
 * every local change (debounced), pull-merge when returning to the app.
 * Returns a cleanup function.
 */
export function startBoardSync(
  onMerged: (titles: string[]) => void,
): () => void {
  if (!REMOTE) return () => {};

  let debounce: ReturnType<typeof setTimeout> | undefined;
  let first = true;

  void pullMergeBoard().then((titles) => {
    if (titles.length) onMerged(titles);
  });

  const sub = liveQuery(() =>
    Promise.all([
      db.tasks.toArray(),
      db.buckets.toArray(),
      db.areas.toArray(),
      db.people.toArray(),
    ]),
  ).subscribe({
    next: () => {
      // First emission is just the initial read; changes after that push.
      if (first) {
        first = false;
        return;
      }
      clearTimeout(debounce);
      debounce = setTimeout(() => void pushBoard(), 4000);
    },
    error: () => {},
  });

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void pullMergeBoard().then((titles) => {
        if (titles.length) onMerged(titles);
      });
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    clearTimeout(debounce);
    sub.unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
