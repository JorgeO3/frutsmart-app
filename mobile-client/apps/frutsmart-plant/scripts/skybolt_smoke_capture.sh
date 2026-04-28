#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$ROOT_DIR/artifacts/skybolt-smoke"
STATE_DIR="$ARTIFACTS_DIR/.state"
PID_FILE="$STATE_DIR/logcat.pid"
DIR_FILE="$STATE_DIR/session_dir"

mkdir -p "$ARTIFACTS_DIR" "$STATE_DIR"

timestamp() {
  date +"%Y%m%d-%H%M%S"
}

start_capture() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "Capture already running with PID $(cat "$PID_FILE")"
    exit 1
  fi

  local session_dir="$ARTIFACTS_DIR/$(timestamp)"
  mkdir -p "$session_dir"

  adb logcat -c
  adb logcat >"$session_dir/logcat.txt" 2>&1 &
  local pid=$!

  echo "$pid" >"$PID_FILE"
  echo "$session_dir" >"$DIR_FILE"

  echo "Skybolt smoke capture started"
  echo "Session dir: $session_dir"
  echo "Logcat PID: $pid"
}

stop_capture() {
  if [[ ! -f "$PID_FILE" ]]; then
    echo "No active capture found"
    exit 1
  fi

  local pid
  pid="$(cat "$PID_FILE")"
  local session_dir
  session_dir="$(cat "$DIR_FILE")"

  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    wait "$pid" 2>/dev/null || true
  fi

  adb shell screencap -p "/sdcard/skybolt-smoke-final.png"
  adb pull "/sdcard/skybolt-smoke-final.png" "$session_dir/final-screen.png" >/dev/null

  rm -f "$PID_FILE" "$DIR_FILE"

  echo "Skybolt smoke capture stopped"
  echo "Artifacts: $session_dir"
}

status_capture() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "running"
    echo "pid=$(cat "$PID_FILE")"
    echo "dir=$(cat "$DIR_FILE")"
  else
    echo "stopped"
  fi
}

case "${1:-}" in
  start)
    start_capture
    ;;
  stop)
    stop_capture
    ;;
  status)
    status_capture
    ;;
  *)
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
