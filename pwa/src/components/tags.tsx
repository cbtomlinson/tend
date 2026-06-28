import type { Area, DueUrgency, Prio, Source } from '@/data/types';
import { areaBgVar, areaTextVar } from '@/domain/areas';
import { SourceIcon } from './SourceIcon';
import s from './tags.module.css';

export function SourceTag({ source }: { source: Source }) {
  return (
    <span className={s.sourceTag}>
      <SourceIcon source={source} />
      {source}
    </span>
  );
}

export function AreaTag({ area }: { area: Area }) {
  return (
    <span
      className={s.areaTag}
      style={{ background: areaBgVar(area), color: areaTextVar(area) }}
    >
      {area}
    </span>
  );
}

const DUE_VARS: Record<Exclude<DueUrgency, ''>, [string, string, string]> = {
  overdue: ['--due-overdue-bg', '--due-overdue-text', '--due-overdue-border'],
  soon: ['--due-soon-bg', '--due-soon-text', '--due-soon-border'],
  normal: ['--due-normal-bg', '--due-normal-text', '--due-normal-border'],
};

export function DueChip({ label, urgency }: { label: string; urgency: DueUrgency }) {
  const [bg, text, border] = DUE_VARS[urgency || 'normal'];
  return (
    <span
      className={s.dueChip}
      style={{
        background: `var(${bg})`,
        color: `var(${text})`,
        borderColor: `var(${border})`,
      }}
    >
      <span className={s.dueDot} />
      {label}
    </span>
  );
}

export function Waiting({ name }: { name: string }) {
  const first = name.split(' ')[0];
  return <span className={s.waiting}>→ {first}</span>;
}

const DOT_CLASS: Record<Prio, string> = {
  High: s.dotHigh,
  Med: s.dotMed,
  Low: s.dotLow,
};

export function PriorityMark({ prio }: { prio: Prio }) {
  return (
    <span className={s.prio}>
      <span className={`${s.dot} ${DOT_CLASS[prio]}`} />
      {prio[0]}
    </span>
  );
}
