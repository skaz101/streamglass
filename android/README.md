# StreamGlass for Android phones and tablets, 0.6.3

An installable Android preview with a dedicated mobile interface: artwork-led
home, compact poster rows, Home / For You / Search / My List tabs, a profile
menu, and stream selection in an accessible bottom sheet. It shares the MIT
Stremio core, account sync, live search and recommendations with the LG version.
The layout adapts to phones, tablets and landscape. Playback uses native AndroidX
Media3/ExoPlayer with original fullscreen controls, double-tap seeking, speed
selection, screen lock, audio/caption settings and watch-progress callbacks. It is not the upstream DX.BI Android TV wrapper.

Package ID: com.streamglass.mobile. Minimum Android: 8.0 (API 26). Compile/target
SDK: 35. Use an updated Android System WebView. Samsung Galaxy S25 is the intended
first hardware test device. This version is designed for touch, not Android TV.

## Install

Download [streamglass-android-0.6.3.apk](https://github.com/skaz101/streamglass/releases/download/v0.6.3/streamglass-android-0.6.3.apk) on your phone and open it. Allow installation
from that browser or file manager when Android asks. Open StreamGlass and sign
in with the same Stremio account used on your TV. This is a separate installation;
it does not replace Stremio or the LG app. Account library/addons/progress sync
through Stremio. Recommendations are computed separately on each device.

Alternatively, with Android platform-tools and USB debugging authorized:

```sh
adb install -r streamglass-android-0.6.3.apk
adb shell am start -n com.streamglass.mobile/.MainActivity
```

## Signing and updates

The 0.6.3 APK is built with the release configuration and signed locally with
the original preview certificate, so it can update earlier previews, including 0.6.0 without uninstalling.
The key remains private. This is still a preview signed with a development
certificate, not a Play Store release. Release builds disable WebView debugging;
local debug builds permit inspection through an authorized USB connection.

The maintainer can place the original key at
`android/signing/streamglass-development.jks` locally to build compatible test
updates. Git and the source exporter exclude signing keys. Other builders use
their own automatically generated Android debug key. A different key cannot
update the existing APK in place; keep the original key backed up privately.
Do not uninstall as a routine update step: that can erase local account data.
A production release needs a separate private release-signing configuration.

## Player controls

- Tap the video to show/hide controls; double-tap left/right to skip 10 seconds.
- Use the center button to pause/resume, or drag the red timeline to seek.
- Playback opens in landscape. The rotation button switches to portrait; the
  fit/fill button controls whether the entire picture or a cropped view is shown.
- Speed supports 0.5×–2× and is remembered on this device. Audio & subs lists
  available tracks; captions can be turned off. Brightness is local to the player.
- Lock prevents accidental input and holds orientation. Tap to reveal Unlock,
  or press Android Back once to unlock. Back closes settings before exiting.
- On an error, retry the stream in place or return to choose another stream.

## Motion

Browsing pages, cards and artwork ease into view. Tabs, buttons and My List
respond to touch; sheets slide and fade on both opening and closing. Player
controls, lock and seek feedback fade smoothly. Android's Remove animations
setting disables native motion, and the WebView follows reduced-motion preferences.

## Playback and limits

- Select Torrentio + TorBox direct HTTP/HTTPS links. Raw torrents/magnets are not
  downloaded. No debrid password, API key or extra account is entered here.
- Native playback supports progressive, HLS and DASH sources, subject to the
  phone's codecs. The Audio & Subtitles panel lists supported tracks. External SRT, VTT,
  ASS/SSA and TTML are handed to Media3. A subtitle URL without a recognized
  extension defaults to SRT. An addon returning another format may fail.
- Progress is forwarded every second and on pause/exit. Closing the player
  returns to the title. Rotation keeps the activity/player alive. Backgrounding
  pauses playback; press Play after returning. No background service, picture
  in picture, casting or downloads are implemented in this release.
- Late subtitle-addon responses can add tracks after playback starts. A source
  update may briefly rebuffer. Default audio/subtitle languages use the account's
  playback settings. Caption size follows the account setting; the TV's full subtitle styling is not ported.
- Metadata/account requests use the shared web client. Use HTTPS addon URLs.
  HTTP direct media links are allowed in the native player. Signed query strings
  are preserved. Non-sensitive addon media headers apply to the original media
  host; Cookie and Authorization headers are intentionally not forwarded.
- Recommendations have the same 500-entry/12-example scope and metadata limits
  documented in ../webos/RELEASE-0.3.0.md. Removed or unsynced history is unavailable.

## Verification and real-device checklist

CI builds debug and release variants and runs Android lint and six JVM tests
covering URL rules, subtitle formats, seek bounds, time labels and playback speeds. The mobile browser integration uses
real Stremio core WASM with fake account/addon services and a simulated native
player. It covers login, touch search, 320/390/800-pixel layouts, landscape,
bottom navigation, My List, episodes, animated page/card entrances, sheet entry/exit,
interrupted transitions, reduced motion, sheet dismissal and focus restoration,
playback handoff, progress, resume, stale events, and recommendations.
See [0.6.3 release notes](RELEASE-0.6.3.md) for the verified release checks.

The Android 35 emulator suite runs the actual native player with isolated local
H.264/AAC/WebVTT fixtures. It covers pause, skips, double taps, timeline scrubbing,
speed, track selection, screen lock, rotation, full-video scrim bounds with cutout
insets, reversible fades, system reduced motion, auto-hide, background pause and
error recovery. Physical-device codecs, real TorBox links, vendor insets, audio
focus and the full WebView-to-native path still require phone testing.

First phone test:

1. Launch, sign in, check your addons/library, then type a live search.
2. Open For you and a recommendation; test the Android Back gesture.
3. Play a known working TorBox H.264/AAC link. Seek, choose an audio track and
   subtitles, then exit and replay. Confirm resume is near the saved position.
4. Rotate the phone, open the keyboard, background the app, then return. Confirm
   the page stays usable and playback is paused until you restart it.
5. Check progress on the TV after account sync. Report the playback error code
   if a link fails, and whether that same link works in official Stremio.

For UI/core logs in a locally built debug APK, connect the phone by USB, authorize USB debugging, open
chrome://inspect/#devices in desktop Chrome and inspect the StreamGlass WebView.
In its Console run:

```js
copy(window.StreamGlassDiagnostics.export())
```

Share that sanitized export plus your Android/System WebView versions and the
steps that failed. If the app crashes before showing a WebView, collect:

```sh
adb logcat -b crash -d > streamglass-android-crash.txt
```

Review crash logs before sharing. Do not send account credentials, configured
addon URLs, signed stream links or unredacted network captures.

## Rebuild and source

Prerequisites: Node/npm, JDK 17, Android SDK platform 35 and build-tools 35.0.0.
Set ANDROID_HOME to the SDK directory or provide local.properties with sdk.dir.
The Gradle wrapper pins Gradle 8.11.1; AGP is 8.7.3. Runtime versions are pinned
in app/build.gradle. From the combined source root:

```sh
cd webos
npm ci
npm test
cd ../android
./gradlew assembleDebug testDebugUnitTest lintDebug
```

APK: app/build/outputs/apk/debug/app-debug.apk. preBuild rebuilds and copies the
shared shell into generated assets, then applies the Android host, mobile
presentation module and stylesheet. Android does not load the TV theme CSS.
`assembleRelease` produces an unsigned APK under `app/build/outputs/apk/release/`
for local signing with the privately held preview key.
The prebuilt MIT core is included. To reproduce that core, see webos/README.md.

```sh
CHROME_BIN=/path/to/chromium node tests/mobile-browser.mjs
./gradlew runtimeInventory
python3 scripts/collect-sources.py
```

Mobile browser tests need Chromium and the webos npm dependencies. For the native
player suite, generate fixtures with `python3 tests/make-player-fixture.py`
(requires ffmpeg), start an Android emulator, and run
`./gradlew connectedDebugAndroidTest`. Debug-only test media is never packaged
in the release APK. vendor/ includes the
resolved runtime sources and notices; one Guava conflict-placeholder JAR contains
no classes and has no source JAR. See THIRD_PARTY.md and the root GPL license.
Redistribute the corresponding combined source with the APK/IPK.

Implementation references:

- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://developer.android.com/reference/androidx/webkit/WebViewCompat
- https://developer.android.com/media/media3/exoplayer/hello-world
- https://developer.android.com/media/media3/exoplayer/track-selection

[Android signing and update requirements](https://developer.android.com/studio/publish/app-signing).
