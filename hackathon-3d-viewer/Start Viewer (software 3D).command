#!/bin/bash
# Double-click in Finder if the normal launcher shows "Error creating WebGL context"
# (e.g. older Macs on OpenCore Legacy Patcher). Opens Chrome with software WebGL (SwiftShader).
exec "$(dirname "$0")/scripts/launch.sh" --software-webgl
