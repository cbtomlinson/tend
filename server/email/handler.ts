import { Resend } from 'resend';

/*
 * Email handler (Resend). Secrets/addresses live in the environment and are passed
 * in by the caller — they never reach the browser. The board content emailed here
 * is the user's own data, sent to the user's own inbox (and optionally their
 * Kindle). Framework-agnostic so it backs both the local dev proxy and a future
 * serverless function.
 */

export interface SendArgs {
  apiKey: string;
  from: string;
  to: string;
  /** Optional @kindle.com address for the Send-to-Kindle copy. */
  kindleTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Also deliver a Send-to-Kindle copy (as an HTML attachment Kindle converts). */
  toKindle?: boolean;
}

export interface SendResult {
  ok: boolean;
  message: string;
}

export async function sendBoardEmail(args: SendArgs): Promise<SendResult> {
  const { apiKey, from, to, kindleTo, subject, html, text, toKindle } = args;
  const resend = new Resend(apiKey);

  // 1. The board, to your inbox.
  const inbox = await resend.emails.send({ from, to, subject, html, text });
  if (inbox.error) {
    return { ok: false, message: `Send failed: ${inbox.error.message}` };
  }

  // 2. Optional Send-to-Kindle copy — Kindle converts an attached HTML document.
  if (toKindle && kindleTo) {
    const kindle = await resend.emails.send({
      from,
      to: kindleTo,
      subject: 'Tend board',
      text: 'Your Tend board is attached.',
      attachments: [
        {
          filename: 'tend-board.html',
          content: Buffer.from(html).toString('base64'),
        },
      ],
    });
    if (kindle.error) {
      return { ok: true, message: `Sent to inbox · Kindle failed: ${kindle.error.message}` };
    }
    return { ok: true, message: 'Sent to inbox + Kindle' };
  }

  return { ok: true, message: `Sent to ${to}` };
}
