#!/bin/bash
# Run one of the QA session's audit scripts (fixes/qa-evidence/*.mjs) against v2 instead of the original.
# The originals are hard-wired to the original app (port 18767, ../../hackathon-3d-viewer). This makes
# a retargeted copy in the OS temp directory; the originals are not edited.
#
# usage: fixes/v2-evidence/tools/run-audit.sh <script-name.mjs> [out-dir]
#   e.g. fixes/v2-evidence/tools/run-audit.sh audit-prototype.mjs
# RV_VIEWER_ROOT overrides the viewer folder (default: v2/hackathon-3d-viewer in this project).
# RV_BASE_URL overrides the app URL (default http://127.0.0.1:18777).
# For audit-prototype.mjs, <viewer-root>/../prototypes/room-vibez-planner-flows is the prototype audited.
#
# Known limit (2026-10-06): the viewer audits (audit-viewer.mjs, audit-viewer-followup.mjs,
# walkthrough-tasks.mjs, the two probes) were written for the pre-fix DOM. Against v2 they also need:
# a step opened before each tool button (.step[data-step=…] .step-toggle), the new placement rows
# (li.placement-row), and the picker trigger in place of #product-select. This script does not do that.
# Only audit-prototype.mjs and probe-product-pick-camera.mjs / probe-tool-toggle.mjs were run through
# it, and the two probes only before the panel was restructured.
set -uo pipefail
NAME="$1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVID="$ROOT/fixes/qa-evidence"
SRC="${RV_VIEWER_ROOT:-$ROOT/v2/hackathon-3d-viewer}"
BASE="${RV_BASE_URL:-http://127.0.0.1:18777}"
BASE="${BASE%/}"
RUN="$(mktemp -d "${TMPDIR:-/tmp}/rv-audit-run.XXXXXX")"
OUT="${2:-$RUN/out}"
PROTO="$(cd "$SRC/.." && pwd)/prototypes/room-vibez-planner-flows"
mkdir -p "$OUT"
sed \
  -e "s#http://127.0.0.1:18767#$BASE#g" \
  -e "s#'\.\./\.\./hackathon-3d-viewer/node_modules/#'$SRC/node_modules/#g" \
  -e "s#'$ROOT/hackathon-3d-viewer/node_modules/#'$SRC/node_modules/#g" \
  -e "s#fileURLToPath(new URL('\.\./\.\./hackathon-3d-viewer', import.meta.url))#'$SRC'#g" \
  -e "s#fileURLToPath(new URL('\.\./\.\./prototypes/room-vibez-planner-flows/index.html', import.meta.url))#'$PROTO/index.html'#g" \
  "$EVID/$NAME" > "$RUN/$NAME"
if grep -n -E "18767|\.\./\.\./hackathon-3d-viewer|\.\./\.\./prototypes" "$RUN/$NAME"; then
  echo "run-audit: the lines above still point at the original app; fix the sed rules before trusting output" >&2
  exit 2
fi
echo "run-audit: $NAME against $BASE ($SRC); output in $OUT"
cd "$RUN" && RV_QA_OUT="$OUT" node "$NAME"
