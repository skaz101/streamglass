# StreamGlass

An unofficial Stremio client for **LG webOS TVs and Android phones/tablets**, with a DX.BI-derived theme, remote navigation, live search, local recommendations, and watch-progress sync.

Version **0.4.0** is a preview. Android native playback still needs device testing; automated browser tests do not establish hardware compatibility.

## Downloads (0.4.0 preview)

- [LG TV installer (.ipk)](https://github.com/skaz101/streamglass/raw/refs/heads/main/downloads/0.4.0/com.streamglass.tv_0.4.0_all.ipk)
- [Android development APK](https://github.com/skaz101/streamglass/raw/refs/heads/main/downloads/0.4.0/streamglass-android-0.4.0.apk)
- [Corresponding source snapshot](https://github.com/skaz101/streamglass/archive/bb5a6b209cc488b566a2b3316bc20ec7b9d107b8.zip)
- [SHA-256 checksums](downloads/0.4.0/SHA256SUMS)

These are the original 0.4.0 installers. The Android APK retains its original
development signature so it is not silently replaced by a differently signed
CI build. Device playback testing remains required.

## Install

- **LG TV:** [installation and updating](webos/INSTALL.md), including rooted TVs. Keep app ID `com.streamglass.tv` and install updates over the existing app.
- **Android:** [installation, signing, and device checks](android/README.md). Package ID `com.streamglass.mobile`; Android 8.0 or later. The original APK is a development build.
- **Validation:** [release audit](RELEASE-AUDIT.md) distinguishes fresh checks from historical reports.

Configure addons in your Stremio account, then sign in to StreamGlass. Playback requires direct HTTP/HTTPS media compatible with the device. No torrent engine, transcoder, or debrid credentials are bundled.

## Build

Use Node.js 22 or 24.

```sh
cd webos
npm ci
npm test
npm run build
npm run package
```

The pinned, prebuilt MIT Stremio core is included. `npm run build:core` rebuilds its JavaScript/WASM bundle. See [webOS build details](webos/README.md).

For Android, install JDK 17 and Android SDK platform 35/build-tools 35.0.0, set `ANDROID_HOME`, then run:

```sh
cd android
./gradlew assembleDebug testDebugUnitTest lintDebug
```

New builders use their own automatically generated debug key. The original test signing key is excluded from this repository and source archives; see [Android signing](android/README.md#signing-and-updates) before updating an existing installation.

## Project layout

- `webos/`: shared shell/core, TV player, build tooling, tests, and vendored dependency sources.
- `android/`: touch host, native Media3 player, tests, and runtime source notices.
- `dxbi.theme.css`: original theme input.
- `README-UPSTREAM.md`, `app/`, `tv/`, and other upstream files: retained DX.BI material; upstream screenshots and features are not a description of this port.

## License and attribution

StreamGlass and the reused DX.BI theme are GPL-3.0-or-later. See [LICENSE](LICENSE), the original [NOTICE](NOTICE.md), [modification history](webos/MODIFICATIONS.md), and dependency notices for [webOS](webos/THIRD_PARTY.md) and [Android](android/THIRD_PARTY.md). Separately licensed dependencies retain their notices. Supply corresponding source with redistributed installers.

StreamGlass is not endorsed by DX.BI, Stremio, LG, or any addon provider.
