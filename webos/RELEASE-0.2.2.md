> Installation: use [INSTALL.md](INSTALL.md) for current rooted and unrooted TV instructions. Validation below records the original release build.

# StreamGlass TV 0.2.2

Live search, plus the earlier navigation fixes, for com.streamglass.tv.
Install directly over 0.2.0 or 0.2.1. Installing 0.2.1 first is not required. Do not uninstall first; the app's account storage and
Stremio settings are unchanged.

## Changes

- Live search updates results 450 ms after the last edit. Automatic requests
  start at two characters; the Search button immediately submits any nonempty
  title, including one-character titles such as V.
- Results update below the same input element. The app does not rebuild the
  field, move focus or reset the caret during live typing.
- Requests for old queries are aborted and late responses are ignored. No more
  than four search requests run concurrently for a query.
- Composition events are respected for multilingual input. Clearing the field
  clears results. Leaving the search page cancels pending work.
- The query is retained in the current history entry, without adding an entry
  for every keystroke. Back from a title restores the live query and selection.
- Addon failure and no-result states are separate; Search can retry a failed
  query. Search form and results now use consistent TV-safe side padding.

The following 0.2.1 fixes are also included:

- Top navigation now uses one rounded, filled focus highlight. Removed the
  extra white rectangle. Current-page state remains separate from remote focus.
- Poster focus follows the artwork instead of boxing in the caption.
- Buttons, fields, stream choices, dialogs and player controls have consistent
  rounded focus treatments, with visible keyboard/remote indicators retained.
- Left/right stays in the top menu. Down returns to the last focused content
  item on the current page when it is still available.
- Long stream lists scroll within their own panel. The title and stream heading
  stay visible. Up/down stays in the list; Left returns to Choose a stream.
- Back remembers which row a title came from. A new Continue Watching row no
  longer redirects the selection to a duplicate card or shifts saved row offsets.
- Restored selections are kept on screen even when rows are inserted above them.
- Empty Continue Watching rows are omitted when filtering Movies or Series.

## Install or update

Follow [INSTALL.md](INSTALL.md) for the current release and your TV connection
type. Install over the existing app without uninstalling.

## Verification and remaining TV checks

Passed 31 Node tests and Chromium 119 file:// integration using the real bundled
MIT Stremio core WASM, real local H.264/AAC video, and intercepted fake account and
addon services. Tests cover sign-in, library writes, addon sync/install, subtitles,
resume, rounded nav focus, header/content focus memory, long stream-list scrolling,
Continue Watching insertion, row boundaries, type filtering and Back restoration.
New tests cover live typing/debounce, caret and input identity, slow stale
responses, clearing, one-letter manual search, composition, failures/retry,
Back without submitting, leaving during debounce, and search-page gutters.
Remote select-dialog regression also passed. Screenshots at 1920x1080 were
visually inspected. LG official CLI 3.2.6 builds the IPK.

The user has confirmed the previous app works on an LG 75UA7000PUB, SDK 10.3.2,
firmware 33.31.80. Version 0.2.2 has NOT been tested on the physical TV. Please
check typing with LG's on-screen keyboard first: enter at least two characters,
pause briefly and confirm results update while the keyboard remains usable.
Native keyboard behavior has not been verified on hardware. The manual Search
button remains available. Also check the navigation and a known working TorBox
stream after updating. No live user credentials or TorBox links were used
in the automated tests. Hardware codecs, audio-track exposure, HDR and TV
on-screen keyboard behavior still depend on the TV.

For logs, run:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-inspect --device lg-tv --app com.streamglass.tv --open
```

In the inspector console: copy(window.StreamGlassDiagnostics.export())
Blue on the remote (F2 on a keyboard) opens app information. Share the sanitized
export and what you pressed. Avoid sending passwords, configured addon URLs,
signed playback links or unredacted network logs.

## Source and license

The complete corresponding source ZIP includes original DX.BI code and notices,
GPL-3.0-or-later port source, MIT Stremio core source and bundled dependency
notices. No Netflix assets or code are included. No new runtime dependency in
this release. Existing playback, account and addon APIs are retained.

From webos/: npm ci; npm run build:core; npm test; npm run build; npm run package.
Browser suite: CHROME_BIN=/path/to/chromium node tests/browser.mjs
Remote dialog: CHROME_BIN=/path/to/chromium node tests/review-host-browser.cjs
Browser playback tests require ffmpeg with H.264/AAC support.
Source ZIP: python3 scripts/source-archive.py
