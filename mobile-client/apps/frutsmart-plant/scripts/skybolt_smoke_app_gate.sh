#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ID="com.anonymous.FrutSmartP"
MAIN_ACTIVITY="$APP_ID/.MainActivity"
APK_PATH="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
ARTIFACT_DIR="$ROOT_DIR/artifacts/skybolt-smoke/gate-$(date +%Y%m%d-%H%M%S)"

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

if [[ ! -f "$APK_PATH" ]]; then
  echo "Debug APK not found: $APK_PATH"
  exit 1
fi

adb -s "$DEVICE" logcat -c
adb -s "$DEVICE" install -r "$APK_PATH"
adb -s "$DEVICE" shell am start -n "$MAIN_ACTIVITY"

sleep 4

adb -s "$DEVICE" shell screencap -p /sdcard/skybolt-gate-screen.png
adb -s "$DEVICE" pull /sdcard/skybolt-gate-screen.png "$ARTIFACT_DIR/final-screen.png" >/dev/null
adb -s "$DEVICE" logcat -d >"$ARTIFACT_DIR/logcat.txt"

if grep -q "FATAL EXCEPTION" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Smoke gate failed: FATAL EXCEPTION found"
  exit 1
fi

if grep -q "AndroidRuntime: Process: $APP_ID" "$ARTIFACT_DIR/logcat.txt"; then
  echo "Smoke gate failed: AndroidRuntime crash for app found"
  exit 1
fi

echo "Smoke gate PASS"
echo "Artifacts: $ARTIFACT_DIR"
