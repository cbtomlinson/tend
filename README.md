# Tend

Personal task-consolidation app for one user — a phone-first **PWA** plus a 7.5″
**e-ink** dashboard. Captures tasks from four disconnected lists by photographing
them, consolidates into a draggable board, and mirrors a read-only view to a
reTerminal e-ink panel.

> Deployment notes in [`DEPLOY.md`](DEPLOY.md). Real task data stays on-device;
> secrets live server-side (Supabase) — never in this repo.

## Non-negotiables

- **PHI:** the capture image is processed **in memory only and never stored** —
  not on disk, IndexedDB, localStorage, server, logs, or analytics. Only the
  extracted text persists, locally. See [`pwa/src/services/vision.ts`](pwa/src/services/vision.ts).
- **Local-first:** tasks/buckets live on-device (IndexedDB via Dexie). No cloud sync.
- **Secrets server-side only:** Resend + vision keys never ship in client code.

## Structure

```
pwa/                     React + Vite + vite-plugin-pwa (installable, offline)
  src/
    app/                 shell, routing, ephemeral UI state
    board/               board, drag-and-drop, task card, new-bucket modal
    capture/             capture → scanning → reconcile overlay
    detail/              task detail bottom sheet
    email/               email sheet + format previews
    eink/                e-ink Display preview (1-bit B/W)
    archive/             completed tasks + restore
    data/                Dexie schema, types, seed, mutations
    domain/              dedupe (glossary), reconcile, sources, areas, email/eink builders
    services/            external boundaries (vision, email)
    components/          shared tags, sheet, icons
    design/             tokens.css + global.css (CSS Modules + tokens)
server/                 request handlers for the vision + email functions
supabase/               Supabase edge functions (deploy target for server/) — WIP
firmware/               reTerminal E1001 firmware — not built yet
.github/workflows/      builds the PWA and deploys to GitHub Pages
```

## Run

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build + service worker
npm run typecheck
```

## Status

Built & verified: board + drag-and-drop, capture → reconcile → dedupe, task
detail, email previews, e-ink Display, archive.

**Vision/OCR is wired** (Anthropic Claude vision, `claude-opus-4-8`) behind a
server-side proxy: the browser sends the captured image to `/api/vision` (a Vite
dev middleware in `vite.config.ts` using `server/vision/handler.ts`); the key
lives in `pwa/.env` (gitignored, `ANTHROPIC_API_KEY`) and never reaches the
client. The image is processed in memory and never stored or logged. Without a
key the proxy returns 503 and the app falls back to clearly-labeled sample data,
so the reconcile flow stays demoable. To enable: copy `pwa/.env.example` →
`pwa/.env` and add your key.

Still stubbed (pending approval): **Resend** email and the **e-ink render**
endpoint.
