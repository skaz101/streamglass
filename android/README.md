# StreamGlass for Android phones and tablets, 0.4.0

An installable Android test app using the same independent StreamGlass shell,
MIT Stremio core, account sync, live search and local recommendations as the LG
version. The layout adapts to phones and tablets. Playback uses native AndroidX
Media3/ExoPlayer with seeking, audio selection, embedded/external subtitles and
watch-progress callbacks. It is not the upstream DX.BI Android TV wrapper.

Package ID: com.streamglass.mobile. Minimum Android: 8.0 (API 26). Compile/target
SDK: 35. Use an updated Android System WebView. Samsung Galaxy S25 is the intended
first hardware test device. This version is designed for touch, not Android TV.

## Install

Download streamglass-android-0.4.0.apk on your phone and open it. Allow installation
from that browser or file manager when Android asks. Open StreamGlass and sign
in with the same Stremio account used on your TV. This is a separate installation;
it does not replace Stremio or the LG app. Account library/addons/progress sync
through Stremio. Recommendations are computed separately on each device.

Alternatively, with Android platform-tools and USB debugging authorized:

```sh
adb install -r streamglass-android-0.4.0.apk
adb shell am start -n com.streamglass.mobile/.MainActivity
```

## Signing and updates

The supplied 0.4.0 APK is a debug/test build. Its original development key is
kept outside the public source. Debug builds permit WebView inspection through
an authorized USB connection.

The maintainer can place the original key at
`android/signing/streamglass-development.jks` locally to build compatible test
updates. Git and the source exporter exclude signing keys. Other builders use
their own automatically generated Android debug key. A different key cannot
update the existing APK in place; keep the original key backed up privately.
Do not uninstall as a routine update step: that can erase local account data.
A production release needs a separate private release-signing configuration.

## Playback and limits

- Select Torrentio + TorBox direct HTTP/HTTPS links. Raw torrents/magnets are not
  downloaded. No debrid password, API key or extra account is entered here.
- Native playback supports progressive, HLS and DASH sources, subject to the
  phone's codecs. Audio and Subs menus list supported tracks. External SRT, VTT,
  ASS/SSA and TTML are handed to Media3. A subtitle URL without a recognized
  extension defaults to SRT. An addon returning another format may fail.
- Progress is forwarded every second and on pause/exit. Closing the player
  returns to the title. Rotation keeps the activity/player alive. Backgrounding
  pauses playback; press Play after returning. No background service, picture
  in picture, casting or downloads are implemented in this release.
- Late subtitle-addon responses can add tracks after playback starts. A source
  update may briefly rebuffer. Default audio/subtitle languages use the account's
  playback settings. The TV's full subtitle styling is not ported to native UI.
- Metadata/account requests use the shared web client. Use HTTPS addon URLs.
  HTTP direct media links are allowed in the native player. Signed query strings
  are preserved. Non-sensitive addon media headers apply to the original media
  host; Cookie and Authorization headers are intentionally not forwarded.
- Recommendations have the same 500-entry/12-example scope and metadata limits
  documented in ../webos/RELEASE-0.3.0.md. Removed or unsynced history is unavailable.

## Verification and real-device checklist

The APK compiles and passes Android lint with no errors. Three JVM tests cover
URL rules and subtitle format selection. The mobile Chromium 119 integration
uses real Stremio core WASM with fake account/addon services and a simulated
native-player bridge. It passes touch login/search, phone/tablet layouts at
320/390/800 CSS pixels, playback handoff, progress, resume, stale-session event
rejection, recommendations and Back navigation. Screenshots were inspected.

No Android emulator or physical Android device has run this APK yet. Native
Media3 decoding, audio/subtitle selection, WebView-to-native messaging on Android,
rotation, keyboard/insets, lifecycle/audio focus and real TorBox links remain
unverified. Browser simulation and a successful build do not prove those work.

First phone test:

1. Launch, sign in, check your addons/library, then type a live search.
2. Open For you and a recommendation; test the Android Back gesture.
3. Play a known working TorBox H.264/AAC link. Seek, choose an audio track and
   subtitles, then exit and replay. Confirm resume is near the saved position.
4. Rotate the phone, open the keyboard, background the app, then return. Confirm
   the page stays usable and playback is paused until you restart it.
5. Check progress on the TV after account sync. Report the playback error code
   if a link fails, and whether that same link works in official Stremio.

For UI/core logs, connect the phone by USB, authorize USB debugging, open
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
shared shell into generated assets, then applies the Android host and stylesheet.
The prebuilt MIT core is included. To reproduce that core, see webos/README.md.

```sh
CHROME_BIN=/path/to/chromium node tests/mobile-browser.mjs
./gradlew runtimeInventory
python3 scripts/collect-sources.py
```

Browser tests need ffmpeg and the webos npm dependencies. vendor/ includes the
resolved runtime sources and notices; one Guava conflict-placeholder JAR contains
no classes and has no source JAR. See THIRD_PARTY.md and the root GPL license.
Redistribute the corresponding combined source with the APK/IPK.

Implementation references:

- https://developer.android.com/develop/ui/views/layout/webapps/load-local-content
- https://developer.android.com/reference/androidx/webkit/WebViewCompat
- https://developer.android.com/media/media3/exoplayer/hello-world
- https://developer.android.com/media/media3/exoplayer/track-selection

[Android signing and update requirements](https://developer.android.com/studio/publish/app-signing).
