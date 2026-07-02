import { useState } from 'react';
import { addArea } from '@/data/store';
import { useUI } from '@/app/uiState';
import s from './NewBucketModal.module.css';

export function NewAreaModal() {
  const { closeOverlay, flash } = useUI();
  const [name, setName] = useState('');

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      closeOverlay();
      return;
    }
    const ok = await addArea(trimmed);
    closeOverlay();
    flash(ok ? 'Area added — scans can now assign it' : 'That area already exists');
  };

  return (
    <div className={s.scrim} onClick={closeOverlay}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.title}>New area</div>
        <input
          className={s.input}
          value={name}
          autoFocus
          placeholder="e.g. Cadence, MyChart…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirm()}
        />
        <div className={s.actions}>
          <button type="button" className={s.cancel} onClick={closeOverlay}>
            Cancel
          </button>
          <button type="button" className={s.add} onClick={confirm}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
