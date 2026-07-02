import { Resend } from 'npm:resend@4.8.0';
import { authorized, json, preflight } from '../_shared/http.ts';

/*
 * Email Edge Function (Resend). Sends the rendered board to the user's inbox,
 * and optionally a Send-to-Kindle copy as an HTML attachment Kindle converts.
 * Recipient addresses + the Resend key are secrets, never in the client.
 */

function toBase64(html: string): string {
  // UTF-8 safe base64 for the Kindle attachment.
  return btoa(unescape(encodeURIComponent(html)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!authorized(req)) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const to = Deno.env.get('EMAIL_TO');
  if (!apiKey || !to) return json({ error: 'not_configured' }, 503);

  const from = Deno.env.get('EMAIL_FROM') || 'Tend <onboarding@resend.dev>';
  const kindleTo = Deno.env.get('KINDLE_TO') || '';

  try {
    const { subject, html, text, toKindle, backupJson, backupFilename } =
      await req.json();
    const resend = new Resend(apiKey);

    // Optional board-backup attachment (a JSON restore file, ≤2 MB).
    const attachments =
      typeof backupJson === 'string' && backupJson.length < 2_000_000
        ? [
            {
              filename:
                typeof backupFilename === 'string' && backupFilename
                  ? backupFilename
                  : 'tend-backup.json',
              content: toBase64(backupJson),
            },
          ]
        : undefined;

    const inbox = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      attachments,
    });
    if (inbox.error) {
      return json({ ok: false, message: `Send failed: ${inbox.error.message}` });
    }

    if (toKindle && kindleTo) {
      const kindle = await resend.emails.send({
        from,
        to: kindleTo,
        subject: 'Tend board',
        text: 'Your Tend board is attached.',
        attachments: [{ filename: 'tend-board.html', content: toBase64(html) }],
      });
      if (kindle.error) {
        return json({
          ok: true,
          message: `Sent to inbox · Kindle failed: ${kindle.error.message}`,
        });
      }
      return json({ ok: true, message: 'Sent to inbox + Kindle' });
    }

    return json({ ok: true, message: `Sent to ${to}` });
  } catch (err) {
    console.error('[email]', (err as Error).message);
    return json({ ok: false, message: 'Send failed' }, 502);
  }
});
