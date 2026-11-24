// A short TV tab visit retains one mounted Home; invalidation releases it.
// Real React/shell with isolated catalog/core fixtures; no account or TV writes.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require('playwright');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-home-return-'));
 let browser;
 try{
  await build({entryPoints:[path.resolve(__dirname,'../src/react/app.jsx')],outfile:path.join(temp,'app.js'),bundle:true,format:'iife',target:'chrome87',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'}});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://home.fixtures.invalid/**',route=>{
   const url=new URL(route.request().url()),[,resource,type,id]=url.pathname.split('/');
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="app"></div>'});
   if(url.pathname.endsWith('.svg'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="#594337"/></svg>'});
   const meta=(index)=>({id:`fixture-${type}-${index}`,type,name:`${type} story ${index}`,background:'https://home.fixtures.invalid/art.svg',poster:'https://home.fixtures.invalid/art.svg',description:'A story for the Home return fixture.',releaseInfo:'2026'});
   return route.fulfill({contentType:'application/json',body:JSON.stringify(resource==='meta'?{meta:{...meta(0),id:id.replace('.json','')}}:{metas:Array.from({length:10},(_,index)=>meta(index))})});
  });
  await page.goto('https://home.fixtures.invalid/');
  await page.clock.install();
  for(const file of ['shell.css','react/theme.css','react/components/hero.css','cinematic.css','tv.css']){
   const css=(await fs.readFile(path.resolve(__dirname,'../src',file),'utf8')).replace(/^@(import|tailwind).*$/gm,'');
   await page.addStyleTag({content:css});
  }
  await page.addScriptTag({path:path.join(temp,'app.js')});
  await page.addScriptTag({path:path.resolve(__dirname,'../src/recommendations.js')});
  await page.evaluate(()=>{
   localStorage.setItem('streamglass-home-v1','addons');
   const addon={transportUrl:'https://home.fixtures.invalid/manifest.json',manifest:{name:'Home fixture',types:['movie','series'],resources:['catalog','meta'],catalogs:[{id:'movies',name:'Movies',type:'movie',extra:[{name:'search'}]},{id:'series',name:'Series',type:'series',extra:[{name:'search'}]}]}};
   window.fixtureProfile={auth:{user:{_id:'account-one',email:'one@example.invalid'}},addons:[addon]};
   window.fixtureEvents=[];
   window.StreamGlassCore={init:async()=>{},dispatch:async()=>{},getState:async name=>name==='ctx'?{profile:structuredClone(fixtureProfile)}:name==='continue_watching_preview'?{items:[]}:{catalog:[]},on:(name,fn)=>{fixtureEvents.push(fn);return()=>{};}};
   window.StreamGlassHost={mobile:false};
   window.mountedRoots=new Set();window.homeMounts=0;
   const mount=StreamGlassUI.mount,unmount=StreamGlassUI.unmount;
   StreamGlassUI.mount=function(node,props){mountedRoots.add(node);if(props.route==='board')homeMounts++;return mount.call(this,node,props);};
   StreamGlassUI.unmount=function(node){mountedRoots.delete(node);return unmount.call(this,node);};
   history.replaceState(null,'','#/board');
  });
  await page.addScriptTag({path:path.resolve(__dirname,'../src/shell.js')});
  await page.evaluate(()=>StreamGlassShell.start());
  const ready=()=>page.waitForFunction(()=>document.querySelector('.sg-hero')&&!document.querySelector('.sg-react-loading'));
  const route=async name=>{
   await page.evaluate(name=>{location.hash='#/'+name;},name);
   await page.waitForFunction(name=>document.querySelector('#sg-view').dataset.sgRoute===name,name);
  };
  await ready();
  await page.getByRole('button',{name:'Next featured title'}).click();
  await page.waitForFunction(()=>document.querySelector('.sg-carousel-controls>span').textContent==='2 / 8');
  await page.waitForFunction(()=>document.querySelector('.sg-hero-art-entering')?.naturalWidth>0);
  await page.evaluate(()=>{
   window.homeView=document.querySelector('#sg-view');window.homeTree=document.querySelector('.sg-home');window.heroImage=document.querySelector('.sg-hero-art-entering');
   const rail=document.querySelectorAll('#sg-home-rows .sg-cards')[1];window.homeCard=rail.querySelectorAll('.sg-card')[6];
   rail.scrollLeft=homeCard.offsetLeft-rail.offsetLeft;homeCard.focus({preventScroll:true});
   homeView.scrollTop=homeCard.getBoundingClientRect().top-homeView.getBoundingClientRect().top-70;
   window.homePosition={top:homeView.scrollTop,left:rail.scrollLeft};
  });
  for(const name of ['search','picks','library','calendar']){
   await route(name);
   assert.equal(await page.evaluate(()=>homeView.hidden&&!homeView.isConnected),true,'Home is detached and hidden during '+name);
   assert.equal(await page.evaluate(()=>homeTree.querySelector('.sg-hero').dataset.slideshow),'paused','Detached Home pauses its carousel');
   assert.equal(await page.evaluate(()=>mountedRoots.size),2,'Only one Home and the active route are mounted');
   await page.clock.fastForward(9000);
   assert.equal(await page.evaluate(()=>homeTree.querySelector('.sg-carousel-controls>span').textContent),'2 / 8','Inactive Home cannot advance its featured title');
   await route('board');await ready();
   assert.equal(await page.evaluate(()=>homeView===document.querySelector('#sg-view')&&homeTree===document.querySelector('.sg-home')&&heroImage===document.querySelector('.sg-hero-art-entering')),true,name+' return reuses the decoded Home tree');
   assert.equal(await page.evaluate(()=>document.activeElement===homeCard),true,'Selected title is restored after '+name);
   assert.deepEqual(await page.evaluate(()=>({top:homeView.scrollTop,left:homeCard.closest('.sg-cards').scrollLeft})),await page.evaluate(()=>homePosition),'View and rail positions survive '+name);
   assert.equal(await page.evaluate(()=>homeMounts),1,'No Home rebuild/loading phase after '+name);
   assert.equal(await page.evaluate(()=>mountedRoots.size),1);
  }
  // Moving between secondary tabs must not accumulate more retained roots.
  await route('search');await route('library');await route('picks');
  assert.equal(await page.evaluate(()=>mountedRoots.size),2);
  // A changed account invalidates even if no account event was emitted.
  await page.evaluate(()=>{fixtureProfile={...fixtureProfile,auth:{user:{_id:'account-two',email:'two@example.invalid'}}};});
  await route('board');await ready();
  assert.equal(await page.evaluate(()=>homeTree===document.querySelector('.sg-home')),false,'Different accounts never reuse the previous account Home');
  assert.equal(await page.evaluate(()=>homeView.children.length),0,'Old account React tree is unmounted');
  // A refresh of profile while Home is still on screen must not recache it.
  await page.evaluate(()=>{window.oldAccountView=document.querySelector('#sg-view');fixtureProfile={...fixtureProfile,auth:null};});
  await route('search');
  assert.equal(await page.evaluate(()=>oldAccountView.querySelector('.sg-home')),null);
  await route('board');await ready();
  await page.evaluate(()=>{window.expiringView=document.querySelector('#sg-view');});
  await route('search');
  await page.evaluate(()=>{fixtureProfile.addons[0].manifest.version='2.0.0';});
  await route('board');await ready();
  assert.equal(await page.evaluate(()=>expiringView.children.length),0,'Changed addon descriptors dispose the stale Home');
  // Event invalidation and fixed TTL release effects while outside Home.
  for(const event of ['LibraryItemsPulledFromAPI','UserLoggedOut']){
   await page.evaluate(()=>{window.expiringView=document.querySelector('#sg-view');});
   await route('search');
   await page.evaluate(event=>fixtureEvents.forEach(fn=>fn({event})),event);
   assert.equal(await page.evaluate(()=>expiringView.children.length),0,event+' disposes retained Home');
   await route('board');await ready();
  }
  await page.evaluate(()=>{window.expiringView=document.querySelector('#sg-view');});
  await route('search');await page.clock.fastForward(120001);
  assert.equal(await page.evaluate(()=>expiringView.children.length),0,'Two-minute expiry unmounts React effects and DOM');
  assert.equal(await page.evaluate(()=>mountedRoots.size),1,'Only the active route survives expiry');
  await route('board');await ready();
  assert.equal(await page.evaluate(()=>expiringView===document.querySelector('#sg-view')),false);
  await page.evaluate(()=>{window.expiringView=document.querySelector('#sg-view');});
  await route('search');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.evaluate(()=>expiringView.children.length),0,'Leaving the TV app disposes cached Home');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));StreamGlassHost.mobile=true;});
  await route('board');await ready();
  await page.evaluate(()=>{window.mobileHome=document.querySelector('.sg-home');});
  await route('search');await route('board');await ready();
  assert.equal(await page.evaluate(()=>mobileHome===document.querySelector('.sg-home')),false,'Android retains its existing route lifecycle');
  assert.equal(await page.evaluate(()=>mountedRoots.size),1,'Android does not retain an extra Home root');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,tabReturns:['search','picks','library','calendar'],retainsDecodedArtwork:true,preservesHeroAndPosition:true,inactiveClockPaused:true,oneHomeBound:true,accountInvalidation:true,addonInvalidation:true,libraryInvalidation:true,expiryCleanup:true,hiddenCleanup:true,mobileUnchanged:true}));
 }finally{if(browser)await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
