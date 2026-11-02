# StreamGlass Android 0.6.1 preview

This update adds motion across the Android app and fixes incomplete player dimming.

- Browsing pages, title information, catalog cards and loaded artwork ease into view.
- Bottom tabs, buttons and My List provide animated feedback.
- Profile, stream and message sheets animate on entry and exit, preserve focus,
  and handle repeated Back presses or replacement during a transition.
- Player controls, seek feedback and screen lock fade in and out. Native player
  settings slide into view and dismiss smoothly.
- The dimming scrim covers the entire player, including cutout edges in fit/fill
  and portrait/landscape. Controls remain inside their safe insets.
- Captions stay clear of controls until their fade completes.
- Reduced-motion preferences disable movement; native controls honor Android's
  system animation setting.

## Validation

The release pipeline builds both APK variants, runs Android lint and JVM tests,
the shared core/browser suites, and the expanded mobile browser integration.
Native tests run real H.264/AAC/WebVTT playback on Android 35 with animations
enabled, including scrim bounds, fade reversal, reduced motion, seeking, captions,
rotation, screen lock and recovery. See `../RELEASE-AUDIT.md` for the exact
validated commit, run and signed APK checksum.

Physical-device motion, vendor cutouts and real addon playback still need phone
testing. No LG TV runtime changes are included.

## Update

Install `streamglass-android-0.6.1.apk` over the existing preview. The package ID
and signing certificate are unchanged, so uninstalling is unnecessary. This is
still a development-signed preview, not a Play Store release.
