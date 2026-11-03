// GPL-3.0-or-later. Reuse the independent StreamGlass shell and MIT core.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webos=path.resolve(root,'../webos');
const result=spawnSync(process.execPath,[path.join(webos,'scripts/build.mjs')],{stdio:'inherit'});
if(result.status)process.exit(result.status);
const out=path.join(root,'app/build/generated/assets/app');
await fs.rm(out,{recursive:true,force:true});
await fs.cp(path.join(webos,'build'),out,{recursive:true});
for(const file of ['host.js','host.css','player.js','player.css','webOSTV.js','appinfo.json','build-manifest.json'])await fs.rm(path.join(out,file),{force:true});
for(const file of ['mobile.css','mobile.js','android-host.js'])await fs.copyFile(path.join(root,'ui',file),path.join(out,file));
await fs.copyFile(path.join(root,'THIRD_PARTY.md'),path.join(out,'licenses/ANDROID-THIRD-PARTY.md'));
try {await fs.cp(path.join(root,'vendor/licenses'),path.join(out,'licenses/android'),{recursive:true});}
catch(error){if(error.code!=='ENOENT')throw error;}
let html=await fs.readFile(path.join(out,'index.html'),'utf8');
html=html.replace(/<script src="(?:webOSTV|player|host)\.js" defer><\/script>/g,'').replace(/<link rel="stylesheet" href="(?:player|host)\.css">/g,'');
html=html.replace('<link rel="stylesheet" href="dxbi.theme.css">','');
html=html.replace('<link rel="stylesheet" href="cinematic.css">','');
html=html.replace('</head>','<link rel="stylesheet" href="mobile.css"><script src="mobile.js" defer></script><script src="android-host.js" defer></script><link rel="stylesheet" href="cinematic.css"></head>');
html=html.replace("object-src 'none'", "frame-src 'none'; object-src 'none'").replace('user-scalable=no','viewport-fit=cover');
html=html.replace('<title>StreamGlass TV</title>','<title>StreamGlass</title>');
await fs.writeFile(path.join(out,'index.html'),html);
const shell=await fs.readFile(path.join(out,'shell.js'),'utf8');
await fs.writeFile(path.join(out,'shell.js'),shell.replaceAll('StreamGlass TV','StreamGlass').replaceAll('This webOS app','This app').replaceAll('on this TV','in this app').replaceAll('The webOS player','The Android player').replaceAll('block TV requests','block requests').replace('Used when the TV exposes matching audio tracks.','Used when the video has matching audio tracks.').replace('StreamGlass 0.4.0 · Unofficial webOS 25 port of the DX.BI interface.','StreamGlass 0.6.3 · An independent Stremio client.').replace('your TV.','your device.').replaceAll('Add to Library','Add to My List').replace("appVersion:'0.4.0'","appVersion:'0.6.3'").replace("shellVersion:'webos25'","shellVersion:'android-mobile'"));
console.log('Android UI assets ready.');
