# StreamGlass TV 0.8.3 — keep browsing comfortably

Short visits to Search, For you, My List, or Calendar now retain Home's decoded artwork, featured title, selected card, and scroll position. Returning resumes that screen without another loading phase. Only one Home is retained, for at most two minutes; its slideshow pauses while away. Account, library, addon, and app-visibility changes invalidate it.

The remote skips collections that are still loading and keeps category headings visible when moving upward. Search remembers the result you left when returning from the field. Addon rows' See All links are reachable by pressing Right after the last card, with Left returning to the row.

Submitting Search moves into the first usable results without waiting for slower addons. Later responses cannot pull focus back after you move away. TV Search offers up to six recent searches saved on this device, with Clear history. Only submitted searches or searches whose result you open are saved. Android's search history and navigation are unchanged.

The first landscape row, including captions, fits the 720p viewport. Featured logos and two-line title fallbacks share a bounded area, preventing logos from covering the year and genres. The artwork's left edge blends into the existing charcoal background. Reduced motion remains supported.

Player teardown also continues through independent cleanup steps if a native media or subtitle operation throws. The cleanup regressions cover source removal, DOM detachment, close notification, saved position, and numeric error diagnostics. This is independent of the CleanYourTV startup compatibility repair recorded in TESTING.md; the installer does not modify that helper or restart TV media services.

## Verification

All 55 unit tests and the packaged TV and shared Android browser suites passed, with no runtime errors. Focused checks also passed for tab-return identity and cache expiry, account/library/addon invalidation, progressive search focus, recent-search controls, loading-row navigation, 720p/1080p geometry, hero image handoff, smooth-scroll interruption, reduced motion, and player cleanup. Browser checks use isolated service fixtures and locally generated H.264/AAC video. They do not establish sustained frame rate or hardware-decoder behavior on an LG TV.

The update was installed over 0.8.2 on the LG TV on 2026-11-23. The installed app reports 0.8.3. YouTube's active 1920×1080 video output remained connected after installation. StreamGlass was not opened during that viewing session, so this release's physical remote-navigation feel remains to be checked in normal use.

Install over the existing `com.streamglass.tv` app to retain its settings and sign-in. Keep the corresponding source archive with the IPK. This release is for LG TV; the published Android installer remains 0.8.2.
