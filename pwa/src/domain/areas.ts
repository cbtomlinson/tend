import type { Area } from '@/data/types';

export const ALL_AREAS: Area[] = ['ClinDoc', 'OP Rehab', 'Acute Rehab', 'IRF', 'Rover'];

/** Maps Area -> the CSS custom-property suffix used in tokens.css. */
const AREA_VAR: Record<Area, string> = {
  ClinDoc: 'clindoc',
  'OP Rehab': 'oprehab',
  'Acute Rehab': 'acuterehab',
  IRF: 'irf',
  Rover: 'rover',
};

export function areaBgVar(area: Area): string {
  return `var(--area-${AREA_VAR[area]}-bg)`;
}

export function areaTextVar(area: Area): string {
  return `var(--area-${AREA_VAR[area]}-text)`;
}

/** Cycle to the next area — used by the capture review chip. */
export function nextArea(area: Area): Area {
  const i = ALL_AREAS.indexOf(area);
  return ALL_AREAS[(i + 1) % ALL_AREAS.length];
}
