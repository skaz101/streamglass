# StreamGlass 0.7.2

- Top movies and Top series are the first collections beneath the featured
  carousel. On phones their cards are numbered in Cinemeta’s catalog order.
- Restore black/charcoal default surfaces and a red StreamGlass mark. Color
  comes from blurred featured artwork, which changes with the title.
- Add a 16px gap below the phone header and 20px below the filter buttons.
- Use compact carousel controls, a white countdown, and clean backdrop artwork.
- Preload adjacent artwork; move feature text/artwork together during swipes;
  shorten and add direction to tab transitions.
- Preserve reduced motion, OLED, keyboard/remote access, refresh and playback.

Install over your existing app to keep local account data. Android retains
package `com.streamglass.mobile` and the original preview certificate.
LG webOS retains `com.streamglass.tv`.

See RELEASE-AUDIT.md for automated validation. Physical-device frame pacing
is separate from browser and emulator checks.
