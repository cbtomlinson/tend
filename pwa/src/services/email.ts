/*
 * Email service boundary (Resend).
 *
 * The board is rendered to HTML/text on the client (it lives in IndexedDB), then
 * POSTed to the /api/email proxy, which holds the Resend key and recipient
 * addresses server-side and does the actual send. The key never reaches the
 * browser. Without configuration the proxy returns 503 and we say so.
 */

export interface SendArgs {
  subject: string;
  html: string;
  text: string;
  toKindle: boolean;
}
export interface SendResult {
  ok: boolean;
  message: string;
}

export async function sendBoardEmail(args: SendArgs): Promise<SendResult> {
  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });

  if (res.status === 503) {
    return { ok: false, message: 'Email not set up yet — use “Set Email Settings”' };
  }
  if (!res.ok) {
    return { ok: false, message: 'Send failed — try again' };
  }
  const data = (await res.json()) as { message?: string };
  return { ok: true, message: data.message ?? 'Sent' };
}
