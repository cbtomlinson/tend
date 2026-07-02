/* Shared HTTP helpers for the Edge Functions (Deno runtime). */

/*
 * CORS: only the deployed app origin may call these from a browser. (curl/native
 * clients aren't governed by CORS — the password gate below covers those.)
 */
const ALLOWED_ORIGIN = 'https://tend.littletomato.dev';

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-password',
  Vary: 'Origin',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: CORS });
}

/* ------------------------------------------------------------------ */
/* Password gate                                                       */
/* ------------------------------------------------------------------ */

/**
 * Brute-force damper: track FAILED attempts per client IP (in-memory, per
 * isolate — resets on cold start, which is fine: it only needs to make
 * guessing impractical, not be a perfect ledger). 8 failures in 10 minutes
 * locks that IP out until the window rolls; correct logins are never counted.
 */
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 8;
const failures = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  );
}

function recentFailures(ip: string): number[] {
  const now = Date.now();
  const kept = (failures.get(ip) ?? []).filter((t) => now - t < FAIL_WINDOW_MS);
  failures.set(ip, kept);
  return kept;
}

/** Constant-time string comparison via SHA-256 digests (length-independent). */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/**
 * App password gate — keeps strangers who find the public function URL from
 * spending the user's Anthropic/Resend credits. The client sends the passphrase
 * in `x-app-password`; we compare to the APP_PASSWORD secret. If APP_PASSWORD is
 * unset, the gate is open (configure it to lock things down).
 *
 * Returns a Response to short-circuit with (401 wrong password / 429 too many
 * failures), or null when the request is authorized.
 */
export async function gate(req: Request): Promise<Response | null> {
  const expected = Deno.env.get('APP_PASSWORD') ?? '';
  if (!expected) return null;

  const ip = clientIp(req);
  if (recentFailures(ip).length >= FAIL_LIMIT) {
    return json({ error: 'too_many_attempts' }, 429);
  }

  const got = req.headers.get('x-app-password') ?? '';
  if (got.length > 0 && (await safeEqual(got, expected))) return null;

  recentFailures(ip).push(Date.now());
  failures.set(ip, recentFailures(ip));
  return json({ error: 'unauthorized' }, 401);
}
