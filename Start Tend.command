#!/bin/bash
# Double-click this file in Finder to run Tend locally.
# It starts the dev server and opens the app in your browser.
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
( sleep 3 && open "http://localhost:5173" ) &
echo "Starting Tend… (close this window to stop the app)"
npm run dev
