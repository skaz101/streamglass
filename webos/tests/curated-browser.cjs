// Built React discovery, real touch arbitration and persisted Home preferences.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[],requests=new Map();
  let failRequests=false,requestGate=null;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://react.fixtures.invalid/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));
  await page.route(/https:\/\/(v3-cinemeta\.strem\.io|7a82163c306e-stremio-netflix-catalog-addon\.baby-beamup\.club)\//,async route=>{
   const url=new URL(route.request().url());requests.set(url.href,(requests.get(url.href)||0)+1);
   if(requestGate)await requestGate;
   if(failRequests){await route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'Unavailable'});return;}
   const [,resource,type,id]=url.pathname.split('/');
   const meta={background:`https://react.fixtures.invalid/scene-${type}.svg`,poster:`https://react.fixtures.invalid/scene-${type}.svg`,id:resource==='meta'?id.replace('.json',''):'tt1000001',type,name:resource==='meta'?'Selection '+id.replace('.json',''):`${id.replace('.json','')} ${type} premiere`,description:'A fixture title for discovery.',genres:['Drama']};
   await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(resource==='meta'?{meta}:{metas:[meta,{...meta,id:'tt1000002',name:'Another good story'}]})});
  });
  await page.route('https://react.fixtures.invalid/scene-*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="${route.request().url().includes('movie')?'#bd5924':'#3d9068'}"/></svg>`}));
  await page.goto('https://react.fixtures.invalid/');
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00'));
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"><div class="sg-app"><main id="sg-view"></main></div></div>');
  await page.evaluate(()=>{document.documentElement.dataset.sgPlatform='mobile';localStorage.clear();});
  for(const file of ['../build/shell.css','../build/react-ui.css','../../android/ui/mobile.css','../build/cinematic.css'])await page.addStyleTag({path:path.resolve(__dirname,file)});
  await page.addScriptTag({path:path.resolve(__dirname,'../build/react-ui.js')});
  await page.evaluate(()=>{
   const entries=[{key:'fixture-movies',catalog:{name:'Fixture collection',type:'movie'},addon:{manifest:{name:'Fixture'}}}];
   window.addonLists=0;window.addonFetches=[];
   window.testAPI={mobile:true,registerCard(){},safeURL(src){return src||'';},progressFraction(){return 0;},detailHash(type,id){return '#/detail/'+type+'/'+id;},catalogs(){window.addonLists++;return entries;},catalog(entry,extra,signal,refresh){window.addonFetches.push({key:entry.key,refresh});return Promise.resolve({metas:[{id:'tt9990001',type:'movie',name:'Only from my addon'}]});},continueWatching(){return Promise.resolve([]);},resolveMeta(type,id,fallback){return Promise.resolve({meta:fallback});}};
   window.mountTest=(route,query='')=>{const node=document.getElementById('sg-view');StreamGlassUI.unmount(node);node.scrollTop=0;StreamGlassUI.mount(node,{route,api:window.testAPI,params:new URLSearchParams(query)});};
   window.mountTest('board');
  });
  const ready=()=>page.waitForFunction(()=>document.querySelector('.sg-home')&&!document.querySelector('.sg-react-loading')&&!document.querySelector('.sg-refresh-accessible')?.disabled);
  await ready();
  for(const title of ['Featured · Movies','Featured · Series','Halloween nights','Netflix · Movies','Netflix · Series','HBO Max · Movies','HBO Max · Series','Anime · Movies','Anime · Series','Top movies','Top series']){
   const row=page.locator('.sg-row').filter({has:page.getByRole('heading',{name:title,exact:true})});
   assert.equal(await row.count(),1,`${title} is present`);
   assert.ok(await row.locator('.sg-card').count()>0,`${title} contains loaded titles`);
  }
  assert.deepEqual((await page.locator('#sg-home-rows h2').allTextContents()).slice(0,2),['Top movies','Top series']);
  assert.equal(await page.evaluate(()=>addonLists),0,'Curated Home never enumerates installed addon catalogs');
  assert.equal(await page.evaluate(()=>addonFetches.length),0);
  const initial=new Map(requests);
  assert.equal(initial.size,28,'Eight catalogs and twenty seasonal/anime metadata requests are mocked');
  await page.evaluate(()=>mountTest('board'));await ready();
  assert.deepEqual(requests,initial,'Revisiting Home reuses discovery cache');

  const cdp=await page.context().newCDPSession(page);
  const gesture=async(dx,dy,{x=195,y=200,release=true}={})=>{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
   for(let step=1;step<=8;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/8,y:y+dy*step/8,id:1}]});
   if(release)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const indicator=page.locator('.sg-pull-refresh');
  await page.locator('.sg-home-ambient .sg-hero-art-entering').waitFor();
  const firstAmbient=await page.locator('.sg-home-ambient .sg-hero-art-entering').getAttribute('src');
  assert.ok(firstAmbient.endsWith('scene-movie.svg'));
  assert.ok(await page.locator('.sg-ambient-art').first().evaluate(node=>getComputedStyle(node).filter.includes('blur(')),'Ambient light is genuinely blurred artwork');
  await gesture(-120,12);
  await page.waitForFunction(()=>document.querySelector('.sg-home-ambient .sg-hero-art-entering')?.src.endsWith('scene-series.svg'));
  assert.equal(await page.locator('.sg-app').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(8, 8, 8)','Changing artwork does not recolor the app chrome');
  await page.waitForTimeout(100);
  assert.deepEqual(requests,initial,'Horizontal hero swipes never refresh Home');
  assert.equal(await indicator.getAttribute('data-state'),'idle');
  await gesture(0,80);
  await page.waitForTimeout(100);
  assert.deepEqual(requests,initial,'A pull below threshold does not refresh');
  assert.equal(await indicator.getAttribute('data-state'),'idle');
  await page.evaluate(()=>{document.getElementById('sg-view').scrollTop=400;});
  assert.ok(await page.locator('#sg-view').evaluate(node=>node.scrollTop)>0,'Fixture is scrollable');
  await gesture(0,200);
  await page.waitForTimeout(100);
  assert.deepEqual(requests,initial,'A gesture beginning below the top does not refresh');
  await page.evaluate(()=>{document.getElementById('sg-view').scrollTop=0;});
  const visibleCards=await page.locator('#sg-home-rows .sg-card').count();
  let releaseRequests;requestGate=new Promise(resolve=>{releaseRequests=resolve;});
  await gesture(0,200,{release:false});
  assert.equal(await indicator.getAttribute('data-state'),'ready','Actual touch exposes release-to-refresh at threshold');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='refreshing');
  assert.equal(await page.locator('#sg-home-rows .sg-card').count(),visibleCards,'Existing titles remain visible while refresh is pending');
  assert.equal(await page.locator('.sg-react-loading').count(),0,'Refresh does not replace content with loading skeletons');
  releaseRequests();requestGate=null;
  await ready();
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='done');
  assert.equal(requests.size,initial.size);
  for(const [url,count] of initial)assert.equal(requests.get(url),count+1,`Pull refresh bypasses cache for ${url}`);
  assert.equal(await page.evaluate(()=>addonLists),0,'Pull refresh retains curated mode');
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='idle');
  failRequests=true;
  await gesture(0,200);await ready();
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='error');
  assert.match(await indicator.textContent(),/Could not refresh/,'All failed collections announce failure, not Up to date');
  assert.equal(await page.locator('.sg-curated-empty').count(),11,'Unavailable collections retain their named rows');
  for(const [url,count] of initial)assert.equal(requests.get(url),count+2,`Failed refresh tried ${url}`);
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='idle');
  failRequests=false;
  await gesture(0,200);await ready();
  await page.waitForFunction(()=>document.querySelector('.sg-pull-refresh')?.dataset.state==='done');
  assert.equal(await page.locator('#sg-home-rows .sg-card').count(),visibleCards,'Pull retry restores every collection');
  for(const [url,count] of initial)assert.equal(requests.get(url),count+3,`Recovery retries ${url}`);

  await page.evaluate(()=>mountTest('settings'));
  assert.equal(await page.getByRole('radio',{name:/Curated collections/}).isChecked(),true);
  await page.getByRole('radio',{name:/My addon catalogs/}).check();
  assert.equal(await page.evaluate(()=>localStorage.getItem('streamglass-home-v1')),'addons');
  await page.evaluate(()=>mountTest('board'));await ready();
  await page.getByRole('heading',{name:'Only from my addon',exact:true}).waitFor();
  assert.ok(await page.evaluate(()=>addonLists)>0);
  assert.equal(await page.locator('#sg-home-rows .sg-row').count(),1);
  assert.equal(await page.locator('#sg-home-rows .sg-card').getAttribute('data-card'),'movie:tt9990001');
  assert.equal(await page.locator('.sg-see-all').getAttribute('href'),'#/discover?catalog=0');
  const afterRefresh=new Map(requests);
  await page.evaluate(()=>mountTest('settings'));
  assert.equal(await page.getByRole('radio',{name:/My addon catalogs/}).isChecked(),true,'Preference survives route remount');
  await page.getByRole('radio',{name:/Curated collections/}).check();
  await page.evaluate(()=>mountTest('board','type=series'));await ready();
  assert.deepEqual(await page.locator('#sg-home-rows h2').allTextContents(),['Top series','Featured · Series','Netflix · Series','HBO Max · Series','Anime · Series']);
  assert.deepEqual(requests,afterRefresh,'Returning to curated mode uses refreshed cache');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Curated Home fits the phone');
  await page.evaluate(()=>StreamGlassUI.unmount(document.getElementById('sg-view')));
  assert.deepEqual(errors,[]);
  console.log('Curated default rows, cache bypass, trusted touch gestures, refresh failure/recovery, filters and persisted addon preference passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
