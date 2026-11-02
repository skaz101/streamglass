"""Temporary transfer of a verified public unsigned APK; signing stays local."""
import base64,hashlib,json,os,urllib.request,zipfile
from pathlib import Path
file=Path('android/app/build/outputs/apk/release/app-release-unsigned.apk')
data=file.read_bytes()
with zipfile.ZipFile(file) as archive:
    assert archive.testzip() is None
    assert not any('player-fixture' in n or 'player-english' in n or 'player-spanish' in n for n in archive.namelist())
    assert not any(b'PlayerPreviewActivity' in archive.read(n) for n in archive.namelist() if n.endswith('.dex'))
content=base64.b64encode(data).decode();shas=[]
for offset in range(0,len(content),384000):
    request=urllib.request.Request('https://api.github.com/repos/'+os.environ['GITHUB_REPOSITORY']+'/git/blobs',data=json.dumps({'encoding':'utf-8','content':content[offset:offset+384000]}).encode(),method='POST',headers={'Authorization':'Bearer '+os.environ['GH_TOKEN'],'Accept':'application/vnd.github+json','Content-Type':'application/json'})
    with urllib.request.urlopen(request) as response:shas.append(json.load(response)['sha'])
print('ANDROID_BUILD_TRANSPORT='+json.dumps({'commit':os.environ['GITHUB_SHA'],'files':[{'name':file.name,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'blobs':shas}]}))
