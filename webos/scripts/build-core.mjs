// Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later.
// The separately licensed Stremio core is MIT; see vendor/core/LICENSE.md.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'generated');
await mkdir(out, { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['vendor/core/worker.js'],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  legalComments: 'inline',
  loader: { '.wasm': 'binary' },
  plugins: [{
    name: 'webos-inline-wasm-base',
    setup(builder) {
      builder.onLoad({ filter: /stremio_core_web\.js$/ }, async ({ path: sourcePath }) => {
        const source = await readFile(sourcePath, 'utf8');
        const oldBase = "new URL('/stremio_core_web.js', document.baseURI).href";
        if (!source.includes(oldBase)) throw new Error('Stremio core import-meta layout changed; review inline WASM loading.');
        // A blob Worker has an opaque base URI. No URL fetch is needed because
        // the binary loader passes bytes to initialize_api directly.
        return { contents: source.replace(oldBase, "'about:blank'"), loader: 'js' };
      });
    },
  }],
});
const worker = result.outputFiles[0].text;
const header = '// Stremio core 0.66.0 (MIT), bundled for packaged webOS. See licenses.\n';
await writeFile(path.join(out, 'core-worker-source.js'), header + 'window.__StreamGlassWorkerSource = ' + JSON.stringify(worker) + ';\n');
console.log('Built embedded Stremio core worker and WASM: ' + Buffer.byteLength(worker) + ' bytes.');
