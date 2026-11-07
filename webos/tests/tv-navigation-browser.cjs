// Remote browsing contract and geometry budget; no network, media or account data.
// GPL-3.0-or-later.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const rows=Array.from({length:20},(_,row)=>`<section class="sg-row"><h2>Row ${row}</h2><div class="sg-cards">${Array.from({length:40},(_,card)=>`<a class="sg-card" href="#/detail/${row}-${card}" id="card-${row}-${card}">Title ${row}-${card}</a>`).join('')}</div></section>`).join('');
    await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;background:#080808;color:white;font:24px sans-serif}.sg-nav{height:100px;display:flex;gap:30px;padding:20px}.sg-nav a,button{padding:12px;color:inherit;background:#333;border:0}#sg-view{height:980px;overflow:auto;padding:0 60px}.sg-hero{height:450px;padding-top:220px}.sg-hero a{display:inline-block;padding:20px;background:#444;margin-right:20px}.sg-carousel-controls{margin-top:30px}.sg-cards{display:flex;gap:20px;overflow-x:auto;padding:20px 0}.sg-card{display:block;flex:0 0 320px;height:180px;background:#222;color:white;padding:30px}.sg-row{margin-bottom:40px}h2{margin:10px 0}a:focus,button:focus{outline:4px solid white}.sg-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}</style><div id="app"><nav class="sg-nav"><a id="home" class="selected" data-nav="board" href="#/board">Home</a><a id="picks" data-nav="picks" href="#/picks">For you</a></nav><main id="sg-view"><section class="sg-hero"><a class="sg-primary" id="play" href="#/detail/hero">Play</a><a id="info" href="#/detail/hero">More info</a><div class="sg-carousel-controls"><button>Previous</button><button>Pause</button><button>Next</button></div></section>${rows}</main></div>`);
    await page.evaluate(()=>{
      window.WebOSPlayer=class{active(){return null;}};
      window.StreamGlassShell={start:async()=>{}};
      const view=document.querySelector('#sg-view');view.addEventListener('focusin',event=>{view.sgLastFocus=event.target;});
      window.geometryReads=0;window.scrollCalls=[];
      const rect=Element.prototype.getBoundingClientRect,scroll=Element.prototype.scrollTo;
      Element.prototype.getBoundingClientRect=function(){window.geometryReads++;return rect.apply(this,arguments);};
      Element.prototype.scrollTo=function(options){window.scrollCalls.push({id:this.id,behavior:options?.behavior});return scroll.apply(this,arguments);};
    });
    await page.addScriptTag({content:fs.readFileSync(process.env.HOST_SOURCE||path.join(__dirname,'../src/host.js'),'utf8')});
    await page.locator('#play').focus();await page.evaluate(()=>{window.geometryReads=0;});
    await page.keyboard.press('ArrowRight');
    const heroReads=await page.evaluate(()=>window.geometryReads);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'info');
    if(process.env.NAV_BASELINE){console.log(JSON.stringify({posters:800,heroArrowGeometryReads:heroReads}));return;}
    assert.ok(heroReads<=12,`Hero navigation read ${heroReads} rectangles for 800 posters`);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-0','Down enters the first row without stopping on carousel controls');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-0','Row boundary keeps focus in its row');
    await page.evaluate(()=>{window.geometryReads=0;window.scrollCalls=[];});
    for(let i=0;i<12;i++)await page.keyboard.press('ArrowRight');
    const railReads=await page.evaluate(()=>window.geometryReads);
    assert.ok(railReads<=48,`Rail movement read ${railReads} rectangles`);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-12','Rapid presses move focus immediately');
    await page.waitForFunction(()=>{const card=document.activeElement.getBoundingClientRect(),rail=document.activeElement.parentElement.getBoundingClientRect();return card.left>=rail.left-1&&card.right<=rail.right+1;});
    await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'card-1-0');
    await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-12','Rows remember the last focused title');
    await page.locator('#home').focus();await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-12','Header returns to remembered content');
    for(let i=0;i<4;i++){
      await page.waitForTimeout(110);
      await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',repeat:true,bubbles:true,cancelable:true})));
    }
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-16','Held keys keep moving at a bounded cadence');
    await page.waitForFunction(()=>{const card=document.activeElement.getBoundingClientRect(),rail=document.activeElement.parentElement.getBoundingClientRect();return card.left>=rail.left-1&&card.right<=rail.right+1;});
    await page.keyboard.press('ArrowRight');await page.waitForTimeout(35);await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(240);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'card-0-16');
    assert.ok(await page.locator('#card-0-16').evaluate(el=>{const card=el.getBoundingClientRect(),rail=el.parentElement.getBoundingClientRect();return card.left>=rail.left-1&&card.right<=rail.right+1;}),'Reversing horizontal scroll keeps the final focused title visible');
    const scrolls=await page.evaluate(()=>window.scrollCalls);
    assert.ok(scrolls.some(item=>item.behavior==='smooth'),'Native smooth scrolling is used');
    assert.ok(!scrolls.some(item=>item.behavior==='instant'),'Held keys do not switch to snapping');
    await page.locator('#card-0-0').focus();await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'play','Up from first row returns to the primary action');

    await page.evaluate(()=>{StreamGlassHost.screenChanged();StreamGlassHost.screenChanged();});
    assert.equal(await page.locator('#sg-view').evaluate(el=>el.getAnimations().filter(a=>a.playState==='running').length),1,'Replacing a screen cancels its previous transition');
    await page.waitForFunction(()=>document.querySelector('#sg-view').getAnimations().length===0);
    await page.evaluate(()=>{StreamGlassHost.screenChanged();window.dispatchEvent(new Event('pagehide'));});
    assert.equal(await page.locator('#sg-view').evaluate(el=>el.getAnimations().length),0,'Leaving the page cancels transitions');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{StreamGlassHost.screenChanged();window.scrollCalls=[];});
    assert.equal(await page.locator('#sg-view').evaluate(el=>el.getAnimations().length),0,'Reduced motion does not animate page changes');
    await page.locator('#card-0-0').focus();await page.keyboard.press('ArrowRight');
    assert.ok((await page.evaluate(()=>window.scrollCalls)).every(item=>item.behavior==='instant'),'Reduced motion uses immediate scrolling');
    await page.evaluate(()=>{
      document.querySelector('#sg-view').innerHTML='<div class="sg-grid">'+Array.from({length:120},(_,index)=>`<a class="sg-card" href="#/detail/${index}" id="grid-${index}">Result ${index}</a>`).join('')+'</div>';
      document.querySelector('#sg-view').scrollTop=0;
    });
    await page.locator('#grid-5').focus();await page.evaluate(()=>{window.geometryReads=0;});
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'grid-5','Grid rows do not wrap at their right edge');
    await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.id),'grid-11');
    await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),'grid-10');
    await page.keyboard.press('ArrowUp');assert.equal(await page.evaluate(()=>document.activeElement.id),'grid-4');
    const gridReads=await page.evaluate(()=>window.geometryReads);
    assert.ok(gridReads<=9,`Grid navigation read ${gridReads} rectangles`);
    // Detail routing can replace the entire main element while Home is cached.
    // A Play deep link enters stream selection without choosing an addon source.
    await page.evaluate(()=>{
      window.cachedMain=document.querySelector('#sg-view');cachedMain.remove();cachedMain.hidden=true;
      const detail=document.createElement('main');detail.id='sg-view';
      detail.innerHTML='<button data-action="focus-streams">Choose a stream</button><div style="height:600px"></div><aside class="sg-stream-panel"><h2 id="sg-stream-heading">Available streams</h2><div id="sg-streams"><p>Finding streams</p></div></aside>';
      document.querySelector('#app').append(detail);
      history.replaceState(null,'','#/detail/fixture?play=1&episode=2');
      StreamGlassHost.detailReady({resumable:true});
    });
    assert.equal(await page.locator('[data-action="focus-streams"]').innerText(),'Resume');
    assert.equal(await page.evaluate(()=>location.hash),'#/detail/fixture?episode=2','Only the consumed Play intent is removed');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'sg-stream-heading','Pending streams keep focus on the panel heading');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'sg-stream-heading','Pending streams do not send focus back to page chrome');
    await page.evaluate(()=>{document.querySelector('#sg-streams').innerHTML='<button id="retry-streams">Try again</button>';});
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'retry-streams','A stream error keeps its retry action reachable');
    await page.locator('#sg-stream-heading').focus();
    await page.evaluate(()=>{
      window.streamClicks=0;
      document.querySelector('#sg-streams').innerHTML='<button data-stream="0" disabled>Unavailable</button><button data-stream="1" id="ready-stream">1080p</button>';
      document.querySelector('#ready-stream').addEventListener('click',()=>window.streamClicks++);
    });
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'ready-stream','Down enters the first available source when it arrives');
    await page.locator('[data-action="focus-streams"]').focus();
    await page.evaluate(()=>StreamGlassHost.showStreams());
    assert.equal(await page.evaluate(()=>document.activeElement.id),'ready-stream');
    assert.equal(await page.evaluate(()=>window.streamClicks),0,'Showing streams never automatically chooses a source');
    await page.evaluate(()=>StreamGlassHost.detailReady({resumable:false}));
    assert.equal(await page.locator('[data-action="focus-streams"]').innerText(),'Play');
    await page.evaluate(()=>{document.querySelector('#sg-view').replaceWith(cachedMain);cachedMain.hidden=false;StreamGlassHost.screenChanged();});
    await page.locator('#home').focus();await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'grid-4','Returning to a cached main preserves its remembered card');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,posters:800,heroArrowGeometryReads:heroReads,twelveRailArrowGeometryReads:railReads,gridArrowGeometryReads:gridReads,immediateFocus:true,rowMemory:true,heldKeys:true,horizontalReversal:true,reducedMotion:true,transitionCancellation:true,playIntent:true,streamSelection:true,cachedMainRestoration:true,runtimeErrors:errors}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
