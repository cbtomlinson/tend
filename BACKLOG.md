# Tend — Backlog

Lightweight list of things to revisit. Not urgent; the app is deployed and working.
Newest ideas go under **Ideas / Someday**. When something's picked up, move it to
**In progress**; when shipped, move it to **Done** with the date.

---

## Ideas / Someday

- **GitHub Actions auto-deploy.** Right now the site is built and pushed to the
  `gh-pages` branch manually. A CI workflow would rebuild automatically on every
  change to `main`. Blocked only by the `gh` token lacking the `workflow` scope —
  a one-time GitHub settings tweak unlocks it. Low priority (manual deploy works).
- **E-ink version.** Original long-term goal: phone-first now, a low-refresh
  e-ink layout later. Future phase, not started.

## In progress

- **Complete a task without opening it.** Need a one-tap "done" affordance on the
  card itself (check circle + Undo is the leading candidate). Awaiting decision.
- **API usage / cost visibility + model choice.** Show real per-scan token/cost,
  and/or an in-app model selector (Opus / Sonnet / Haiku) to test handwriting
  accuracy vs. cost. Vision fn already honors a `VISION_MODEL` env var. Awaiting
  decision on scope.

## Done

- 2026-06-30 — Punch list #2: "Today" → "Today's Priorities" (with migration),
  added **Rover** area, "Done" button → "Accept Changes", drag no longer selects
  card text, and the board auto-scrolls when you drag near the top/bottom edge.
- 2026-06-30 — Moved built site off `main` to the `gh-pages` branch so the
  Synology-synced folder is source-only (fixes the recurring "Stale NFS file
  handle" git wedge).
- 2026-06-29/30 — Punch list: High-priority styling stands out (red), Today
  bucket at top, reorderable buckets, text fields no longer zoom on focus (iOS),
  note shows on card when present, "Done" button so editing a task no longer
  risks accidentally completing it.
- 2026-06-29 — Initial deploy: live at tend.littletomato.dev (GitHub Pages +
  Supabase Edge Functions), password gate, mobile safe-area insets, reliable
  email delivery (Gmail + Kindle).
