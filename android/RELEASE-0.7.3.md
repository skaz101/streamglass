# StreamGlass 0.7.3

- Featured titles put Play and My List together. Tap the artwork or its info
  control for details. Saves use the real Stremio library and stay associated
  with the correct title during swipes.
- Categories opens a sheet of Home collections. Calendar has its own header
  shortcut; addon catalogs and Home settings are also available in the sheet.
- Title pages lead with Play/Resume, followed by the synopsis and compact
  My List / Episodes actions. Back stays reachable while scrolling.
- My List has one-tap type filters and sorting beside its title. Search puts
  the search field first and keeps it available while browsing results.
- Details retain the originating bottom tab. Calendar and app pages return
  to that tab and its filters. Tapping the current tab scrolls back to the top.
- Preserve the black surfaces, artwork-derived blur, Top collection order,
  slideshow progress, pull to refresh and reduced-motion support from 0.7.2.

Install over the existing Android app to retain local data. Package
`com.streamglass.mobile` and the original preview certificate are unchanged.
See [release audit](../RELEASE-AUDIT.md) for validation and installer checks.

The player still uses addon streams. Play opens the stream chooser when a
source is needed. Physical-phone frame pacing remains separate from automated
browser and emulator validation.
