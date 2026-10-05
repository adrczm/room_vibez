#!/bin/bash
# Run this folder's Playwright e2e specs from a throwaway copy in the OS temp directory.
# Why: six of the original specs write screenshots to hard-coded Cursor agent-store paths under
# ~/Library/Application Support/Cursor/, and some agent shells cannot write inside the project.
# The copy redirects those paths into the temp run directory. Nothing in the project is written.
# The dev server must already be running (npm run dev).
#
# usage: scripts/run-e2e-scratch.sh [playwright test args...]
#   scripts/run-e2e-scratch.sh --workers=1                      # the whole suite
#   scripts/run-e2e-scratch.sh viewer.spec.ts --workers=1       # one spec
# Use --workers=1: with parallel workers tests time out under software rendering.
# RV_BASE_URL overrides the app URL (default http://127.0.0.1:18777).
set -uo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${RV_BASE_URL:-http://127.0.0.1:18777}"
BASE="${BASE%/}"
RUN="$(mktemp -d "${TMPDIR:-/tmp}/rv-e2e-run.XXXXXX")"
mkdir -p "$RUN/tests" "$RUN/media"
cp -R "$SRC/tests/e2e" "$RUN/tests/e2e"
rm -rf "$RUN/tests/e2e/screenshots"
[ -d "$SRC/tests/fixtures" ] && cp -R "$SRC/tests/fixtures" "$RUN/tests/fixtures"
CURSOR_STORE="$HOME/Library/Application Support/Cursor/AgentStores/cursor_agent_stores"
sed -i '' "s#$CURSOR_STORE#$RUN/media#g" "$RUN"/tests/e2e/*.spec.ts
if grep -rq "Application Support/Cursor" "$RUN/tests"; then
  echo "run-e2e-scratch: refusing to run, a spec still points into Cursor app data:" >&2
  grep -rn "Application Support/Cursor" "$RUN/tests" >&2
  exit 2
fi
ln -s "$SRC/node_modules" "$RUN/node_modules"
cat > "$RUN/playwright.config.ts" <<EOF
import { defineConfig } from '@playwright/test';
// Scratch copy of playwright.config.ts without webServer; baseURL passed in.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    baseURL: '$BASE',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  reporter: [['list']],
  outputDir: 'tests/e2e/screenshots',
});
EOF
echo "run-e2e-scratch: specs from $SRC against $BASE; run dir $RUN"
cd "$RUN" && "$SRC/node_modules/.bin/playwright" test --config playwright.config.ts "$@"
