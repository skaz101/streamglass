/* StreamGlass mobile presentation. GPL-3.0-or-later. */
(function () {
  'use strict';
  const doc=document;
  doc.documentElement.dataset.sgPlatform='mobile';
  const themes=[['classic','Classic','Charcoal & red'],['purple','Amethyst','Soft purple'],['oled','OLED','True black']];
  let theme='classic';
  try{const saved=localStorage.getItem('streamglass-appearance');if(themes.some(([id])=>id===saved))theme=saved;}catch(_){}
  doc.documentElement.dataset.theme=theme;
  function appearance(view) {
    const old=view.querySelector('[data-action="appearance"]');if(!old)return;
    const section=doc.createElement('section');section.className='sg-appearance';section.setAttribute('aria-labelledby','sg-appearance-title');
    section.innerHTML='<h2 id="sg-appearance-title">Make it yours</h2><p>Choose the mood for your next watch.</p><div class="sg-theme-options" role="group" aria-label="App theme"></div><small class="sg-theme-status" role="status"></small>';
    const options=section.querySelector('.sg-theme-options');
    for(const [id,name,description] of themes){
      const button=doc.createElement('button');button.type='button';button.className='sg-theme-option';button.dataset.themeChoice=id;button.setAttribute('aria-pressed',String(theme===id));
      button.innerHTML='<span class="sg-theme-preview" aria-hidden="true"><i></i><i></i><i></i></span><b>'+name+'</b><small>'+description+'</small>';
      button.onclick=()=>{
        theme=id;doc.documentElement.dataset.theme=id;
        options.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
        let saved=true;try{localStorage.setItem('streamglass-appearance',id);}catch(_){saved=false;}
        section.querySelector('.sg-theme-status').textContent=saved?name+' theme saved':name+' applied for this session';
      };options.append(button);
    }
    old.replaceWith(section);
  }
  const paths={
    home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
    spark:'<path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    list:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
    user:'<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
    play:'<path d="m8 4 12 8-12 8Z" fill="currentColor" stroke="none"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
    plus:'<path d="M12 4v16M4 12h16"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    back:'<path d="m14 5-7 7 7 7"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#202020"/><circle cx="15" cy="17" r="3" fill="#202020"/>',
    addon:'<path d="M4 4h6a3 3 0 1 1 6 0h4v6a3 3 0 1 0 0 6v4h-6a3 3 0 1 0-6 0H4V4Z"/>'
  };
  const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+paths[name]+'</svg>';
  const mark='<svg class="sg-mobile-mark" viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M7 4h18v6H13v4h10v14H5v-6h12v-4H7Z"/></svg>';
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const ease='cubic-bezier(.22,1,.36,1)';
  let dialog=null,lastRoute=null,tabAnimation=null,account=null,snapshot=null,snapshotAnimation=null,lastHash=null,restoreScroll=null,scrollObserver=null,scrollTimer=null,screenSequence=0;
  function finishDismiss(state,restore) {
    if(dialog!==state)return;
    dialog=null;
    state.animations.forEach(animation=>animation.cancel());
    state.overlay.classList.remove('sg-sheet-closing');
    state.overlay.hidden=true;
    state.inert.forEach(([node,value])=>node.inert=value);
    doc.removeEventListener('keydown',state.keydown,true);
    if(state.remove)state.overlay.remove();
    doc.body.classList.remove('sg-dialog-open');
    if(restore){const target=state.previous?.isConnected?state.previous:doc.querySelector('[data-action="focus-streams"]');if(target)target.focus({preventScroll:true});}
    if(state.resolve)state.resolve();
  }
  function dismiss(restore=true) {
    if(!dialog)return false;
    const state=dialog;
    // Navigation/native playback and reduced motion complete synchronously.
    // Ordinary Back/Close keeps focus trapped until the exit has finished.
    if(!restore||reducedMotion.matches){finishDismiss(state,restore);return true;}
    if(state.closing)return true;
    state.closing=true;state.overlay.classList.add('sg-sheet-closing');
    const opacity=getComputedStyle(state.overlay).opacity,transform=getComputedStyle(state.panel).transform;
    state.animations.forEach(animation=>animation.cancel());
    state.animations=[
      state.overlay.animate([{opacity},{opacity:0}],{duration:180,easing:ease,fill:'forwards'}),
      state.panel.animate([{transform},{transform:'translateY(32px)'}],{duration:180,easing:ease,fill:'forwards'})
    ];
    Promise.all(state.animations.map(animation=>animation.finished)).then(()=>finishDismiss(state,true)).catch(()=>{});
    return true;
  }
  reducedMotion.addEventListener('change',()=>{
    if(reducedMotion.matches)clearSnapshot();
    if(reducedMotion.matches&&tabAnimation){tabAnimation.cancel();tabAnimation=null;}
    if(!reducedMotion.matches||!dialog)return;
    if(dialog.closing)finishDismiss(dialog,true);
    else{dialog.animations.forEach(animation=>animation.cancel());dialog.animations=[];}
  });
  function open(overlay,{remove=false,resolve}={}) {
    dismiss(false);
    const previous=doc.activeElement,inert=[];
    overlay.hidden=false;
    // Inert only siblings, so the dialog can keep the shell's delegated actions.
    for(let node=overlay;node&&node!==doc.body;node=node.parentElement){
      for(const sibling of node.parentElement.children){
        if(sibling!==node){inert.push([sibling,sibling.inert]);sibling.inert=true;}
      }
    }
    const panel=overlay.querySelector('[role="dialog"]');
    const focusables=()=>[...panel.querySelectorAll('a[href],button:not(:disabled),input,select,[tabindex="0"]')].filter(node=>node.getClientRects().length);
    const keydown=event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismiss();}
      if(event.key==='Tab'){
        const items=focusables(),first=items[0]||panel,last=items.at(-1)||panel;
        if(event.shiftKey&&(doc.activeElement===first||doc.activeElement===panel)){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(doc.activeElement===last||doc.activeElement===panel)){event.preventDefault();first.focus();}
      }
    };
    dialog={overlay,panel,previous,inert,keydown,remove,resolve,animations:[],closing:false};
    if(!reducedMotion.matches){
      dialog.animations=[
        overlay.animate([{opacity:0},{opacity:1}],{duration:260,easing:ease}),
        panel.animate([{transform:'translateY(40px)'},{transform:'translateY(0)'}],{duration:300,easing:ease})
      ];
    }
    doc.addEventListener('keydown',keydown,true);doc.body.classList.add('sg-dialog-open');
    overlay.onclick=event=>{
      if(dialog?.closing){event.preventDefault();event.stopPropagation();return;}
      if(event.target===overlay||event.target.closest('[data-mobile-close]'))dismiss();
      else if(event.target.closest('a[href]'))dismiss(false);
    };
    (focusables()[0]||panel).focus({preventScroll:true});
  }
  const closeButton='<button class="sg-icon-button sg-sheet-close" data-mobile-close aria-label="Close">'+icon('close')+'</button>';
  function showMessage(title,message) {
    return new Promise(resolve=>{
      const overlay=doc.createElement('div');overlay.className='sg-mobile-overlay';
      overlay.innerHTML='<section class="sg-mobile-sheet sg-message-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-message-title" tabindex="-1">'+closeButton+'<h2 id="sg-message-title"></h2><p></p><button class="sg-button sg-primary" data-mobile-close>Got it</button></section>';
      overlay.querySelector('h2').textContent=title;overlay.querySelector('p').textContent=message;
      doc.querySelector('.sg-app').append(overlay);open(overlay,{remove:true,resolve});
    });
  }
  function profileAvatar(node) {
    node.replaceChildren();
    const fallback=()=>{node.textContent=account?(account.email||'S').trim().slice(0,1).toUpperCase():'';if(!account)node.innerHTML=icon('user');};
    fallback();
    if(!account?.avatar)return;
    let url;try{url=new URL(account.avatar);if(url.protocol!=='https:'||url.username||url.password)return;}catch(_){return;}
    const img=doc.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=url.href;
    img.onerror=()=>{if(node.contains(img))fallback();};node.replaceChildren(img);
  }
  function paintAccount() {
    const button=doc.getElementById('sg-profile');
    if(button){button.classList.toggle('signed-in',!!account);button.setAttribute('aria-label',account?'Open account and settings':'Open profile and sign in');profileAvatar(button);}
    const menu=doc.querySelector('.sg-menu-sheet');
    if(menu){profileAvatar(menu.querySelector('.sg-menu-profile'));menu.querySelector('h2').textContent='Your StreamGlass';menu.querySelector('p').textContent=account?.email||'Your stories. Your way.';}
    const box=doc.querySelector('.sg-account-box');
    if(account&&box){box.querySelector('h1').textContent='Your Stremio account';box.querySelector('p').textContent=account.email||'Signed in to Stremio';}
  }
  function menu() {
    const signedIn=window.StreamGlassShell.state.signedIn;
    const overlay=doc.createElement('div');overlay.className='sg-mobile-overlay';
    const links=[['account',signedIn?'Your account':'Sign in to Stremio','user'],['calendar','Release calendar','grid'],['discover','Browse all titles','grid'],['addons','Manage addons','addon'],['settings','App settings','settings']];
    overlay.innerHTML='<section class="sg-mobile-sheet sg-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-menu-title" tabindex="-1">'+closeButton+'<div class="sg-menu-profile">'+icon('user')+'</div><h2 id="sg-menu-title">Your StreamGlass</h2><p>Your stories. Your way.</p><nav aria-label="Account and app">'+links.map(([route,label,glyph])=>'<a href="#/'+route+'">'+icon(glyph)+'<span>'+label+'</span><span aria-hidden="true">›</span></a>').join('')+'</nav><small>StreamGlass 0.7.0</small></section>';
    doc.querySelector('.sg-app').append(overlay);paintAccount();open(overlay,{remove:true});
  }
  function mount(root) {
    root.querySelector('.sg-nav').outerHTML='<header class="sg-mobile-header"><a class="sg-mobile-brand" href="#/board" aria-label="StreamGlass Home">'+mark+'<span>STREAMGLASS</span></a><div class="sg-header-actions"><a class="sg-icon-button" href="#/discover" aria-label="Browse all titles">'+icon('grid')+'</a><button class="sg-icon-button sg-profile-button" id="sg-profile" aria-label="Open profile and settings">'+icon('user')+'</button></div></header>';
    root.querySelector('.sg-app').insertAdjacentHTML('beforeend','<nav class="sg-bottom-nav" aria-label="Main navigation">'+[['board','Home','home'],['picks','For You','spark'],['search','Search','search'],['library','My List','list']].map(([route,label,glyph])=>'<a data-nav="'+route+'" href="#/'+route+'"'+(route==='search'?' class="sg-nav-search"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav>');
    doc.getElementById('sg-profile').onclick=menu;
    // Animate artwork when it is decoded, including cached and async catalog
    // images. No observer, scroll handler or retained animation per card.
    root.addEventListener('load',event=>{
      if(event.target.matches('.sg-poster img,.sg-mobile-hero-art,.sg-detail-background img,.sg-detail-logo'))event.target.classList.add('sg-art-ready');
    },true);
  }
  function renderHero(meta) {
    const {escapeHTML:e,safeURL,detailHash}=StreamGlassShell.helpers;
    const href=detailHash(meta.type||'movie',meta.id||meta._id),poster=safeURL(meta.poster||meta.background),logo=safeURL(meta.logo);
    return '<section class="sg-mobile-hero" aria-label="Featured title">'+(poster?'<img class="sg-mobile-hero-art" src="'+e(poster)+'" alt="" fetchpriority="high" referrerpolicy="no-referrer">':'')+'<div class="sg-mobile-hero-shade"></div><div class="sg-mobile-hero-content"><span class="sg-mobile-hero-kicker">'+(meta.type==='series'?'SERIES':'MOVIE')+'</span>'+(logo?'<img class="dx-hero-logo sg-mobile-hero-logo" src="'+e(logo)+'" alt="'+e(meta.name)+'">':'<h1>'+e(meta.name)+'</h1>')+'<p>'+e((meta.genres||[]).slice(0,3).join(' · ')||'Your next great watch')+'</p><div class="sg-mobile-hero-actions"><a class="sg-button sg-primary" href="'+e(href)+'?play=1">'+icon('play')+'Play</a><a class="sg-button" href="'+e(href)+'">'+icon('info')+'More info</a></div></div></section>';
  }
  function libraryChanged(saved) {
    const button=doc.getElementById('sg-library-toggle');if(!button)return;
    const changed=button.hasAttribute('aria-pressed')&&button.getAttribute('aria-pressed')!==String(saved);
    button.innerHTML=icon(saved?'check':'plus')+'<span>My List</span>';
    button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',saved?'Remove from My List':'Add to My List');
    if(changed&&!reducedMotion.matches)button.querySelector('svg').animate([{transform:'scale(.7)'},{transform:'scale(1.15)',offset:.65},{transform:'scale(1)'}],{duration:280,easing:ease});
  }
  function showStreams() {
    const overlay=doc.querySelector('.sg-stream-sheet');if(overlay)open(overlay);
  }
  function detailReady({inLibrary,resumable}) {
    const button=doc.querySelector('[data-action="focus-streams"]');
    button.innerHTML=icon('play')+(resumable?'Resume':'Play');
    button.setAttribute('aria-label',(resumable?'Resume':'Play')+' — choose a stream');
    button.setAttribute('aria-haspopup','dialog');
    libraryChanged(inLibrary);
    if(new URLSearchParams(location.hash.split('?')[1]).has('play')){
      history.replaceState(null,'',location.hash.replace(/\?play=1$/,''));showStreams();
    }
  }
  function clearSnapshot(){if(snapshotAnimation)snapshotAnimation.cancel();snapshotAnimation=null;if(snapshot)snapshot.remove();snapshot=null;}
  function beforeScreenChanged(){
    screenSequence++;
    if(scrollObserver)scrollObserver.disconnect();clearTimeout(scrollTimer);scrollObserver=null;
    const previousView=doc.getElementById('sg-view');restoreScroll=lastHash===location.hash?previousView?.scrollTop:null;
    clearSnapshot();dismiss(false);
    const view=doc.getElementById('sg-view');if(reducedMotion.matches||!view?.firstElementChild)return;
    const rect=view.getBoundingClientRect();snapshot=view.cloneNode(true);snapshot.removeAttribute('id');snapshot.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
    snapshot.classList.add('sg-route-snapshot');snapshot.inert=true;snapshot.setAttribute('aria-hidden','true');
    Object.assign(snapshot.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:rect.height+'px',bottom:'auto',right:'auto'});
    doc.querySelector('.sg-app').append(snapshot);snapshot.scrollTop=view.scrollTop;
  }
  function renderPending(title,subtitle){
    const e=StreamGlassShell.helpers.escapeHTML;
    return '<div class="sg-loading-surface" role="status"><span class="sg-loading-label">'+e(title)+'</span><div class="sg-loading-cards" aria-hidden="true">'+Array(6).fill('<i></i>').join('')+'</div>'+(subtitle?'<p>'+e(subtitle)+'</p>':'')+'</div>';
  }
  function libraryFilters(view){
    for(const [id,label] of [['sg-library-type','Type'],['sg-library-sort','Sort by']]){
      const select=view.querySelector('#'+id);if(!select||select.hidden)return;
      const wrapper=select.parentElement,button=doc.createElement('button');button.type='button';button.className='sg-choice-trigger';button.setAttribute('aria-haspopup','dialog');
      const selected=()=>select.selectedOptions[0]?.textContent||'';
      button.innerHTML='<small>'+label+'</small><span></span>'+icon('back');button.querySelector('span').textContent=selected();
      button.setAttribute('aria-label',label+': '+selected());
      select.hidden=true;wrapper.replaceChildren(select,button);
      button.onclick=()=>{
        const overlay=doc.createElement('div');overlay.className='sg-mobile-overlay';
        overlay.innerHTML='<section class="sg-mobile-sheet sg-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-choice-title" tabindex="-1">'+closeButton+'<h2 id="sg-choice-title"></h2><div class="sg-choice-options"></div></section>';
        overlay.querySelector('h2').textContent=label;
        for(const option of select.options){
          const item=doc.createElement('button');item.type='button';item.className='sg-choice-option';item.textContent=option.textContent;item.setAttribute('aria-pressed',String(option.selected));
          if(option.selected)item.insertAdjacentHTML('beforeend',icon('check'));
          item.onclick=()=>{const value=option.value;dismiss(false);select.value=value;button.querySelector('span').textContent=selected();button.focus({preventScroll:true});select.dispatchEvent(new Event('change',{bubbles:true}));};
          overlay.querySelector('.sg-choice-options').append(item);
        }
        doc.querySelector('.sg-app').append(overlay);open(overlay,{remove:true});
      };
    }
  }
  function screenChanged(route) {
    dismiss(false);
    const view=doc.getElementById('sg-view');
    const tabs=['board','picks','search','library'],index=tabs.indexOf(route),previous=tabs.indexOf(lastRoute);
    view.dataset.motion=route==='detail'?'forward':lastRoute==='detail'?'back':'tab';
    if(tabAnimation){tabAnimation.cancel();tabAnimation=null;}
    if(index>=0){
      const nav=doc.querySelector('.sg-bottom-nav');nav.style.setProperty('--sg-tab',index);nav.dataset.active='true';

    }else doc.querySelector('.sg-bottom-nav').dataset.active='false';
    if(!reducedMotion.matches&&lastRoute){tabAnimation=view.animate([{opacity:.45},{opacity:1}],{duration:420,easing:ease});}
    if(snapshot){const outgoing=snapshot;snapshotAnimation=snapshot.animate([{opacity:1},{opacity:0}],{duration:240,easing:ease});snapshotAnimation.finished.then(()=>{if(snapshot===outgoing)clearSnapshot();}).catch(()=>{});}
    lastRoute=route;lastHash=location.hash;
    if(restoreScroll>0){
      const position=restoreScroll,version=screenSequence;
      const restore=()=>{if(version!==screenSequence)return;view.scrollTop=position;if(view.scrollHeight-view.clientHeight>=position){if(scrollObserver)scrollObserver.disconnect();clearTimeout(scrollTimer);scrollObserver=null;}};
      scrollObserver=new MutationObserver(restore);scrollObserver.observe(view,{childList:true,subtree:true});requestAnimationFrame(restore);
      scrollTimer=setTimeout(()=>{if(scrollObserver)scrollObserver.disconnect();scrollObserver=null;},3000);
    }
    if(route==='library')requestAnimationFrame(()=>{if(view.isConnected&&doc.body.dataset.dxRoute==='library')libraryFilters(view);});
    const heading=view.querySelector('.sg-page>h1');
    if(heading&&route==='library')heading.textContent='My List';
    if(heading&&route==='search'){
      heading.textContent='Let’s find something good';
      const form=view.querySelector('.sg-search-form'),input=form.querySelector('input'),submit=form.querySelector('button');
      form.insertAdjacentHTML('afterbegin','<span class="sg-search-glyph">'+icon('search')+'</span>');
      input.placeholder='Search movies, series and more';input.setAttribute('enterkeyhint','search');
      submit.innerHTML=icon('search');submit.setAttribute('aria-label','Search');submit.title='Search';
      const clear=doc.createElement('button');clear.type='button';clear.className='sg-search-clear';clear.setAttribute('aria-label','Clear search');clear.innerHTML=icon('close');
      const update=()=>{clear.hidden=!input.value;};update();input.addEventListener('input',update);
      clear.onclick=()=>{input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus({preventScroll:true});};
      form.insertBefore(clear,submit);
    }
    if(route==='settings')appearance(view);
    if(route==='account'){
      paintAccount();
      const intro=view.querySelector('.sg-account-box>p');
      if(intro&&!StreamGlassShell.state.signedIn)intro.textContent='Bring your saved titles, addons and watch progress with you.';
    }
    if(route!=='detail')return;
    const detail=view.querySelector('.sg-detail');if(!detail)return;
    const back=detail.querySelector('.sg-back');back.innerHTML=icon('back');back.setAttribute('aria-label','Back to browsing');
    const info=detail.querySelector('.sg-detail-info'),actions=info.querySelector('.sg-detail-actions');
    info.insertBefore(actions,info.querySelector('.sg-detail-description'));
    const panel=detail.querySelector('.sg-stream-panel'),overlay=doc.createElement('div');
    overlay.className='sg-mobile-overlay sg-stream-sheet';overlay.hidden=true;
    panel.classList.add('sg-mobile-sheet');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','sg-stream-heading');panel.setAttribute('tabindex','-1');
    panel.insertAdjacentHTML('afterbegin','<span class="sg-sheet-handle" aria-hidden="true"></span>'+closeButton);
    overlay.append(panel);detail.append(overlay);
  }
  window.StreamGlassMobile={mobile:true,mount,renderHero,renderPending,beforeScreenChanged,screenChanged,detailReady,libraryChanged,showStreams,showMessage,dismiss,
    rowTitle(title){return title.replace(/\s·\s(movie|series|anime)$/i,(suffix,type)=>{const label=type==='movie'?'movies':type,base=title.slice(0,-suffix.length);return base.toLowerCase().endsWith(label)?'':' '+label;});},
    accountChanged(signedIn,user){account=signedIn?{email:typeof user?.email==='string'?user.email:'',avatar:typeof user?.avatar==='string'?user.avatar:''}:null;paintAccount();}
  };
})();
