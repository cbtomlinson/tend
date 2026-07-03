import { useEffect, useState } from 'react';
import { ScanFace } from 'lucide-react';
import {
  REMOTE,
  clearPassword,
  getPassword,
  setAuthFailHandler,
  setPassword,
  verifyPassword,
} from '@/services/api';
import {
  bioAvailable,
  bioEnabled,
  biometricUnlock,
  enrollBiometric,
} from '@/services/biometric';
import { App } from './App';
import { LoginGate } from './LoginGate';
import s from './LoginGate.module.css';

/**
 * Top-level gate.
 * - Local dev (REMOTE=false): straight to the app, no password.
 * - Deployed: password verified against the server. With Face ID enrolled,
 *   every launch additionally requires a successful Face ID before the app
 *   opens (a stored password alone no longer auto-unlocks).
 * - After a fresh password login on a capable device, offer Face ID once.
 */
export function Root() {
  const [phase, setPhase] = useState<
    'checking' | 'login' | 'bio' | 'offerbio' | 'app'
  >(REMOTE ? 'checking' : 'app');
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    setAuthFailHandler(() => setPhase('login'));
    if (!REMOTE) return;
    const stored = getPassword();
    if (!stored) {
      setPhase('login');
      return;
    }
    let active = true;
    verifyPassword(stored).then((ok) => {
      if (!active) return;
      if (!ok) {
        clearPassword();
        setPhase('login');
      } else if (bioEnabled()) {
        setPhase('bio'); // password is good — still ask the face
      } else {
        setPhase('app');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const tryFace = async () => {
    if (bioBusy) return;
    setBioBusy(true);
    const ok = await biometricUnlock();
    setBioBusy(false);
    if (ok) setPhase('app');
  };

  const onUnlock = async (pw: string) => {
    setPassword(pw);
    // First password login on a Face ID-capable device: offer to enroll.
    if (!bioEnabled() && (await bioAvailable())) setPhase('offerbio');
    else setPhase('app');
  };

  if (phase === 'checking') return null;
  if (phase === 'login') return <LoginGate onUnlock={onUnlock} />;

  if (phase === 'bio') {
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <div className={s.mark}>Tend</div>
          <div className={s.sub}>Unlock with Face ID.</div>
          <button type="button" className={s.button} onClick={tryFace}>
            <ScanFace size={18} style={{ marginRight: 8 }} />
            {bioBusy ? 'Checking…' : 'Unlock'}
          </button>
          <button
            type="button"
            className={s.linkBtn}
            onClick={() => {
              clearPassword();
              setPhase('login');
            }}
          >
            Use password instead
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'offerbio') {
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <div className={s.mark}>Tend</div>
          <div className={s.sub}>
            Unlock with Face ID next time? Your password stays as the backup.
          </div>
          <button
            type="button"
            className={s.button}
            onClick={async () => {
              await enrollBiometric(); // declining the sheet just skips enrollment
              setPhase('app');
            }}
          >
            <ScanFace size={18} style={{ marginRight: 8 }} />
            Enable Face ID
          </button>
          <button
            type="button"
            className={s.linkBtn}
            onClick={() => setPhase('app')}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  return <App />;
}
