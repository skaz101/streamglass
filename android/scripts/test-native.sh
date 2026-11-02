#!/usr/bin/env bash
# Keep one shell for the emulator action; always collect screenshots on failure.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-results/native
trap 'adb pull /sdcard/Download/streamglass-native/. test-results/native/ >/dev/null 2>&1 || true' EXIT
./gradlew --no-daemon connectedDebugAndroidTest
