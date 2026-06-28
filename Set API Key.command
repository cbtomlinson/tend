#!/bin/bash
# Double-click to save your Anthropic API key for Tend.
# It is written to pwa/.env, which is gitignored and never committed.
cd "$(dirname "$0")"
echo "Paste your Anthropic API key (starts with sk-ant-...) then press Return:"
read -r KEY
if [ -z "$KEY" ]; then
  echo "No key entered — nothing changed."
else
  printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > "pwa/.env"
  echo ""
  echo "Saved. Tend will use it automatically (the app reloads the key on its own)."
fi
echo ""
read -n 1 -s -r -p "Press any key to close this window."
