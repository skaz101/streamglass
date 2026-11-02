# StreamGlass Android notices

StreamGlass's Android host, touch stylesheet and integration are independently
written GPL-3.0-or-later code. Copyright (C) 2026 StreamGlass contributors.
The source archive retains DX.BI's original license, attribution and source.
No Netflix code or assets are used. No GPL-2.0-only Stremio Web UI is bundled.

The shared shell, MIT Stremio core, fonts and their source/license inventory are
described in ../webos/THIRD_PARTY.md. Those notices are also inside the APK under
assets/app/licenses. LG's JavaScript player is not used on Android.

Android-specific libraries:

- AndroidX WebKit 1.12.1, copyright The Android Open Source Project, Apache-2.0.
- AndroidX Media3 1.5.1 (ExoPlayer, HLS, DASH, UI and transitive modules),
  copyright The Android Open Source Project, Apache-2.0.
- Other AndroidX support libraries and Kotlin standard library, Apache-2.0.
- Guava and failureaccess, copyright Google, Apache-2.0.
- JetBrains annotations 13.0, Apache-2.0.

The exact resolved runtime inventory is in vendor/dependencies.json. Corresponding
source JARs and POM/license metadata are in vendor/runtime-sources. Extracted
license/notice files are in vendor/licenses and bundled in the APK. A dependency's
own notices control if they differ from this summary. Build-time JUnit and AndroidX Test (runner 1.6.2, rules 1.6.1 and JUnit
extension 1.2.1, Apache-2.0) are test tooling and are not shipped inside the
release APK. Native-test media is generated original artwork and audio. The
fixture host and media are confined to the debug source set.

Gradle wrapper scripts/JAR retain the Gradle contributors' Apache-2.0 license.
Android SDK and JDK are build tools and are not distributed in the source ZIP.
The Android framework and Android System WebView are provided by the device.
No native codec, torrent engine or proprietary streaming service client is added.
