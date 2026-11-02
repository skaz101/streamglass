# StreamGlass Android 0.6.0 preview

A new native player with familiar streaming-app controls and a cleaner viewing
experience. StreamGlass keeps its own identity and the existing Stremio account,
addon, library and watch-progress integration.

## Player changes

- Immersive fullscreen with a compact title/episode header and large central
  play/pause and 10-second skip controls. Tap the video to show/hide controls;
  double-tap the left or right side to skip ten seconds.
- Red seek timeline with elapsed and remaining time. Drag to seek; canceled
  scrubs preserve the position, and playback resumes only if it was playing.
- Landscape on entry, with a rotation button for portrait. Exiting restores
  the prior orientation policy. Cutouts are kept clear of controls.
- Playback speeds from 0.5× to 2×, remembered on this device.
- One Audio & Subtitles panel, with supported tracks, readable language labels,
  audio channel information and a subtitle Off option. Caption size follows
  your settings, and captions move above the controls while they are visible.
- External subtitles can be enabled after seeking without losing the active cue.
  The pinned Media3 runtime uses its compatible renderer-decoding path.
- Screen lock prevents accidental taps and holds orientation. Tap the locked
  screen to reveal Unlock; Android Back unlocks before exiting.
- Fit/fill toggle and brightness adjustment that affects only the player.
- Playback errors stay on screen with Retry and Choose another stream actions.
  Media3 can try a fallback decoder if initial decoder setup fails.
- Controls auto-hide during playback and remain accessible while paused,
  scrubbing or using settings. Auto-hide is disabled for touch exploration.
  Backgrounding still pauses playback; returning does not start it by itself.

No Netflix code, branding or media is included. Casting, downloads, background
playback, picture-in-picture and automatic next-episode playback are not added.

## Installation

Install `streamglass-android-0.6.0.apk` over the previous StreamGlass preview.
Package ID `com.streamglass.mobile` and the original preview signing certificate
are retained. Version code is 600; minimum Android is 8.0 (API 26), target is 35.
Do not uninstall as an update step.

The distributed APK uses the release configuration with WebView debugging off.
The preview certificate SHA-256 remains
`167c739ded0846e2e7e31884cef42ec58d1154e1145740c1a6ced15d4f9f3ead`.

## Validation scope

CI builds debug/release APKs, checks lint, runs the shared browser suites and
Java unit tests, and exercises the actual native player in an Android 35
emulator. Native tests use generated original artwork with local H.264 video,
two AAC audio tracks and WebVTT captions. Screenshots cover landscape, portrait,
settings, captions, lock and error recovery. The fixture activity and media are
excluded from the release APK.

Physical-phone behavior, real addon/debrid links, device-specific codecs, 4K/HDR
and vendor-specific keyboard/inset behavior still need hardware testing. The
emulator fixture does not establish compatibility with every media format.

The release includes corresponding source and SHA-256 checksums. LG stays on
0.4.0; this release changes the Android player.
