# StreamGlass TV notices and source

StreamGlass TV is an unofficial webOS port built from DX.BI's interface code and an independently written Stremio-compatible shell. It is not an official release from DX.BI, Stremio, LG, Torrentio, or TorBox. The app name and launcher artwork are separate from DX.BI's branding, as requested by upstream `NOTICE.md`.

## DX.BI and port code

- Upstream: https://github.com/notdxbi/dxbi-stremio
- Source commit: `c78ca45dff30b23c22a38928445876def0d0d472`
- Upstream version: `2.22.1`
- Copyright (C) 2026 dx.bi.
- License: GNU GPL version 3 or, at your option, any later version.
- The original license and notices remain in repository-root `LICENSE`, `NOTICE.md`, and `LICENSE-ANIME4K`.
- The webOS port, player, adapter, shell, packaging scripts, and tests are new or modified files under `webos/`. Port changes are dated 2026-10-30. New port code is GPL-3.0-or-later unless a file states a third-party license.
- Build-time changes to upstream interface code are recorded in the readable packaging scripts. Keep those scripts, the original input files, the full port source, and these notices with redistributed builds.

This distribution includes the complete source used for the port, build instructions, and Developer Mode installation instructions. You may inspect, change, rebuild, and install the app. No private signing key is required for Developer Mode installation. There is no warranty; see `LICENSE`.

GPLv2-only Stremio Web frontend source and its compiled frontend are **not included in the app**. The port uses its own shell with the MIT-licensed Stremio Core. This avoids treating GPLv2-only frontend code as if it could be relicensed under GPLv3.

## Stremio Core

- Package: `@stremio/stremio-core-web` version `0.66.0`.
- Upstream: https://github.com/Stremio/stremio-core
- Exact npm release git commit: `3417c2e7ed45cdbfd86b3226f69814c2dc4947ad`.
- License: MIT, copyright SmartCode OOD. See `vendor/stremio-core-source/LICENSE.md`.
- Published package files: `vendor/core/`.
- Original Rust and JavaScript sources, Cargo lockfile, and upstream build scripts: `vendor/stremio-core-source/`.
- Local-search git dependency: `vendor/local-search-source/`, commit `74fefe1da2fa17d2b4ef7e3e629da00f3946ee72`, MIT license, copyright (c) 2022 Stremio.
- The port embeds the release WASM bytes into the worker bundle and uses a classic Blob worker to avoid packaged `file://` resource-fetch restrictions. Port source records these integration changes.
- The published WASM is used as supplied by npm. Its Rust source is included, but the WASM has not been rebuilt from Rust in this environment and byte-for-byte reproducibility is not claimed.

The source archive also includes all 178 registry packages from this core source's `Cargo.lock` as compressed `.crate` source archives in `vendor/rust-crates/`. Their SHA-256 values were checked against `Cargo.lock`. Extracted license notices and a package inventory are in `vendor/rust-licenses/`. This is a conservative inventory: some listed crates are development or platform-specific dependencies that are not part of the final WASM binary. Each retains its own license. `scripts/collect-rust-sources.py` reproduces the collection.

To rebuild the original Rust package, use its own `stremio-core-web/README.md`, `scripts/build.sh`, `Cargo.lock`, `package-lock.json`, and `.github/workflows/build.yml`. The release's upstream workflow specifies its Rust/wasm-pack versions; do not assume a newer toolchain is byte-identical. The normal StreamGlass build uses the pinned published WASM and does not require a Rust toolchain.

## Fonts and flags

`vendor/fonts/` contains the following original font assets and their notices:

| Asset | Source | License |
| --- | --- | --- |
| Inter variable font | https://github.com/google/fonts/tree/main/ofl/inter | SIL Open Font License 1.1; `Inter-OFL.txt` |
| Bebas Neue | https://github.com/google/fonts/tree/main/ofl/bebasneue | SIL Open Font License 1.1; `BebasNeue-OFL.txt` |
| Twemoji Country Flags, package 0.1.8 | https://github.com/talkjs/country-flag-emoji-polyfill | Package code MIT; Twemoji artwork CC-BY 4.0; see the bundled notices |

The flag font is the original, unmodified Twemoji-derived font. Twemoji graphics are by Twitter and other contributors, licensed under Creative Commons Attribution 4.0: https://creativecommons.org/licenses/by/4.0/ . Source: https://github.com/twitter/twemoji . Attribution is preserved here and in the bundled font package README.

## JavaScript packages and LG tooling

`vendor/npm-licenses/` contains license files and package metadata copied from installed npm packages. It includes development tools as well as runtime dependencies, so presence in this inventory does not mean a package is loaded on the TV. `inventory.json` lists exact versions; `REVIEW.txt` reports any missing license declarations. The exact `@babel/runtime@7.24.1` source package used by the worker is also included in `vendor/runtime-sources/`, with its registry integrity and SHA-256 values. `scripts/collect-licenses.mjs` can regenerate this inventory after `npm ci`.

LG's official `@webos-tools/cli` is a build/install tool. It is not a replacement or modified webOS SDK. Its package license is preserved in the npm inventory. The app uses webOS's built-in HTML media and remote APIs; it does not redistribute LG's firmware or media decoders.

Torrentio and TorBox are external services configured through the user's addons. This app does not contain their source, credentials, or media files. Movies, posters, catalog data, and subtitles returned by addons are not included as app assets.
