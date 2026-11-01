#!/usr/bin/env python3
"""Collect pinned Android runtime source JARs and notices. GPL-3.0-or-later.
Run ./gradlew runtimeInventory first. No account data is used.
"""
import concurrent.futures
import hashlib
import io
import json
import pathlib
import re
import shutil
import urllib.request
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
source_dir = root / 'vendor/runtime-sources'
license_dir = root / 'vendor/licenses'
source_dir.mkdir(parents=True, exist_ok=True)
license_dir.mkdir(parents=True, exist_ok=True)
shutil.copyfile(root.parent / 'webos/build/licenses/LG-webOSTVjs-Apache-2.0.txt', license_dir / 'Apache-2.0.txt')
modules = {}
for item in json.loads((root / 'runtime-inventory.json').read_text()):
    modules.setdefault((item['group'], item['name'], item['version']), []).append(item['file'])

def collect(entry):
    (group, name, version), binaries = entry
    prefix = f'{group}.{name}-{version}'
    base = 'https://dl.google.com/dl/android/maven2/' if group.startswith('androidx.') else 'https://repo.maven.apache.org/maven2/'
    base += group.replace('.', '/') + f'/{name}/{version}/{name}-{version}'
    files = []
    empty_placeholder = name == 'listenablefuture' and version == '9999.0-empty-to-avoid-conflict-with-guava'
    if empty_placeholder:
        for binary in binaries:
            with zipfile.ZipFile(binary) as archive:
                assert not any(path.endswith('.class') for path in archive.namelist())
    for suffix in ['.pom', '-sources.jar']:
        if empty_placeholder and suffix == '-sources.jar':
            continue  # Published conflict-avoidance JAR has no code and no source JAR.
        target = source_dir / (prefix + suffix)
        if not target.exists():
            with urllib.request.urlopen(base + suffix, timeout=30) as response:
                target.write_bytes(response.read())
        files.append({'file':target.relative_to(root).as_posix(), 'url':base+suffix,
                      'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    notices = {}
    def inspect(blob):
        with zipfile.ZipFile(io.BytesIO(blob)) as archive:
            for path in archive.namelist():
                if re.search(r'(^|/)(LICENSE|NOTICE|COPYING)([._-].*)?$', path, re.I):
                    notices[path.replace('/', '_')] = archive.read(path)
                elif path == 'classes.jar':
                    inspect(archive.read(path))
    for binary in binaries:
        inspect(pathlib.Path(binary).read_bytes())
    if not empty_placeholder:
        inspect((source_dir / (prefix + '-sources.jar')).read_bytes())
    for name_, data in notices.items():
        (license_dir / (prefix + '-' + name_)).write_bytes(data)
    return {'group':group, 'name':name, 'version':version, 'sourceFiles':files,
            'binaries':[{'file':pathlib.Path(p).name,'sha256':hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()} for p in binaries],
            'notices':list(notices), 'emptyPlaceholder':empty_placeholder}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result = list(pool.map(collect, modules.items()))
(root / 'vendor/dependencies.json').write_text(json.dumps(result, indent=2)+'\n')
shutil.copyfile(root / 'vendor/dependencies.json', license_dir / 'dependencies.json')
print(f'Collected {len(result)} runtime modules and their source JARs.')
