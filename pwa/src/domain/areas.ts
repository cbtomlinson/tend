import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Area, AreaDef } from '@/data/types';

/*
 * Areas are user-manageable (stored in the `areas` table) since v2.
 * The five seeded areas keep their original token colors; custom areas cycle
 * through the c5–c9 palette in tokens.css.
 */

/** The seeded areas (can't be deleted). Color indexes 0–4 map below. */
export const DEFAULT_AREAS: AreaDef[] = [
  { name: 'ClinDoc', fixed: true, order: 0, color: 0 },
  { name: 'OP Rehab', fixed: true, order: 1, color: 1 },
  { name: 'Acute Rehab', fixed: true, order: 2, color: 2 },
  { name: 'IRF', fixed: true, order: 3, color: 3 },
  { name: 'Rover', fixed: true, order: 4, color: 4 },
];

/** Color index -> CSS custom-property suffix in tokens.css. */
const COLOR_VAR = [
  'clindoc',
  'oprehab',
  'acuterehab',
  'irf',
  'rover',
  'c5',
  'c6',
  'c7',
  'c8',
  'c9',
];

export const AREA_PALETTE_SIZE = COLOR_VAR.length;

/*
 * Module-level color cache kept fresh by a Dexie live query, so areaBgVar /
 * areaTextVar stay synchronous (they're called from many render paths).
 * Renders that add areas re-run via useAreas(), which re-reads the cache.
 */
const colorOf = new Map<string, number>(DEFAULT_AREAS.map((a) => [a.name, a.color]));
liveQuery(() => db.areas.toArray()).subscribe({
  next: (defs) => {
    for (const d of defs) colorOf.set(d.name, d.color);
  },
  error: () => {},
});

function varSuffix(area: Area): string {
  return COLOR_VAR[(colorOf.get(area) ?? 9) % COLOR_VAR.length];
}

export function areaBgVar(area: Area): string {
  return `var(--area-${varSuffix(area)}-bg)`;
}

export function areaTextVar(area: Area): string {
  return `var(--area-${varSuffix(area)}-text)`;
}

/** Live list of area definitions, seeded-first order. */
export function useAreas(): AreaDef[] {
  return (
    useLiveQuery(() => db.areas.orderBy('order').toArray(), [], DEFAULT_AREAS) ??
    DEFAULT_AREAS
  );
}

/** Cycle to the next area — used by the capture review chip. */
export function nextArea(area: Area, names: string[]): Area {
  if (!names.length) return area;
  const i = names.indexOf(area);
  return names[(i + 1) % names.length];
}
