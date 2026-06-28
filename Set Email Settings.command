#!/bin/bash
# Double-click to set up emailing your board (Resend).
# Writes to pwa/.env (gitignored). Your Anthropic key is preserved.
cd "$(dirname "$0")"
ENV="pwa/.env"
echo "Set up emailing your board with Resend."
echo ""
echo "1) Paste your Resend API key (starts with re_) then press Return:"
read -r RKEY
echo "2) Email address to send your board TO, then Return:"
read -r TO
echo "3) (Optional) Send-to-Kindle address like you_xxxx@kindle.com — or just Return to skip:"
read -r KIN

touch "$ENV"
# Keep existing non-email settings (e.g. ANTHROPIC_API_KEY); replace email ones.
grep -v -E '^(RESEND_API_KEY|EMAIL_TO|KINDLE_TO|EMAIL_FROM)=' "$ENV" > "$ENV.tmp" 2>/dev/null || true
mv "$ENV.tmp" "$ENV"
{
  [ -n "$RKEY" ] && printf 'RESEND_API_KEY=%s\n' "$RKEY"
  [ -n "$TO" ] && printf 'EMAIL_TO=%s\n' "$TO"
  printf 'EMAIL_FROM=%s\n' 'Tend <onboarding@resend.dev>'
  [ -n "$KIN" ] && printf 'KINDLE_TO=%s\n' "$KIN"
} >> "$ENV"
echo ""
echo "Saved. Tend reloads these automatically — no restart needed."
echo ""
read -n 1 -s -r -p "Press any key to close this window."
