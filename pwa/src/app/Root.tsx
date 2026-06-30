import { useEffect, useState } from 'react';
import {
  REMOTE,
  clearPassword,
  getPassword,
  setAuthFailHandler,
  setPassword,
  verifyPassword,
} from '@/services/api';
import { App } from './App';
import { LoginGate } from './LoginGate';

/**
 * Top-level gate.
 * - Local dev (REMOTE=false): straight to the app, no password.
 * - Deployed: the app only renders after the password is verified against the
 *   server. A stored password is re-checked on launch (so a stale/wrong one
 *   can't skip the gate), and a 401 mid-session re-locks.
 */
export function Root() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'app'>(
    REMOTE ? 'checking' : 'app',
  );

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
      if (ok) {
        setPhase('app');
      } else {
        clearPassword();
        setPhase('login');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (phase === 'checking') return null;
  if (phase === 'login') {
    return (
      <LoginGate
        onUnlock={(pw) => {
          setPassword(pw);
          setPhase('app');
        }}
      />
    );
  }
  return <App />;
}
