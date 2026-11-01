/* StreamGlass TV webOS adapter. Modified 2026-10-30. GPL-3.0-or-later. */
(function () {
  'use strict';
  const VERSION = '0.4.0';
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
  window.StreamGlassHost = {
    play(payload) {
      if (!player) throw new Error('Player is not ready');
      player.play(payload);
    },
    closePlayer() { if (player && player.active()) player.close(); },
    activePlayback() { return player && player.active(); },
    showMessage,
    showSettings: diagnostics,
    log,
  };

  const keyNames = {13: 'Enter', 27: 'Escape', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 461: 'Back', 403: 'Red', 404: 'Green', 405: 'Yellow', 406: 'Blue'};
  function visible(element) {
    if (element.disabled || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    const r = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && !element.closest('[hidden]');
  }
  function candidates() {
    const scope = modal ? modal.el : document.querySelector('[role="dialog"][aria-modal="true"]') || document;
    return [...scope.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]')]
      .filter((el) => el.tabIndex >= 0 && visible(el));
  }
  const rowFocus = new WeakMap();
  let rowScroll=null;
  function cancelRowScroll() {
    if(rowScroll)cancelAnimationFrame(rowScroll.frame);
    rowScroll=null;
  }
  function scrollRow(view,target) {
    cancelRowScroll();
    target=Math.max(0,Math.min(target,view.scrollHeight-view.clientHeight));
    const start=view.scrollTop,delta=target-start;
    if(!delta)return;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches){view.scrollTop=target;return;}
    const state={view,start,target,at:performance.now(),frame:0};rowScroll=state;
    function step(now) {
      if(rowScroll!==state||!view.isConnected)return;
      const t=Math.min(1,(now-state.at)/180);
      view.scrollTop=start+delta*(1-Math.pow(1-t,3));
      if(t<1)state.frame=requestAnimationFrame(step);else rowScroll=null;
    }
    state.frame=requestAnimationFrame(step);
  }
  window.addEventListener('hashchange',cancelRowScroll);
  window.addEventListener('pointerdown',cancelRowScroll,{passive:true});
  window.addEventListener('wheel',cancelRowScroll,{passive:true});
  window.addEventListener('touchstart',cancelRowScroll,{passive:true});
  function focusTarget(next, animate=false) {
    if (!next) return false;
    cancelRowScroll();
    next.focus({preventScroll:true});
    const rail=next.closest('.sg-cards');
    if(rail){
      rowFocus.set(rail,next);
      const box=next.getBoundingClientRect(),bounds=rail.getBoundingClientRect();
      const delta=box.right>bounds.right-10?box.right-bounds.right+10:box.left<bounds.left+10?box.left-bounds.left-10:0;
      const reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(delta)rail.scrollTo({left:rail.scrollLeft+delta,behavior:animate&&!reduced?'smooth':'auto'});
      const view=document.getElementById('sg-view');
      if(view){const area=view.getBoundingClientRect();if(box.bottom>area.bottom-20)scrollRow(view,view.scrollTop+box.bottom-area.bottom+20);else if(box.top<area.top+20)scrollRow(view,view.scrollTop+box.top-area.top-20);}
    }else {
      const view=document.getElementById('sg-view');
      if(view&&view.contains(next)&&!next.closest('#sg-streams')){
        const box=next.getBoundingClientRect(),area=view.getBoundingClientRect();
        if(box.bottom>area.bottom-20)scrollRow(view,view.scrollTop+box.bottom-area.bottom+20);
        else if(box.top<area.top+20)scrollRow(view,view.scrollTop+box.top-area.top-20);
      }else next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    }
    return true;
  }
  function move(key, repeated=false) {
    const current = document.activeElement;
    if(!modal&&current&&current.closest('.sg-nav')){
      const nav=[...document.querySelectorAll('.sg-nav a[href],.sg-nav button')].filter(visible);
      if(key==='ArrowLeft'||key==='ArrowRight'){
        focusTarget(nav[nav.indexOf(current)+(key==='ArrowRight'?1:-1)]);
        return true;
      }
      if(key==='ArrowUp')return true;
      if(key==='ArrowDown'){
        const view=document.getElementById('sg-view'),last=view&&view.sgLastFocus;
        if(last&&last.isConnected&&view.contains(last)&&visible(last))return focusTarget(last);
        return focusTarget(view&&view.querySelector('.sg-hero .sg-primary,button:not(:disabled),a[href],input,select'));
      }
    }
    const streamList=!modal&&current&&current.closest('#sg-streams');
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
    const rail=!modal&&current&&current.closest('.sg-cards');
    if(rail){
      rowFocus.set(rail,current);
      const items=[...rail.querySelectorAll('.sg-card')];
      const index=items.indexOf(current);
      if(key==='ArrowLeft'||key==='ArrowRight'){
        focusTarget(items[index+(key==='ArrowRight'?1:-1)],!repeated);
        return true; // Never jump into a different row at a rail boundary.
      }
      const rails=[...document.querySelectorAll('#sg-view .sg-cards')];
      const adjacent=rails[rails.indexOf(rail)+(key==='ArrowDown'?1:-1)];
      if(adjacent){
        const remembered=rowFocus.get(adjacent);
        return focusTarget(remembered&&remembered.isConnected?remembered:adjacent.querySelector('.sg-card'));
      }
      if(key==='ArrowDown')return true;
      const above=document.querySelector('.sg-hero .sg-primary')||document.querySelector('.sg-nav [data-nav].selected');
      if(above)return focusTarget(above);
    }
    const all = candidates();
    if (!all.length) return false;
    if (!all.includes(current)) {
      return focusTarget(all.find((el) => el.closest('main')) || all[0]);
    }
    const here = current.getBoundingClientRect();
    const x = here.left + here.width / 2, y = here.top + here.height / 2;
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const positive = key === 'ArrowRight' || key === 'ArrowDown';
    const ranked = all.filter((el) => el !== current).map((el) => {
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - x, dy = r.top + r.height / 2 - y;
      const primary = horizontal ? dx : dy;
      const cross = Math.abs(horizontal ? dy : dx);
      const overlap = horizontal ? r.top < here.bottom && r.bottom > here.top : r.left < here.right && r.right > here.left;
      return {el, primary: primary * (positive ? 1 : -1), score: Math.abs(primary) + cross * (overlap ? 0.3 : 3) + (overlap ? 0 : 600)};
    }).filter((p) => p.primary > 2).sort((a, b) => a.score - b.score);
    if (!ranked.length) return true;
    const next = ranked[0].el;
    focusTarget(next);
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
      if (e.repeat && now - lastDirection < 120) { consume(e); return; }
      lastDirection = now;
      if (move(key,e.repeat)) consume(e);
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
