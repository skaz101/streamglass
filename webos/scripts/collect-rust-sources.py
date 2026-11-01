#!/usr/bin/env python3
# Copyright (C) 2026 StreamGlass TV contributors
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fetch exact, Cargo.lock-verified Rust source archives and their license notices."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib, io, json, tarfile, tomllib, urllib.request
ROOT = Path(__file__).resolve().parents[1]
packages = tomllib.loads((ROOT/'vendor/stremio-core-source/Cargo.lock').read_text())['package']
archives = ROOT/'vendor/rust-crates'
notices = ROOT/'vendor/rust-licenses'
archives.mkdir(parents=True, exist_ok=True)
notices.mkdir(parents=True, exist_ok=True)

def fetch(p):
    name = p['name'] + '-' + p['version']
    dest = archives/(name+'.crate')
    if dest.exists():
        data = dest.read_bytes()
    else:
        url = 'https://static.crates.io/crates/{}/{}-{}.crate'.format(p['name'],p['name'],p['version'])
        with urllib.request.urlopen(url, timeout=45) as r:
            data = r.read()
    actual = hashlib.sha256(data).hexdigest()
    if actual != p['checksum']:
        raise RuntimeError('Checksum mismatch: '+name)
    dest.write_bytes(data)
    out = notices/name
    out.mkdir(exist_ok=True)
    license_files = []
    manifest = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as tf:
        for member in tf.getmembers():
            relative = Path(member.name)
            leaf = relative.name
            if not member.isfile():
                continue
            if len(relative.parts) == 2 and leaf == 'Cargo.toml':
                manifest = tomllib.loads(tf.extractfile(member).read().decode('utf-8'))
            if leaf.lower().startswith(('license','licence','copying','copyright','notice')):
                contents = tf.extractfile(member).read()
                filename = '_'.join(relative.parts[1:])
                (out/filename).write_bytes(contents)
                license_files.append(filename)
    meta = {'name':p['name'],'version':p['version'],'sha256':actual,
            'license':manifest.get('package',{}).get('license'),
            'license_file':manifest.get('package',{}).get('license-file'),
            'repository':manifest.get('package',{}).get('repository'),
            'notices':license_files}
    (out/'package-notice.json').write_text(json.dumps(meta,indent=2)+'\n')
    return meta
registry = [p for p in packages if p.get('source','').startswith('registry+')]
with ThreadPoolExecutor(max_workers=10) as pool:
    results = list(pool.map(fetch,registry))
(notices/'inventory.json').write_text(json.dumps(results,indent=2)+'\n')
print('Saved {} checksum-verified source crates and license notices'.format(len(results)))
