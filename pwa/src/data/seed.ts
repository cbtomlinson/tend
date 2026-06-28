import type { Bucket, Task } from './types';

/*
 * Starter/demo data shown on a fresh install (empty store). Generic on purpose —
 * no real names or site specifics ship in the (public) repo. Real tasks come in
 * via capture and live only on the device.
 */

export const SEED_NEXT_ID = 50;

export const SEED_BUCKETS: Bucket[] = [
  { id: 'active', name: 'Actively Working', fixed: true, order: 0 },
  { id: 'waiting', name: 'Waiting On', fixed: true, order: 1 },
  { id: 'later', name: 'Later', fixed: true, order: 2 },
];

type SeedPatch = Partial<Task>;

function mk(
  id: number,
  title: string,
  source: Task['source'],
  area: Task['area'],
  prio: Task['prio'],
  bucket: string,
  order: number,
  extra: SeedPatch = {},
): Task {
  return {
    id,
    title,
    source,
    area,
    prio,
    bucket,
    order,
    due: '',
    dueUrgency: '',
    note: '',
    ref: '',
    waiting: '',
    inSources: [source],
    added: '',
    status: 'active',
    archivedAt: '',
    ...extra,
  };
}

export const SEED_TASKS: Task[] = [
  mk(1, 'Build IRF-PAI flowsheet', 'Epic SLG', 'IRF', 'High', 'active', 0, {
    due: 'Due Jun 30',
    dueUrgency: 'normal',
    note: 'Confirm GG items.',
    ref: 'SLG-4821',
    inSources: ['Epic SLG', 'To Do'],
    added: '5d',
  }),
  mk(2, 'OP eval template update', 'Zoho', 'OP Rehab', 'Med', 'active', 1, {
    added: '2d',
  }),
  mk(3, 'Therapy charge reconciliation', 'To Do', 'Acute Rehab', 'High', 'active', 2, {
    due: 'Due today',
    dueUrgency: 'soon',
    added: '1d',
  }),
  mk(4, 'Cosign routing fix', 'Epic SLG', 'ClinDoc', 'Med', 'active', 3, {
    note: 'Rover cosign flow.',
    ref: 'SLG-4790',
    added: '3d',
  }),
  mk(5, 'Outpatient scheduling ticket', 'Zoho', 'OP Rehab', 'Med', 'waiting', 4, {
    waiting: 'Epic TS',
    added: '4d',
  }),
  mk(6, 'Rover smartphrase access', 'Epic SLG', 'ClinDoc', 'Low', 'waiting', 5, {
    waiting: 'Epic TS',
    ref: 'SLG-4655',
    added: '6d',
  }),
  mk(7, 'Swing bed build sign-off', 'Zoho', 'Acute Rehab', 'Low', 'waiting', 6, {
    waiting: 'Cadence team',
    added: '7d',
  }),
  mk(8, 'FIM to GG mapping review', 'Hand', 'IRF', 'Low', 'later', 7, { added: '4d' }),
  mk(9, 'Smartphrase cleanup', 'Zoho', 'ClinDoc', 'Low', 'later', 8, { added: '8d' }),
  mk(10, 'GPU note template', 'Hand', 'ClinDoc', 'Low', 'later', 9, { added: '9d' }),
  mk(11, 'Weekly meeting follow-ups', 'Hand', 'OP Rehab', 'Low', 'later', 10, {
    added: '1d',
  }),
  // Archived (seed the Archive view).
  mk(20, '2FA reset batch (Rover)', 'Epic SLG', 'ClinDoc', 'Med', 'active', 11, {
    status: 'archived',
    archivedAt: 'Jun 25',
  }),
  mk(21, 'Swing bed order set', 'Zoho', 'Acute Rehab', 'Low', 'later', 12, {
    status: 'archived',
    archivedAt: 'Jun 24',
  }),
];
