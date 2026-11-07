> Latest TV update: see [RELEASE-0.8.0.md](RELEASE-0.8.0.md) for playback lifecycle hardening. Older results below describe earlier releases.

# StreamGlass TV for LG webOS 25

An unofficial webOS port of the DX.BI experience for the LG 75UA7000PUB.
Package ID: `com.streamglass.tv`. Version: `0.8.0`.

This project targets Stremio email/password login, account addons, library
and watch progress, direct Torrentio/TorBox HTTP/HTTPS results, native LG
video playback, selectable audio/subtitles, and LG remote navigation.
The original DX.BI CSS theme is retained. A successful build does not mean
those paths have all passed on a physical TV. The current verification
record and acceptance tests are in [TESTING.md](TESTING.md).

For installation and log collection, start with [INSTALL.md](INSTALL.md).

## Why the implementation uses a separate shell

Upstream DX.BI combines a large plugin with an existing Stremio interface
and platform-specific desktop or Android playback. LG webOS cannot run
those desktop/Android components directly.

The webOS runtime therefore combines:

- DX.BI's original GPL-3.0-or-later CSS theme, with webOS layout adaptations.
- A new TV shell and LG player written for this port.
- The MIT-licensed Stremio core, including its WebAssembly account/state
  implementation.
- LG's native HTML video pipeline and official webOS CLI packaging.

The monolithic DX.BI plugin is not loaded by the webOS runtime. The
GPL-2.0-only Stremio Web application is not included, since combining it
with the GPL-3.0-or-later DX.BI application would create a license conflict.
The original upstream source remains in this source tree for attribution
and comparison; its presence does not make every upstream feature part of
the webOS app.

StreamGlass uses its own name and icon as requested by upstream's
`NOTICE.md`. It is not endorsed by DX.BI, Stremio, LG, Torrentio, or TorBox.

## Runtime constraints

The app targets webOS 25's Chromium 120 engine. Local packaged apps use a
`file://` origin, so the build emits classic scripts and embeds the Stremio
core worker/WASM rather than relying on local ES-module imports or local
WASM fetches. Native playback receives direct URLs. Account and addon
requests still depend on the remote server's CORS policy.

There is no bundled local proxy service, torrent engine, transcoder, mpv,
or Android player. Files must use codecs the TV can decode. External
subtitles are the supported path; embedded image subtitles and advanced
subtitle styling are not guaranteed. See [TESTING.md](TESTING.md) for the
full boundaries and physical-TV checks.

No account credentials, TorBox API keys, or configured Torrentio URLs are
included. Configure the addon in your own Stremio account before signing
in to the TV app.

## Rebuild the IPK

Prerequisites: Node.js 22 or 24, npm, and an internet connection for npm
dependencies. The project pins LG's official `@webos-tools/cli` at `3.2.6`
in `package-lock.json`; it requires Node.js 20 or later.

From the source archive's repository root:

```sh
cd webos
npm ci
npm run build:core
npm test
npm run build
npm run package
```

The package command prints the output path for
`com.streamglass.tv_0.8.0_all.ipk`. It uses LG's `ares-package`; the IPK is
not a renamed ZIP file. The debug build preserves the port's scripts for
Web Inspector. The upstream core is a production bundle, so it does not
enable the core's sensitive debug logging.

`build:core` bundles the supplied MIT Stremio core JavaScript and WASM into
the packaged-app worker. It does not recompile the Rust core. The upstream
Rust source and dependency materials are included under `vendor/` for
source availability and further development. Consult the core source's
own build files when changing the Rust implementation.

Browser checks can be run separately:

```sh
npx playwright install chromium
# Also install ffmpeg with H.264/AAC support for generated test media.
node tests/core-browser.mjs
node tests/player-browser.cjs
node tests/review-host-browser.cjs
npm run test:browser
```

These are desktop checks. They do not substitute for LG decoder, remote,
account, subtitle, or long-playback testing. Read the final build record in
[TESTING.md](TESTING.md) for the checks actually completed for this release.

## Source layout

| Path | Purpose |
|---|---|
| `../dxbi.theme.css` | Original DX.BI theme retained by the port |
| `src/` | TV interface, playback, navigation, and diagnostics |
| `appinfo.json` | LG app ID, version, icons, resolution, and Back handling |
| `scripts/` | Core bundling, app build, license collection, and IPK packaging |
| `tests/` | Automated behavior and browser checks |
| `vendor/core/` | MIT Stremio core web bridge, worker, and WASM distribution |
| `vendor/stremio-core-source/` | Corresponding upstream Stremio core source |
| `vendor/local-search-source/` | Upstream local-search dependency source |
| `vendor/rust-crates/` | Rust dependency source materials |
| `vendor/fonts/` | Bundled fonts and their licenses |
| `vendor/npm-licenses/`, `vendor/rust-licenses/` | Third-party license records |
| `INSTALL.md` | TV installation, account setup, and diagnostics |
| `TESTING.md` | Honest verification record and physical-TV acceptance tests |

## License and redistribution

The port and reused DX.BI theme are GPL-3.0-or-later. Preserve the original
copyright notices, the repository's `LICENSE` and `NOTICE.md`, modification
records, and third-party notices. MIT-licensed Stremio components and the
fonts retain their own licenses.

When redistributing the IPK, provide the corresponding source and build
instructions under the applicable GPL terms. The supplied source archive
is the source deliverable for this test build. The app name and icon are
separate from DX.BI's branding.

No release, repository fork, or other remote publication is required to
build or install this package locally.

## Platform references

- [LG CLI](https://github.com/webos-tools/cli)
- [webOS 25 web engine](https://webostv.developer.lge.com/develop/specifications/web-api-and-web-engine)
- [Packaged ES-module restriction](https://forum.webostv.developer.lge.com/t/module-script-loads-blocked-under-file-origin-for-installed-webos-app-no-cors-workaround-found/28351)
- [LG video, audio, and subtitle specifications](https://webostv.developer.lge.com/develop/specifications/video-audio-250)
- [Original DX.BI repository](https://github.com/notdxbi/dxbi-stremio)
- [Stremio core repository](https://github.com/Stremio/stremio-core)
