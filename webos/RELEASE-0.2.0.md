> Installation: use [INSTALL.md](INSTALL.md) for current rooted and unrooted TV instructions. Validation below records the original release build.

# StreamGlass TV 0.2.0

An unofficial GPL-3.0-or-later DX.BI-derived webOS app. App ID remains
`com.streamglass.tv`. This is an in-place update of 0.1.0; no storage migration
or account reset is performed. Do not uninstall the working app first.

## Changes

- Cinematic home banner, restrained dark surfaces, refreshed typography and
  navigation, larger landscape cards in the first catalog and Continue Watching.
- For you / Movies / Series filters using installed addon catalogs. “For you” is
  the account's catalog view, not a new recommendation algorithm.
- Focused cards can update the home spotlight after a short dwell while the
  banner remains in view. No autoplay trailers or continuous background zoom.
- Short focus transitions and native horizontal smooth scrolling. Held keys use
  immediate scrolling; reduced-motion preference disables animation.
- Left/right stays in a catalog row; vertical movement remembers each row's last
  card. Back from details returns to the originating home/search/library/catalog
  screen and restores the selected card and scroll positions when available.
- Restyled detail, settings, account, episode and player controls. Stream quality
  badges reflect words in addon metadata; they do not verify codec support.
- Broken poster/logo fallback. Bounded metadata and catalog caches.
- Existing Stremio authentication, addons, library, watch progress, TorBox direct
  links and native HTML video behavior retained.

## Install or update

Follow [INSTALL.md](INSTALL.md) for the current release and your TV connection
type. Install over the existing app without uninstalling.

## Hardware status and checks to perform

The user confirmed 0.1.0 installs, launches and streams successfully on their
LG 75UA7000PUB. Reported device output: SDK 10.3.2, firmware 33.31.80,
board K25LP_ATSC_US. That is user-reported evidence for 0.1.0, not hardware
validation of 0.2.0.

For 0.2.0 check:
1. Account and addons still present after updating.
2. D-pad through at least 10 cards; hold Left/Right and move between rows.
3. Open a card, press Back; confirm selection and scroll position return.
4. Search, open a result, press Back; confirm search results return.
5. Movies and Series filters; See All opens the correct catalog.
6. Play a known working TorBox title, seek, select subtitles/audio where exposed.
7. Stop and resume; check progress from another Stremio device.
8. Long playback, suspend/wake, Magic Remote pointer and TV on-screen keyboard.

No claim of Netflix-equivalent performance or physical TV validation is made.
4K/HDR decoding, embedded subtitles and track availability depend on the stream
and LG's native player. No torrent engine or custom request-header proxy added.

## Diagnostics

Keep the laptop connected directly to the TV's LAN, then run:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-inspect --device lg-tv --app com.streamglass.tv --open
```

In the inspector console run `copy(window.StreamGlassDiagnostics.export())`.
The Blue remote key (or F2) opens app information. Send the sanitized diagnostic
JSON, what you pressed, and what appeared on the TV. Do not share credentials,
configured addon URLs, signed stream links or unredacted network captures.

## Build and tests

From webos/: `npm ci`, `npm run build:core`, `npm test`, `npm run build`,
`npm run package`. Packaging uses LG's official @webos-tools/cli 3.2.6.
`python3 scripts/source-archive.py` produces the corresponding source ZIP.

Browser integration: `CHROME_BIN=/path/to/chromium node tests/browser.mjs`.
Remote-select regression: `CHROME_BIN=/path/to/chromium node tests/review-host-browser.cjs`.
Playback integration requires ffmpeg with H.264/AAC support.

0.2.0 verification: 31 Node tests; Chromium 119 file:// full-app integration with
real MIT core WASM and real local H.264/AAC video, intercepted fake account and
addon services. Tests cover login, library writes, addon sync/install, settings,
external subtitles, resume, home filtering, row boundaries/memory, search-origin
and Back restoration, and secret-free diagnostics. No live account credentials
or real TorBox links were used in these automated checks.

Original source and notices remain in the source ZIP. New UI and navigation
changes are GPL-3.0-or-later; MIT Stremio core and all bundled license notices are
retained. No Netflix code, assets, logos or branding are included.
