import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import {
  extractFromImage,
  type ImageMediaType,
} from '../server/vision/handler';
import { sendBoardEmail } from '../server/email/handler';

/*
 * Dev-only vision proxy. Holds the ANTHROPIC_API_KEY server-side (Node) and
 * exposes POST /api/vision to the browser. The browser sends the captured image
 * (base64, in memory); this proxy forwards it to the vision model and returns
 * only the extracted text. The image is never written to disk or logged here.
 *
 * In production this same handler lives behind a serverless function (/server).
 */
function visionProxy(apiKey: string, model: string, peopleJson: string): Plugin {
  return {
    name: 'tend-vision-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/vision', (req, res, next) => {
        if (req.method !== 'POST') return next();
        if (!apiKey) {
          res.statusCode = 503;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'not_configured' }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c as Buffer));
        req.on('end', async () => {
          try {
            const { imageBase64, mediaType, areas, people } = JSON.parse(
              Buffer.concat(chunks).toString('utf8'),
            ) as {
              imageBase64: string;
              mediaType: ImageMediaType;
              areas?: unknown;
              people?: unknown;
            };
            const extraction = await extractFromImage({
              imageBase64,
              mediaType,
              apiKey,
              model,
              peopleJson,
              areas,
              people,
            });
            // imageBase64 goes out of scope here — nothing is persisted.
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(extraction));
          } catch (err) {
            // Log the error only — never the image payload.
            console.error('[vision] extraction failed:', (err as Error).message);
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'extraction_failed' }));
          }
        });
      });
    },
  };
}

interface EmailConfig {
  apiKey: string;
  from: string;
  to: string;
  kindleTo: string;
}

// Dev-only email proxy. Holds the Resend key + recipient addresses server-side
// and exposes POST /api/email. The browser sends the rendered board; this proxy
// performs the actual Resend send.
function emailProxy(cfg: EmailConfig): Plugin {
  return {
    name: 'tend-email-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/email', (req, res, next) => {
        if (req.method !== 'POST') return next();
        if (!cfg.apiKey || !cfg.to) {
          res.statusCode = 503;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'not_configured' }));
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c as Buffer));
        req.on('end', async () => {
          try {
            const { subject, html, text, toKindle, backupJson, backupFilename } =
              JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
                subject: string;
                html: string;
                text: string;
                toKindle: boolean;
                backupJson?: string;
                backupFilename?: string;
              };
            const result = await sendBoardEmail({
              apiKey: cfg.apiKey,
              from: cfg.from,
              to: cfg.to,
              kindleTo: cfg.kindleTo || undefined,
              subject,
              html,
              text,
              toKindle,
              backupJson,
              backupFilename,
            });
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('[email] send failed:', (err as Error).message);
            res.statusCode = 502;
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ error: 'send_failed' }));
          }
        });
      });
    },
  };
}

// Tend PWA — installable, offline-capable, phone-first.
// The service worker caches the app shell + assets only; it never caches or
// stores task/PHI data.
export default defineConfig(({ mode }) => {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, dir, '');
  const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '';
  // Optional: override the vision model (e.g. claude-sonnet-4-6). Defaults to Opus 4.8.
  const visionModel = env.VISION_MODEL || process.env.VISION_MODEL || '';
  // People → area knowledge (real names) live in a secret, never in the repo.
  const peopleJson = env.PEOPLE_JSON || process.env.PEOPLE_JSON || '';

  const email: EmailConfig = {
    apiKey: env.RESEND_API_KEY || process.env.RESEND_API_KEY || '',
    from: env.EMAIL_FROM || process.env.EMAIL_FROM || 'Tend <onboarding@resend.dev>',
    to: env.EMAIL_TO || process.env.EMAIL_TO || '',
    kindleTo: env.KINDLE_TO || process.env.KINDLE_TO || '',
  };

  return {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      react(),
      visionProxy(apiKey, visionModel, peopleJson),
      emailProxy(email),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Tend',
          short_name: 'Tend',
          description: 'Personal task consolidation — capture, reconcile, focus.',
          theme_color: '#3f74a6',
          background_color: '#fbfcfd',
          display: 'standalone',
          orientation: 'portrait',
          // TODO: add raster 192/512 + maskable PNGs for best install fidelity.
          // SVG works for install meanwhile and keeps everything self-hosted.
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
        },
      }),
    ],
    server: {
      port: 5173,
    },
  };
});
