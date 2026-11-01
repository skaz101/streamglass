> Installation: use [INSTALL.md](INSTALL.md) for current rooted and unrooted TV instructions. Validation below records the original release build.

# StreamGlass 0.4.0: smoother TV browsing and Android phones/tablets

## LG TV update

Up/down between category rows now uses a short 180 ms ease-out scroll instead
of jumping instantly. Focus changes immediately. Another remote press retargets
from the current position, so animations never build a queue. Pointer/touch,
wheel input and route changes cancel the animation. Reduced-motion preference
skips it. The stream list keeps its own scrolling and navigation behavior.

Search, account sync, playback and For you recommendations from 0.3.0 are retained.
The LG package ID stays com.streamglass.tv. Install over 0.2.x or 0.3.0 without
uninstalling. Save com.streamglass.tv_0.4.0_all.ipk in a local folder:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-launch --device lg-tv --close com.streamglass.tv
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-install --device lg-tv ./com.streamglass.tv_0.4.0_all.ipk
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-launch --device lg-tv com.streamglass.tv
```

If close says the app is not running, continue. Use your existing saved TV
connection. Rooted TVs use Homebrew Channel SSH; do not enable Developer Mode
on a rooted TV. See [INSTALL.md](INSTALL.md).

## Android phone/tablet app

The separate streamglass-android-0.4.0.apk contains the same shell/core with a
touch layout and native AndroidX Media3 player. Supports sign-in, synced addons,
library, live search, recommendations, direct streams, audio/subtitle menus and
progress/resume callbacks. No webOS developer setup is needed on the phone.

Open the APK on the phone and allow installation from that browser/file manager
when prompted. Sign in with the same Stremio account. The minimum is Android 8.0
with an updated System WebView; the first intended test device is the Galaxy S25.
Package ID com.streamglass.mobile does not replace the official Stremio app.

This is a signed development/test build, not a Play Store release. The original development key is excluded from this public source. Updates to
the supplied test APK require that original key; other builders use their own
key. A differently signed APK cannot update an existing installation in place. Background playback, PiP, casting, downloads,
raw torrent downloading and full TV subtitle-style controls are not implemented.
Native playback pauses when the app is backgrounded. HTTPS addons are required;
native direct media can use HTTP or HTTPS. Cookie/Authorization media headers
are not forwarded. See android/README.md in the combined source for full details.

## Verified and not verified

- 40 shared Node tests pass.
- Chromium 119 full TV integration passes with real core WASM, fake account/addon
  services and local H.264/AAC video. The separate remote select test passes.
- Animation tests check intermediate frames, direction reversal, route
  cancellation and reduced motion.
- Mobile browser integration passes at 320/390/800 CSS-pixel widths, with real
  core state and a simulated native player: touch search/login, recommendations,
  playback handoff, progress/resume, stale-session protection and Back.
- Android debug APK compiles; three JVM tests pass; Android lint has no errors.
- LG IPK is built using the official webOS CLI 3.2.6. Package/source contents and
  APK signature are checked. Phone and TV screenshots were inspected.

This release has not run on the physical LG TV or an Android device/emulator.
Android native decoding, bridge behavior on real WebView, audio/subtitle menus,
rotation, keyboard/insets, lifecycle/audio focus and real TorBox streams remain
unverified. No real account credentials or TorBox links were used in tests.

On the TV, press Down/Up between rows, then hold Down and quickly reverse. Check
that the focused poster stays visible and scrolling stops without drift. Open
a title and return with Back. Test a known working stream after updating.

On the phone, check login, live typing, For you, playback/audio/subtitles, seeking,
exit/resume, rotation and returning from the background. Check synced progress
on the TV. Share an error code and the steps if something fails.

## Logs

LG inspection:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-inspect --device lg-tv --app com.streamglass.tv --open
```

Android inspection: connect USB with USB debugging authorized, then open
chrome://inspect/#devices in desktop Chrome and inspect the StreamGlass WebView.
In either inspector Console:

```js
copy(window.StreamGlassDiagnostics.export())
```

For an Android crash before the UI loads: adb logcat -b crash -d. Review before
sharing. Do not send passwords, configured addon URLs, signed links or raw
network logs. Diagnostics exported by the app omit those private values.

## Source and builds

streamglass-0.4.0-source.zip is the combined corresponding source for both apps,
including original DX.BI notices, GPL-3.0-or-later new code, MIT core source,
Android runtime source JARs, dependency inventories and license notices.
No Netflix assets/code or GPL-2.0-only Stremio Web frontend is bundled.

LG: webos/README.md. Android: android/README.md. Keep the source with any
redistributed APK/IPK. SHA256SUMS covers both packages, the source and this guide.
