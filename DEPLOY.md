# Deploying Tend (tend.littletomato.dev)

Pattern matches "The Nightstand": **frontend on GitHub Pages**, **backend on a
separate Supabase project**, **secrets in Supabase** (never in the repo).

```
Phone / browser ──> tend.littletomato.dev (GitHub Pages, static Vite build)
                         │  capture / email calls
                         ▼
                   Supabase Edge Functions (vision, email)  ← holds the secret keys
                         │
                         ▼
                   Anthropic vision · Resend
```

The board data stays **on each device** (IndexedDB). No cloud copy. Phone and
desktop are independent boards.

## Done
- [x] Scrubbed identifying info from app source (names/sites → `PEOPLE_JSON`
      secret + generic seed). Public-repo safe.
- [x] GitHub Actions workflow (`.github/workflows/deploy.yml`) builds the PWA and
      publishes to Pages.
- [x] `pwa/public/CNAME` pins the custom domain.

## To do — code (no accounts needed)
- [ ] Supabase Edge Functions `supabase/functions/{vision,email}/index.ts`
      (Deno; reuse the `server/` handler logic via `npm:` imports).
- [ ] Client routing: call `VITE_API_BASE` in prod, `/api/*` in dev.
- [ ] Password gate (a passphrase checked by the functions against `APP_PASSWORD`)
      so a stranger who finds the URL can't spend the API keys.

## To do — accounts (do together)
1. **GitHub**: create **public** repo `cbtomlinson/tend`. Push (exclude
   `design_handoff_tend/` and the `.zip` — they contain real names).
2. **Supabase**: new project for Tend. Deploy the two functions. Set secrets:
   `ANTHROPIC_API_KEY`, `VISION_MODEL` (optional), `PEOPLE_JSON`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `EMAIL_TO`, `KINDLE_TO`, `APP_PASSWORD`. (Values are in `pwa/.env`.)
3. **GitHub repo settings** → Pages → Source = **GitHub Actions**; set custom
   domain `tend.littletomato.dev`.
4. **GitHub repo settings** → Secrets and variables → Actions → **Variables**:
   `VITE_API_BASE` = `https://<project>.supabase.co/functions/v1`,
   `VITE_SUPABASE_ANON_KEY` = the project's anon (publishable) key.
5. **Namecheap** DNS: add `CNAME` · Host `tend` · Value `cbtomlinson.github.io`.
6. Wait for GitHub to provision HTTPS, then open `https://tend.littletomato.dev`
   on your phone → Share → **Add to Home Screen**.
