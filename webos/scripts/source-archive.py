#!/usr/bin/env python3
"""Create the corresponding source archive. GPL-3.0-or-later."""
import argparse
import re
import hashlib
import os
import pathlib
import zipfile

EXCLUDED_DIRS = {'.git', 'node_modules', 'build', 'dist', 'test-results',
                 '__pycache__', '.gradle', '.idea', 'verification', 'signing'}
EXCLUDED_NAMES = {'local.properties', 'key.properties', 'runtime-inventory.json',
                  'chat.txt', '.dev.vars', '.DS_Store'}
PRIVATE_SUFFIXES = {'.jks', '.keystore', '.p12', '.pfx', '.pem', '.key'}


def source_files(repo):
    """Never follow links or include credentials, generated output or installers."""
    for directory, dirs, files in os.walk(repo, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS
                         and not (pathlib.Path(directory) / d).is_symlink())
        for name in sorted(files):
            item = pathlib.Path(directory) / name
            if (item.is_symlink() or name in EXCLUDED_NAMES
                    or (name.startswith('.env') and name != '.env.example')
                    or item.suffix.lower() in PRIVATE_SUFFIXES | {'.apk', '.ipk', '.aab'}):
                continue
            yield item


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', default='0.4.0')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?', args.version):
        parser.error('version must be a semantic version without path separators')
    repo = pathlib.Path(__file__).resolve().parents[2]
    out = repo / 'webos' / 'dist'
    out.mkdir(exist_ok=True)
    target = out / ('streamglass-' + args.version + '-source.zip')
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for item in source_files(repo):
            archive.write(item, pathlib.Path('streamglass-tv-source') / item.relative_to(repo))
    with zipfile.ZipFile(target) as archive:
        bad = archive.testzip()
        if bad:
            raise RuntimeError('Corrupt archive member: ' + bad)
    print(str(target))
    print('SHA256: ' + hashlib.sha256(target.read_bytes()).hexdigest())


if __name__ == '__main__':
    main()
