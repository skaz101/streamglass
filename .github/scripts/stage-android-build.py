"""Temporary connector transport for public, unsigned build outputs only.

Unreferenced Git blobs keep installers out of the source tree. The original
preview signing key never leaves the maintainer's local machine.
"""
import base64
import hashlib
import json
import os
import pathlib
import urllib.request

files = {
    'app-release-unsigned.apk': pathlib.Path('android/app/build/outputs/apk/release/app-release-unsigned.apk'),
    'apksigner.jar': pathlib.Path(os.environ['ANDROID_HOME']) / 'build-tools/35.0.0/lib/apksigner.jar',
}
manifest = {'commit': os.environ['GITHUB_SHA'], 'files': []}
for name, path in files.items():
    data = path.read_bytes()
    content = base64.b64encode(data).decode('ascii')
    shas = []
    for offset in range(0, len(content), 384000):
        payload = json.dumps({'encoding': 'utf-8', 'content': content[offset:offset + 384000]}).encode()
        request = urllib.request.Request(
            'https://api.github.com/repos/' + os.environ['GITHUB_REPOSITORY'] + '/git/blobs',
            data=payload, method='POST', headers={
                'Authorization': 'Bearer ' + os.environ['GH_TOKEN'],
                'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json',
            })
        with urllib.request.urlopen(request) as response:
            shas.append(json.load(response)['sha'])
    manifest['files'].append({'name': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'blobs': shas})
print('ANDROID_BUILD_TRANSPORT=' + json.dumps(manifest))
