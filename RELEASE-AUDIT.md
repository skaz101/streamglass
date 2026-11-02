# StreamGlass release audit

## Android 0.6.0 native player

[Validation run 41393673766](https://github.com/skaz101/streamglass/actions/runs/41393673766)
passed at `8d94fd5c560ec2eb7737ee6ca671e10c65933d7e`:

- 40 shared Node tests, six Android JVM tests and the source-export regression.
- Six browser suites: core, player, remote dialog, motion, TV and mobile.
- Android debug/release compilation, both lint variants, and TV packaging.
- Actual H.264/AAC/WebVTT playback on an Android 35 AOSP emulator: pause,
  ten-second skips, double taps, timeline scrubbing, speed, audio/subtitle
  selection, lock, rotation, auto-hide, background pause and error recovery.
- Captions enabled after a seek render correctly. Geometry assertions and native
  screenshots confirm captions stay clear of the timeline and Unlock button.
- Native landscape, portrait, speed, tracks, captions, lock, brightness and
  error screenshots reviewed. The artwork and local media are original fixtures.

The validated unsigned release APK was signed locally with the original preview
key. SDK apksigner verified v2/v3 signatures and the unchanged certificate.
Every ZIP entry remained identical after signing. Release assets match source;
fixture media and the debug-only player activity are absent from the release APK.

APK SHA-256: `bee07fca560745fe7d348fd55e53bad65b312e696a79a56ec7f2962e82928baf`.
Certificate SHA-256: `167c739ded0846e2e7e31884cef42ec58d1154e1145740c1a6ced15d4f9f3ead`.
Package: `com.streamglass.mobile`; version: `0.6.0`; version code: `600`.

The corresponding source's subsequent changes only record publication and remove
temporary transfer tooling. Android and shared app sources are unchanged from
the successful validation run. Routine CI has read-only repository permissions;
the signing key remains local and is excluded from source archives.

Physical phones, real addon/debrid media, audio focus and device-specific codecs
still need testing. Native emulator tests isolate the player from the account
and network; browser tests simulate the WebView/native bridge. This remains a
preview, with WebView debugging disabled. LG remains on 0.4.0.

## Android 0.5.0

[Validation run 41290194733](https://github.com/skaz101/streamglass/actions/runs/41290194733)
passed at `271891b6a7ecdd4e2cbd494f1deef4f33b4f0afb`:

- 40 shared Node tests, three Android JVM tests and the source-export regression.
- Six browser suites: real core, player, remote dialog, motion, TV and mobile.
- Android debug and release compilation, lint for both variants, and TV packaging.
- Mobile screenshots reviewed at 320, 390 and 800 pixels, plus 844 × 390 landscape.
  Fixtures are fictional and isolated; native playback is mocked in browser tests.
- Mobile tests cover bottom navigation, login/search, My List, episodes, accessible
  stream sheets, Back, focus restoration, progress/resume and stale native events.

The tested unsigned release APK was signed locally with the original private
preview key. Android SDK `apksigner` verified APK v2 and v3 signatures. The signer
certificate matches the original 0.4.0 APK exactly; all ZIP entries were unchanged
by signing, and the bundled mobile source matches the validated commit.

APK SHA-256: `6957dbd11965d6cd9ce064df174cf5596ecb8374788fb3e4bdf8e8168bb83235`.
Certificate SHA-256: `167c739ded0846e2e7e31884cef42ec58d1154e1145740c1a6ced15d4f9f3ead`.
Package: `com.streamglass.mobile`; version: `0.5.0`; version code: `500`.

The source snapshot's only subsequent changes are publication documentation and
removal of temporary build-transfer tooling. Runtime sources are unchanged.
The signing key never entered GitHub or the source archive. Routine CI has
read-only repository permissions and uploads the unsigned release build.

Native Android decoding, keyboard/insets, rotation and lifecycle still require
physical-device testing. This remains a preview, with WebView debugging disabled
in the distributed release-configured APK. LG's installer remains on 0.4.0.

## Historical 0.4.0 publication audit

This records the recovered release and publication cleanup. Original release
notes and validation JSON files are historical results, not fresh CI results.

## Fresh local checks

- All 40 shared Node unit tests passed.
- Before documentation cleanup, a webOS build reproduced all 1,367 files listed
  in the original 0.4.0 IPK's manifest, byte for byte.
- The cleaned tree assembles successfully and packages with LG CLI 3.2.6.
  Packaging used an existing local copy of that pinned CLI: a fresh `npm ci`
  could not complete because network access was unavailable and the cache was
  incomplete. Dependency installation and core rebundling need CI validation.
- The Android asset assembly completed. The original APK's core client,
  recommendations and embedded core match the TV files. ZIP integrity passed.
- An independent APK v2 check verified the RSA/SHA-256 signature and chunked
  content digest. This is not a substitute for Android device testing.
- The source-export regression passed: signing keys, local settings, environment
  secrets, build output and symlinks are excluded; dependency source archives
  remain included.
- The public source was checked for the owner's personal paths, TV address,
  private-key headers and common access-token patterns. A token-pattern match
  inside the unchanged encoded WASM bundle was not an actual credential.
  This targeted scan is not a comprehensive security review.

## Public-source changes

The root README now describes StreamGlass, with the original retained as
README-UPSTREAM.md. Installation instructions cover rooted and unrooted TVs.
Personal paths and network details were removed from release notes. Android
signing uses the original local development key when available, otherwise the
builder's own debug key. Signing keys are excluded from Git and source exports.
Runtime app behavior is unchanged; the original installers retain version 0.4.0.

## Original installer checksums

```text
118cdd55b2d6255325cef95aaf03646ef764988d1d043cbe3ddb45c7eb14652e  com.streamglass.tv_0.4.0_all.ipk
0349cfa56f74374189a986f2daf2d95b83015b98832415fb154922e3a05c7ee7  streamglass-android-0.4.0.apk
```

Android signer certificate SHA-256:
`167c739ded0846e2e7e31884cef42ec58d1154e1145740c1a6ced15d4f9f3ead`.

## Fresh CI validation

[Run 41288138848](https://github.com/skaz101/streamglass/actions/runs/41288138848)
passed both jobs at commit `cc18d7afd3e61fa92c731430b75c673bd0e5e49e`.

- Clean npm installation, 40 shared Node tests, and the source-export regression.
- Core rebundling, TV app assembly and IPK packaging.
- All six browser suites: real-core state, video player, remote dialog, animation,
  full TV app, and mobile layout/native-bridge simulation.
- Android debug compilation, three JVM tests, and lint.
- Build/source artifacts and browser/Android reports uploaded by CI.

The original browser suite had two assertions that read the previous screen
before hash navigation rendered the new one. The tests now wait for the new
filter and results, retaining their original behavior assertions. The Android
SDK setup now requests platform-tools instead of the retired tools package.

## Local environment and remaining hardware checks

The local environment lacked an Android SDK/JDK 17 and a complete Playwright
installation. Android compilation/lint/JVM tests and browser integration were
not rerun locally. The successful CI run above supplies those checks and publishes build/report
artifacts.
CI uses an ephemeral debug signing key, so its Android APK is not distributed
as an update to the original preview installation.

Physical LG and Android playback, subtitle/audio selection, resume, rotation,
keyboard behavior and lifecycle handling still require device validation.

The inherited DX.BI workflows and funding metadata are retained in
`upstream-workflows/` as inactive reference files. Only StreamGlass validation
is active. The first import briefly triggered the upstream desktop checks;
they do not validate this port.

## GitHub Release publication

[StreamGlass 0.4.0 Preview](https://github.com/skaz101/streamglass/releases/tag/v0.4.0)
contains the unchanged original APK/IPK, the cleaned corresponding source ZIP,
and SHA256SUMS. The release is marked as a prerelease pending physical-device
validation. The source snapshot and tag point to
`63709d73b88099ffc2f21ebbded199f07288ec2a`.

[Publish run 41288666947](https://github.com/skaz101/streamglass/actions/runs/41288666947)
verified the existing successful validation run, checked the original installer
checksums, tested source-export exclusions, and compared all uploaded asset
sizes and SHA-256 digests before publishing the draft. The temporary publication
workflow and duplicate installers were then removed from main. Git history
retains the original source snapshot; no history was rewritten.
