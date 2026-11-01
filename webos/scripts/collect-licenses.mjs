// Copyright (C) 2026 StreamGlass TV contributors
// SPDX-License-Identifier: GPL-3.0-or-later
// Preserve dependency notices without guessing the license from the package name.
import { readdir, readFile, mkdir, writeFile, realpath, stat, copyFile } from 'node:fs/promises';
import path from 'node:path';

const webos = path.resolve(import.meta.dirname, '..');
const output = path.resolve(process.argv[2] || path.join(webos, 'build/licenses/dependencies'));
const roots = process.argv.slice(3);
if (!roots.length) roots.push(path.join(webos, 'node_modules'), path.join(webos, 'vendor/stremio-web/node_modules'));
await mkdir(output, { recursive: true });
const visited = new Set();
const packages = [];
async function walk(directory) {
  let physical;
  try { physical = await realpath(directory); } catch { return; }
  if (visited.has(physical)) return;
  visited.add(physical);
  let entries;
  try { entries = await readdir(physical, { withFileTypes: true }); } catch { return; }
  let metadata;
  try { metadata = JSON.parse(await readFile(path.join(physical, 'package.json'), 'utf8')); } catch { /* grouping directory */ }
  if (metadata?.name && metadata?.version) {
    const name = `${metadata.name.replaceAll('/', '__')}@${metadata.version}`;
    const target = path.join(output, name);
    await mkdir(target, { recursive: true });
    const notices = [];
    for (const entry of entries) {
      if (!/^(license|licence|copying|copyright|notice)([._-].*)?$/i.test(entry.name)) continue;
      const source = path.join(physical, entry.name);
      if ((await stat(source)).isFile()) {
        await copyFile(source, path.join(target, entry.name));
        notices.push(entry.name);
      }
    }
    const info = {
      name: metadata.name, version: metadata.version,
      license: metadata.license ?? metadata.licenses ?? null,
      author: metadata.author ?? null,
      repository: metadata.repository ?? null,
      homepage: metadata.homepage ?? null,
      notices
    };
    await writeFile(path.join(target, 'package-notice.json'), JSON.stringify(info, null, 2) + '\n');
    packages.push(info);
    // Every installed dependency is included, including build dependencies. This is a
    // conservative notice inventory, not a claim that each package is in the runtime.
    await walk(path.join(physical, 'node_modules'));
    return;
  }
  for (const entry of entries) {
    if (!(entry.isDirectory() || entry.isSymbolicLink())) continue;
    if (entry.name.startsWith('.') && entry.name !== '.pnpm') continue;
    await walk(path.join(physical, entry.name));
  }
}
for (const root of roots) await walk(path.resolve(root));
packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const unique = [...new Map(packages.map(p => [`${p.name}@${p.version}`, p])).values()];
await writeFile(path.join(output, 'inventory.json'), JSON.stringify(unique, null, 2) + '\n');
const unknown = unique.filter(p => !p.license && !p.notices.length).map(p => `${p.name}@${p.version}`);
await writeFile(path.join(output, 'REVIEW.txt'), `Installed packages: ${unique.length}\nNo declared license or notice found: ${unknown.length}\n${unknown.join('\n')}\n`);
console.log(`Collected notices for ${unique.length} installed packages into ${output}`);
if (unknown.length) console.warn(`${unknown.length} packages have no declared license or notice; see REVIEW.txt.`);
