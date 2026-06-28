/* Shared HTTP helpers for the Edge Functions (Deno runtime). */

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-app-password',
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

/**
 * App password gate — keeps strangers who find the public function URL from
 * spending the user's Anthropic/Resend credits. The client sends the passphrase
 * in `x-app-password`; we compare to the APP_PASSWORD secret. If APP_PASSWORD is
 * unset, the gate is open (configure it to lock things down).
 */
export function authorized(req: Request): boolean {
  const expected = Deno.env.get('APP_PASSWORD') ?? '';
  if (!expected) return true;
  const got = req.headers.get('x-app-password') ?? '';
  return got.length > 0 && got === expected;
}
