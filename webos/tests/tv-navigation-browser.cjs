// Remote browsing contract and geometry budget; no network, media or account data.
// GPL-3.0-or-later.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
async function verifyFullHeroReturn(browser,source) {
  for(const viewport of [{width:1280,height:720},{width:1920,height:1080}]) {
    const page=await browser.newPage({viewport});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    try {
      const rows=['Top movies','Top series','Popular movies','Popular series'].map((name,row)=>`<section class="sg-row meta-row-container sg-row-tv"><div class="sg-row-heading"><h2>${name}</h2></div><div class="sg-cards meta-items-container">${Array.from({length:8},(_,card)=>`<a class="sg-card meta-item-container sg-card-tv" href="#/detail/${row}-${card}" id="tv-card-${row}-${card}"><div class="sg-poster poster-container"><span class="sg-poster-placeholder">Title ${card}</span></div><span class="sg-card-title title-label">Title ${card}</span><span class="sg-card-caption">2026</span></a>`).join('')}</div></section>`).join('');
      await page.setContent(`<div id="app"><div class="sg-app"><nav class="sg-nav horizontal-nav-bar"><a class="sg-brand" href="#/board" aria-label="StreamGlass Home"></a><div class="sg-nav-links"><a id="tv-home" class="selected" data-nav="board" href="#/board">Home</a><a id="tv-picks" data-nav="picks" href="#/picks">For you</a></div><a class="sg-nav-search" href="#/search" aria-label="Search">⌕</a><a class="sg-nav-settings" href="#/settings" aria-label="Settings">⚙</a><button class="sg-account-button">Account</button></nav><main id="sg-view"><section class="sg-home"><div class="sg-home-filters"><a id="tv-all" class="sg-filter selected" aria-current="page" href="#/board">All</a><a id="tv-movies" class="sg-filter" href="#/board?type=movie">Movies</a><a id="tv-series" class="sg-filter" href="#/board?type=series">Series</a><a id="tv-calendar" class="sg-filter sg-calendar-link" href="#/calendar">Calendar</a></div><div class="sg-feature-stage"><section class="sg-hero sg-react-hero sg-hero-premium"><div class="sg-hero-scene"><div class="sg-react-hero-copy"><div class="sg-hero-story"><h1>A complete featured title</h1><p class="sg-hero-synopsis">The full featured scene should return when browsing back from a row.</p></div><div class="sg-react-hero-actions"><a id="tv-play" class="sg-button sg-primary" href="#/detail/hero">Play</a><a class="sg-button" href="#/detail/hero">More info</a></div></div></div></section></div><div class="sg-home-rows">${rows}</div></section></main></div></div>`);
      // Exercise the shipped layout rules rather than another hand-tuned height.
      for(const file of ['shell.css','host.css','react/theme.css','react/components/hero.css','cinematic.css','tv.css']){
        const css=fs.readFileSync(path.join(__dirname,'../src',file),'utf8').replace(/^@import[^;]*;/gm,'').replace(/^@tailwind[^;]*;/gm,'');
        await page.addStyleTag({content:css});
      }
      await page.evaluate(()=>{
        window.WebOSPlayer=class{active(){return null;}};window.StreamGlassShell={start:async()=>{}};
        document.querySelector('#sg-view').addEventListener('focusin',event=>{event.currentTarget.sgLastFocus=event.target;});
      });
      assert.equal(await page.locator('.sg-nav').evaluate(el=>getComputedStyle(el).backdropFilter),'none','The opaque TV header does not run a backdrop blur');
      await page.addScriptTag({content:source});
      const assertAtTop=async message=>{
        try { await page.waitForFunction(()=>document.querySelector('#sg-view').scrollTop<=1,null,{timeout:2000}); }
        catch(_){assert.fail(message+': remaining scrollTop '+await page.locator('#sg-view').evaluate(el=>el.scrollTop));}
        assert.ok(await page.evaluate(()=>{
          const hero=document.querySelector('.sg-hero').getBoundingClientRect(),view=document.querySelector('#sg-view').getBoundingClientRect(),nav=document.querySelector('.sg-nav').getBoundingClientRect(),filters=document.querySelector('.sg-home-filters').getBoundingClientRect();
          return hero.top>=view.top-1&&hero.bottom<=view.bottom+1&&nav.top>=-1&&Math.abs(nav.bottom-view.top)<=1&&filters.top>=view.top-1;
        }),message+': the complete hero, filters and header are visible');
      };
      await page.locator('#tv-play').focus();
      await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('#sg-view').scrollTop>100);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-card-1-0');
      await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-play');
      await assertAtTop('Series → movies → Play restores the entire featured scene');

      // Reach every Home filter using only the remote from the featured action.
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-all','Hero Up reaches the selected Home filter');
      for(const id of ['tv-movies','tv-series','tv-calendar']){
        await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.id),id);
      }
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-calendar','Right stays at the end of the filter strip');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-play','Filter Down reaches the featured Play action');
      await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowLeft');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-all','Left stays at the beginning of the filter strip');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-home','Filter Up reaches the current navigation tab');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-all','Navigation Down remembers the filter just left');
      await page.keyboard.press('ArrowDown');
      await assertAtTop('The remote-only filter path keeps the full scene visible');
      await page.evaluate(()=>{document.querySelector('#tv-all').classList.remove('selected');document.querySelector('#tv-all').removeAttribute('aria-current');document.querySelector('#tv-series').classList.add('selected');});
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-series','Hero Up follows the active content filter');
      await page.keyboard.press('ArrowDown');

      // Navigation and filter focus must restore the scene even when those
      // controls were already visible above a partially scrolled main element.
      await page.evaluate(()=>{document.querySelector('#sg-view').scrollTo({top:420,behavior:'instant'});document.querySelector('#tv-home').focus({preventScroll:true});});
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-picks');
      await assertAtTop('Top navigation restores the whole Home scene');
      await page.evaluate(()=>{document.querySelector('#sg-view').scrollTo({top:420,behavior:'instant'});document.querySelector('#tv-all').focus({preventScroll:true});});
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'tv-movies');
      await assertAtTop('Home filters restore the whole featured scene');

      // Reverse during both the downward and upward native scroll. The final
      // key decides the destination; no previous animation may carry it away.
      await page.locator('#tv-play').focus();
      for(let i=0;i<2;i++){
        await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.waitForTimeout(35);
        await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.waitForTimeout(35);
      }
      await assertAtTop('Rapid row/hero reversals settle with the full hero visible');
      await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.waitForTimeout(35);
      await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.waitForTimeout(35);
      await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>{const card=document.activeElement.getBoundingClientRect(),view=document.querySelector('#sg-view').getBoundingClientRect();return document.activeElement.id==='tv-card-1-0'&&card.top>=view.top&&card.bottom<=view.bottom;});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
      assert.equal(await page.locator('#sg-view').evaluate(el=>el.scrollTop),0,'Reduced motion restores the full hero immediately');
      await assertAtTop('Reduced motion keeps the complete hero visible');
      const controls=await page.evaluate(()=>Array.from(document.querySelectorAll('.sg-nav a,.sg-nav button,.sg-home-filters .sg-filter'),element=>{
        element.focus({preventScroll:true});const style=getComputedStyle(element);
        return {transform:style.transform,duration:style.transitionDuration};
      }));
      assert.ok(controls.every(style=>style.transform==='none'&&style.duration==='0s'),'Reduced motion disables top navigation and filter focus transforms');
      assert.deepEqual(errors,[],'TV layout fixture has no runtime errors');
    }finally{await page.close();}
  }
}
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
    const hostSource=fs.readFileSync(process.env.HOST_SOURCE||path.join(__dirname,'../src/host.js'),'utf8');
    await page.addScriptTag({content:hostSource});
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
    await verifyFullHeroReturn(browser,hostSource);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,posters:800,heroArrowGeometryReads:heroReads,twelveRailArrowGeometryReads:railReads,gridArrowGeometryReads:gridReads,immediateFocus:true,rowMemory:true,heldKeys:true,horizontalReversal:true,reducedMotion:true,transitionCancellation:true,playIntent:true,streamSelection:true,cachedMainRestoration:true,fullHeroReturn:true,topNavAndFilterReturn:true,remoteFilterPath:true,headerAligned:true,headerBlurDisabled:true,reducedTopControlMotion:true,heroRowReversals:true,runtimeErrors:errors}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
