// Packaged touch UI with real WASM core and a mocked native player bridge.
// GPL-3.0-or-later. No account credentials or API writes leave this test.
import {chromium} from '../../webos/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../webos');
const shots=path.join(root,'../android/test-results');
await fs.mkdir(shots,{recursive:true});
let browser;
try {
  const origin='https://media.fixtures.invalid';
  const addon={transportUrl:'https://fixtures.invalid/manifest.json',flags:{official:false,protected:false},manifest:{id:'org.streamglass.integration',name:'Fixture catalog',description:'Test services, never shipped.',version:'1.0.0',types:['movie','series'],resources:['catalog','meta','stream','subtitles'],catalogs:[{type:'movie',id:'movies',name:'Movies',extra:[{name:'search'},{name:'skip'},{name:'genre',options:['Adventure','Drama']}]},{type:'series',id:'series',name:'Series',extra:[{name:'search'}]}]}};
  const titles=['The Last Horizon','After Hours','Wild Country','Deep Blue','The Long Way Home','Neon City','Beyond the Pines','Nightfall','A New Beginning'];
  const titleFor=(type,id)=>type==='series'?'The Quiet Coast':titles[(Number(String(id).match(/(\d+)$/)?.[1])||0)%titles.length];
  const meta=(type='movie',id='sg-movie')=>({id,type,name:titleFor(type,id),description:'At the edge of a changing world, a lone explorer follows a mysterious signal beyond the mountains. Some journeys change everything.',poster:'https://fixtures.invalid/poster-'+id+'.svg',background:'https://fixtures.invalid/background-'+id+'.svg',genres:['Adventure','Drama'],imdbRating:'8.1',releaseInfo:'2026',runtime:'1 min',videos:type==='series'?[{id:id+':1:1',season:1,episode:1,title:'First episode',released:'2020-01-01T00:00:00.000Z'},{id:id+':2:1',season:2,episode:1,title:'Second season',released:'2020-01-01T00:00:00.000Z'}]:[{id,title:'Test Film',released:'2020-01-01T00:00:00.000Z'}]});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const screenshot=async name=>{
    await page.locator('#sg-toast').waitFor({state:'hidden'});
    await page.evaluate(()=>Promise.all([...document.images].filter(img=>img.complete).map(img=>img.decode().catch(()=>{}))));
    await page.screenshot({path:path.join(shots,name),animations:'disabled'});
  };
  let acceptLogin=false,loginRequests=0,libraryWrites=0,addonWrites=0;
  let storedAddons=[addon];
  const searchRequests=[];
  let recommendationFailure=false, genrelessCatalog=false, slowRecommendations=false, metadataRequests=0;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route(/^https?:/,async route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin){await route.abort();return;}
    const reply=value=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(value)});
    if(url.pathname.endsWith('.svg')){
      const index=(Number(url.pathname.match(/(\d+)\.svg$/)?.[1])||0)%9;
      const palette=[['#17283c','#d9a16b'],['#331e38','#ed786f'],['#17352d','#a9bd91'],['#152e45','#6ebac4'],['#332a24','#dda768'],['#271d46','#b57dcc'],['#1c342b','#8bbfac'],['#242b3c','#9ca8c7'],['#3f2730','#e3a99a']][index];
      const isPoster=url.pathname.includes('poster');
      const title=titles[index].toUpperCase();
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${isPoster?960:450}" viewBox="${isPoster?'0 0 640 960':'0 190 640 360'}"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><linearGradient id="fog" x2="0" y2="1"><stop stop-color="${palette[1]}" stop-opacity="0"/><stop offset="1" stop-color="#080e16"/></linearGradient></defs><rect width="640" height="960" fill="url(#sky)"/><circle cx="390" cy="285" r="125" fill="${palette[1]}" opacity=".8"/><circle cx="382" cy="280" r="113" fill="${palette[0]}" opacity=".13"/><path d="M0 560 150 300 300 570 410 390 640 650V960H0Z" fill="#253640"/><path d="m150 300-35 100 35-18 30 30Z" fill="#c1c9c7" opacity=".6"/><path d="M0 670 240 490 410 690 540 520 640 680V960H0Z" fill="#17232a"/><path d="M0 750 130 650 380 730 570 650 640 720V960H0Z" fill="#10191f"/><rect y="650" width="640" height="310" fill="url(#fog)"/><path d="M310 700v64m-8-45 8-15 10 15m-10 45-8 30m8-30 9 30" stroke="#070e14" stroke-width="8"/><circle cx="310" cy="692" r="9" fill="#070e14"/>${isPoster?`<text x="320" y="837" text-anchor="middle" fill="#eee6d7" font-family="sans-serif" font-weight="800" font-size="30" letter-spacing="2">${title}</text><text x="320" y="870" text-anchor="middle" fill="#c4c6c8" font-family="sans-serif" font-size="11" letter-spacing="5">A WORLD WAITING TO BE FOUND</text>`:''}</svg>`;
      await route.fulfill({status:200,contentType:'image/svg+xml',body:svg});return;
    }
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
      await reply({metas:query==='nothingfound'?[]:Array.from({length:9},(_,i)=>({...meta(parts[1],parts[1]==='series'?'sg-series-'+i:'sg-movie-'+i),...(genrelessCatalog?{genres:[]}:{}),name:(query?query+' ':'')+(parts[1]==='series'?'The Quiet Coast '+(i+1):titles[i])}))});return;
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
  await screenshot('home.png');
  assert.ok(await page.evaluate(()=>document.getElementById('app').scrollWidth<=innerWidth),'No phone-wide horizontal overflow');
  acceptLogin=true;
  await page.locator('#sg-profile').tap();
  await page.locator('.sg-menu-sheet a[href="#/account"]').tap();
  await page.locator('#sg-email').fill('test@example.invalid');await page.locator('#sg-password').fill('fake-password');
  await page.locator('#sg-login-form button').tap();
  await page.waitForFunction(()=>StreamGlassShell.state.signedIn&&location.hash==='#/board');
  await page.locator('.sg-card').first().waitFor();
  await page.locator('.sg-nav-search').tap();
  await page.locator('#sg-search-input').tap();await page.locator('#sg-search-input').fill('phone');
  await page.locator('#sg-search-results .sg-card').first().waitFor();
  assert.equal(await page.locator('#sg-search-input').evaluate(el=>el.readOnly),false);
  assert.equal(await page.locator('#sg-search-input').inputValue(),'phone');
  await screenshot('phone-search.png');
  await page.locator('.sg-card').first().tap();await page.locator('[data-action="focus-streams"]').waitFor();
  assert.equal(await page.locator('.sg-stream-sheet').isVisible(),false,'Streams stay out of the title page until Play');
  await page.locator('#sg-library-toggle').tap();
  await page.waitForFunction(()=>document.getElementById('sg-library-toggle').getAttribute('aria-pressed')==='true');
  await page.locator('[data-action="focus-streams"]').tap();
  await page.locator('[data-stream="0"]').waitFor();
  await screenshot('phone-streams.png');
  assert.equal(await page.locator('.sg-bottom-nav').evaluate(el=>el.inert),true,'Background navigation is inert while choosing a stream');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.sg-stream-sheet').isVisible(),false);
  assert.equal(await page.locator('[data-action="focus-streams"]').evaluate(el=>el===document.activeElement),true,'Sheet dismissal restores focus');
  await page.locator('[data-action="focus-streams"]').tap();
  await page.locator('[data-stream="0"]').tap();
  await page.waitForFunction(()=>window.nativeMessages.some(message=>message.action==='play'));
  const payload=await page.evaluate(()=>nativeMessages.find(message=>message.action==='play'));
  assert.ok(payload.payload.url.includes('token=private-stream-token'),'Signed links survive the native handoff');
  assert.ok(payload.payload.subtitles.length>0);
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'progress',session,timeMs:20000,durationMs:60000,paused:false}),payload.session);
  await page.waitForFunction(async()=>{const p=await StreamGlassCore.getState('player');return p.libraryItem?.state.timeOffset>=20000;});
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:21000,durationMs:60000,ended:false}),payload.session);
  await page.waitForFunction(()=>!StreamGlassShell.state.playing&&location.hash.startsWith('#/detail'));
  await page.locator('[data-action="focus-streams"]').tap();
  await page.locator('[data-stream="0"]').tap();
  await page.waitForFunction(()=>nativeMessages.filter(message=>message.action==='play').length===2);
  const resumed=await page.evaluate(()=>nativeMessages.filter(message=>message.action==='play').at(-1));
  assert.ok(resumed.payload.startMs>=20000,'Native progress is used for resume');
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:0,durationMs:0}),payload.session);
  assert.equal(await page.evaluate(()=>StreamGlassShell.state.playing),true,'Old native events cannot close the new session');
  await page.evaluate(session=>StreamGlassAndroid.receive({action:'closed',session,timeMs:22000,durationMs:60000}),resumed.session);
  await page.waitForFunction(()=>!StreamGlassShell.state.playing);
  await page.locator('[data-nav="picks"]').tap();await page.locator('.sg-recommendation').first().waitFor();
  await screenshot('phone-picks.png');
  await page.locator('.sg-recommendation').first().tap();await page.locator('[data-action="focus-streams"]').waitFor();
  await screenshot('phone-detail.png');
  assert.equal(await page.evaluate(()=>StreamGlassAndroid.back()),true);
  await page.waitForFunction(()=>location.hash==='#/picks');
  for(const width of [320,390,800]){
    await page.setViewportSize({width,height:900});
    await page.locator('[data-nav="board"]').tap();await page.locator('.sg-card').first().waitFor();
    assert.ok(await page.evaluate(()=>document.getElementById('app').scrollWidth<=innerWidth),'Layout fits width '+width);
    await screenshot('home-'+width+'.png');
    const nav=await page.locator('.sg-bottom-nav').boundingBox();
    assert.ok(nav.y+nav.height<=900&&nav.y>=830,'Bottom tabs stay in thumb reach');
    assert.equal(await page.locator('[data-nav="board"]').getAttribute('aria-current'),'page');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.sg-mobile-hero-actions .sg-primary').tap();
  await page.locator('.sg-stream-sheet:not([hidden])').waitFor();
  assert.equal(await page.evaluate(()=>StreamGlassAndroid.back()),true,'Android Back closes stream sheet first');
  assert.ok((await page.evaluate(()=>location.hash)).startsWith('#/detail'));
  assert.equal(await page.locator('.sg-stream-sheet').isVisible(),false);
  await page.locator('[data-nav="library"]').tap();
  await page.locator('#sg-library-grid .sg-card').first().waitFor();
  assert.equal(await page.locator('.library-content>h1').textContent(),'My List');
  await screenshot('phone-my-list.png');
  await page.locator('[data-nav="board"]').tap();
  await page.locator('a.sg-filter[href="#/board?type=series"]').tap();
  await page.locator('a.sg-filter[href="#/board?type=series"].selected').waitFor();
  await page.locator('.sg-card').first().tap();
  await page.locator('#sg-season').selectOption('2');
  await page.locator('[data-video$=":2:1"]').tap();
  await page.locator('.sg-stream-sheet:not([hidden])').waitFor();
  assert.ok((await page.locator('#sg-stream-heading').textContent()).includes('S2 E1'));
  await page.evaluate(()=>StreamGlassAndroid.back());
  await screenshot('phone-episodes.png');
  await page.locator('[data-nav="board"]').tap();
  await page.locator('#sg-profile').tap();
  await screenshot('phone-profile.png');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')),true);
  await page.locator('.sg-menu-sheet a[href="#/settings"]').tap();
  await page.locator('#sg-prefs-form').waitFor();
  assert.equal(await page.locator('.sg-bottom-nav').evaluate(el=>el.inert),false,'Leaving a sheet restores navigation');
  await screenshot('phone-settings.png');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:844,height:390});
  await page.locator('[data-nav="board"]').tap();await page.locator('.sg-card').first().waitFor();
  assert.ok(await page.evaluate(()=>document.getElementById('app').scrollWidth<=innerWidth),'Landscape has no horizontal page overflow');
  await screenshot('landscape.png');
  const heroPlay=await page.locator('.sg-mobile-hero-actions .sg-primary').boundingBox();
  const bottomBar=await page.locator('.sg-bottom-nav').boundingBox();
  assert.ok(heroPlay.y+heroPlay.height<=bottomBar.y,'Featured Play stays above bottom navigation in landscape');
  await page.locator('#sg-profile').tap();
  assert.equal(await page.locator('.sg-menu-sheet').evaluate(el=>getComputedStyle(el).animationName),'none','Reduced motion disables sheet animation');
  await page.evaluate(()=>StreamGlassAndroid.back());
  assert.deepEqual(errors,[],'No mobile JavaScript runtime errors');
  const exported=await page.evaluate(()=>StreamGlassDiagnostics.export());
  assert.ok(!exported.includes('private-stream-token')&&!exported.includes('secret-fixture-token'));
  const summary={passed:true,engine:await browser.version(),nativePlayerMocked:true,actualAndroidDevice:false,realCore:true,login:true,touchSearch:true,responsiveWidths:[320,390,800],nativePayload:true,progress:true,resume:true,staleNativeEvents:true,recommendations:true,back:true,bottomNavigation:true,streamSheet:true,focusRestoration:true,myList:true,episodes:true,reducedMotion:true,landscape:true,runtimeErrors:errors};
  await fs.writeFile(path.join(shots,'browser-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{
  if(browser)await browser.close();
}
