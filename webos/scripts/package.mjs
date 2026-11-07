// Package using LG's official CLI, never a handwritten IPK. GPL-3.0-or-later.
import {spawnSync} from 'node:child_process';
import {mkdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules/@webos-tools/cli/bin');
if (!existsSync(path.join(root, 'build/index.html'))) throw new Error('Run npm run build first.');
mkdirSync(path.join(root, 'dist'), {recursive: true});
for (const [command, args] of [
  ['ares-config.js', ['--profile', 'tv']],
  ['ares-package.js', ['--no-minify', '--outdir', path.join(root, 'dist'), path.join(root, 'build')]],
  ['ares-package.js', ['--info-detail', path.join(root, 'dist/com.streamglass.tv_0.8.2_all.ipk')]],
]) {
  const result = spawnSync(process.execPath, [path.join(cli, command), ...args], {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
