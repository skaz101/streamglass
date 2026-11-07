// Home stays usable while independent catalogs load or refresh fails.
// Isolated build: never writes webos/build, device state, or account data.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require('playwright');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-browse-'));
 let browser;
 try{
  await build({entryPoints:[path.resolve(__dirname,'../src/react/app.jsx')],outfile:path.join(temp,'app.js'),bundle:true,format:'iife',target:'chrome87',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'}});
  browser=await chromium.launch({executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let releaseRows,fail=false;
  const rowsGate=new Promise(resolve=>{releaseRows=resolve;});
  let releaseSeries;
  const seriesGate=new Promise(resolve=>{releaseSeries=resolve;});
  await page.route('https://browse.fixtures.invalid/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html></html>'}));
  await page.route('https://browse.fixtures.invalid/*.svg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#474039"/></svg>'}));
  await page.route(/https:\/\/(v3-cinemeta\.strem\.io|7a82163c306e-stremio-netflix-catalog-addon\.baby-beamup\.club)\//,async route=>{
   const url=new URL(route.request().url()),[,resource,type,id]=url.pathname.split('/');
   if(resource==='catalog'&&id==='top.json'&&type==='series')await seriesGate;
   else if(!(resource==='catalog'&&id==='top.json'&&type==='movie'))await rowsGate;
   if(fail){await route.fulfill({status:503,headers:{'access-control-allow-origin':'*'},body:'Unavailable'});return;}
   const suffix=id?.replace('.json','')||'';
   const meta={id:resource==='meta'?suffix:type==='movie'?'tt1000001':'tt2000001',type,name:resource==='meta'?'A saved story':`${suffix} ${type} story`,background:'https://browse.fixtures.invalid/landscape.svg',poster:'https://browse.fixtures.invalid/portrait.svg',description:'An isolated catalog fixture.',releaseInfo:'2026'};
   const body=resource==='meta'?{meta}:{metas:Array.from({length:10},(_,index)=>({...meta,id:(type==='movie'?'tt10000':'tt20000')+String(index).padStart(2,'0'),name:meta.name+' '+index}))};
   await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
  });
  await page.goto('https://browse.fixtures.invalid/');
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00'));
  await page.setContent('<style>html,body{margin:0;background:#080808;color:white;font-family:Arial}#sg-view{height:100vh;overflow:auto}</style><div id="app"><main id="sg-view"></main></div>');
  for(const file of ['../src/shell.css','../src/react/theme.css'])await page.addStyleTag({content:(await fs.readFile(path.resolve(__dirname,file),'utf8')).replace(/^@(import|tailwind).*$/gm,'')});
  await page.addScriptTag({path:path.join(temp,'app.js')});
  await page.evaluate(()=>{
   localStorage.clear();window.progressComputations=0;window.metadataReads=0;
   const api={mobile:false,savedTitles:async()=>new Set(),saveTitle:async()=>{},registerCard(){},safeURL:src=>src||'',progressFraction(){window.progressComputations++;return 0;},detailHash:(type,id)=>'#/detail/'+type+'/'+id,continueWatching:async()=>[],resolveMeta:async(type,id,meta)=>{window.metadataReads++;return {meta};}};
   StreamGlassUI.mount(document.getElementById('sg-view'),{route:'board',api,params:new URLSearchParams()});
  });
  // Top series is still blocked: movies are already browsable and featured.
  await page.locator('.sg-hero').waitFor();
  await page.locator('.sg-row[data-row-key="Top movies"] .sg-card').first().waitFor();
  assert.equal(await page.locator('.sg-hero-loading').count(),0);
  assert.ok(await page.locator('.sg-row-loading').count()>0);
  assert.equal(await page.locator('.sg-row[data-row-key="Top movies"] .sg-card img').first().getAttribute('src'),'https://browse.fixtures.invalid/landscape.svg','TV rails use landscape art');
  await page.locator('.sg-row[data-row-key="Top movies"] .sg-card img').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.sg-row[data-row-key="Top movies"] img')?.dataset.artReady==='true');
  await page.locator('.sg-row[data-row-key="Top movies"] .sg-card').nth(3).focus();
  await page.evaluate(()=>{window.firstCard=document.activeElement;window.firstPoster=firstCard.querySelector('img');});
  releaseSeries();releaseRows();
  await page.waitForFunction(()=>!document.querySelector('.sg-react-loading')&&!document.querySelector('.sg-home-toolbar button')?.disabled);
  assert.equal(await page.evaluate(()=>document.activeElement===firstCard),true,'Later catalogs preserve remote focus');
  assert.equal(await page.evaluate(()=>firstCard.querySelector('img')===firstPoster),true,'Later catalogs retain decoded image elements');
  const count=await page.locator('#sg-home-rows .sg-card').count();
  const computations=await page.evaluate(()=>progressComputations);
  assert.ok(computations<count*2,`${computations} progress calculations for ${count} cards: unrelated rows must not rerender loaded cards`);
  assert.ok(await page.evaluate(()=>metadataReads)<=2,'Later catalog arrivals do not restart the billboard repeatedly');
  // Refresh failure must not delete the focused title or replace it with a dead end.
  fail=true;
  await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.evaluate(()=>firstCard.focus());
  await page.waitForFunction(()=>!document.querySelector('.sg-home-toolbar button')?.disabled);
  assert.equal(await page.locator('#sg-home-rows .sg-card').count(),count);
  assert.equal(await page.evaluate(()=>document.activeElement===firstCard&&firstCard.isConnected),true);
  assert.ok(await page.locator('.sg-row[data-stale="true"]').count()>0);
  assert.equal(await page.locator('.sg-curated-empty').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.sg-row[data-row-key="Top movies"] img').first().evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  await page.evaluate(()=>StreamGlassUI.unmount(document.getElementById('sg-view')));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,firstCatalogUsableBeforeOthers:true,stableFocusDuringProgressiveLoad:true,failedRefreshRetainsTitles:true,cards:count,cardCalculations:computations,decodedArtwork:true,reducedMotion:true}));
 }finally{if(browser)await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
