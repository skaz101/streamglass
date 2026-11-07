# StreamGlass Android 0.8.0

The shared browsing engine now keeps loaded cards stable as more catalogs arrive, shows featured titles without waiting for a slower collection, and preserves existing titles if refresh fails. Featured artwork and copy transition together after image decoding. The countdown no longer runs a continuous JavaScript animation-frame loop.

Mobile retains its touch navigation, artwork-coloured ambient background, swipeable feature, My List action, and pull to refresh. The featured logo has a stable, readable area so decoding does not shift the Play button. Live public-catalog reviews at 390×844 and 320×720 showed no horizontal overflow; both hero actions remained at least 44 pixels tall.

Version code 800, version name 0.8.0; package ID and preview signing certificate are unchanged. Native player behavior is unchanged. See the GitHub release for CI, signing verification, source, and checksums. Physical Android-device smoothness still needs user testing.
