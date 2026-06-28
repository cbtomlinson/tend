import { useEffect, useState } from 'react';
import {
  REMOTE,
  getPassword,
  setPassword,
  setAuthFailHandler,
} from '@/services/api';
import { App } from './App';
import { LoginGate } from './LoginGate';

/**
 * Top-level gate. In local dev (REMOTE=false) it's a passthrough to the app.
 * In the deployed app it shows a password screen until the right password is
 * entered; a 401 from the server re-locks it.
 */
export function Root() {
  const [locked, setLocked] = useState(REMOTE && !getPassword());
  const [error, setError] = useState('');

  useEffect(() => {
    setAuthFailHandler(() => {
      setError('Incorrect password — try again.');
      setLocked(true);
    });
  }, []);

  if (REMOTE && locked) {
    return (
      <LoginGate
        error={error}
        onSubmit={(pw) => {
          setPassword(pw);
          setError('');
          setLocked(false);
        }}
      />
    );
  }
  return <App />;
}
