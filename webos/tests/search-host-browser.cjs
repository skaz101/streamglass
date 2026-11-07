// TV Search edit/navigation contract. Native keyboard events are simulated;
// actual LG keyboard behavior is checked on device separately. GPL-3.0-or-later.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.setContent(`<style>body{margin:0;background:#080808;color:white;font:22px sans-serif}a,button,input{font:inherit;margin:8px;padding:14px;color:inherit;background:#333;border:0}.sg-nav{display:flex;height:80px}#sg-view{height:640px;overflow:auto;padding:0 40px}.sg-search-header{display:flex;align-items:center}.sg-search-form{display:flex}.sg-search-form input{width:620px}.sg-cards{display:flex;gap:20px;overflow:auto;margin:35px 0}.sg-card{display:block;flex:0 0 180px;height:100px}.sg-grid{display:grid;grid-template-columns:repeat(3,1fr)}[hidden]{display:none!important}</style><div id="app"><nav class="sg-nav"><a id="nav-home" href="#/board" data-nav="board">Home</a><a id="nav-search" class="sg-nav-search selected" href="#/search" data-nav="search">Search</a></nav><main id="sg-view"><section class="search-content"><div class="sg-search-header"><a id="search-home" href="#/board">Home</a><h1>Search</h1></div><form id="sg-search-form"><input id="sg-search-input" type="search" aria-label="Search titles"><button id="search-clear" type="button" data-action="search-clear" hidden>Clear</button><button id="search-submit" type="submit">Search</button></form><div id="sg-search-results"></div></section><input id="login-email" type="email" aria-label="Account email"></main></div>`);
    await page.evaluate(()=>{
      window.playerActive=false;window.playerKeys=0;window.submits=0;window.backCalls=0;
      window.WebOSPlayer=class{active(){return window.playerActive?{}:null;}handleKey(){window.playerKeys++;return true;}};
      window.StreamGlassShell={start:async()=>{},back:()=>{window.backCalls++;return true;}};
      document.querySelector('#sg-view').addEventListener('focusin',event=>{event.currentTarget.sgLastFocus=event.target;});
      document.querySelector('#sg-search-form').addEventListener('submit',event=>{
        event.preventDefault();if(!StreamGlassHost.finishSearchEditing())return;window.submits++;
      });
      window.keyboardVisibility=visibility=>document.dispatchEvent(new CustomEvent('keyboardStateChange',{detail:{visibility}}));
      window.makeResults=()=>{document.querySelector('#sg-search-results').innerHTML=Array.from({length:2},(_,row)=>`<div class="sg-cards">${Array.from({length:6},(_,column)=>`<a class="sg-card" id="result-${row}-${column}" href="#/detail/${row}-${column}">Result ${row}-${column}</a>`).join('')}</div>`).join('');};
      history.replaceState(null,'','#/search');
    });
    await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'../src/host.js'),'utf8')});
    const input=page.locator('#sg-search-input');
    const active=()=>page.evaluate(()=>document.activeElement.id);
    await input.focus();assert.equal(await input.evaluate(el=>el.readOnly),true);
    await page.keyboard.press('ArrowRight');assert.equal(await active(),'search-submit','Locked input skips hidden Clear and reaches Search');
    await page.keyboard.press('ArrowLeft');assert.equal(await active(),'sg-search-input');
    await page.keyboard.press('Enter');assert.equal(await input.getAttribute('data-sg-typing'),'1');
    await page.keyboard.type('foundation');
    await page.evaluate(()=>keyboardVisibility(true));
    await page.keyboard.press('ArrowDown');assert.equal(await active(),'sg-search-input','Visible native keyboard owns directional input');
    // LG briefly reports hidden before showing its voice UI. No auto-blur or
    // readOnly mutation may happen merely because this event was delivered.
    await page.evaluate(()=>keyboardVisibility(false));
    assert.equal(await active(),'sg-search-input');assert.equal(await input.evaluate(el=>el.readOnly),false);
    assert.equal(await input.getAttribute('data-sg-typing'),'1');
    await page.evaluate(()=>keyboardVisibility(true));
    await page.evaluate(()=>document.querySelector('#sg-search-input').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true})));
    await page.evaluate(()=>keyboardVisibility(false));
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'sg-search-input','IME composition retains editing focus even while keyboard visibility changes');
    assert.equal(await page.evaluate(()=>StreamGlassHost.finishSearchEditing()),false,'An IME candidate is not a Search submission');
    assert.equal(await input.getAttribute('data-sg-typing'),'1');
    await page.evaluate(()=>document.querySelector('#sg-search-input').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
    await page.evaluate(()=>keyboardVisibility(true));
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>window.submits),1,'Native Done/Enter submits once');
    assert.equal(await input.inputValue(),'foundation','Submission preserves the query');
    assert.equal(await input.getAttribute('data-sg-typing'),null);
    assert.equal(await input.evaluate(el=>el.readOnly),true);
    assert.equal(await active(),'sg-search-input','Pending results leave a navigable Search field');
    await page.evaluate(()=>{makeResults();StreamGlassHost.focusSearchResults();});
    assert.equal(await active(),'result-0-0','Explicit completed submission enters results');
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'sg-search-input','First result row Up returns directly to the Search field');
    assert.equal(await input.evaluate(el=>el.readOnly),true);
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'search-home','Search field Up reaches the visible Home shortcut');
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'nav-search','Home shortcut Up reaches top navigation');
    await page.keyboard.press('ArrowLeft');assert.equal(await active(),'nav-home');
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#/board','Search can exit to Home without Back');
    await page.evaluate(()=>history.replaceState(null,'','#/search'));

    await input.focus();await page.keyboard.press('Enter');
    await page.evaluate(()=>keyboardVisibility(true));await page.evaluate(()=>keyboardVisibility(false));
    await page.keyboard.press('ArrowDown');
    assert.equal(await active(),'result-0-0','After the native keyboard closes, Down exits editing and browses results');
    assert.equal(await input.getAttribute('data-sg-typing'),null);
    await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');assert.equal(await active(),'sg-search-input','A fresh edit does not inherit a stale hidden-keyboard state');
    await page.evaluate(()=>keyboardVisibility(true));await page.evaluate(()=>keyboardVisibility(false));
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'search-home','After keyboard dismissal Up leaves editing for Home');
    // A late result callback cannot steal focus after navigating away, nor while
    // the user has returned to typing another query.
    assert.equal(await page.evaluate(()=>StreamGlassHost.focusSearchResults()),false);assert.equal(await active(),'search-home');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>StreamGlassHost.focusSearchResults()),false);assert.equal(await active(),'sg-search-input');
    await page.evaluate(()=>StreamGlassHost.finishSearchEditing());
    await page.evaluate(()=>{document.querySelector('#search-clear').hidden=false;});
    await page.keyboard.press('ArrowRight');assert.equal(await active(),'search-clear');
    await page.keyboard.press('ArrowRight');assert.equal(await active(),'search-submit');
    await page.keyboard.press('ArrowDown');assert.equal(await active(),'result-0-0','Search button Down enters the first result');
    await page.keyboard.press('ArrowDown');assert.equal(await active(),'result-1-0');
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'result-0-0');
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'sg-search-input');

    await page.evaluate(()=>{
      const results=document.querySelector('#sg-search-results');results.inert=true;results.style.marginTop='800px';
      document.querySelector('#sg-view').scrollTo({top:0,behavior:'instant'});
    });
    assert.ok(await page.locator('#result-0-0').evaluate(el=>el.getBoundingClientRect().top>document.querySelector('#sg-view').getBoundingClientRect().bottom),'The stale result is below the visible Search area');
    const staleScroll=await page.locator('#sg-view').evaluate(el=>el.scrollTop);
    await page.keyboard.press('ArrowDown');await page.waitForTimeout(350);
    assert.equal(await active(),'sg-search-input','Pending stale results cannot receive remote focus');
    assert.equal(await page.locator('#sg-view').evaluate(el=>el.scrollTop),staleScroll,'Rejecting an inert result does not scroll the focused Search field away');
    await page.evaluate(()=>{const results=document.querySelector('#sg-search-results');results.inert=false;results.style.marginTop='';});

    await page.evaluate(()=>{document.querySelector('#sg-search-results').innerHTML='<div class="sg-grid">'+Array.from({length:9},(_,index)=>`<a class="sg-card" id="grid-${index}" href="#/detail/${index}">Title ${index}</a>`).join('')+'</div>';});
    await page.locator('#grid-2').focus();await page.keyboard.press('ArrowUp');assert.equal(await active(),'sg-search-input','The top result-grid row also returns to the field');
    await page.evaluate(()=>{document.querySelector('#sg-search-results').innerHTML='<p>No results</p>';});
    await page.keyboard.press('ArrowDown');assert.equal(await active(),'sg-search-input','Empty results do not lose focus');
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'search-home');
    // Shared account fields retain their original edit behavior.
    await page.locator('#login-email').focus();await page.keyboard.press('Enter');
    await page.evaluate(()=>keyboardVisibility(false));await page.keyboard.press('ArrowDown');
    assert.equal(await active(),'login-email');assert.equal(await page.locator('#login-email').getAttribute('data-sg-typing'),'1');
    // The native player still handles its keys before any Search navigation.
    await input.focus();await page.keyboard.press('Enter');await page.evaluate(()=>{keyboardVisibility(false);window.playerActive=true;});
    await page.keyboard.press('ArrowUp');assert.equal(await active(),'sg-search-input');assert.equal(await page.evaluate(()=>window.playerKeys),1);
    assert.equal(await input.getAttribute('data-sg-typing'),'1');
    assert.equal(await page.evaluate(()=>window.backCalls),0,'No Back action was required by the Search flows');
    await page.evaluate(()=>{window.playerActive=false;StreamGlassShell.back=()=>{window.backCalls++;location.hash='#/board';return true;};});
    await page.keyboard.press('Escape');
    assert.equal(await active(),'sg-search-input','Back from editing retains the navigable Search field');
    assert.equal(await input.getAttribute('data-sg-typing'),null);
    assert.equal(await input.evaluate(el=>el.readOnly),true);
    assert.equal(await page.evaluate(()=>location.hash),'#/search','The first Back only closes editing');
    assert.equal(await page.evaluate(()=>window.backCalls),0);
    assert.equal(await input.inputValue(),'foundation','Closing editing preserves the query');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>location.hash==='#/board');
    assert.equal(await page.evaluate(()=>window.backCalls),1,'The second Back follows the shell navigation path');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({passed:true,submitLeavesEditing:true,nativeKeyboardArrowsPreserved:true,voiceTransitionPreserved:true,compositionPreserved:true,hiddenKeyboardDirectionalExit:true,searchHomePath:true,resultsReturnToField:true,lateFocusGuard:true,genericFieldsUnchanged:true,playerPriority:true,backClosesEditingBeforeNavigation:true,runtimeErrors:errors}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
