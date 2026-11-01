> Installation: use [INSTALL.md](INSTALL.md) for current rooted and unrooted TV instructions. Validation below records the original release build.

# StreamGlass TV 0.3.0

Search icon fix and personal recommendations for com.streamglass.tv.
Install directly over 0.2.0, 0.2.1 or 0.2.2. Keep the existing installation;
the app ID, account storage and playback integration are unchanged.

## Changes

- The Search button uses an inline SVG magnifying glass. It no longer depends
  on the TV having the font character that appeared as a rectangle. Both pointer
  clicks and remote Enter still open live search.
- A new For you page recommends up to 24 titles from your installed catalogues.
  Each card explains the connection: Because you watched, Because you started,
  or Similar to a title in your library. Movies, Series and Anime filters are
  available, with Refresh picks to retry or fetch a fresh set of catalogues.
- Matching compares genres and, when provided, directors and cast. Completed
  titles have more influence than started titles, which have more influence
  than saves. Recent entries have more weight. Small variety adjustments keep
  one genre or reference title from dominating comparable matches.
- Titles already in the library sample are excluded. Duplicate catalogue entries
  are removed by media type and ID. Different IDs for the same title may still
  appear; addon identity is not universally consistent.
- Metadata lookups, scoring, filters and selection restoration run without
  changing the account or playback APIs. The existing live search and remote
  navigation fixes are retained.

## How recommendations work and their limits

This is a local content-based recommendation engine. It does not use Netflix's
model, collaborative ratings, an external AI API, a paid key or a new account.
Matching and ranking run on the TV. Catalogues, artwork and individual title
metadata still come from your installed addons, so those providers receive
normal requests for the queried title IDs. Your library is not uploaded to a
new recommendation service. Diagnostics contain counts, never title names,
library IDs, credentials or configured addon URLs.

To keep the TV responsive, each run considers the latest 500 entries exposed by
the core's library view, chooses up to 12 watched/started/saved examples, and
checks up to eight catalogue feeds with 60 entries each. It can enrich up to 24
candidates with missing metadata, balanced across media types. Results are
cached in memory for three minutes and invalidated by history/account/addon
changes. Refresh picks bypasses that result cache. No recommendation cache is
written to disk. Addon requests have a 20-second individual timeout and the
recommendation network work has a 40-second overall deadline. Leaving the page
cancels outstanding work. Partial results can still be shown if an addon fails.

The Stremio library projection excludes removed entries. Deleted/removed history,
titles beyond the latest 500, history not yet synced from another device, and
metadata your addons do not provide cannot be used. A started title means at
least 5% progress; completion uses the core's watched flag. Recommendations do
not imply that a playable Torrentio/TorBox stream exists. Open a title to check
its streams as usual. If the sample is empty or no metadata matches, the page
says so rather than claiming unrelated popular titles are personal matches.

## Install or update

Follow [INSTALL.md](INSTALL.md) for the current release and your TV connection
type. Install over the existing app without uninstalling.

## Verification

Passed 40 Node tests and the Chromium 119 file:// full-app integration suite.
The browser test runs the real bundled MIT Stremio core WASM and local H.264/AAC
video, with intercepted fake account and addon services. Recommendation checks
cover real core watch progress and marked-watched records, exclusions, missing
genre enrichment, type filters, cache reuse, remote card navigation, Back/focus
restoration, unavailable addons, retry, cancellation and an empty library.
Existing sign-in, addon sync/install, live search, subtitle, playback/resume,
library-write and sanitized-diagnostics checks also pass. The separate remote
select-dialog regression passes. The 1920x1080 layout was visually inspected.
The IPK is built with LG's official webOS CLI 3.2.6.

This release has not been tested on the physical LG 75UA7000PUB. Prior versions
were confirmed working by the user. No real account credentials or TorBox URLs
were used in automated tests. Recommendation relevance for your actual library,
network performance, native LG keyboard and pointer behavior, HDR, codecs and
hardware audio-track exposure still require TV testing.

On the TV, check:

1. The magnifying glass is visible. Open Search by pointer and remote OK, then
   type a title and check live results.
2. Open For you. Confirm the explanations reference titles you recognize and
   watched/saved titles in the scanned library are not suggested again.
3. Change the Movies/Series filter, open a suggestion, and press Back. Confirm
   the selected card is restored. Refresh picks should complete or explain an
   addon failure.
4. Play a known working TorBox link and verify resume, audio and subtitles.

For logs:

```sh
npm exec --yes --package=node@22 --package=@webos-tools/cli@3.2.6 -- ares-inspect --device lg-tv --app com.streamglass.tv --open
```

In the inspector console, run:

```js
copy(window.StreamGlassDiagnostics.export())
```

The recommendations_ready event records seedCount, candidateCount, resultCount
and partial. The blue remote button (F2 on a keyboard) shows app/version info.
Share the sanitized export and the actions that failed. Do not share passwords,
configured addon URLs, signed playback URLs or unredacted network logs.

## Source and license

The corresponding source ZIP includes the original DX.BI source/notices,
GPL-3.0-or-later port, MIT Stremio core source, pinned dependencies and bundled
license notices. No new runtime dependencies or Netflix assets are included.
Keep the corresponding source with any IPK you redistribute.

From webos/:

```sh
npm ci
npm run build:core
npm test
npm run build
npm run package
CHROME_BIN=/path/to/chromium node tests/browser.mjs
CHROME_BIN=/path/to/chromium node tests/review-host-browser.cjs
python3 scripts/source-archive.py
```

The prebuilt generated core source is included, so build:core can be omitted
unless changing or reproducing the embedded core. Browser playback tests need
ffmpeg with H.264/AAC support. See README.md for core rebuild prerequisites.
