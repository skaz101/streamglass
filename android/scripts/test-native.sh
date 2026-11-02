#!/usr/bin/env bash
# Keep one shell for the emulator action; collect previews even when a test fails.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-results/native
collect() {
  adb logcat -d -s StreamGlassPreview:I > test-results/native/native-log.txt || true
  python3 tests/collect-native-previews.py
}
trap collect EXIT
adb logcat -G 16M
adb logcat -c
adb shell wm dismiss-keyguard
./gradlew --no-daemon connectedDebugAndroidTest
