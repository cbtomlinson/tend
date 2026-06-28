#!/bin/bash
# Double-click to grant GitHub permission to add the auto-deploy workflow.
# It opens your browser once to authorize. Safe — it's your own GitHub CLI login.
echo "Granting the 'workflow' permission to your GitHub login."
echo "A one-time code will appear; press Return to open your browser, paste it, and click Authorize."
echo ""
gh auth refresh -h github.com -s workflow
echo ""
echo "All set. You can close this window and tell Claude to continue."
read -n 1 -s -r -p "Press any key to close."
