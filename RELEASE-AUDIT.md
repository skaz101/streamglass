# 0.4.0 publication audit

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
