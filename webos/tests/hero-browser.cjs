/* Featured carousel clock and gesture integration. GPL-3.0-or-later. */
const {chromium}=require('playwright');
const {build}=require('esbuild');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-hero-'));
 await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';import Hero from './src/react/components/Hero.jsx';const root=createRoot(document.getElementById('sg-view'));const items=[{id:'one',type:'movie',name:'First story'},{id:'two',type:'series',name:'Second story'},{id:'three',type:'movie',name:'Third story'}];const api={mobile:true,safeURL:()=>'',detailHash:(type,id)=>'#/detail/'+type+'/'+id,resolveMeta:(type,id,meta)=>Promise.resolve({meta})};window.mountHero=()=>flushSync(()=>root.render(<Hero items={items} api={api}/>));window.unmountHero=()=>root.unmount();mountHero();`,resolveDir:root,loader:'jsx'},bundle:true,jsx:'automatic',outfile:path.join(temp,'hero.js'),define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install();
  await page.setContent('<html data-sg-platform="mobile"><head><style>body{margin:0;background:#101014;color:white;font-family:Arial}.sg-react-hero{position:relative;height:500px}.sg-react-hero-copy{padding:100px 24px}.sg-carousel-controls{position:absolute;bottom:10px;display:flex}.sg-carousel-controls button{width:44px;height:44px}#sg-view{height:600px;overflow:auto}</style></head><body><button id="outside">Outside carousel</button><div id="app"><main id="sg-view"></main></div></body></html>');
  await page.addStyleTag({path:path.join(temp,'hero.css')});await page.addScriptTag({path:path.join(temp,'hero.js')});
  await page.getByRole('heading',{name:'First story'}).waitFor();
  await page.clock.runFor(2200);
  const fraction=()=>page.locator('[data-current-timer]').evaluate(node=>Number(/scaleX\(([^)]+)/.exec(node.style.transform)?.[1]||0));
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
  await page.evaluate(()=>unmountHero());await page.clock.runFor(10000);assert.deepEqual(errors,[]);
  console.log('Hero countdown, pause/resume, rerender continuity, swipe direction, click suppression, reduced motion and unmount passed.');
 }finally{await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
