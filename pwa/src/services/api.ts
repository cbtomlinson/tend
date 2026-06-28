/*
 * API routing + auth.
 *
 * - Local dev: VITE_API_BASE is unset → calls the Vite dev middleware at /api/*
 *   (no password needed; it's your machine).
 * - Production: VITE_API_BASE points at the Supabase functions. Every call carries
 *   the app password (x-app-password) so a stranger who finds the URL can't spend
 *   your Anthropic/Resend credits.
 */

const BASE = import.meta.env.VITE_API_BASE as string | undefined;

/** True when talking to the deployed Supabase functions (password required). */
export const REMOTE = Boolean(BASE);

const PW_KEY = 'tend.auth.pw';

export function getPassword(): string {
  try {
    return localStorage.getItem(PW_KEY) ?? '';
  } catch {
    return '';
  }
}
export function setPassword(v: string): void {
  try {
    localStorage.setItem(PW_KEY, v);
  } catch {
    /* ignore */
  }
}
export function clearPassword(): void {
  try {
    localStorage.removeItem(PW_KEY);
  } catch {
    /* ignore */
  }
}

let onAuthFail: (() => void) | null = null;
/** Register a handler invoked when the server rejects the password (401). */
export function setAuthFailHandler(fn: () => void): void {
  onAuthFail = fn;
}

export type ApiEndpoint = 'vision' | 'email';

export async function apiPost(
  endpoint: ApiEndpoint,
  body: unknown,
): Promise<Response> {
  const url = BASE ? `${BASE}/${endpoint}` : `/api/${endpoint}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (REMOTE) headers['x-app-password'] = getPassword();

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    // Wrong/expired password — force re-login.
    clearPassword();
    onAuthFail?.();
  }
  return res;
}
