"""Reassemble isolated emulator screenshots from bounded Android log chunks."""
import base64,re
from collections import defaultdict
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'test-results/native'
chunks=defaultdict(dict)
for line in (root/'native-log.txt').read_text().splitlines():
    match=re.search(r'NATIVE_IMAGE:([\w-]+):(\d+):([A-Za-z0-9+/=]+)',line)
    if match:chunks[match[1]][int(match[2])]=match[3]
    elif 'NODE ' in line or 'StreamGlassPlayback' in line:print(line)
for name,parts in chunks.items():
    assert set(parts)==set(range(len(parts))),name+' has missing chunks'
    data=base64.b64decode(''.join(parts[i] for i in range(len(parts))),validate=True)
    assert data.startswith(b'RIFF') and data[8:12]==b'WEBP',name
    (root/(name+'.webp')).write_bytes(data)
print('Collected native previews: '+', '.join(sorted(chunks)))
