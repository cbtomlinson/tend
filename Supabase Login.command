#!/bin/bash
# Double-click to log the Supabase CLI into your account (one-time, browser auth).
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
echo "Logging in to Supabase — your browser will open. Click Authorize, then come back."
echo ""
supabase login
echo ""
echo "Done. Tell Claude you're logged in."
read -n 1 -s -r -p "Press any key to close."
