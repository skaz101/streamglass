# StreamGlass TV 0.1.0: verification and TV test record

Target: LG 75UA7000PUB, 75-inch UHD display, webOS 25, reported version
10.3.2-34. App ID: `com.streamglass.tv`.

The runtime uses DX.BI's original GPL-3.0-or-later CSS theme, an independent
TV shell, and the MIT-licensed Stremio core. It does not run the original
DX.BI plugin or bundle the GPL-2.0-only Stremio Web application. Visual and
feature parity with every desktop DX.BI feature is not claimed.

## What this build does and does not prove

**Physical-TV verification is required.** A package that builds and passes
desktop tests can still fail because the LG media pipeline, device codec
support, network policy, and file-scheme behavior differ from a computer.
The webOS simulator also does not support `mediaOption`.

Build/test record for 0.1.0, prepared 2026-10-30:

- Node.js 24.22.1 and official LG webOS CLI 3.2.6.
- JavaScript/WASM bundle compiled with esbuild 0.25.12, target Chrome 120.
- 30 Node unit tests passed.
- Actual Stremio WASM core initialized from `file://` in desktop Chromium
  119.0.6045.0 and 153.0.8010.0, without file-access bypass flags.
- Core tests passed: intercepted successful/failed login, addon sync,
  saved sign-in, signed-in library writes, progress, backward seek,
  persisted resume after core restart, and worker crash recovery.
- Native browser H.264/AAC playback, SRT-to-WebVTT rendering, pause/seek,
  subtitle Off, saved-position resume, close, page-hide flush, stale
  subtitle cancellation and unsupported-header errors passed.
- Full packaged-app tests passed on Chromium 119: account forms, addon
  sync/install, title selection, playback, subtitles, library/progress,
  resume, search, settings, D-pad navigation and redacted diagnostics.
  The background-sync/typed-addon-form regression is included.
- Dedicated remote tests passed: Enter/arrow dropdown selection,
  keycode 461 Back cancellation and focus restoration.
- LG's official `ares-package --no-minify` built the IPK and
  `ares-package --info-detail` inspected its metadata successfully.

All account/addon API responses in automated browser tests were intercepted
fixtures. Test media was generated locally with ffmpeg. No real account was
created, no real credentials were used, and no live account was modified.
These tests are not a webOS emulator or physical-TV test.

Anonymous network probes from this build environment returned HTTP 200 and
`Access-Control-Allow-Origin: *` for Stremio's login preflight and Cinemeta's
manifest. Cinemeta's catalog and Torrentio's public manifest returned 403
here. The cause was not established. Their reachability on the TV and
configured TorBox playback remain unverified; the app shows addon errors.

Reproduce the checks after `npm ci` and `npm run build:core`:

```sh
npm test
npm run build
node tests/core-browser.mjs
node tests/player-browser.cjs
node tests/review-host-browser.cjs
npm run test:browser
npm run package
```

