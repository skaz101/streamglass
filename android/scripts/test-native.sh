#!/usr/bin/env bash
# Keep one shell for the emulator action; collect previews even when a test fails.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-results/native
collect() {
  adb logcat -d -s StreamGlassPreview:I StreamGlassPlayback:D > test-results/native/native-log.txt || true
  python3 tests/collect-native-previews.py
}
trap collect EXIT
adb logcat -G 16M
adb logcat -c
adb shell wm dismiss-keyguard
# This disposable AOSP emulator launches the fixture Activity directly. Its
# Quickstep launcher ANRs during rotation; keep that unrelated dialog out of tests.
adb shell am force-stop com.android.launcher3
adb shell pm disable-user --user 0 com.android.launcher3
./gradlew --no-daemon connectedDebugAndroidTest
