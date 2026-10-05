#!/bin/bash
# Shared launcher for the .command files. Usage: launch.sh [--software-webgl]
cd "$(dirname "$0")/.."
URL="http://127.0.0.1:18777/"

# Find Node: PATH first, then the newest nvm install.
if ! command -v node >/dev/null 2>&1; then
  NVM_NODE=$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)
  [ -n "$NVM_NODE" ] && export PATH="$NVM_NODE:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org and run this again."
  read -r -p "Press Enter to close." _
  exit 1
fi

open_viewer() {
  CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ "$1" = "--software-webgl" ] && [ -x "$CHROME" ]; then
    # Software WebGL in a separate Chrome profile: for Macs whose GPU can't create a WebGL context.
    "$CHROME" --user-data-dir="$PWD/.chrome-viewer-profile" --no-first-run --no-default-browser-check \
      --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
      --new-window "$URL" >/dev/null 2>&1 &
  else
    open "$URL"
  fi
}

if curl -s -o /dev/null "$URL"; then
  echo "Viewer already running at $URL"
  open_viewer "$1"
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (needs internet, about a minute)…"
  npm install || { read -r -p "npm install failed. Press Enter to close." _; exit 1; }
fi
(
  for _ in $(seq 1 60); do curl -s -o /dev/null "$URL" && break; sleep 1; done
  open_viewer "$1"
) &
echo "Starting viewer at $URL — close this window (or press Ctrl+C) to stop it."
npm run dev
