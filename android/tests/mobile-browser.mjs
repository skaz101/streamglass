// Full packaged-app test with real WASM core and video, isolated fixture services.
// GPL-3.0-or-later. No account credentials or API writes leave this test.
import {chromium} from '../../webos/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../webos');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-app-'));
const shots=path.join(root,'../android/test-results');
await fs.mkdir(shots,{recursive:true});
let browser,server;
try {
  const media=path.join(temp,'clip.mp4');
  const gen=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=640x360:r=25','-f','lavfi','-i','sine=frequency=220:sample_rate=48000','-t','60','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',media]);
  assert.equal(gen.status,0,'Generate H.264/AAC fixture: '+String(gen.stderr));
  const bytes=await fs.readFile(media);
  server=http.createServer((req,res)=>{
    res.setHeader('Access-Control-Allow-Origin','*');
    if(req.url.startsWith('/subtitle')){res.setHeader('Content-Type','text/plain');res.end('1\n00:00:00,000 --> 00:00:59,000\nStreamGlass integration caption\n');return;}
    res.setHeader('Content-Type','video/mp4');res.setHeader('Accept-Ranges','bytes');
    const range=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});res.end(bytes.subarray(start,end+1));}
    else {res.setHeader('Content-Length',bytes.length);res.end(bytes);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const addon={transportUrl:'https://fixtures.invalid/manifest.json',flags:{official:false,protected:false},manifest:{id:'org.streamglass.integration',name:'Fixture catalog',description:'Test services, never shipped.',version:'1.0.0',types:['movie','series'],resources:['catalog','meta','stream','subtitles'],catalogs:[{type:'movie',id:'movies',name:'Movies',extra:[{name:'search'},{name:'skip'},{name:'genre',options:['Adventure','Drama']}]},{type:'series',id:'series',name:'Series',extra:[{name:'search'}]}]}};
  const meta=(type='movie',id='sg-movie')=>({id,type,name:type==='series'?'Test Series':'Test Film',description:'A fixture title for testing the installed app. This content is not included in the release.',poster:'https://fixtures.invalid/poster.svg',background:'https://fixtures.invalid/background.svg',genres:['Adventure','Drama'],imdbRating:'8.1',releaseInfo:'2026',runtime:'1 min',videos:type==='series'?[{id:id+':1:1',season:1,episode:1,title:'First episode',released:'2020-01-01T00:00:00.000Z'},{id:id+':2:1',season:2,episode:1,title:'Second season',released:'2020-01-01T00:00:00.000Z'}]:[{id,title:'Test Film',released:'2020-01-01T00:00:00.000Z'}]});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  let acceptLogin=false,loginRequests=0,libraryWrites=0,addonWrites=0;
  let storedAddons=[addon];
  const searchRequests=[];
  let recommendationFailure=false, genrelessCatalog=false, slowRecommendations=false, metadataRequests=0;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin){await route.continue();return;}
    const reply=value=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
    if(url.pathname.endsWith('.svg')){await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g"><stop stop-color="#142233"/><stop offset="1" stop-color="#72503c"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><circle cx="950" cy="270" r="170" fill="#ac7960" opacity=".4"/><text x="70" y="420" fill="white" font-size="65">Test artwork</text></svg>'});return;}
    if(url.host==='api.strem.io'){
      if(url.pathname.endsWith('/login')){loginRequests++;await reply(acceptLogin?{result:{authKey:'secret-fixture-token',user:{_id:'fixture-user',email:'test@example.invalid',lastModified:'2026-01-01T00:00:00Z',dateRegistered:'2020-01-01T00:00:00Z',premium_expire:null,gdpr_consent:{tos:true,privacy:true,marketing:false,from:'tests'}}}}:{error:{code:1,message:'Invalid fixture credentials'}});return;}
      if(url.pathname.endsWith('/addonCollectionGet')){await reply({result:{addons:storedAddons,lastModified:'2026-01-01T00:00:00Z'}});return;}
      if(url.pathname.endsWith('/addonCollectionSet')){addonWrites++;const body=route.request().postDataJSON();if(Array.isArray(body.addons))storedAddons=body.addons;await reply({result:{success:true}});return;}
      if(url.pathname.endsWith('/datastoreGet')){await reply({result:[]});return;}
      if(url.pathname.endsWith('/datastorePut')){libraryWrites++;await reply({result:{success:true}});return;}
      await reply({result:{}});return;
    }
    if(url.pathname.endsWith('/manifest.json')){await reply(addon.manifest);return;}
    const parts=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if(recommendationFailure&&['catalog','meta'].includes(parts[0])){await route.fulfill({status:503,body:'Unavailable'});return;}
    if(parts[0]==='catalog'){
      if(slowRecommendations)await new Promise(resolve=>setTimeout(resolve,1000));
      const match=url.pathname.match(/\/search=([^/]+)\.json$/);
      const query=match?decodeURIComponent(match[1]):'';
      if(query)searchRequests.push(query);
      if(query==='slowold')await new Promise(resolve=>setTimeout(resolve,1000));
      if(query==='failsearch'){await route.fulfill({status:503,body:'Unavailable'});return;}
      await reply({metas:query==='nothingfound'?[]:Array.from({length:9},(_,i)=>({...meta(parts[1],parts[1]==='series'?'sg-series-'+i:'sg-movie-'+i),...(genrelessCatalog?{genres:[]}:{}),name:(query?query+' ':'')+(parts[1]==='series'?'Test Series ':'Test Film ')+(i+1)}))});return;
    }
    if(parts[0]==='meta'){metadataRequests++;await reply({meta:meta(parts[1],parts[2].replace(/\.json$/,''))});return;}
    if(parts[0]==='stream'){await reply({streams:[{name:'Torrentio\n[TB+] 1080p',title:'Direct test stream\nH.264 / AAC',url:origin+'/clip.mp4?token=private-stream-token',subtitles:[{id:'fixture-caption',lang:'eng',url:origin+'/subtitle.srt'}]},{name:'Raw torrent fixture',title:'Unsupported raw torrent',infoHash:'a'.repeat(40),fileIdx:0},...Array.from({length:16},(_,i)=>({name:'Direct choice '+(i+3),title:'1080p H.264 AAC',url:origin+'/clip.mp4'}))]});return;}
    if(parts[0]==='subtitles'){await reply({subtitles:[{id:'fixture-caption',lang:'eng',url:origin+'/subtitle.srt'}]});return;}
    await route.abort();
  });
  const ready=()=>page.waitForFunction(()=>window.StreamGlassCore&&StreamGlassCore.ready&&window.StreamGlassShell);
  await page.addInitScript(()=>{window.nativeMessages=[];window.StreamGlassNative={postMessage:data=>window.nativeMessages.push(JSON.parse(data))};});
  await page.goto(pathToFileURL(path.join(root,'../android/app/build/generated/assets/app/index.html')).href);
  await ready();await page.locator('.sg-card').first().waitFor();
  await page.screenshot({path:path.join(shots,'home.png')});
  assert.ok(await page.evaluate(()=>document.getElementById('app').scrollWidth<=innerWidth),'No phone-wide horizontal overflow');
  acceptLogin=true;
  await page.locator('#sg-account').tap();
  await page.locator('#sg-email').fill('test@example.invalid');await page.locator('#sg-password').fill('fake-password');
  await page.locator('#sg-login-form button').tap();
  await page.waitForFunction(()=>StreamGlassShell.state.signedIn&&location.hash==='#/board');
  await page.locator('.sg-card').first().waitFor();
  await page.locator('.sg-nav-search').tap();
  await page.locator('#sg-search-input').tap();await page.locator('#sg-search-input').fill('phone');
  await page.locator('#sg-search-results .sg-card').first().waitFor();
  assert.equal(await page.locator('#sg-search-input').evaluate(el=>el.readOnly),false);
  assert.equal(await page.locator('#sg-search-input').inputValue(),'phone');
  await page.screenshot({path:path.join(shots,'phone-search.png')});
  await page.locator('.sg-card').first().tap();await page.locator('[data-stream="0"]').waitFor();
  await page.locator('#sg-library-toggle').tap();
  await page.locator('[data-stream="0"]').tap();
  await page.waitForFunction(()=>window.nativeMessages.some(message=>message.action==='play'));
  const payload=await page.evaluate(()=>nativeMessages.find(message=>message.action==='play'));
  assert.ok(payload.payload.url.includes('token=private-stream-token'),'Signed links survive the native handoff');
  assert.ok(payload.payload.subtitles.length>0);
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'progress',session,timeMs:20000,durationMs:60000,paused:false}),payload.session);
  await page.waitForFunction(async()=>{const p=await StreamGlassCore.getState('player');return p.libraryItem?.state.timeOffset>=20000;});
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:21000,durationMs:60000,ended:false}),payload.session);
  await page.waitForFunction(()=>!StreamGlassShell.state.playing&&location.hash.startsWith('#/detail'));
  await page.locator('[data-stream="0"]').tap();
  await page.waitForFunction(()=>nativeMessages.filter(message=>message.action==='play').length===2);
  const resumed=await page.evaluate(()=>nativeMessages.filter(message=>message.action==='play').at(-1));
  assert.ok(resumed.payload.startMs>=20000,'Native progress is used for resume');
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:0,durationMs:0}),payload.session);
  assert.equal(await page.evaluate(()=>StreamGlassShell.state.playing),true,'Old native events cannot close the new session');
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:22000,durationMs:60000}),resumed.session);
  await page.waitForFunction(()=>!StreamGlassShell.state.playing);
  await page.locator('[data-nav="picks"]').tap();await page.locator('.sg-recommendation').first().waitFor();
  await page.screenshot({path:path.join(shots,'phone-picks.png')});
  await page.locator('.sg-recommendation').first().tap();await page.locator('[data-action="focus-streams"]').waitFor();
  await page.screenshot({path:path.join(shots,'phone-detail.png')});
  assert.equal(await page.evaluate(()=>StreamGlassAndroid.back()),true);
  await page.waitForFunction(()=>location.hash==='#/picks');
  for(const width of [320,800]){
    await page.setViewportSize({width,height:900});
    await page.locator('[data-nav="board"]').tap();await page.locator('.sg-card').first().waitFor();
    assert.ok(await page.evaluate(()=>document.getElementById('app').scrollWidth<=innerWidth),'Layout fits width '+width);
    await page.screenshot({path:path.join(shots,'home-'+width+'.png')});
  }
  assert.deepEqual(errors,[],'No mobile JavaScript runtime errors');
  const exported=await page.evaluate(()=>StreamGlassDiagnostics.export());
  assert.ok(!exported.includes('private-stream-token')&&!exported.includes('secret-fixture-token'));
  const summary={passed:true,engine:await browser.version(),nativePlayerMocked:true,actualAndroidDevice:false,realCore:true,login:true,touchSearch:true,responsiveWidths:[320,390,800],nativePayload:true,progress:true,resume:true,staleNativeEvents:true,recommendations:true,back:true,runtimeErrors:errors};
  await fs.writeFile(path.join(shots,'browser-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});
}
