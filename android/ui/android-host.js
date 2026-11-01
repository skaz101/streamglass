/* Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later. */
(function () {
  'use strict';
  let active=null,sequence=0,modal=null;
  const events=[];
  function log(event,fields={}) {
    const record={event:/^[a-z0-9_.-]{1,64}$/i.test(event)?event:'event',at:new Date().toISOString()};
    for(const key of ['code','count','seedCount','candidateCount','resultCount','partial'])if(typeof fields[key]==='number'||typeof fields[key]==='boolean')record[key]=fields[key];
    events.push(record);if(events.length>150)events.shift();
  }
  function post(action,payload) {
    if(!window.StreamGlassNative||typeof StreamGlassNative.postMessage!=='function')throw new Error('Native player is unavailable.');
    StreamGlassNative.postMessage(JSON.stringify({action,session:active&&active.session,payload}));
  }
  function showMessage(title,message) {
    if(modal)modal.close();
    return new Promise(resolve=>{
      const previous=document.activeElement,overlay=document.createElement('div');overlay.className='sg-mobile-modal';
      overlay.innerHTML='<section role="dialog" aria-modal="true"><h2></h2><p></p><button class="sg-button">Close</button></section>';
      overlay.querySelector('h2').textContent=title;overlay.querySelector('p').textContent=message;
      const close=()=>{overlay.remove();modal=null;if(previous&&previous.isConnected)previous.focus({preventScroll:true});resolve();};
      modal={close};overlay.querySelector('button').onclick=close;document.body.append(overlay);overlay.querySelector('button').focus();
    });
  }
  window.StreamGlassDiagnostics={export:()=>JSON.stringify({platform:{app:'com.streamglass.mobile',version:'0.4.0'},events},null,2),log};
  window.StreamGlassHost={
    play(payload){active={...payload,session:++sequence};try{post('play',payload);}catch(error){active=null;throw error;}},
    closePlayer(){if(active)post('close');},activePlayback:()=>active,
    updateSubtitles(subtitles){if(active)post('subtitles',subtitles);},
    showMessage,log,
    showSettings:()=>showMessage('StreamGlass 0.4.0','Android phone and tablet test build. Playback pauses when the app goes into the background.')
  };
  window.StreamGlassAndroid={
    receive(event){
      if(!active||!event||event.session!==active.session)return;
      const time=Math.max(0,Number(event.timeMs)||0),duration=Math.max(0,Number(event.durationMs)||0);
      if(event.action==='progress')StreamGlassShell.onProgress(time,duration,!!event.paused);
      else if(event.action==='closed'){active=null;StreamGlassShell.onClose({timeMs:time,durationMs:duration,ended:!!event.ended});}
    },
    back(){if(modal){modal.close();return true;}return !!(window.StreamGlassShell&&StreamGlassShell.back());}
  };
  window.addEventListener('error',()=>log('uncaught_error'));
  window.addEventListener('unhandledrejection',()=>log('unhandled_rejection'));
  async function boot(){
    try{await StreamGlassShell.start();log('ready');}
    catch(_){document.getElementById('app').textContent='StreamGlass could not start. Update Android System WebView and reopen the app.';log('boot_failed');}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
