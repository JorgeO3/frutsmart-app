#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="com.anonymous.FrutSmartP"
MAIN_ACTIVITY="$APP_ID/.MainActivity"
ARTIFACT_DIR="$ROOT_DIR/artifacts/nanort-phase14/gate-$(date +%Y%m%d-%H%M%S)"

mkdir -p "$ARTIFACT_DIR"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found in PATH"
  exit 1
fi

DEVICE="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
if [[ -z "$DEVICE" ]]; then
  echo "No connected adb device"
  exit 1
fi

echo "Using device: $DEVICE"

adb -s "$DEVICE" logcat -c
adb -s "$DEVICE" shell am start -n "$MAIN_ACTIVITY"

sleep 8

adb -s "$DEVICE" shell screencap -p /sdcard/nanort-phase14-screen.png
adb -s "$DEVICE" pull /sdcard/nanort-phase14-screen.png "$ARTIFACT_DIR/startup-screen.png" >/dev/null
adb -s "$DEVICE" logcat -d >"$ARTIFACT_DIR/logcat.txt"

if ! adb -s "$DEVICE" shell pidof "$APP_ID" >/dev/null 2>&1; then
  echo "Phase 14 gate failed: app process is not alive"
  exit 1
fi

if grep -q "FATAL EXCEPTION" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Phase 14 gate failed: FATAL EXCEPTION found"
  exit 1
fi

if grep -q "AndroidRuntime: Process: $APP_ID" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Phase 14 gate failed: AndroidRuntime crash for app found"
  exit 1
fi

if grep -q "ExpoNanoRT.*Emitting init event: onReady" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Observed NanoRT onReady event in logcat"
else
  echo "NanoRT onReady event not observed in this capture"
fi

if grep -q "ExpoNanoRT.*Emitting init event: onInitError" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Warning: NanoRT onInitError event observed in logcat"
else
  echo "No NanoRT onInitError event observed in this capture"
fi

cat >"$ARTIFACT_DIR/manual-matrix-template.md" <<'EOF'
# NanoRT Phase 14 Manual Matrix

- [ ] useNanoRTReady reports ready in host app
- [ ] initializeModule() path succeeds
- [ ] classifyPlantExternal returns items with uri/confidences
- [ ] classifyPlantInternal returns items with uri/confidences
- [ ] classifyFieldExternal returns items with uri/confidences
- [ ] classifyFieldInternal returns items with uri/confidences
- [ ] No visible regression in host screens
- [ ] No corrupted state after app restart/reload

Evidence notes:
- Artifact folder:
- Device/Build:
- Operator:
- Result:
EOF

echo "Phase 14 startup gate PASS"
echo "Artifacts: $ARTIFACT_DIR"
