# StreamGlass

An unofficial Stremio client for **LG webOS TVs and Android phones/tablets**, with a dedicated Android interface, a DX.BI-derived TV theme, live search, local recommendations, and watch-progress sync.

Android **0.6.3** smooths page and refresh transitions, preserves your place on
refresh, adds skeleton loading, and refines Search and My List filters.
LG webOS remains on **0.4.0**. Both are previews; physical-phone testing remains.

## Downloads

- [**Android 0.6.3 APK**](https://github.com/skaz101/streamglass/releases/download/v0.6.3/streamglass-android-0.6.3.apk) — updates the original preview installation.
- [Android 0.6.3 release, source and checksums](https://github.com/skaz101/streamglass/releases/tag/v0.6.3)
- [LG TV 0.4.0 installer (.ipk)](https://github.com/skaz101/streamglass/releases/download/v0.4.0/com.streamglass.tv_0.4.0_all.ipk)
- [LG 0.4.0 release, source and checksums](https://github.com/skaz101/streamglass/releases/tag/v0.4.0)

The Android update retains the original application ID and preview certificate.
Install it over the existing app to preserve local account data.

## Install

- **LG TV:** [installation and updating](webos/INSTALL.md), including rooted TVs. Keep app ID `com.streamglass.tv` and install updates over the existing app.
- **Android:** [installation, signing, and device checks](android/README.md). Package ID `com.streamglass.mobile`; Android 8.0 or later. Updates retain the preview signing certificate.
- **Validation:** [release audit](RELEASE-AUDIT.md) distinguishes fresh checks from historical reports.

Configure addons in your Stremio account, then sign in to StreamGlass. Playback requires direct HTTP/HTTPS media compatible with the device. No torrent engine, transcoder, or debrid credentials are bundled.

## Build

[CI: TV/browser and Android validation](https://github.com/skaz101/streamglass/actions/workflows/validate.yml).

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

## Shared React interface

Android and webOS now use the shared React screens in `webos/src/react/`.
The home screen includes an animated featured carousel and addon catalog rows;
the release calendar follows dated movies and episodes from saved titles.
Native playback and Stremio account integration retain their existing adapters.

For component development, work in `webos/`. Its `components.json` configures
shadcn and the `@react-bits` registry, with Tailwind utilities compiled by the
shared build. See [React UI development](webos/src/react/README.md) for commands
and integration details. The retained upstream Electron application in `app/`
is separate from the Android/webOS runtime.
