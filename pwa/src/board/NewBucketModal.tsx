import { useState } from 'react';
import { addBucket } from '@/data/store';
import { useUI } from '@/app/uiState';
import s from './NewBucketModal.module.css';

export function NewBucketModal() {
  const { closeOverlay, flash } = useUI();
  const [name, setName] = useState('');

  const confirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      closeOverlay();
      return;
    }
    const ok = await addBucket(trimmed);
    closeOverlay();
    flash(ok ? 'Bucket added' : 'That bucket already exists');
  };

  return (
    <div className={s.scrim} onClick={closeOverlay}>
      <div className={s.modal} onClick={(e) => e.stopPropagation()}>
        <div className={s.title}>New bucket</div>
        <input
          className={s.input}
          value={name}
          autoFocus
          placeholder="e.g. This week, Blocked…"
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
