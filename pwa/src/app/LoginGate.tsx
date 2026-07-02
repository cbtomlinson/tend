import { useState } from 'react';
import { verifyPassword } from '@/services/api';
import s from './LoginGate.module.css';

interface Props {
  /** Called only after the password is verified against the server. */
  onUnlock: (password: string) => void;
}

/** Password screen shown only in the deployed app (protects the API + your board). */
export function LoginGate({ onUnlock }: Props) {
  const [pw, setPw] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const v = pw.trim();
    if (!v || checking) return;
    setChecking(true);
    setError('');
    const ok = await verifyPassword(v);
    setChecking(false);
    if (ok) onUnlock(v);
    else setError('Incorrect password');
  };

  return (
    <div className={s.wrap}>
      <div className={s.card}>
        <div className={s.mark}>Tend</div>
        <div className={s.sub}>Enter your access password to continue.</div>
        <div className={s.error}>{error}</div>
        <input
          className={s.input}
          type="password"
          value={pw}
          autoFocus
          placeholder="Password"
          autoComplete="current-password"
          disabled={checking}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button
          type="button"
          className={s.button}
          disabled={checking}
          onClick={submit}
        >
          {checking ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    </div>
  );
}
