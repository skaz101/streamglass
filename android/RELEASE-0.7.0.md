# StreamGlass 0.7.0

- Shared React interface for Android and LG webOS.
- Cinematic home artwork, animated featured carousel and addon catalog rows.
- Restyled search, My List, details, stream sheets, settings and calendar.
- Release calendar follows precise dates from addons for saved movies/episodes.
- Classic, Amethyst and OLED themes, reduced motion and remote/touch navigation.

Android package ID and preview signing certificate are retained. Install over the
existing app to preserve account data. The native player remains Media3.

Calendar coverage depends on addon metadata and checks up to 500 library entries;
year-only release information is not converted into a fabricated date. Slow
addons return partial results with a refresh option.

Automated browser and emulator validation is recorded in RELEASE-AUDIT.md.
Physical Android and LG hardware checks are separate from automated validation.
