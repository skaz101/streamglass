/* StreamGlass TV webOS adapter. Modified 2026-10-30. GPL-3.0-or-later. */
(function () {
  'use strict';
  const VERSION = '0.8.1';
  const APP_ID = 'com.streamglass.tv';
  const events = [];
  // Deliberately allow only numeric/boolean diagnostics. Never record account data,
  // addon manifests, URLs, headers, subtitle contents, titles or exception messages.
  const safeFields = new Set(['code', 'timeMs', 'durationMs', 'paused', 'count', 'width', 'height', 'readyState', 'networkState', 'audioTracks', 'textTracks', 'online', 'status', 'elapsedMs', 'size', 'seedCount', 'candidateCount', 'resultCount', 'partial']);
  function log(name, fields) {
    const item = {at: new Date().toISOString(), event: /^[a-z0-9_.-]{1,64}$/i.test(name) ? name : 'event'};
    for (const [key, value] of Object.entries(fields || {})) {
      if (safeFields.has(key) && (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) item[key] = value;
    }
    events.push(item);
    if (events.length > 200) events.shift();
    console.info('[StreamGlass]', JSON.stringify(item));
  }
  const platform = {
    app: APP_ID, version: VERSION, build: 'webos25-test',
    engine: ((navigator.userAgent || '').match(/Chrome\/([\d.]+)/) || [])[1] || 'unknown',
    webOS: /Web0S|webOS|web0s/i.test(navigator.userAgent),
  };
  window.StreamGlassDiagnostics = {
    log,
    export: () => JSON.stringify({platform, screen: {width: screen.width, height: screen.height}, online: navigator.onLine, events}, null, 2),
  };
  window.addEventListener('error', () => log('uncaught_error'));
  window.addEventListener('unhandledrejection', () => log('unhandled_rejection'));
  window.addEventListener('online', () => log('network', {online: true}));
  window.addEventListener('offline', () => log('network', {online: false}));

  let modal = null;
  let player;
  let lastDirection = 0;
  function showMessage(title, message) {
    if (modal) modal.finish();
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'sg-host-modal';
      overlay.innerHTML = '<section role="dialog" aria-modal="true"><h2></h2><p></p><button type="button">Close</button></section>';
      overlay.querySelector('h2').textContent = title;
      overlay.querySelector('p').textContent = message;
      const finish = () => {
        overlay.remove();
        if (modal && modal.el === overlay) modal = null;
        if (previous && previous.isConnected) previous.focus();
        resolve();
      };
      modal = {el: overlay, finish};
      overlay.querySelector('button').onclick = finish;
      document.body.append(overlay);
      overlay.querySelector('button').focus();
    });
  }
  function diagnostics() {
    const info = player && player.active();
    if (info) log('snapshot', {timeMs: info.timeMs, durationMs: info.durationMs, paused: info.paused});
    return showMessage('StreamGlass TV ' + VERSION, 'Unofficial webOS port based on DX.BI.\n\n' +
      'webOS 25 test build. Native video formats and track support depend on the TV.\n\n' +
      'Diagnostics: ' + events.length + ' events recorded. Open LG Web Inspector and run:\nStreamGlassDiagnostics.export()\n\n' +
      'The diagnostic export excludes passwords, addon addresses and stream links.\n\n' +
      'DX.BI theme: Copyright (C) 2026 dx.bi. GPL-3.0-or-later. Stremio core: MIT. Full notices and corresponding source accompany this build.');
  }
  function selectMenu(field) {
    if (modal) modal.finish();
    const overlay = document.createElement('div');
    overlay.className = 'sg-host-modal';
    overlay.innerHTML = '<section role="dialog" aria-modal="true"><h2>Choose an option</h2><div class="sg-host-options"></div><button type="button">Cancel</button></section>';
    const finish = () => {
      overlay.remove();
      if (modal && modal.el === overlay) modal = null;
      if (field.isConnected) field.focus();
    };
    modal = {el: overlay, finish};
    const list = overlay.querySelector('.sg-host-options');
    let selected;
    for (const option of field.options) {
      if (option.disabled || option.hidden) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (option.selected ? '✓ ' : '') + option.text;
      if (option.selected) selected = button;
      button.onclick = () => {
        field.value = option.value;
        finish();
        field.dispatchEvent(new Event('change', {bubbles: true}));
      };
      list.append(button);
    }
    overlay.querySelector('section > button').onclick = finish;
    document.body.append(overlay);
    (selected || overlay.querySelector('button')).focus();
  }
  function showStreams() {
    const view=document.getElementById('sg-view'),panel=view&&view.querySelector('.sg-stream-panel');
    if(!panel)return;
    const stream=panel.querySelector('button[data-stream]:not(:disabled)');
    const target=stream||panel.querySelector('#sg-stream-heading,h2')||panel;
    if(!stream)target.tabIndex=-1;
    target.focus({preventScroll:true});
    const box=panel.getBoundingClientRect(),area=view.getBoundingClientRect();
    if(Math.abs(box.top-area.top-24)>2)scrollTo(view,{top:view.scrollTop+box.top-area.top-24});
    if(stream){
      const list=panel.querySelector('#sg-streams');
      if(list&&list.scrollTop)scrollTo(list,{top:0});
    }
  }
  function detailReady({resumable}={}) {
    const view=document.getElementById('sg-view'),button=view&&view.querySelector('[data-action="focus-streams"]');
    if(!button)return;
    const label=resumable?'Resume':'Play';
    button.innerHTML='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5v14l11-7Z" fill="currentColor"/></svg>'+label;
    button.setAttribute('aria-label',label+' — choose a stream');
    const [path,query]=location.hash.split('?'),params=new URLSearchParams(query);
    if(params.get('play')==='1'){
      params.delete('play');const remaining=params.toString();
      history.replaceState(null,'',path+(remaining?'?'+remaining:''));
      showStreams();
    }
  }
  window.StreamGlassHost = {
    play(payload) {
      if (!player) throw new Error('Player is not ready');
      player.play(payload);
    },
    closePlayer() { if (player && player.active()) player.close(); },
    activePlayback() { return player && player.active(); },
    showMessage,
    showSettings: diagnostics,
    screenChanged,
    detailReady,
    showStreams,
    log,
  };

  const keyNames = {13: 'Enter', 27: 'Escape', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 461: 'Back', 403: 'Red', 404: 'Green', 405: 'Yellow', 406: 'Blue'};
  const focusableSelector = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]';
  const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function measure(element) {
    if (!element || element.tabIndex < 0 || element.disabled || element.hidden || element.getAttribute('aria-hidden') === 'true' || element.closest('[hidden],[inert]')) return null;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const style = getComputedStyle(element);
    return style.visibility === 'hidden' || style.display === 'none' ? null : rect;
  }
  const visible = element => !!measure(element);
  const rowFocus = new WeakMap();
  const scrolling = new Set();
  let screenAnimation = null;
  function cancelRowScroll() {
    for (const element of scrolling) {
      if (element.isConnected) element.scrollTo({left:element.scrollLeft,top:element.scrollTop,behavior:'instant'});
    }
    scrolling.clear();
  }
  function scrollTo(element, values) {
    // Native smooth scrolling can run without a JS callback every frame. A held
    // remote key changes its destination instead of snapping the current scroll.
    scrolling.add(element);
    element.scrollTo({...values,behavior:reducedMotion()?'instant':'smooth'});
  }
  function cancelScreenAnimation() {
    if (screenAnimation) screenAnimation.cancel();
    screenAnimation = null;
  }
  function screenChanged() {
    cancelScreenAnimation();
    cancelRowScroll();
    const view=document.getElementById('sg-view');
    if (!view || document.hidden || reducedMotion()) return;
    const animation=view.animate([{opacity:.45,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:160,easing:'cubic-bezier(.2,.8,.2,1)'});
    screenAnimation=animation;
    animation.finished.then(()=>{if(screenAnimation===animation)screenAnimation=null;}).catch(()=>{});
  }
  function stopMotion() { cancelScreenAnimation(); cancelRowScroll(); }
  window.addEventListener('hashchange',cancelRowScroll);
  window.addEventListener('pointerdown',cancelRowScroll,{passive:true});
  window.addEventListener('wheel',cancelRowScroll,{passive:true});
  window.addEventListener('touchstart',cancelRowScroll,{passive:true});
  window.addEventListener('pagehide',stopMotion);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
  if(window.matchMedia)window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)stopMotion();});
  function focusTarget(next) {
    if (!next || !next.isConnected || next.disabled || next.hidden) return false;
    const rail=next.closest('.sg-cards');
    const view=document.getElementById('sg-view');
    // The featured scene and its controls are one destination. Keeping only the
    // Play button visible leaves the title/artwork clipped after row browsing.
    const returnToTop=!!view&&!!next.closest('.sg-hero,.sg-home-filters,.sg-nav');
    // Batch geometry before focus: focusin updates the row counter and preview,
    // and reading layout afterward would force a second layout on every key.
    // Insets also reserve room for the card's focused outline and scale.
    const box=next.getBoundingClientRect();
    const bounds=rail&&rail.getBoundingClientRect();
    const area=view&&view.contains(next)&&!next.closest('#sg-streams')?view.getBoundingClientRect():null;
    const left=rail?rail.scrollLeft:0,top=(area||returnToTop)?view.scrollTop:0;
    const dx=bounds?(box.right>bounds.right-18?box.right-bounds.right+18:box.left<bounds.left+18?box.left-bounds.left-18:0):0;
    const dy=returnToTop?-top:area?(box.bottom>area.bottom-24?box.bottom-area.bottom+24:box.top<area.top+24?box.top-area.top-24:0):0;
    const moveRail=rail&&(dx||scrolling.has(rail)),moveView=(area||returnToTop)&&(Math.abs(dy)>1||scrolling.has(view));
    next.focus({preventScroll:true});
    if(rail){
      rowFocus.set(rail,next);
      // Replace an old destination even when the new card is currently visible;
      // otherwise reversing can carry the final selection out of the viewport.
      if(moveRail)scrollTo(rail,{left:left+dx});
    }
    if(moveView)scrollTo(view,{top:top+dy});
    else if(!area&&!rail&&!returnToTop)next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
    return true;
  }
  function rememberedCard(rail) {
    const previous=rowFocus.get(rail);
    return previous&&previous.isConnected&&rail.contains(previous)?previous:rail.querySelector('.sg-card');
  }
  function navTarget() {
    return document.querySelector('.sg-nav [data-nav].selected,.sg-nav [aria-current="page"]')||document.querySelector('.sg-nav a[href]');
  }
  function candidates(scope) {
    // Geometry is the fallback, not the way to traverse hundreds of posters.
    // One entry point per rail/grid is sufficient when entering from a heading.
    const nodes=[...scope.querySelectorAll(focusableSelector)].filter(el=>!el.classList.contains('sg-card'));
    for(const rail of scope.querySelectorAll('.sg-cards,.sg-grid')){
      const card=rememberedCard(rail);if(card)nodes.push(card);
    }
    return nodes.map(el=>({el,rect:measure(el)})).filter(item=>item.rect);
  }
  function move(key) {
    const current=document.activeElement;
    const dialog=modal?modal.el:document.querySelector('[role="dialog"][aria-modal="true"]');
    if(!dialog&&current&&current.closest('.sg-nav')){
      const nav=[...document.querySelectorAll('.sg-nav a[href],.sg-nav button')].filter(visible);
      if(key==='ArrowLeft'||key==='ArrowRight'){
        focusTarget(nav[nav.indexOf(current)+(key==='ArrowRight'?1:-1)]);return true;
      }
      if(key==='ArrowUp')return true;
      if(key==='ArrowDown'){
        const view=document.getElementById('sg-view'),last=view&&view.sgLastFocus;
        if(last&&last.isConnected&&view.contains(last)&&visible(last))return focusTarget(last);
        return focusTarget(view&&view.querySelector('.sg-hero .sg-primary,button:not(:disabled),a[href],input,select'));
      }
    }
    const filterStrip=!dialog&&current&&current.closest('.sg-home-filters');
    if(filterStrip){
      const filters=[...filterStrip.querySelectorAll('a[href],button')].filter(visible);
      if(key==='ArrowLeft'||key==='ArrowRight')focusTarget(filters[filters.indexOf(current)+(key==='ArrowRight'?1:-1)]);
      else if(key==='ArrowUp')focusTarget(navTarget());
      else if(key==='ArrowDown')focusTarget(document.querySelector('#sg-view .sg-hero .sg-primary,#sg-view .sg-cards .sg-card'));
      return true;
    }
    const streamList=!dialog&&current&&current.closest('#sg-streams');
    if(streamList){
      const streams=[...streamList.querySelectorAll('button:not(:disabled)')];
      if(key==='ArrowDown'||key==='ArrowUp'){
        const next=streams[streams.indexOf(current)+(key==='ArrowDown'?1:-1)];
        if(next)focusTarget(next);
        else if(key==='ArrowUp')focusTarget(document.querySelector('[data-action="focus-streams"]'));
        return true;
      }
      if(key==='ArrowLeft')return focusTarget(document.querySelector('[data-action="focus-streams"]'));
      if(key==='ArrowRight')return true;
    }
    const streamPanel=!dialog&&current&&current.closest('.sg-stream-panel');
    if(streamPanel){
      if(key==='ArrowDown'){
        const first=streamPanel.querySelector('#sg-streams button:not(:disabled)');
        if(first)focusTarget(first);
        return true;
      }
      if(key==='ArrowUp'||key==='ArrowLeft')return focusTarget(document.querySelector('[data-action="focus-streams"]'));
      if(key==='ArrowRight')return true;
    }
    const rail=!dialog&&current&&current.closest('.sg-cards');
    if(rail){
      rowFocus.set(rail,current);
      const items=[...rail.querySelectorAll('.sg-card')];
      const index=items.indexOf(current);
      if(key==='ArrowLeft'||key==='ArrowRight'){
        focusTarget(items[index+(key==='ArrowRight'?1:-1)]);
        return true; // Rail edges never spill into another row or an unrelated control.
      }
      const rails=[...document.querySelectorAll('#sg-view .sg-cards')];
      const adjacent=rails[rails.indexOf(rail)+(key==='ArrowDown'?1:-1)];
      if(adjacent)return focusTarget(rememberedCard(adjacent));
      if(key==='ArrowDown')return true;
      return focusTarget(document.querySelector('.sg-hero .sg-primary')||navTarget());
    }
    const hero=!dialog&&current&&current.closest('.sg-hero');
    if(hero){
      if(key==='ArrowDown'){
        const first=document.querySelector('#sg-view .sg-cards');
        return first?focusTarget(rememberedCard(first)):true;
      }
      if(key==='ArrowUp'){
        const filters=[...document.querySelectorAll('#sg-view .sg-home-filters a[href],#sg-view .sg-home-filters button')].filter(visible);
        const selected=filters.find(filter=>filter.classList.contains('selected')||filter.getAttribute('aria-current')==='page');
        return focusTarget(selected||filters[0]||navTarget());
      }
    }
    const grid=!dialog&&current&&current.closest('.sg-grid');
    if(grid&&current.classList.contains('sg-card')){
      rowFocus.set(grid,current);
      const items=[...grid.querySelectorAll('.sg-card')],index=items.indexOf(current);
      const columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length);
      const offset=key==='ArrowRight'?1:key==='ArrowLeft'?-1:key==='ArrowDown'?columns:-columns;
      if((key==='ArrowLeft'&&index%columns===0)||(key==='ArrowRight'&&index%columns===columns-1))return true;
      if(items[index+offset])return focusTarget(items[index+offset]);
      if(key!=='ArrowUp')return true;
    }
    const all=candidates(dialog||hero||document);
    if(!all.length)return false;
    let here=all.find(item=>item.el===current)?.rect;
    if(!here&&grid)here=current.getBoundingClientRect();
    if(!here)return focusTarget(all.find(item=>item.el.closest('main'))?.el||all[0].el);
    const x=here.left+here.width/2,y=here.top+here.height/2;
    const horizontal=key==='ArrowLeft'||key==='ArrowRight',positive=key==='ArrowRight'||key==='ArrowDown';
    let next=null,best=Infinity;
    for(const {el,rect:r} of all){
      if(el===current)continue;
      const dx=r.left+r.width/2-x,dy=r.top+r.height/2-y;
      const primary=horizontal?dx:dy;
      if(primary*(positive?1:-1)<=2)continue;
      const cross=Math.abs(horizontal?dy:dx);
      const overlap=horizontal?r.top<here.bottom&&r.bottom>here.top:r.left<here.right&&r.right>here.left;
      const score=Math.abs(primary)+cross*(overlap ? .3 : 3)+(overlap?0:600);
      if(score<best){best=score;next=el;}
    }
    if(next)focusTarget(next);
    return true;
  }
  function leaveApp() {
    log('platform_back');
    if (window.webOS && typeof webOS.platformBack === 'function' && (platform.webOS || window.PalmSystem)) webOS.platformBack();
    else showMessage('Exit', 'On your LG TV, Back from Home opens the system exit dialog.');
  }
  function consume(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  window.addEventListener('keydown', (e) => {
    const key = keyNames[e.keyCode] || e.key;
    if (key === 'Blue' || key === 'F2') { consume(e); diagnostics(); return; }
    if (modal) {
      if (key === 'Back' || key === 'Escape') { consume(e); modal.finish(); }
      else if (key.startsWith('Arrow')) { consume(e); move(key); }
      return;
    }
    if (player && player.active() && player.handleKey(e)) { consume(e); return; }
    const field = e.target && typeof e.target.matches === 'function' && e.target.matches('input:not([type="checkbox"]):not([type="radio"]), textarea');
    if (key === 'Back' || key === 'Escape') {
      consume(e);
      if (field && e.target.dataset.sgTyping) {
        delete e.target.dataset.sgTyping;
        e.target.readOnly = true;
        e.target.blur();
        return;
      }
      if (window.StreamGlassShell && StreamGlassShell.back && StreamGlassShell.back()) return;
      const route = location.hash.split('?')[0];
      if (!route || route === '#/' || route === '#/board') leaveApp();
      else location.hash = '#/board';
      return;
    }
    if (field && e.target.dataset.sgTyping) return;
    if (key === 'Enter') {
      if (e.target && e.target.tagName === 'SELECT') {
        consume(e);
        selectMenu(e.target);
        return;
      }
      if (field) {
        e.target.blur();
        e.target.readOnly = false;
        e.target.dataset.sgTyping = '1';
        e.target.focus();
        e.target.click();
        consume(e);
      }
      return;
    }
    if (key.startsWith('Arrow')) {
      const now = performance.now();
      if (e.repeat && now - lastDirection < 100) { consume(e); return; }
      lastDirection = now;
      if (move(key)) consume(e);
    }
  }, true);
  // A remote may focus a field while moving through a form. Open the keyboard only
  // after OK; pointer users can click to edit normally.
  let pointerAt = -Infinity;
  window.addEventListener('pointerdown', (e) => {
    pointerAt = performance.now();
    if (e.target && typeof e.target.matches === 'function' && e.target.matches('input, textarea')) {
      e.target.readOnly = false;
      e.target.dataset.sgTyping = '1';
    }
  }, true);
  window.addEventListener('focusin', (e) => {
    if (!e.target || typeof e.target.matches !== 'function' || !e.target.matches('input[type="text"], input[type="email"], input[type="password"], input[type="url"], input[type="search"], textarea')) return;
    if (!e.target.dataset.sgTyping && performance.now() - pointerAt > 700) {
      e.target.readOnly = true;
      e.target.dataset.sgLocked = '1';
    }
  }, true);
  window.addEventListener('focusout', (e) => {
    if (!e.target.dataset) return;
    if (e.target.dataset.sgLocked) e.target.readOnly = false;
    delete e.target.dataset.sgLocked;
    delete e.target.dataset.sgTyping;
  }, true);

  async function boot() {
    log('boot');
    player = new window.WebOSPlayer({
      log,
      onProgress: (t, d, p) => {
        if (window.StreamGlassShell && StreamGlassShell.onProgress) StreamGlassShell.onProgress(t, d, p);
      },
      onClose: (info) => {
        if (window.StreamGlassShell && StreamGlassShell.onClose) StreamGlassShell.onClose(info);
      },
    });
    try {
      await window.StreamGlassShell.start();
      log('ready');
    } catch (_) {
      log('boot_failed');
      document.querySelector('#app').textContent = 'StreamGlass could not start. Press Blue for diagnostics. Close and reopen the app, or reinstall the test build.';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