Install Playwright Chromium first with `npx playwright install chromium`.
The video tests also require `ffmpeg` with H.264/AAC encoding. Optional
`CHROME_BIN` selects an existing Chromium binary for core/app/remote tests;
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` does the same for the isolated player test.
Do not mark a TV check as passed from these desktop results.

| Check | Verification state |
|---|---|
| Official LG CLI creates and inspects the IPK | Passed, CLI 3.2.6 |
| Automated webOS port tests | Passed, 30 unit tests |
| Browser startup, interface, and remote simulation | Passed with fixture services and actual local media, Chromium 119 |
| Install and cold start on this LG TV | Not verified on physical TV |
| Real Stremio email/password login | Not verified with a live account on TV |
| Real addon and library sync | Not verified with a live account on TV |
| Real watch-progress sync in both directions | Not verified with a live account on TV |
| Torrentio/TorBox signed direct links on this TV | Not verified with user credentials on TV |
| Native HEVC/AV1/HDR and 4K decoding | Not verified on physical TV |
| Native multiple-audio track switching | Not verified on physical TV |
| External subtitle fetching, timing, and rendering | Not verified on physical TV |
| Long playback, seek recovery, suspend/resume | Not verified on physical TV |

No account credentials or configured debrid URLs are bundled. Mock tests
can check request shape and state handling, but cannot prove that a remote
service accepts the request or that a real account syncs correctly.

## Known platform boundaries

- This port targets direct HTTP/HTTPS streaming links. A torrent infohash,
  magnet URI, or peer-to-peer-only result is not a TorBox direct media URL.
  No Android libtorrent engine or desktop mpv binary runs inside this app.
- Native playback depends on the actual container, codecs, bitrate, server,
  range-request behavior, and TV firmware. A `.mkv` filename alone does not
  establish compatibility.
- LG lists external WebVTT as the officially supported subtitle format.
  SRT can be converted to WebVTT by the port. Embedded subtitles, image
  subtitles such as PGS, and advanced ASS styling must not be assumed to
  work. Use an external subtitle from an addon when available.
- Audio selection depends on the native player exposing `audioTracks`.
  LG documents this API, but the specific file and TV must be tested.
  The app cannot turn an unsupported audio codec into a supported one.
- Do not assume this model supports DTS, TrueHD, or Dolby Vision. Start
  testing with H.264/AAC or HEVC/AAC, AC-3, or E-AC-3 where supported.
- For UHD models, LG lists H.264 4K30 up to 50 Mbps, HEVC Main/Main10
  4K60 up to 60 Mbps, and VP9/AV1 4K60 up to 50 Mbps. These are platform
  limits, not a promise for every file or network connection.
- WebOS enforces CORS for web API requests. A working media URL in one
  application does not guarantee that an addon's API or subtitle endpoint
  permits another application's requests.
- Social-login popups, desktop plugins requiring native desktop APIs,
  desktop mpv features, Android installation/update actions, and raw
  torrents are outside this port's verified feature set.

## Set up the test

1. Follow [INSTALL.md](INSTALL.md) and confirm the IPK installs.
2. Record the TV's model, software/firmware version, webOS version, and
   whether it uses Ethernet or Wi-Fi. Do not publish the TV's IP address.
3. Record the IPK filename and SHA-256 from the build's checksum file.
4. Keep Stremio on your phone ready with the same account. Use content you
   are authorized to access, with a known working TorBox cached result.
5. Connect Web Inspector before reproducing a failure, where possible:

   ```sh
   ares-inspect --device lg-tv --app com.streamglass.tv --open
   ```

For each row below record `PASS`, `FAIL`, or `NOT RUN`, the time, and a short
observation. A passed first-play test does not mark the rest as passed.

## First session: required checks

| ID | Action | Pass condition |
|---|---|---|
| T01 | Launch the app from the LG launcher twice, closing it between runs. | Both launches reach a usable screen without a blank screen or repeated loading loop. |
| T02 | Sign in with Stremio email/password using the remote and TV keyboard. | Correct account opens; password field is obscured; login errors remain readable. |
| T03 | Close and reopen the app. | Sign-in persists without asking for the password again. |
| T04 | Compare Addons and Library with Stremio on the phone. | Configured Torrentio addon and expected library titles appear. |
| T05 | Navigate Home, search, title details, seasons/episodes, Addons, Library, and Settings with arrows/OK/Back. | Selection is visible; every required control can be reached; text fields can be entered and exited. |
| T06 | Open a title with a known working cached TorBox result. | Results load and the chosen direct-link result starts playback. Record time to first frame. |
| T07 | Pause, resume, seek forward 30 seconds, and seek backward 10 seconds. | Playback resumes near the selected position and audio remains in sync. |
| T08 | Use Back during playback, then reopen the same title. | Playback stops cleanly and the app offers or applies useful resume progress. |
| T09 | Return to the app's entry screen and press Back. | Appropriate webOS exit behavior appears; the user can leave the app. |

## Account and progress checks

Avoid watching the same title in two apps at once during these tests.

| ID | Action | Pass condition |
|---|---|---|
| S01 | Add a title to the library on the TV, then refresh Stremio on the phone. | The title appears on the phone. |
| S02 | Remove a test title on the phone, then reopen or refresh the TV library. | The change appears on the TV without deleting unrelated titles. |
| S03 | Watch at least two minutes on the TV, seek to a distinct position, then exit the player normally. Refresh Stremio on the phone. | Phone resume progress is close to the TV stopping point; record the time difference. |
| S04 | Continue the title on the phone, advance by at least a minute, exit normally, then reopen on the TV. | TV resume position reflects the newer phone progress. |
| S05 | Finish a short test video or episode. | Completed/watched state and next-episode behavior are sensible and do not reset unrelated library entries. |
| S06 | Sign out from the app and reopen it. | Private account/library data is no longer displayed until signing in again. |

## Media and remote checks

| ID | Action | Pass condition |
|---|---|---|
| M01 | Play a known H.264/AAC MP4 direct link. | Picture and audio work, giving a basic native-playback baseline. |
| M02 | Play a cached TorBox HEVC MKV with compatible audio. | Picture/audio, duration, and seeking work. Record resolution and codec if known. |
| M03 | Play a 4K result below the documented bitrate limit for at least 15 minutes. | No app crash, growing audio delay, or repeated buffering on a sufficient connection. |
| M04 | Play a file with at least two supported audio tracks and switch tracks. | The actual spoken language or audio changes, not just the displayed selection. |
| M05 | Select an external WebVTT subtitle from the available subtitle choices. | Cues render, follow playback time after seeking, and can be turned off. |
| M06 | Select an external SRT subtitle. | Converted cues appear with correct timing and readable text, including accented characters. |
| M07 | Repeat switching subtitles and audio several times. | No duplicate subtitles, silent player, stuck selection, or growing delay. |
| M08 | Test native HLS if a known working direct HLS URL is available. | Playback, seeking where applicable, and stopping work. Otherwise mark NOT RUN. |
| M09 | Try an expired, unreachable, or unsupported result. | A useful error appears; Back returns to stream selection; the app does not remain stuck. |
| M10 | Press the remote's Play/Pause/seek keys if present. Test Magic Remote clicks if available. | Each action happens once and preserves focus. Mark absent hardware controls NOT RUN. |
| M11 | Open the TV Home screen or another app during playback, then return. | Background playback stops or pauses as intended, progress survives, and playback can resume. |
| M12 | Play for 60 minutes, seek repeatedly, then play a different title. | No progressive slowdown, black player, or inability to start the next title. |

Test 4K HDR separately if you have an appropriate test source. Record the
TV's HDR indicator and actual appearance. A desktop browser screenshot
cannot verify HDR, Dolby Vision, or hardware decoding on the TV.

## Export diagnostics

In LG Web Inspector's Console, after reproducing the problem:

```js
copy(window.StreamGlassDiagnostics.export())
```

Paste into a local `.txt` file. If `copy()` is unavailable, run the export
function alone and copy the returned text. Check the text before sending it.
Send sanitized diagnostics rather than a Network/HAR dump. Do not include
passwords, Stremio tokens, TorBox keys, complete addon URLs, or signed media
URLs. If diagnostics are unavailable, send the first console error after
removing any secrets from it.

Use this report format:

```text
Build: StreamGlass TV 0.1.0
IPK filename:
IPK SHA-256:
TV model: LG 75UA7000PUB
TV firmware/software version:
webOS version:
Connection: Ethernet / Wi-Fi
Test ID:
Result: PASS / FAIL / NOT RUN
Local date/time and timezone:
Steps taken:
Expected result:
Actual result:
Media container/video codec/audio codec, if known:
Resolution/bitrate, if known:
Subtitle format/source hostname, if relevant:
Sanitized diagnostic export:
```

## Official references

- [webOS 25 codecs and subtitles](https://webostv.developer.lge.com/develop/specifications/video-audio-250)
- [LG audioTracks guidance](https://forum.webostv.developer.lge.com/t/video-multi-audio/24156)
- [Embedded-subtitle support limits](https://forum.webostv.developer.lge.com/t/fix-for-mp4-playback-with-embedded-mov-text-subtitles/27996)
- [LG CORS guidance](https://webostv.developer.lge.com/faq/how-to-solve-the-problem-if-cors-occurs)
- [Simulator limitations](https://webostv.developer.lge.com/develop/tools/simulator-introduction)
- [Web Inspector](https://webostv.developer.lge.com/develop/getting-started/app-debugging)
