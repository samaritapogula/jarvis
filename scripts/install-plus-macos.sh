#!/usr/bin/env bash
# Run from the repository root: bash scripts/install-plus-macos.sh
# Never calls sudo, brew, npm -g, or a payment/reset action.
set -euo pipefail

cd "$(dirname "$0")/.."
echo
echo 'JARVIS + ChatGPT Plus local setup'
echo 'No system-wide software will be installed.'
echo

if [[ "$(uname -s)" != 'Darwin' ]]; then
  echo 'This installer is for macOS. Nothing was installed.' >&2
  exit 1
fi

for app in git node npm; do
  if ! command -v "$app" >/dev/null 2>&1; then
    echo "Missing prerequisite: $app. Stop and ask before installing it system-wide." >&2
    exit 1
  fi
done

major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( major < 20 )); then
  echo "Node.js 20+ required, found Node $major. Stop and ask before upgrading." >&2
  exit 1
fi

if [[ ! -d '/Applications/Google Chrome.app' && ! -d '/Applications/Microsoft Edge.app' &&
      ! -d "$HOME/Applications/Google Chrome.app" && ! -d "$HOME/Applications/Microsoft Edge.app" ]]; then
  echo 'Chrome or Edge missing. Stop and ask before installing a browser.' >&2
  exit 1
fi

if [[ -n "$(printenv OPENAI_API_KEY 2>/dev/null || true)" ||
      -n "$(printenv CODEX_API_KEY 2>/dev/null || true)" ]]; then
  echo 'An OpenAI API-key environment variable is set. Unset it first; no API billing is intended.' >&2
  exit 1
fi

echo 'Prerequisites are present. Running the ORIGINAL advisory check...'
echo 'NOTE: The original check may report Claude missing; that is expected in Plus mode.'
node scripts/setup.mjs

echo
echo 'Installing npm packages ONLY into this project (not system-wide)...'
npm install

echo
echo 'Checking local Codex ChatGPT sign-in...'
if ! ./node_modules/.bin/codex login status 2>&1 | grep -qi 'logged in using chatgpt'; then
  echo 'The official Codex login will open. Choose Sign in with ChatGPT (NOT an API key).'
  ./node_modules/.bin/codex login
fi

echo
echo 'Running Plus-specific preflight, source tests and frontend build...'
npm run setup:plus
npm test
npm run build

echo
echo 'All local checks passed.'
echo 'No credits, API billing, or resets were purchased or activated by this script.'
echo 'WARNING: Codex may use any pre-existing purchased credit balance after plan limits.'
echo 'Check ChatGPT Usage / credit settings if you require absolutely no paid usage.'
echo 'Start manually when ready: npm run start:plus'
echo 'Then open http://localhost:5173 in Chrome/Edge and click INITIALISE.'
