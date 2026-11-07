// StreamGlass TV reproducible web app assembly. GPL-3.0-or-later.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import crypto from 'node:crypto';
import {build} from 'esbuild';
import {compile} from 'tailwindcss';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'build');
const repo = path.dirname(root);
await fs.rm(out, {recursive: true, force: true});
await fs.mkdir(out, {recursive: true});
await build({entryPoints:[path.join(root,'src/react/app.jsx')],outfile:path.join(out,'react-ui.js'),bundle:true,minify:true,format:'iife',target:['chrome87'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
const candidates=[];
async function scanReact(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await scanReact(full);else if(/\.(jsx?|tsx?)$/.test(entry.name))candidates.push(...(await fs.readFile(full,'utf8')).split(/[\s"'`<>]+/));}}
await scanReact(path.join(root,'src/react'));
const cssFile=path.join(out,'react-ui.css');
const compiler=await compile(await fs.readFile(cssFile,'utf8'));
await fs.writeFile(cssFile,compiler.build(candidates));
for(const name of ['react','react-dom','scheduler','clsx','tailwind-merge','class-variance-authority','lucide-react','tailwindcss']){await fs.mkdir(path.join(out,'licenses'),{recursive:true});const dir=path.join(root,'node_modules',name);const license=(await fs.readdir(dir)).find(file=>/^license(?:\.|$)/i.test(file));if(!license)throw new Error('Missing license: '+name);await fs.copyFile(path.join(dir,license),path.join(out,'licenses',name+'-LICENSE.txt'));}
for (const file of ['core-client.js', 'player.js', 'host.js', 'recommendations.js', 'shell.js']) {
  const source = await fs.readFile(path.join(root, 'src', file), 'utf8');
  new Script(source, {filename: file});
  await fs.writeFile(path.join(out, file), source);
}
for (const file of ['shell.css', 'host.css', 'player.css', 'cinematic.css', 'tv.css']) await fs.copyFile(path.join(root, 'src', file), path.join(out, file));
await fs.copyFile(path.join(root, 'generated/core-worker-source.js'), path.join(out, 'core-worker-source.js'));
await fs.copyFile(path.join(root, 'appinfo.json'), path.join(out, 'appinfo.json'));
for (const file of ['icon.png', 'largeIcon.png']) await fs.copyFile(path.join(root, 'assets', file), path.join(out, file));
await fs.cp(path.join(root, 'vendor/fonts'), path.join(out, 'fonts'), {recursive: true});
const lg = path.join(root, 'node_modules/@webos-tools/cli/files/templates/tv-sdk-templates/bootplate-web/webOSTVjs-1.2.13');
await fs.copyFile(path.join(lg, 'webOSTV.js'), path.join(out, 'webOSTV.js'));
let theme = await fs.readFile(path.join(repo, 'dxbi.theme.css'), 'utf8');
theme = theme.replace(/@import url\("https:\/\/fonts.googleapis.com[^\n]*\n/, '')
  .replace('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.8/dist/TwemojiCountryFlags.woff2', 'fonts/TwemojiCountryFlags.woff2')
  .replace('content: "DX.BI"', 'content: "STREAMGLASS"');
theme = '/* Modified 2026-10-30 for StreamGlass TV: bundled fonts and fork wordmark. Original copyright and GPL grant retained below. */\n' +
  '@font-face{font-family:Inter;src:url("fonts/Inter.ttf");font-weight:100 900;font-display:swap}\n' +
  '@font-face{font-family:"Bebas Neue";src:url("fonts/BebasNeue-Regular.ttf");font-display:swap}\n' + theme;
await fs.writeFile(path.join(out, 'dxbi.theme.css'), theme);
await fs.mkdir(path.join(out, 'licenses'),{recursive:true});
for (const name of ['LICENSE', 'NOTICE.md', 'LICENSE-ANIME4K']) await fs.copyFile(path.join(repo, name), path.join(out, 'licenses', name));
await fs.copyFile(path.join(lg, 'LICENSE-2.0.txt'), path.join(out, 'licenses/LG-webOSTVjs-Apache-2.0.txt'));
await fs.copyFile(path.join(root, 'vendor/core/LICENSE.md'), path.join(out, 'licenses/Stremio-core-MIT.txt'));
for (const name of ['THIRD_PARTY.md', 'MODIFICATIONS.md']) await fs.copyFile(path.join(root, name), path.join(out, 'licenses', name));
for (const dir of ['rust-licenses', 'npm-licenses']) {
  try { await fs.cp(path.join(root, 'vendor', dir), path.join(out, 'licenses', dir), {recursive: true}); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await fs.writeFile(path.join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src blob:; style-src 'self' 'unsafe-inline'; connect-src https: http:; img-src 'self' https: http: data: blob:; media-src https: http: blob: 'self'; font-src 'self'; object-src 'none'; base-uri 'self'">
<title>StreamGlass TV</title><link rel="stylesheet" href="shell.css"><link rel="stylesheet" href="player.css"><link rel="stylesheet" href="host.css"><link rel="stylesheet" href="react-ui.css"><link rel="stylesheet" href="cinematic.css"><link rel="stylesheet" href="tv.css">
<script src="webOSTV.js" defer></script><script src="core-worker-source.js" defer></script><script src="core-client.js" defer></script><script src="player.js" defer></script><script src="recommendations.js" defer></script><script src="react-ui.js" defer></script><script src="shell.js" defer></script><script src="host.js" defer></script></head>
<body><div id="app"><p style="padding:5vw;font-size:28px;color:white">Starting StreamGlass TV…</p></div><noscript>JavaScript is required.</noscript></body></html>\n`);
const files = [];
async function visit(dir) {
  for (const entry of (await fs.readdir(dir, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await visit(full);
    else files.push({file: path.relative(out, full).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(await fs.readFile(full)).digest('hex')});
  }
}
await visit(out);
await fs.writeFile(path.join(out, 'build-manifest.json'), JSON.stringify({app: 'com.streamglass.tv', version: '0.8.0', upstreamDXBI: 'c78ca45dff30b23c22a38928445876def0d0d472', stremioCore: '0.66.0', files}, null, 2));
console.log('Built ' + files.length + ' files in ' + out);
