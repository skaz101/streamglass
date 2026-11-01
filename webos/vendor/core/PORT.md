# Stremio core for StreamGlass

This directory contains the MIT-licensed npm package `@stremio/stremio-core-web`
version `0.66.0`. Its Rust source and build instructions are included in the
adjacent `stremio-core-source` directory. `UPSTREAM.json` records the package
version, source commit, and file checksums.

The package code is unmodified here. `../../scripts/build-core.mjs` performs one
documented build-time substitution: its generated JavaScript's `importMeta.url`
base changes to `about:blank`. The worker receives embedded WebAssembly bytes,
so that URL is never fetched. This prevents an invalid relative URL from being
resolved against a blob Worker URL in a packaged app.

The bundle uses esbuild's binary loader for the WASM and writes a classic script
containing the complete worker source. `../../src/core-client.js` starts that
source as a blob Worker. No local WASM fetch, service worker, remote executable
script, or JavaScript module loader is needed at runtime. Network calls made by
Stremio core retain browser CORS rules.

The independent client is GPL-3.0-or-later. The upstream core and Babel runtime
helpers keep their MIT licenses. The GPL-2.0-only Stremio Web user interface is
not part of this port.
