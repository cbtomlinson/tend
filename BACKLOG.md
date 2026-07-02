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

- _(nothing right now)_

## Done

- 2026-07-01 — **Full security + bug review.** Fixed: password gate now
  timing-safe with per-IP rate limiting (8 fails/10 min → 429); CORS locked to
  tend.littletomato.dev (was `*`); vision endpoint rejects missing/oversized
  (>5 MB) images and unknown media types before spending tokens; area/people
  names stripped of control chars before entering the AI prompt; backup files
  validated field-by-field before restore; bucket add uses max-order+1 (delete
  → add could collide orders and break reordering) + duplicate-name guard;
  auto-backup email body no longer stale on the visibility trigger;
  verifyPassword only accepts a real 200 (429 no longer unlocks); login field
  autocompletes from the password manager. Repo hygiene verified clean (no
  secrets tracked). Recommendations list delivered in chat.
- 2026-07-01 — **Data-loss protection** (after tasks vanished on device):
  `navigator.storage.persist()` at boot; red "your saved tasks are missing"
  banner when the DB comes up empty on a device that had tasks (localStorage
  sentinel); **auto backup email daily, anchored to 5 pm** (sends on first
  open/return after 5 pm, catches up next open; JSON restore file attached,
  deployed app only) + "Back up now" / "Restore" in the Email sheet. Also
  renamed the new-name "One-off" button to **"No thanks"** (session-only skip —
  it can ask again next scan). Note: OS storage eviction gives no advance
  warning, so the strategy is prevent (persist) + detect (banner) + recover
  (backups), not predict.
- 2026-07-01 — Punch list #3: **custom areas** (+ chip to add, trash in "By area"
  view to delete; scans auto-assign them), **waiting-too-long flags** (amber card
  edge + "waiting Nd" chip after 7d, per-task threshold stepper in the detail
  sheet, "Waiting too long" section atop board emails), **PHI soft banner** on
  capture review (advisory only; photo still never stored), and **scan learns
  new people** ("Who is X?" cards on review → pick an area or One-off; stored
  on-device, sent with each scan alongside the server PEOPLE_JSON).
- 2026-07-01 — **Vision model switched to Sonnet** (`VISION_MODEL=claude-sonnet-4-6`
  Supabase secret). 4-note bake-off: Sonnet matched Opus on every note at ~1/10
  the cost (~$0.01 vs ~$0.11/scan); Haiku misread something on all 4 (2024→2026,
  ZFA→2FA, Pediatric→Biometric) — disqualified. Revert = set the secret back to
  `claude-opus-4-8`. Bake-off harness: scratchpad `bakeoff.mjs` (session temp).
- 2026-07-01 — One-tap complete: check circle on every card + "Undo" toast
  (5s). Also tightened area filter chips so all six (incl. Rover) fit on one line.
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
