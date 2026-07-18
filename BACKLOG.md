# Tend — Backlog

Lightweight list of things to revisit. Not urgent; the app is deployed and working.
Newest ideas go under **Ideas / Someday**. When something's picked up, move it to
**In progress**; when shipped, move it to **Done** with the date.

---

## Ideas / Someday

- **E-ink version.** Original long-term goal: phone-first now, a low-refresh
  e-ink layout later. Future phase, not started. NOTE: will likely need a
  server-held copy of the board — that's the moment to revisit the tabled
  "guaranteed 5 pm backup / server snapshot" idea (Chelsea tabled it 2026-07-02:
  it weakens "data only on my phone" and isn't worth it until sync/e-ink needs it).
- **Rate-limit persistence** (Supabase table instead of per-isolate memory),
  **CSP header**, **multi-device sync** — from the 2026-07-01 security review,
  all low priority. (Sync likely rides along with the e-ink server copy.)

## In progress

- **E-ink display (reTerminal E1001).** Decisions locked 2026-07-17: hardware
  in hand; FULL spec (incl. button-C write-back); 15-min refresh cadence;
  server board copy consented.
  - ✅ Stage 1 (2026-07-18): server copy live — `board` table (RLS, service-key
    only) + `board` Edge Function (GET snapshot / POST push / completeTop),
    phone pushes on change (debounced 4s) + pull-merges display completions on
    open ("Done from your display: X" toast). E2E verified.
  - ✅ Stage 2 (2026-07-18): render endpoint live — `eink` Edge Function:
    GET ?view=A|B&format=raw (48,000-byte framebuffer, MSB-first, 1=black) or
    format=bmp (browser preview). Hand-built 5×7 bitmap font + 1-bit
    rasterizer; both views visually verified against the design.
  - ✅ Stage 3 (2026-07-18): firmware FLASHED AND RUNNING on the reTerminal.
    First boot verified over serial: Wi-Fi up, 48,000-byte frame fetched,
    painted, deep-sleeping on a 15-min timer. Buttons: left=cycle view,
    middle=refresh, green=done-#1 (chirps on success). Battery 4.15V at flash
    time. PlatformIO project in `firmware/` (config.h gitignored — holds Wi-Fi
    + app password); flash: `pio run -t upload`. Serial-monitor gotcha: open
    the port with DTR/RTS de-asserted or the chip latches into bootloader.

## Done

- 2026-07-18 — Display field-feedback round 1: **archive sorts by completion
  recency** (newest first); **display lists follow phone board order** (was
  internal-id order); **View A main list = Today's Priorities** (was Actively
  Working; Active count added to the summary column). Top-3 logic documented:
  priority level, then has-due-date, then board order.
- 2026-07-17 — **Board search**: 🔍 chip at the start of the filter row expands
  a search bar; every query word must match across title/note/waiting/ref;
  live match count; empty groups hidden while searching. 54 tests.
- 2026-07-17 — Capture upgrades: **crossed-out handwritten items are skipped**
  (scanner told struck-through = done); **review rows are editable** (tap the
  title to fix wording, cycle area AND bucket chips before committing);
  **manual task entry** on the capture screen ("or type one in" — flows through
  the same dedupe/review as scans, source Hand); **Accept Changes pinned** to
  the bottom of the edit sheet + safe-area padding (was hanging off screen).
  50 tests.
- 2026-07-11 — **Capture-recency indicator** on the capture screen: "Last
  capture: 2 days ago · Jul 9" plus a per-list line (SLG 2d · Zoho — · …).
  Stamped on every capture commit (meta lastCaptureAt + lastCapture:<source>).
- 2026-07-08 — Field feedback round 2: **people roster fixed** (full names —
  first-name-only entries were why "Isabelle Roethle"/"Sushmita Barua" got
  flagged; Chelsea herself added as known/no-area so scans never ask about
  her; Isabelle encoded multi-area ClinDoc/IRF/Rover; prompt now says fuller
  names starting with a known first name are the same person). **OP/IP stay
  shorthand in extracted titles** (removed from expansion list; comparison
  still treats OP≡outpatient internally). **Plural-blind matching**
  ("Providers"≡"Provider" — the 91% near-dupes now auto-merge). **Stale
  waiting tasks float to the top of Waiting On** (longest wait first).
  47 tests.
- 2026-07-04 — **Supabase pause-warning neutralized.** Free-tier inactivity
  detector only counts DB/API-gateway traffic — Edge Function calls don't
  register, so the active app looked "inactive." Fix: `keepalive.yml` GitHub
  Action pings auth health + vision {ping} daily at 13:00 UTC (secrets:
  SUPABASE_ANON_KEY, TEND_APP_PASSWORD). No Pro plan needed. Escape hatch if
  policy tightens: port the two functions to Deno Deploy (free, no pausing).
  NOTE: a second Supabase project "the-nightstand" exists — the warning email
  may have been about it; unprotected by this ping.
- 2026-07-03 — **GitHub Actions auto-deploy LIVE.** Every push to `main` now
  builds, runs the 37-test suite, and deploys to Pages automatically (red tests
  block the deploy). Pages build_type switched to "workflow"; the manual
  build-and-push-to-gh-pages dance is retired (branch kept but unused).
- 2026-07-02 — Review follow-ups: **"New version ready" update banner** (SW now
  prompt-mode — updates apply when tapped, no more hard-refresh dance);
  **Face ID app lock** (on-device passkey gates the app; password stays as
  backup; enroll offer appears after next password login); **archive auto-clean
  at 1 month** (archivedIso stamped; legacy "Jun 25" labels parsed
  best-effort); **restore preview panel** (date + counts + first titles before
  merging); **vitest suite — 37 tests** (dedupe, reconcile, dates, backup
  validation, email formats, extraction sanitizers) wired into the CI workflow.
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
