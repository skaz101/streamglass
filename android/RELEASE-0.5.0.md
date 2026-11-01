# StreamGlass Android 0.5.0 preview

A dedicated phone and tablet interface inspired by familiar streaming-app
browsing patterns. The name remains StreamGlass.

- Artwork-led Home with Movies / Series filters and compact poster rows.
- Four bottom tabs: Home, For You, Search and My List.
- Profile menu for your account, full catalog browsing, addons and settings.
- Full-width Play / Resume and My List actions on title pages.
- Stream choices in a slide-up panel; episode selection opens the matching
  streams. Android Back dismisses the panel before leaving the title.
- Focus restoration, keyboard containment, reduced motion, portrait/tablet/
  landscape layouts, and an original matching launcher mark.
- Existing Stremio account/addon/library sync, recommendations, native Media3
  playback, subtitle handoff and watch-progress/resume integration retained.

## Update

Install `streamglass-android-0.5.0.apk` over 0.4.0. Application ID
`com.streamglass.mobile` and the original preview certificate are preserved;
version code is 500. Do not uninstall as an update step.

This APK uses the release build configuration (WebView debugging disabled)
but retains the private development certificate for preview compatibility.
Certificate SHA-256:
`167c739ded0846e2e7e31884cef42ec58d1154e1145740c1a6ced15d4f9f3ead`.

## Validation

GitHub Actions builds both Android variants, runs their lint checks and three
JVM tests, and runs the shared core, player, remote, motion, TV and mobile browser
suites. Mobile coverage includes sign-in, touch search, saved-list updates,
stream sheets, Android Back, focus restoration, seasons/episodes, native bridge
payloads, progress, resume and stale native events. Layouts cover 320, 390 and
800 pixels plus 844 × 390 landscape. Review screenshots use fictional fixture
artwork and isolated services; no account credentials or API writes leave the
tests.

Physical Android playback, codecs, audio/subtitle selection, system keyboard,
rotation and lifecycle still need phone testing. A browser simulation and
successful Android build do not establish hardware compatibility. Casting,
downloads, picture-in-picture and a torrent engine are not included.

LG remains on 0.4.0. Shared rendering hooks are optional; the TV host continues
to use its existing layout. Supply the corresponding 0.5.0 source archive when
redistributing the Android APK.
