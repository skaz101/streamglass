/* StreamGlass mobile presentation. GPL-3.0-or-later. */
(function () {
  'use strict';
  const doc=document;
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
  let dialog=null;
  function dismiss(restore=true) {
    if(!dialog)return false;
    const state=dialog;dialog=null;
    state.overlay.hidden=true;
    state.inert.forEach(([node,value])=>node.inert=value);
    doc.removeEventListener('keydown',state.keydown,true);
    if(state.remove)state.overlay.remove();
    doc.body.classList.remove('sg-dialog-open');
    if(restore){const target=state.previous?.isConnected?state.previous:doc.querySelector('[data-action="focus-streams"]');if(target)target.focus({preventScroll:true});}
    if(state.resolve)state.resolve();
    return true;
  }
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
    dialog={overlay,previous,inert,keydown,remove,resolve};
    doc.addEventListener('keydown',keydown,true);doc.body.classList.add('sg-dialog-open');
    overlay.onclick=event=>{
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
  function menu() {
    const signedIn=window.StreamGlassShell.state.signedIn;
    const overlay=doc.createElement('div');overlay.className='sg-mobile-overlay';
    const links=[['account',signedIn?'Your account':'Sign in to Stremio','user'],['discover','Browse all titles','grid'],['addons','Manage addons','addon'],['settings','App settings','settings']];
    overlay.innerHTML='<section class="sg-mobile-sheet sg-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="sg-menu-title" tabindex="-1">'+closeButton+'<div class="sg-menu-profile">'+icon('user')+'</div><h2 id="sg-menu-title">Your StreamGlass</h2><p>Your stories. Your way.</p><nav aria-label="Account and app">'+links.map(([route,label,glyph])=>'<a href="#/'+route+'">'+icon(glyph)+'<span>'+label+'</span><span aria-hidden="true">›</span></a>').join('')+'</nav><small>StreamGlass 0.6.0</small></section>';
    doc.querySelector('.sg-app').append(overlay);open(overlay,{remove:true});
  }
  function mount(root) {
    root.querySelector('.sg-nav').outerHTML='<header class="sg-mobile-header"><a class="sg-mobile-brand" href="#/board" aria-label="StreamGlass Home">'+mark+'<span>STREAMGLASS</span></a><div class="sg-header-actions"><a class="sg-icon-button" href="#/discover" aria-label="Browse all titles">'+icon('grid')+'</a><button class="sg-icon-button sg-profile-button" id="sg-profile" aria-label="Open profile and settings">'+icon('user')+'</button></div></header>';
    root.querySelector('.sg-app').insertAdjacentHTML('beforeend','<nav class="sg-bottom-nav" aria-label="Main navigation">'+[['board','Home','home'],['picks','For You','spark'],['search','Search','search'],['library','My List','list']].map(([route,label,glyph])=>'<a data-nav="'+route+'" href="#/'+route+'"'+(route==='search'?' class="sg-nav-search"':'')+'>'+icon(glyph)+'<span>'+label+'</span></a>').join('')+'</nav>');
    doc.getElementById('sg-profile').onclick=menu;
  }
  function renderHero(meta) {
    const {escapeHTML:e,safeURL,detailHash}=StreamGlassShell.helpers;
    const href=detailHash(meta.type||'movie',meta.id||meta._id),poster=safeURL(meta.poster||meta.background),logo=safeURL(meta.logo);
    return '<section class="sg-mobile-hero" aria-label="Featured title">'+(poster?'<img class="sg-mobile-hero-art" src="'+e(poster)+'" alt="" fetchpriority="high" referrerpolicy="no-referrer">':'')+'<div class="sg-mobile-hero-shade"></div><div class="sg-mobile-hero-content"><span class="sg-mobile-hero-kicker">'+mark+(meta.type==='series'?'SERIES':'FILM')+'</span>'+(logo?'<img class="dx-hero-logo sg-mobile-hero-logo" src="'+e(logo)+'" alt="'+e(meta.name)+'">':'<h1>'+e(meta.name)+'</h1>')+'<p>'+e((meta.genres||[]).slice(0,3).join(' · ')||'Your next great watch')+'</p><div class="sg-mobile-hero-actions"><a class="sg-button sg-primary" href="'+e(href)+'?play=1">'+icon('play')+'Play</a><a class="sg-button" href="'+e(href)+'">'+icon('info')+'More info</a></div></div></section>';
  }
  function libraryChanged(saved) {
    const button=doc.getElementById('sg-library-toggle');if(!button)return;
    button.innerHTML=icon(saved?'check':'plus')+'<span>My List</span>';
    button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',saved?'Remove from My List':'Add to My List');
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
  function screenChanged(route) {
    dismiss(false);
    const view=doc.getElementById('sg-view');
    const heading=view.querySelector('.sg-page>h1');
    if(heading&&route==='library')heading.textContent='My List';
    if(heading&&route==='search')heading.textContent='Search';
    if(route==='account'){
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
  window.StreamGlassMobile={mobile:true,mount,renderHero,screenChanged,detailReady,libraryChanged,showStreams,showMessage,dismiss,
    rowTitle(title){return title.replace(/\s·\s(movie|series|anime)$/i,(suffix,type)=>{const label=type==='movie'?'movies':type,base=title.slice(0,-suffix.length);return base.toLowerCase().endsWith(label)?'':' '+label;});},
    accountChanged(signedIn){const button=doc.getElementById('sg-profile');if(button){button.classList.toggle('signed-in',signedIn);button.setAttribute('aria-label',signedIn?'Open account and settings':'Open profile and sign in');}}
  };
})();
