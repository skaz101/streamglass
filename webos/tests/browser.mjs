// Full packaged-app test with real WASM core and video, isolated fixture services.
// GPL-3.0-or-later. No account credentials or API writes leave this test.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-app-'));
const shots=path.join(root,'test-results');
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
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
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
  await page.goto(pathToFileURL(path.join(root,'build/index.html')).href);
  await ready();await page.locator('.sg-card').first().waitFor();
  await page.screenshot({path:path.join(shots,'home.png')});
  // D-pad moves focus without pointer input.
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(()=>document.activeElement!==document.body),'Remote obtains focus');
  await page.keyboard.press('ArrowRight');
  await page.locator('#sg-account').click();
  await page.locator('#sg-email').click();await page.locator('#sg-email').fill('test@example.invalid');
  await page.locator('#sg-password').click();await page.locator('#sg-password').fill('fake-password');
  await page.locator('#sg-login-form button').click();
  await page.waitForFunction(()=>/Sign-in failed/.test(document.querySelector('#sg-login-status')?.textContent||''),null,{timeout:30000});
  acceptLogin=true;
  await page.locator('#sg-password').click();await page.locator('#sg-password').fill('fake-password');
  await page.locator('#sg-login-form button').click();
  await page.waitForFunction(()=>StreamGlassShell.state.signedIn&&location.hash==='#/board');
  await page.locator('.sg-card').first().waitFor();
  assert.equal(loginRequests,2);
  // The actual button artwork uses vectors, never an unavailable font character.
  const searchIcon=page.locator('.sg-nav-search svg');
  assert.equal(await searchIcon.locator('circle').count(),1);
  assert.ok(await searchIcon.evaluate(el=>el.getBoundingClientRect().width>20&&getComputedStyle(el).stroke!=='none'));
  await page.locator('[data-nav="picks"]').click();
  await page.getByRole('heading',{name:'Make it yours'}).waitFor();
  assert.equal(await page.locator('.sg-recommendation').count(),0,'Empty history never invents personal picks');
  await page.locator('.sg-nav-search').focus();await page.keyboard.press('Enter');
  await page.locator('#sg-search-input').waitFor();
  // 0.4.0: live search must not replace the input, caret or editing state.
  await page.locator('.sg-nav-search').click();
  const searchInput=page.locator('#sg-search-input');
  await searchInput.click();
  await page.evaluate(()=>window.liveInputNode=document.querySelector('#sg-search-input'));
  const beforeSearch=searchRequests.length;
  await searchInput.pressSequentially('matrix',{delay:65});
  await page.waitForFunction(()=>document.querySelector('#sg-search-results')?.getAttribute('aria-busy')==='false'&&document.querySelector('#sg-search-results .sg-card'));
  assert.deepEqual(searchRequests.slice(beforeSearch),['matrix','matrix'],'Typing a burst sends one query per catalog');
  assert.ok(await page.evaluate(()=>document.activeElement===window.liveInputNode&&document.querySelector('#sg-search-input')===window.liveInputNode&&!window.liveInputNode.readOnly),'Live results preserve editable focus and the same input node');
  assert.equal(await searchInput.evaluate(el=>el.selectionStart),6,'Caret remains at the end of the typed query');
  assert.ok(await searchInput.evaluate(el=>el.getBoundingClientRect().left>=60),'Search field has TV-safe side padding');
  assert.ok(await page.locator('#sg-search-results .sg-card').first().evaluate(el=>el.getBoundingClientRect().left>=60),'First result aligns with search heading');
  await page.screenshot({path:path.join(shots,'live-search.png')});
  await searchInput.fill('slowold');
  await page.waitForFunction(()=>document.querySelector('#sg-search-status').textContent==='Searching your addons…');
  await page.waitForTimeout(100);
  await searchInput.fill('newtitle');
  await page.waitForFunction(()=>document.querySelector('#sg-search-results')?.getAttribute('aria-busy')==='false'&&document.querySelector('#sg-search-results .sg-card')?.textContent.includes('newtitle'));
  await page.waitForTimeout(1100);
  assert.ok(!(await page.locator('#sg-search-results').innerText()).includes('slowold'),'Late responses cannot replace a newer query');
  await searchInput.fill('');
  assert.equal(await page.locator('#sg-search-results .sg-card').count(),0,'Clearing removes results immediately');
  const beforeShort=searchRequests.length;
  await searchInput.fill('V');await page.waitForTimeout(550);
  assert.equal(searchRequests.length,beforeShort,'One character waits for an explicit Search');
  await page.locator('#sg-search-form button').click();
  await page.locator('#sg-search-results .sg-card').first().waitFor();
  assert.ok(searchRequests.includes('V'),'One-letter titles can still be submitted');
  await searchInput.click();
  const beforeComposition=searchRequests.length;
  await searchInput.dispatchEvent('compositionstart');await searchInput.fill('composed');
  await page.waitForTimeout(550);
  assert.equal(searchRequests.length,beforeComposition,'No requests during IME composition');
  await searchInput.dispatchEvent('compositionend');
  await page.waitForFunction(()=>document.querySelector('#sg-search-results .sg-card')?.textContent.includes('composed'));
  await searchInput.fill('nothingfound');
  await page.getByRole('heading',{name:'No results',exact:true}).waitFor();
  await searchInput.fill('failsearch');
  await page.getByRole('heading',{name:'Search unavailable',exact:true}).waitFor();
  const failedCount=searchRequests.filter(q=>q==='failsearch').length;
  await page.locator('#sg-search-form button').click();
  await page.getByRole('heading',{name:'Search unavailable',exact:true}).waitFor();
  assert.ok(searchRequests.filter(q=>q==='failsearch').length>failedCount,'Same-query retry is available after failures');
  await searchInput.click();await searchInput.fill('liveback');
  await page.locator('#sg-search-results .sg-card').first().waitFor();
  await page.locator('#sg-search-results .sg-card').first().click();
  await page.locator('[data-action="focus-streams"]').waitFor();await page.keyboard.press('Escape');
  await page.waitForFunction(()=>location.hash==='#/search?search=liveback'&&document.activeElement.classList.contains('sg-card'));
  assert.equal(await page.locator('#sg-search-input').inputValue(),'liveback','Back restores a live query without prior submit');
  // Leaving during the debounce must not send a search from the next page.
  await page.locator('#sg-search-input').click();await page.locator('#sg-search-input').fill('dontsend');
  await page.locator('[data-nav="board"]').click();await page.locator('.sg-card').first().waitFor();
  await page.waitForTimeout(550);assert.ok(!searchRequests.includes('dontsend'));
  // 0.4.0: no duplicate rectangle over nav pills; preserve keyboard visibility.
  await page.locator('[data-nav="board"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.nav),'picks');
  await page.waitForFunction(()=>getComputedStyle(document.activeElement).backgroundColor==='rgb(243, 244, 247)');
  const navFocus=await page.locator('[data-nav="picks"]').evaluate(el=>{const s=getComputedStyle(el);return {outline:s.outlineStyle,background:s.backgroundColor,color:s.color,radius:parseFloat(s.borderRadius)};});
  assert.equal(navFocus.outline,'none');assert.equal(navFocus.background,'rgb(243, 244, 247)');
  assert.ok(navFocus.radius>20,'Navigation highlight stays rounded');
  assert.equal(await page.locator('[data-nav="board"]').getAttribute('aria-current'),'page','Focused and current navigation are different states');
  await page.screenshot({path:path.join(shots,'nav-focus.png')});
  await page.locator('.sg-card').nth(2).focus();
  const rememberedCard=await page.evaluate(()=>document.activeElement.dataset.card);
  await page.locator('[data-nav="board"]').focus();await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),rememberedCard,'Down from header restores content focus');
  assert.equal(await page.locator('.sg-card').nth(2).evaluate(el=>getComputedStyle(el).outlineStyle),'none','No rectangle wraps card captions');

  // 0.4.0: filter mapping, rail boundaries and returning to an off-screen card.
  await page.locator('.sg-filter').filter({hasText:'Series'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.sg-card').length>0&&[...document.querySelectorAll('.sg-card')].every(n=>n.dataset.card.startsWith('series:')));
  await page.locator('.sg-see-all').first().click();
  await page.locator('#sg-discover-grid .sg-card').first().waitFor();
  assert.ok((await page.locator('#sg-discover-grid .sg-card').first().getAttribute('data-card')).startsWith('series:'),'Filtered See All keeps original catalog mapping');
  await page.locator('[data-nav="board"]').click();await page.locator('.sg-card').first().waitFor();
  const firstRail=page.locator('.sg-cards').first();
  await firstRail.locator('.sg-card').first().focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),'movie:sg-movie-0','Left edge stays on the first card');
  for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),'movie:sg-movie-7');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),'series:sg-series-0');
  await page.keyboard.press('ArrowUp');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.card),'movie:sg-movie-7','Returning to a row restores its last card');
  await page.waitForTimeout(450);
  const scrollBefore=await firstRail.evaluate(el=>el.scrollLeft);
  assert.ok(scrollBefore>0,'Remote scrolls off-screen cards into view');
  await page.keyboard.press('Enter');await page.locator('[data-action="focus-streams"]').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>document.activeElement.dataset.card==='movie:sg-movie-7');
  assert.equal(await page.locator('.sg-cards').first().evaluate(el=>el.scrollLeft),scrollBefore,'Back restores horizontal scroll');
  // Search origin is restored, rather than always returning to Home.
  await page.locator('.sg-nav-search').click();
  await page.locator('#sg-search-input').click();await page.locator('#sg-search-input').fill('return test');await page.locator('#sg-search-form button').click();
  await page.locator('.sg-card').first().click();await page.locator('[data-action="focus-streams"]').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>location.hash.includes('search=return%20test')&&document.activeElement.classList.contains('sg-card'));
  await page.locator('[data-nav="board"]').click();await page.locator('.sg-card').first().waitFor();

  await page.locator('[data-nav="settings"]').click();
  await page.locator('select[name="subtitlesLanguage"]').focus();await page.keyboard.press('Enter');
  await page.locator('.sg-host-options button').filter({hasText:/English$/}).click();
  await page.getByRole('button',{name:'Save playback settings'}).click();
  assert.equal(await page.evaluate(async()=>(await StreamGlassCore.getState('ctx')).profile.settings.subtitlesLanguage),'eng');
  await page.screenshot({path:path.join(shots,'settings.png')});
  await page.locator('[data-nav="board"]').click();await page.locator('.sg-card').first().waitFor();
  await page.locator('.sg-cards').first().locator('.sg-card').first().focus();
  for(let i=0;i<7;i++)await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(450);
  await page.keyboard.press('Enter');
  await page.locator('[data-stream="0"]').waitFor();
  assert.equal(await page.locator('.sg-stream-badges').first().innerText(),'1080p');
  await page.locator('#sg-library-toggle').click();
  await page.waitForFunction(()=>/In Library/.test(document.querySelector('#sg-library-toggle').textContent));
  await page.screenshot({path:path.join(shots,'details.png')});
  const detailTop=await page.locator('.sg-detail-info').evaluate(el=>el.getBoundingClientRect().top);
  await page.locator('[data-stream="0"]').focus();
  for(let i=0;i<20;i++)await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.stream),'17','Stream list stops at its end');
  assert.ok(await page.locator('#sg-streams').evaluate(el=>el.scrollTop>0),'Long stream list scrolls locally');
  assert.ok(Math.abs(await page.locator('.sg-detail-info').evaluate(el=>el.getBoundingClientRect().top)-detailTop)<3,'Title remains in place while scrolling streams');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'focus-streams');

  await page.locator('[data-stream="1"]').click();
  await page.getByRole('heading',{name:'A direct link is needed'}).waitFor();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('[data-stream="0"]').click();
  await page.waitForFunction(()=>document.querySelector('video')?.videoWidth===640&&!document.querySelector('video').paused,null,{timeout:30000});
  await page.waitForFunction(()=>document.querySelector('video').textTracks.length>0&&document.querySelector('video').textTracks[0].cues?.length>0);
  await page.screenshot({path:path.join(shots,'player.png')});
  await page.evaluate(()=>{const v=document.querySelector('video');v.currentTime=20;v.pause();});
  await page.waitForFunction(async()=>{const p=await StreamGlassCore.getState('player');return p.libraryItem?.state.timeOffset>=19000;});
  await page.evaluate(()=>StreamGlassHost.closePlayer());
  await page.waitForFunction(()=>!StreamGlassShell.state.playing&&location.hash.startsWith('#/detail'));
  await page.locator('[data-stream="0"]').click();
  await page.waitForFunction(()=>document.querySelector('video')?.currentTime>=19,null,{timeout:30000});
  await page.evaluate(()=>StreamGlassHost.closePlayer());
  await page.waitForFunction(()=>!StreamGlassShell.state.playing);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>location.hash==='#/board'&&document.activeElement.dataset.card==='movie:sg-movie-7');
  assert.equal(await page.evaluate(()=>document.activeElement.closest('.sg-row').dataset.rowKey),'catalog:0','Back restores catalog selection, not its Continue Watching duplicate');
  assert.ok(await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=100&&r.bottom<=1080;}),'Saved selection stays visible after Continue Watching adds a row');
  assert.ok(await page.locator('[data-row-key="catalog:0"] .sg-cards').evaluate(el=>el.scrollLeft>0),'Catalog horizontal position survives new Continue Watching row');
  await page.locator('.sg-filter').filter({hasText:'Series'}).click();
  await page.locator('.sg-card').first().waitFor();
  assert.equal(await page.locator('[data-row-key="Continue Watching"]').count(),0,'No empty Continue Watching heading in a different type filter');
  await page.locator('[data-nav="library"]').click();await page.locator('.sg-card').first().waitFor();
  await page.screenshot({path:path.join(shots,'library.png')});
  // Recommendations use the real core library/progress created by playback above.
  genrelessCatalog=true;
  const beforeRecommendationMetadata=metadataRequests;
  await page.locator('[data-nav="picks"]').click();
  await page.locator('.sg-recommendation').first().waitFor();
  assert.equal(await page.locator('.sg-recommendation').count(),17,'Saved/started title excluded from both catalogues');
  assert.equal(await page.locator('.sg-recommendation[data-card="movie:sg-movie-7"]').count(),0);
  assert.match(await page.locator('.sg-recommendation .sg-card-caption').first().innerText(),/Because you started Test Film/);
  assert.ok(metadataRequests>beforeRecommendationMetadata+1,'Missing catalogue genres enriched through installed metadata addons');
  assert.equal(await page.locator('#sg-picks-results').getAttribute('aria-busy'),'false');
  await page.screenshot({path:path.join(shots,'recommendations.png')});
  const cachedMetadataRequests=metadataRequests;
  await page.locator('.sg-picks-filters a').filter({hasText:'Series'}).click();
  await page.locator('.sg-recommendation').first().waitFor();
  assert.equal(await page.locator('.sg-recommendation').count(),9);
  assert.ok(await page.locator('.sg-recommendation').evaluateAll(nodes=>nodes.every(node=>node.dataset.card.startsWith('series:'))));
  assert.equal(metadataRequests,cachedMetadataRequests,'Type changes reuse the bounded in-memory recommendation snapshot');
  await page.locator('.sg-recommendation').first().focus();await page.keyboard.press('ArrowRight');
  const recommendedCard=await page.evaluate(()=>document.activeElement.dataset.card);
  await page.keyboard.press('Enter');await page.locator('[data-action="focus-streams"]').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(key=>location.hash==='#/picks?type=series'&&document.activeElement.dataset.card===key,recommendedCard);
  await page.evaluate(()=>StreamGlassCore.dispatch({action:'Ctx',args:{action:'LibraryItemMarkAsWatched',args:{id:'sg-movie-7',is_watched:true}}},'ctx'));
  await page.locator('[data-action="recommendations-refresh"]').first().click();
  await page.waitForFunction(()=>document.querySelector('.sg-recommendation .sg-card-caption')?.textContent.includes('Because you watched'));
  assert.equal(await page.locator('.sg-recommendation[data-card="movie:sg-movie-7"]').count(),0,'Watched history is excluded too');
  recommendationFailure=true;
  await page.locator('[data-action="recommendations-refresh"]').first().click();
  await page.getByRole('heading',{name:'No new matches yet'}).waitFor();
  assert.match(await page.locator('#sg-picks-note').innerText(),/Some addons did not finish/);
  recommendationFailure=false;
  await page.getByRole('button',{name:'Try again',exact:true}).click();
  await page.locator('.sg-recommendation').first().waitFor();
  slowRecommendations=true;
  await page.locator('[data-action="recommendations-refresh"]').first().click();
  await page.locator('.sg-nav-search').click();await page.locator('#sg-search-input').waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('#sg-picks-results').count(),0,'Late recommendation requests cannot overwrite another page');
  genrelessCatalog=false;slowRecommendations=false;
  await page.locator('[data-nav="addons"]').click();
  await page.locator('#sg-addon-url').click();await page.locator('#sg-addon-url').fill('https://additional.invalid/manifest.json');
  await page.evaluate(()=>StreamGlassCore.dispatch({action:'Ctx',args:{action:'PullAddonsFromAPI'}},'ctx'));
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#sg-addon-url').inputValue(),'https://additional.invalid/manifest.json','Background sync preserves a typed addon configuration');
  await page.locator('#sg-addon-form button').click();
  await page.waitForFunction(()=>StreamGlassShell.state.addonCount>=2);
  await page.locator('.sg-nav-search').click();
  await page.locator('#sg-search-input').click();await page.locator('#sg-search-input').fill('fixture');await page.locator('#sg-search-form button').click();
  await page.locator('.sg-card').first().waitFor();
  await page.reload();await ready();await page.waitForFunction(()=>StreamGlassShell.state.signedIn);
  await page.keyboard.press('F2');await page.getByRole('heading',{name:'StreamGlass TV 0.4.0'}).waitFor();
  const exported=await page.evaluate(()=>StreamGlassDiagnostics.export());
  for(const secret of ['secret-fixture-token','private-stream-token','test@example.invalid','fake-password','fixtures.invalid'])assert.ok(!exported.includes(secret),'No private values in diagnostic export');
  assert.ok(libraryWrites>0);assert.ok(addonWrites>0);
  assert.deepEqual(errors,[],'No JavaScript runtime errors in packaged app');
  const summary={passed:true,engine:await browser.version(),protocol:'file:',mockedAccountAndAddons:true,localVideoPlayback:true,subtitleRendering:true,resume:true,libraryWrites,addonWrites,remoteNavigation:true,liveSearch:true,inputAndCaretPreserved:true,staleSearchSuppressed:true,compositionSafe:true,liveQueryRestored:true,roundedNavigationFocus:true,navReturnsToContent:true,localStreamScrolling:true,continueWatchingInsertion:true,railBoundary:true,rowFocusMemory:true,backRestoresCardAndScroll:true,searchOriginRestored:true,homeTypeFilter:true,vectorSearchIcon:true,recommendationsFromRealCoreProgress:true,recommendationsFromRealCoreWatched:true,recommendationExclusions:true,recommendationMetadataEnrichment:true,recommendationFilters:true,recommendationBackFocus:true,recommendationFailureRetry:true,recommendationCancellation:true,recommendationColdStart:true,sensitiveDiagnosticsExcluded:true,runtimeErrors:errors};
  await fs.writeFile(path.join(shots,'browser-results.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
}finally{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));await fs.rm(temp,{recursive:true,force:true});
}
