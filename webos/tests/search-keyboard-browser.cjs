// Real React, shell and TV host with isolated catalogs. No native keyboard
// events are supplied: this verifies the app-owned keyboard, not LG hardware.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require('playwright');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-search-keyboard-'));
 let browser;
 try{
  await build({entryPoints:[path.resolve(__dirname,'../src/react/app.jsx')],outfile:path.join(temp,'app.js'),bundle:true,format:'iife',target:'chrome87',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'}});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'}),errors=[],requests=[];
  let releaseMovies=null;const waiting=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://search.fixtures.invalid/**',async route=>{
   const url=new URL(route.request().url()),[,resource,type]=url.pathname.split('/');
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>'});
   if(url.pathname.endsWith('.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#594337"/><circle cx="700" cy="190" r="150" fill="#ac7960"/></svg>'});
   const query=decodeURIComponent(url.pathname.match(/search=([^/]+)\.json$/)?.[1]||'');
   if(resource==='catalog'&&query)requests.push(query);
   if(query==='wait-for-focus')await new Promise(resolve=>waiting.push(resolve));
   else if(query.startsWith('gated')&&type==='movie')await new Promise(resolve=>{releaseMovies=resolve;});
   const titles=Array.from({length:12},(_,index)=>({id:`${type}-${index}`,type,name:`${query} ${type} ${index+1}`,releaseInfo:'2026',background:'https://search.fixtures.invalid/art.svg'}));
   if(resource==='meta')return route.fulfill({contentType:'application/json',body:JSON.stringify({meta:{...titles[0],id:url.pathname.split('/').pop().replace('.json','')}})});
   return route.fulfill({contentType:'application/json',body:JSON.stringify({metas:titles})});
  });
  await page.goto('https://search.fixtures.invalid/');
  for(const file of ['shell.css','host.css','react/theme.css','react/components/search.css','cinematic.css','tv.css']){
   const css=(await fs.readFile(path.resolve(__dirname,'../src',file),'utf8')).replace(/^@(import|tailwind).*$/gm,'');
   await page.addStyleTag({content:css});
  }
  await page.addScriptTag({path:path.join(temp,'app.js')});
  await page.evaluate(()=>{
   const addon={transportUrl:'https://search.fixtures.invalid/manifest.json',manifest:{name:'Search fixture',types:['movie','series'],resources:['catalog','meta'],catalogs:[{id:'movies',type:'movie',extra:[{name:'search'}]},{id:'series',type:'series',extra:[{name:'search'}]}]}};
   window.StreamGlassCore={init:async()=>{},dispatch:async()=>{},getState:async name=>name==='ctx'?{profile:{addons:[addon]}}:name==='continue_watching_preview'?{items:[]}:{catalog:[]},on:()=>()=>{}};
   window.WebOSPlayer=class{active(){return false;}handleKey(){return false;}};
   window.nativeInputFocuses=0;
   document.addEventListener('focusin',event=>{if(event.target.matches('input:not([type="hidden"]),textarea,[contenteditable="true"]'))nativeInputFocuses++;});
   history.replaceState(null,'','#/search');
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../src/shell.js')});
  await page.addScriptTag({path:path.resolve(__dirname,'../src/host.js')});
  const keys=page.locator('.sg-search-keys button'),value=()=>page.locator('#sg-search-input').inputValue();
  const activeKey=()=>page.evaluate(()=>document.activeElement.dataset.key);
  const display=page.locator('#sg-search-query');
  const paste=async value=>display.evaluate((el,value)=>{const data=new DataTransfer();data.setData('text/plain',value);el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},value);
  const setQuery=async query=>{await display.focus();await page.keyboard.press('Control+a');await page.keyboard.press('Backspace');await page.keyboard.type(query);};
  const resultsReady=()=>page.waitForFunction(()=>document.querySelector('#sg-search-results')?.getAttribute('aria-busy')==='false'&&document.querySelector('#sg-search-results .sg-card'));
  await keys.first().waitFor();
  assert.equal(await activeKey(),'a','Search immediately focuses the available custom keyboard');
  assert.equal(await keys.count(),36);
  await page.evaluate(()=>{window.firstKey=document.querySelector('.sg-search-keys button');window.queryNode=document.querySelector('#sg-search-query');});
  await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
  assert.equal(await value(),'ab','D-pad and OK type into the query');
  await page.locator('[data-key="space"]').click();await page.locator('[data-key="7"]').click();
  assert.equal(await value(),'ab 7','Pointer keys and Space use the same query');
  await page.locator('[data-key="backspace"]').click();assert.equal(await value(),'ab ');
  await page.locator('[data-key="clear"]').click();assert.equal(await value(),'');
  await keys.first().focus();
  const requestStart=requests.length;
  await page.keyboard.type('matrix',{delay:35});await resultsReady();
  assert.deepEqual(requests.slice(requestStart),['matrix','matrix'],'A typing burst sends one query per catalog');
  assert.equal(await activeKey(),'a','Live results never steal focus from the letters');
  assert.equal(await page.evaluate(()=>firstKey===document.querySelector('.sg-search-keys button')&&queryNode===document.querySelector('#sg-search-query')),true,'Keyboard and query nodes remain mounted');
  assert.equal(await page.evaluate(()=>localStorage.getItem('streamglass-search-v1')),null,'Live typing does not store unsubmitted history');
  for(const size of [{width:1280,height:720},{width:1920,height:1080}]){
   await page.setViewportSize(size);
   const fit=await page.locator('.sg-search-keyboard').evaluate(el=>{const rect=el.getBoundingClientRect();const cards=[...document.querySelectorAll('#sg-search-results .sg-cards')][0];const third=cards.querySelectorAll('.sg-card')[2].getBoundingClientRect();return {left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,height:innerHeight,scroll:document.querySelector('#sg-view').scrollTop,thirdRight:third.right,paneRight:document.querySelector('.sg-search-results-pane').getBoundingClientRect().right};});
   assert.ok(fit.bottom<=fit.height-12&&fit.top>=76&&fit.left>=40,'Every keyboard key fits '+size.width+'×'+size.height+': '+JSON.stringify(fit));
   assert.ok(fit.thirdRight<=fit.paneRight,'Three complete result cards fit beside the keyboard');
   assert.equal(fit.scroll,0,'Browsing the split surface does not scroll its keyboard');
   if(process.env.SEARCH_SCREENSHOT_DIR){await fs.mkdir(process.env.SEARCH_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SEARCH_SCREENSHOT_DIR,'search-'+size.width+'.png')});}
  }
  await page.setViewportSize({width:1280,height:720});
  await page.locator('[data-key="f"]').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement.matches('#sg-search-results .sg-card')),true,'Right edge of letters enters results');
  await page.keyboard.press('ArrowLeft');assert.equal(await activeKey(),'f','Left from first card returns to the exact letter');
  await page.locator('.sg-search-submit').click();
  assert.equal(await page.evaluate(()=>document.activeElement.matches('#sg-search-results .sg-card')),true,'Explicit Results enters the first usable result');
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');assert.equal(await activeKey(),'f','Back returns from results to the remembered letter');
  assert.ok((await page.evaluate(()=>location.hash)).startsWith('#/search'));
  // Editing in the query display supports actual keyboard selection/caret keys.
  await setQuery('ad');await display.press('Home');await display.press('ArrowRight');await page.keyboard.type('bc');assert.equal(await value(),'abcd');
  await display.press('Delete');assert.equal(await value(),'abc');await display.press('Backspace');assert.equal(await value(),'ab');
  await display.press('Shift+Home');assert.equal(await display.locator('[data-query-caret="start"]').isVisible(),true,'Backward selection displays the caret at its active end');await page.keyboard.type('X');assert.equal(await value(),'X');
  await paste(' 🔎\nFilm');
  assert.equal(await value(),'X 🔎 Film','Physical paste preserves Unicode and normalizes line breaks');
  await display.press('Home');await display.press('ArrowRight');await display.press('ArrowRight');await display.press('Delete');assert.equal(await value(),'X  Film','Delete removes a full Unicode code point');
  for(const word of ['clear','space','home','backspace','select-all']){await display.press('Control+a');await paste(word);assert.equal(await value(),word,'Pasted '+word+' is text, never an edit command');}
  await display.press('Control+a');await paste('a'.repeat(159)+'🔎');assert.equal(await value(),'a'.repeat(159),'Length limiting never leaves an incomplete surrogate');
  await setQuery('');await display.dispatchEvent('keydown',{key:'猫',bubbles:true});assert.equal(await value(),'猫','Direct non-Latin physical key input is supported');
  await page.keyboard.type('abcd');await display.dispatchEvent('keydown',{key:'Backspace',repeat:true,bubbles:true});await display.dispatchEvent('keydown',{key:'Backspace',repeat:true,bubbles:true});assert.equal(await value(),'猫ab','Held Backspace repeats deletion');
  await setQuery('gated-first');await page.locator('.sg-search-submit').click();
  await page.waitForFunction(()=>document.activeElement.matches('.sg-card')&&document.activeElement.textContent.includes('gated-first series'));
  assert.equal(await page.locator('#sg-search-results').getAttribute('aria-busy'),'true','A slow first catalog does not delay usable results');
  await page.keyboard.press('Escape');releaseMovies();await resultsReady();assert.equal(await activeKey(),'f','Late catalog completion never repeats a focus handoff');
  // Submit, then move within the keyboard while waiting: the form is still
  // focused, but a late callback must not move the user's newly chosen key.
  await setQuery('wait-for-focus');await page.locator('.sg-search-submit').click();
  await page.waitForFunction(()=>document.querySelector('#sg-search-results').getAttribute('aria-busy')==='true');
  await page.locator('[data-key="b"]').focus();
  for(let attempt=0;attempt<500&&waiting.length<2;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(waiting.length,2,'Both catalog requests reach the controlled focus gate');
  waiting.splice(0).forEach(resolve=>resolve());await resultsReady();assert.equal(await activeKey(),'b','Moving within the form cancels the pending focus handoff');
  await page.locator('[data-key="clear"]').click();
  assert.ok(await page.locator('[data-action="search-recent"]').count()>0);
  await page.locator('[data-action="search-recent"][data-query="matrix"]').click();await resultsReady();assert.equal(await value(),'matrix');
  assert.equal(await page.evaluate(()=>document.activeElement.matches('.sg-card')),true,'A recent query enters its results');
  await page.keyboard.press('ArrowDown');for(let index=0;index<8;index++)await page.keyboard.press('ArrowRight');
  const selected=await page.evaluate(()=>({key:document.activeElement.dataset.card,top:document.querySelector('.sg-search-results-pane').scrollTop,left:document.activeElement.closest('.sg-cards').scrollLeft}));
  assert.ok(selected.top>0&&selected.left>0,'Lower results can be browsed without moving the keyboard');
  await page.keyboard.press('Enter');await page.locator('[data-action="focus-streams"]').waitFor();await page.keyboard.press('Escape');
  await page.waitForFunction(key=>document.activeElement.dataset.card===key,selected.key);
  const restored=await page.evaluate(()=>{const box=document.activeElement.getBoundingClientRect(),pane=document.querySelector('.sg-search-results-pane').getBoundingClientRect();return {top:document.querySelector('.sg-search-results-pane').scrollTop,left:document.activeElement.closest('.sg-cards').scrollLeft,inside:box.top>=pane.top&&box.bottom<=pane.bottom,page:document.querySelector('#sg-view').scrollTop};});
  assert.equal(restored.left,selected.left,'Returning from a title preserves the horizontal result position');assert.ok(restored.inside&&restored.top>0&&restored.page===0,'Returning from a title restores the result pane and keeps the keyboard fixed');
  await page.keyboard.press('Escape');assert.equal(await activeKey(),'b','The last custom letter survives a title visit');
  await page.locator('.sg-search-submit').click();
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.waitForFunction(()=>location.hash==='#/board');
  assert.equal(await page.evaluate(()=>nativeInputFocuses),0,'Normal TV Search never focuses a native input or depends on keyboardStateChange');
  // The mobile rendering keeps the real editable field and no custom keyboard.
  await page.evaluate(()=>{StreamGlassHost.mobile=true;document.documentElement.dataset.sgPlatform='mobile';location.hash='#/search';});
  await page.locator('#sg-search-input[type="search"]').waitFor();assert.equal(await keys.count(),0);
  await page.locator('#sg-search-input').click();await page.locator('#sg-search-input').fill('phone');await resultsReady();
  assert.equal(await value(),'phone');
  const beforeComposition=requests.length;
  await page.locator('#sg-search-input').dispatchEvent('compositionstart');await page.locator('#sg-search-input').fill('composed');
  await page.waitForTimeout(500);assert.equal(requests.length,beforeComposition,'Mobile native IME composition waits before querying');
  await page.locator('#sg-search-input').dispatchEvent('compositionend');await resultsReady();
  assert.deepEqual(errors,[]);
  console.log('Custom TV Search passes: native keyboard absent, remote/pointer/physical input, focus safety, split layout 720p/1080p, history and mobile input.');
 }finally{await browser?.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exit(1);});
