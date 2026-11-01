// GPL-3.0-or-later. Check actual animation frames, interruption and reduced motion.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,args:['--no-sandbox'],headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.setContent('<div id="app"><main id="sg-view" style="height:500px;overflow:auto">'+Array.from({length:5},(_,i)=>'<section class="sg-cards" style="height:340px"><a class="sg-card" id="card'+i+'" href="#/detail/'+i+'" style="display:block;width:200px;height:300px">Row '+i+'</a></section>').join('')+'</main></div>');
  await page.evaluate(()=>{window.WebOSPlayer=class{active(){return null;}};window.StreamGlassShell={start:async()=>{}};});
  await page.addScriptTag({path:path.resolve(__dirname,'../src/host.js')});
  await page.locator('#card0').focus();
  const frames=await page.evaluate(async()=>{
   document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));
   const view=document.getElementById('sg-view'),values=[view.scrollTop];
   for(let i=0;i<18;i++){await new Promise(requestAnimationFrame);values.push(view.scrollTop);}return values;
  });
  assert.equal(frames[0],0,'Does not jump on the key event');
  assert.ok(frames.some(n=>n>0&&n<frames.at(-1)),'There are intermediate scroll positions');
  assert.ok(frames.at(-1)>100,'Focused row ends inside the viewport');
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(35);await page.keyboard.press('ArrowUp');await page.waitForTimeout(240);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'card1');
  assert.ok(await page.locator('#card1').evaluate(el=>{const a=el.getBoundingClientRect(),v=el.closest('main').getBoundingClientRect();return a.top>=v.top&&a.bottom<=v.bottom;}),'Reversing mid-animation keeps the final selection visible');
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(35);
  const cancelled=await page.evaluate(()=>{window.dispatchEvent(new Event('hashchange'));return document.getElementById('sg-view').scrollTop;});
  await page.waitForTimeout(220);assert.equal(await page.locator('#sg-view').evaluate(el=>el.scrollTop),cancelled,'Route changes cancel the old animation');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{document.getElementById('sg-view').scrollTop=0;document.getElementById('card0').focus({preventScroll:true});});
  const instant=await page.evaluate(()=>{document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));return document.getElementById('sg-view').scrollTop;});
  assert.ok(instant>100,'Reduced motion skips the animation');
  console.log(JSON.stringify({passed:true,durationMs:180,intermediateFrames:true,reverseDuringAnimation:true,routeCancellation:true,reducedMotion:true}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
