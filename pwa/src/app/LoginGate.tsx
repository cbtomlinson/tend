import { useState } from 'react';
import s from './LoginGate.module.css';

interface Props {
  error?: string;
  onSubmit: (password: string) => void;
}

/** Password screen shown only in the deployed app (protects the API keys). */
export function LoginGate({ error, onSubmit }: Props) {
  const [pw, setPw] = useState('');

  const submit = () => {
    const v = pw.trim();
    if (v) onSubmit(v);
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
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button type="button" className={s.button} onClick={submit}>
          Unlock
        </button>
      </div>
    </div>
  );
}
