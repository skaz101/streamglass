/* Featured carousel clock and gesture integration. GPL-3.0-or-later. */
const {chromium}=require('playwright');
const {build}=require('esbuild');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-hero-'));
 await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import Hero from './src/react/components/Hero.jsx';const root=createRoot(document.getElementById('sg-view'));let items=[{id:'one',type:'movie',name:'First story'},{id:'two',type:'series',name:'Second story'},{id:'three',type:'movie',name:'Third story'}];window.saveCalls=[];window.notices=[];window.deferSave=false;window.failSave=false;const api={mobile:true,savedTitles:async()=>new Set(['movie:one']),saveTitle:(meta,saved)=>{window.saveCalls.push({id:meta.id,saved});if(window.failSave)return Promise.reject(new Error('Offline'));return window.deferSave?new Promise(resolve=>{window.finishSave=resolve;}):Promise.resolve();},notify:message=>window.notices.push(message),safeURL:value=>value||'',detailHash:(type,id)=>'#/detail/'+type+'/'+id,resolveMeta:(type,id,meta)=>Promise.resolve({meta})};window.mountHero=()=>flushSync(()=>root.render(<Hero items={items} api={api}/>));window.setHeroPlatform=mobile=>{api.mobile=mobile;mountHero();};window.replaceHeroItems=next=>{items=next;mountHero();};window.unmountHero=()=>root.unmount();mountHero();`,resolveDir:root,loader:'jsx'},bundle:true,jsx:'automatic',outfile:path.join(temp,'hero.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.setContent('<html data-sg-platform="mobile"><head><style>body{margin:0;background:#101014;color:white;font-family:Arial}.sg-react-hero{position:relative;height:500px}.sg-react-hero-copy{padding:100px 24px}.sg-carousel-controls{position:absolute;bottom:10px;display:flex}.sg-carousel-controls button{width:44px;height:44px}#sg-view{height:600px;overflow:auto}</style></head><body><button id="outside">Outside carousel</button><div id="app"><main id="sg-view"></main></div></body></html>');
  await page.addStyleTag({path:path.join(temp,'hero.css')});await page.addScriptTag({path:path.join(temp,'hero.js')});
  await page.getByRole('heading',{name:'First story'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.sg-hero-save')?.getAttribute('aria-pressed')==='true');
  await page.clock.runFor(2200);
  const fraction=()=>page.getByRole('progressbar',{includeHidden:true}).evaluate(node=>Number(node.getAttribute('aria-valuenow'))/100);
  assert.ok(await fraction()>.2,'Countdown advances during the current title');
  await page.evaluate(()=>mountHero());const before=await fraction();await page.clock.runFor(1000);assert.ok(await fraction()>before+.1,'Rerender does not restart the clock');
  await page.getByRole('button',{name:'Pause featured slideshow'}).click();const paused=await fraction();await page.locator('#outside').focus();await page.mouse.move(0,0);await page.clock.runFor(9000);assert.equal(await fraction(),paused,'Pause freezes the timer');
  await page.getByRole('button',{name:'Resume featured slideshow'}).click();await page.locator('#outside').focus();await page.mouse.move(0,0);await page.clock.runFor(5200);await page.getByRole('heading',{name:'Second story'}).waitFor();
  await page.getByRole('button',{name:'Next featured title'}).click();await page.getByRole('heading',{name:'Third story'}).waitFor();
  assert.ok(await fraction()<.01,'Manual next restarts the countdown');
  const cdp=await page.context().newCDPSession(page);
  const swipe=async(dx,dy)=>{
    const box=await page.locator('.sg-react-hero').boundingBox(),x=box.x+box.width/2,y=box.y+140;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let step=1;step<=6;step++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/6,y:y+dy*step/6,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  await swipe(-100,5);await page.getByRole('heading',{name:'First story'}).waitFor();
  const blocked=await page.locator('.sg-react-hero-actions a').first().evaluate(node=>!node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));assert.equal(blocked,true,'Swipe cannot accidentally open a title');
  await page.clock.runFor(600);await swipe(10,120);await page.getByRole('heading',{name:'First story'}).waitFor();
  await swipe(100,5);await page.getByRole('heading',{name:'Third story'}).waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#outside').focus();await page.mouse.move(0,0);await page.clock.runFor(12000);await page.getByRole('heading',{name:'Third story'}).waitFor();
  assert.equal(await page.locator('.sg-react-hero-copy').evaluate(node=>getComputedStyle(node).animationName),'none');
  await page.evaluate(()=>{window.deferSave=true;});
  await page.getByRole('button',{name:'Add to My List: Third story',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.saveCalls),[{id:'three',saved:true}]);
  await page.getByRole('button',{name:'Previous featured title'}).click();
  await page.getByRole('heading',{name:'Second story'}).waitFor();
  await page.evaluate(()=>window.finishSave());
  await page.waitForFunction(()=>!document.querySelector('.sg-hero-save').disabled);
  assert.equal(await page.locator('.sg-hero-save').getAttribute('aria-pressed'),'false','A late save must not mark the newly selected title as saved');
  await page.getByRole('button',{name:'Next featured title'}).click();
  assert.equal(await page.locator('.sg-hero-save').getAttribute('aria-pressed'),'true','Saved membership follows the original title');
  await page.evaluate(()=>{window.failSave=true;});
  await page.getByRole('button',{name:'Remove from My List: Third story',exact:true}).click();
  await page.waitForFunction(()=>window.notices.length===1);
  assert.equal(await page.locator('.sg-hero-save').getAttribute('aria-pressed'),'true','Failed removals retain the saved state');
  // A row arriving later can change the ordering, but must not change the selected film.
  await page.getByRole('button',{name:'Previous featured title'}).click();
  await page.getByRole('heading',{name:'Second story'}).waitFor();
  await page.evaluate(()=>replaceHeroItems([{id:'three',type:'movie',name:'Third story'},{id:'one',type:'movie',name:'First story'},{id:'two',type:'series',name:'Second story'}]));
  await page.getByRole('heading',{name:'Second story'}).waitFor();
  assert.match(await page.locator('.sg-primary').getAttribute('href'),/series\/two\?play=1$/);
  // No automatic slideshow work continues when focus is on a shelf or Home is hidden.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{const shelf=document.createElement('button');shelf.className='sg-card';shelf.id='shelf';shelf.textContent='Shelf title';document.body.append(shelf);});
  await page.locator('#shelf').focus();await page.mouse.move(0,0);const shelfProgress=await fraction();
  await page.clock.runFor(10000);assert.equal(await fraction(),shelfProgress);await page.getByRole('heading',{name:'Second story'}).waitFor();
  await page.locator('#outside').focus();
  await page.evaluate(()=>{document.querySelector('.sg-feature-stage').hidden=true;window.dispatchEvent(new Event('streamglass:screenchange'));});
  const hiddenProgress=await fraction();await page.clock.runFor(10000);assert.equal(await fraction(),hiddenProgress);
  await page.evaluate(()=>{document.querySelector('.sg-feature-stage').hidden=false;window.dispatchEvent(new Event('streamglass:screenchange'));});
  await page.waitForFunction(()=>document.querySelector('.sg-hero-premium').dataset.slideshow==='playing');
  await page.clock.runFor(1100);assert.ok(await fraction()>hiddenProgress);
  // Slow artwork keeps the old title/action until the incoming image is decoded.
  let releaseArtwork;const artworkReady=new Promise(resolve=>{releaseArtwork=resolve;});
  await page.route('https://artwork.invalid/**',async route=>{
    if(route.request().url().endsWith('/two.svg'))await artworkReady;
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#46504c"/></svg>'});
  });
  await page.evaluate(()=>replaceHeroItems([{id:'art-one',type:'movie',name:'Artwork one',background:'https://artwork.invalid/one.svg'},{id:'art-two',type:'movie',name:'Artwork two',background:'https://artwork.invalid/two.svg'}]));
  await page.getByRole('heading',{name:'Artwork one'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.sg-hero-art-entering')?.src.endsWith('/one.svg'));
  await page.getByRole('button',{name:'Next featured title'}).click();
  await page.getByRole('heading',{name:'Artwork one'}).waitFor();
  assert.match(await page.locator('.sg-primary').getAttribute('href'),/art-one\?play=1$/);
  releaseArtwork();await page.getByRole('heading',{name:'Artwork two'}).waitFor();
  assert.match(await page.locator('.sg-primary').getAttribute('href'),/art-two\?play=1$/);
  assert.ok(await page.locator('.sg-react-hero-art.sg-hero-art-entering').evaluate(node=>node.src.endsWith('/two.svg')));
  await page.evaluate(()=>unmountHero());await page.clock.runFor(10000);assert.deepEqual(errors,[]);
  // Real-time TV check: countdown is visibly progressing on the compositor and
  // the hero does not schedule a recurring JavaScript animation-frame loop.
  const tv=await browser.newPage({viewport:{width:1920,height:1080}});
  await tv.setContent('<html><head><style>body{margin:0;background:#080808;color:#fff}.sg-react-hero{position:relative;isolation:isolate;overflow:hidden}#sg-view{height:900px;overflow:auto}</style></head><body><div id="app"><main id="sg-view"></main></div></body></html>');
  await tv.evaluate(()=>{window.heroFrames=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=fn=>{window.heroFrames++;return raf.call(window,fn);};});
  await tv.addStyleTag({path:path.join(temp,'hero.css')});await tv.addScriptTag({path:path.join(temp,'hero.js')});
  await tv.evaluate(()=>setHeroPlatform(false));
  await tv.waitForFunction(()=>Number(getComputedStyle(document.querySelector('[data-current-timer]')).transform.split('(')[1]?.split(',')[0])>.12,null,{polling:100});
  assert.equal(await tv.evaluate(()=>window.heroFrames),0,'TV hero does not run a JS loop for every display frame');
  assert.equal(await tv.locator('.sg-primary').innerText(),'Play');
  assert.match(await tv.locator('.sg-primary').getAttribute('href'),/play=1$/);
  await tv.locator('.sg-primary').focus();
  await tv.waitForFunction(()=>document.querySelector('.sg-hero-premium').dataset.slideshow==='paused');
  assert.equal(await tv.locator('[data-current-timer]').evaluate(node=>node.getAnimations().filter(animation=>animation.playState==='running').length),0);
  await tv.close();
  // A transparent logo must be readable on small phones without moving Play
  // when its network request finishes.
  for(const viewport of [{width:390,height:844},{width:320,height:720}]){
    const phone=await browser.newPage({viewport,isMobile:true,hasTouch:true});
    await phone.emulateMedia({reducedMotion:'reduce'});
    await phone.setContent('<html data-sg-platform="mobile"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"><main id="sg-view"></main></div></body></html>');
    for(const stylesheet of ['src/shell.css','src/react/theme.css','../android/ui/mobile.css','src/cinematic.css'])await phone.addStyleTag({path:path.join(root,stylesheet)});
    await phone.addStyleTag({path:path.join(temp,'hero.css')});
    let releaseLogo;const logoReady=new Promise(resolve=>{releaseLogo=resolve;});
    await phone.route('https://artwork.invalid/logo.svg',async route=>{
      await logoReady;
      await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="500" height="180"><text x="250" y="116" fill="white" font-family="sans-serif" font-weight="900" font-size="65" text-anchor="middle">OBSESSION</text></svg>'});
    });
    await phone.addScriptTag({path:path.join(temp,'hero.js')});
    await phone.evaluate(()=>replaceHeroItems([{id:'logo',type:'movie',name:'Obsession',logo:'https://artwork.invalid/logo.svg',releaseInfo:'2026',imdbRating:'7.8',genres:['Horror','Thriller']} ]));
    await phone.getByRole('heading',{name:'Obsession'}).waitFor();
    const beforeLogo=await phone.locator('.sg-primary').boundingBox();
    const beforeSlot=await phone.locator('.sg-hero-title').boundingBox();
    assert.ok(beforeSlot.height>=80,'Phone title reserves at least80px before the logo loads');
    releaseLogo();await phone.locator('.sg-hero-title-ready').waitFor();
    const afterLogo=await phone.locator('.sg-primary').boundingBox();
    const afterSlot=await phone.locator('.sg-hero-title').boundingBox();
    assert.equal(afterSlot.height,beforeSlot.height,'Decoding a logo does not resize the title slot');
    assert.equal(afterLogo.y,beforeLogo.y,'Decoding a logo does not move the primary action');
    assert.ok(afterLogo.height>=43.9&&afterLogo.width>=100,'Both phone sizes retain a usable Play target');
    assert.ok(await phone.locator('.sg-react-hero-logo').evaluate(node=>node.getBoundingClientRect().height>=80),'Phone logo uses the reserved title height');
    assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Phone title creates no horizontal overflow');
    await phone.close();
  }
  console.log('Hero clock, offscreen/hidden pause, stable identity, decoded scene handoff, swipe, saved state, TV compositor countdown (zero JS rAF),390/320px mobile logo layout stability, reduced motion and unmount passed.');
 }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
