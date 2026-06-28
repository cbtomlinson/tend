import type { ReactNode } from 'react';
import s from './BottomSheet.module.css';

interface Props {
  onClose: () => void;
  children: ReactNode;
}

/** Slide-up bottom sheet with scrim + grab handle (detail, email). */
export function BottomSheet({ onClose, children }: Props) {
  return (
    <div className={s.scrim} onClick={onClose}>
      <div className={s.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={s.handle} />
        {children}
      </div>
    </div>
  );
}
