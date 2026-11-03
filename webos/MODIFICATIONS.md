# StreamGlass TV changes

Modified 2026-10-30. Unofficial webOS 25 port for LG 75UA7000PUB.

Based on DX.BI commit `c78ca45dff30b23c22a38928445876def0d0d472`.
Original copyright and GPL-3.0-or-later notices are preserved.

The app is named StreamGlass TV to follow DX.BI's request that forks use their own
name. It is not endorsed by DX.BI, Stremio, LG, Torrentio or TorBox.

## Runtime changes

- Reuse the original DX.BI CSS theme, with local fonts and a different wordmark.
- Implement a TV shell independently around MIT-licensed Stremio core 0.66.0.
  Stremio Web's GPLv2-only UI is not distributed or linked into the app.
- Replace Android-specific playback with LG's native HTML5 video element.
- Add remote navigation, hardware playback keys and LG system Back behavior.
- Add external WebVTT/SRT captions, audio selection when the TV exposes tracks,
  native media errors, seeking and resume/progress forwarding.
- Bundle the core worker and WASM as local script data, avoiding file-origin
  module and local-WASM-fetch restrictions.
- Add local diagnostics that exclude account details and private URLs.
- Package with the official LG webOS CLI 3.2.6.

The monolithic DX.BI plugin, desktop/Android binaries, torrent engine, Discord
presence, watch parties and desktop video enhancement are not run by this port.
The unmodified upstream source is supplied with the new code for attribution and
review. The installed app is a standalone implementation of the requested TV
features using the original theme, not a hosted website or a mock interface.

New port source is licensed under GPL-3.0-or-later. Separately licensed libraries
retain their own notices in THIRD_PARTY.md and vendor/.

The source archive contains the preferred source form of the modified theme,
the port, build scripts and pinned dependency metadata. Redistribute the
corresponding source with any IPK you share, and retain these notices and all
third-party licenses. Do not represent this fork as an official DX.BI release.


## 2026-10-31: version 0.2.0

Cinematic home/detail/player styling, home catalog type filters, stream metadata badges, artwork failure fallbacks, bounded caches, remote rail navigation, short native scrolling, route/selection restoration and regression tests. Same app ID and account storage. Details and validation are in RELEASE-0.2.0.md. GPL-3.0-or-later; existing notices retained.


## 2026-10-31: version 0.2.1

Replaced duplicate nav focus outlines with rounded highlights; shaped poster/control focus; header/content focus memory; independently scrolling stream panel and explicit stream navigation; row-keyed Back restoration across Continue Watching insertion; omitted empty filtered rows. Updated regression tests. GPL-3.0-or-later, existing notices retained. See RELEASE-0.2.1.md.


## 2026-10-31: version 0.2.2

Added debounced live search with cancellable requests, per-query stale response protection, four-request concurrency, input/caret preservation, IME handling, query history replacement, clear and retry states, and TV-safe search gutters. Retains the 0.2.1 fixes. Extended full-app browser regression coverage. GPL-3.0-or-later; existing notices retained. See RELEASE-0.2.2.md.

## 2026-10-31: version 0.3.0

Replaced the unsupported search font glyph with inline SVG. Added an independent,
local content-based recommendation engine and For you page with watched/progress/
saved weighting, metadata enrichment, explanations, exclusions, deduplication,
variety, type filters and remote focus restoration. Bounded addon concurrency,
deadlines, cancellation, partial results and in-memory caching. Extended unit
and full-app tests using real core history state. No new runtime dependencies.
GPL-3.0-or-later; existing notices retained. See RELEASE-0.3.0.md for limits,
validation and TV checks.

## 2026-11-01: version 0.4.0

Added 180 ms interruptible row scrolling with reduced-motion support and motion
regressions. Added an independent Android phone/tablet host with a touch layout,
origin-restricted message bridge, native Media3 playback, audio/subtitle menus,
late subtitle updates, lifecycle pause and progress/resume integration. Retained
the shared GPL shell, MIT core, account and recommendation behavior. Added pinned
Android build scripts, JVM/mobile browser tests and runtime source/license
inventory. See RELEASE-0.4.0.md and ../android/README.md for validation and limits.

## Android 0.5.0 (2026-11-01)

- Add an original Android presentation module and stylesheet; do not load the TV
  theme on mobile. Retain shared Stremio state, routing and playback integration.
- Provide optional host hooks for navigation, featured artwork, title actions
  and account state. The TV host continues to use its original rendering.
- Replace mobile top tabs with bottom navigation, use compact poster rows, and
  put stream choices in a focus-managed sheet with Android Back support.
- Keep the StreamGlass name and stable application IDs. The preview signing key
  is excluded from source and remains local.


## Unreleased: curated Home and touch motion

Added curated Featured, seasonal, provider, Anime and Top collections with an
explicit addon-catalog setting; bounded discovery requests and metadata fallback;
a swipeable, timed React billboard; mobile pull-to-refresh; and indigo, iris, rose
and cyan surfaces with limited backdrop blur. Preserved reduced motion, OLED,
keyboard/remote controls and existing playback. Added data and trusted-touch
regressions. GPL-3.0-or-later; existing notices retained.
