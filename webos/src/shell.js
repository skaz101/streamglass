/* StreamGlass TV shell. Copyright (C) 2026 StreamGlass contributors.
 * GPL-3.0-or-later. Independently written UI using DX.BI's licensed theme and
 * Stremio's MIT core. No Stremio-web application code is included here. */
(function (global) {
  'use strict';
  const escapeHTML = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function safeURL(value) {
    try { const url = new URL(String(value)); return /^(https?:)$/.test(url.protocol) ? url.href : ''; } catch (_) { return ''; }
  }
  function manifestURL(value) {
    const url = safeURL(String(value || '').trim().replace(/^stremio:\/\//i, 'https://'));
    if (!url) throw new Error('Use an HTTPS addon manifest URL.');
    if (!/\/manifest\.json$/i.test(new URL(url).pathname)) throw new Error('The addon link must end in /manifest.json.');
    return url;
  }
  function resourceURL(base, resource, type, id, extra) {
    const url = new URL(manifestURL(base));
    const root = url.pathname.replace(/\/manifest\.json$/i, '');
    const query = Object.entries(extra || {}).filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(String(value))).join('&');
    url.pathname = root + '/' + [resource, type, id].map(encodeURIComponent).join('/') + (query ? '/' + query : '') + '.json';
    return url.href;
  }
  function supports(addon, resource, type, id) {
    const manifest = addon && addon.manifest || {};
    const resources = manifest.resources || [];
    return resources.some(item => {
      const definition = typeof item === 'string' ? {name: item, types: manifest.types, idPrefixes: manifest.idPrefixes} : item;
      return definition && definition.name === resource && (!definition.types || definition.types.includes(type)) && (!definition.idPrefixes || definition.idPrefixes.some(prefix => String(id).startsWith(prefix)));
    });
  }
  const path = (resource, type, id, extra = []) => ({resource, type, id, extra});
  const loadAction = (model, args) => ({action:'Load', args:{model, args}});
  const ctxAction = (action, args) => ({action:'Ctx',args: args === undefined ? {action} : {action,args}});
  const playerAction = (action, args) => ({action:'Player',args: args === undefined ? {action} : {action,args}});
  const detailHash = (type, id, videoId) => '#/detail/' + encodeURIComponent(type) + '/' + encodeURIComponent(id) + (videoId ? '?video=' + encodeURIComponent(videoId) : '');
  function parseHash(hash) {
    const [route, query] = String(hash || '#/board').replace(/^#\/?/, '').split('?');
    const parts = route.split('/').map(value => { try { return decodeURIComponent(value); } catch (_) { return value; } });
    return {route:parts[0] || 'board', parts, query:new URLSearchParams(query || '')};
  }
  function playbackUpdate(previous, time, duration, now) {
    const current = Math.max(0, Math.round(Number(time) || 0));
    const elapsed = previous ? Math.max(0, now - previous.wall) : 0;
    const seek = previous && (current < previous.time - 500 || Math.abs(current - previous.time - elapsed) > 5000);
    return playerAction(seek ? 'Seek' : 'TimeChanged', {time:current,duration:Math.max(0,Math.round(Number(duration) || 0)),device:'streamglass-webos'});
  }
  function mergeSubtitles(first, second) {
    const seen=new Set();return [...(first||[]),...(second||[])].filter(item=>{if(!item||!safeURL(item.url)||seen.has(item.url))return false;seen.add(item.url);return true;});
  }
  const progressFraction = value => Math.max(0, Math.min(1, (Number(value) || 0) / 100));
  function streamBadges(stream) {
    const text=[stream.name,stream.title,stream.description,stream.behaviorHints&&stream.behaviorHints.filename].filter(Boolean).join(' ');
    const tags=[];
    if(/\b(2160p|4k|uhd)\b/i.test(text))tags.push('4K');
    else if(/\b1080p\b/i.test(text))tags.push('1080p');
    else if(/\b720p\b/i.test(text))tags.push('720p');
    if(/\b(dolby[ ._-]?vision|dovi)\b/i.test(text))tags.push('Dolby Vision');
    else if(/\bhdr10?\+?\b/i.test(text))tags.push('HDR');
    if(/\b(hevc|h[ ._-]?265|x265)\b/i.test(text))tags.push('HEVC');
    if(/\batmos\b/i.test(text))tags.push('Atmos');
    return tags;
  }
  const helpers = {streamBadges,mergeSubtitles,progressFraction,escapeHTML,safeURL,manifestURL,resourceURL,supports,path,loadAction,ctxAction,playerAction,detailHash,parseHash,playbackUpdate};
  if (typeof module === 'object' && module.exports) module.exports = helpers;
  if (!global || !global.document) return;

  const doc = global.document;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  let core, root, view, profile = {}, epoch = 0, started = false, currentDetail = null;
  let activePlayback = null, pendingPlayback = false, progressQueue = Promise.resolve(), lastProgress = null;
  let statusTimer, heroTimer, refreshTimer, refreshAddons=false, refreshLibrary=false, catalogMemory = [], activeCatalog = null;
  const cache = new Map(), cards = new Map(), screenMemory = new Map();
  let searchSession=null, recommendationController=null, recommendationSnapshot=null;
  let screenHash='', detailOrigin='#/board', previewTimer, previewSequence=0, interaction=0;
  function rememberScreen() {
    if(!screenHash||!view)return;
    const focused=doc.activeElement;
    const active=view.contains(focused)?focused:view.sgLastFocus;
    const key=active&&active.isConnected&&view.contains(active)?active.getAttribute('href'):null;
    screenMemory.set(screenHash,{top:view.scrollTop,key,rowKey:active&&active.closest('.sg-row')&&active.closest('.sg-row').dataset.rowKey,rows:Object.fromEntries([...view.querySelectorAll('.sg-cards')].map(row=>[row.closest('.sg-row').dataset.rowKey,row.scrollLeft]))});
    if(screenMemory.size>20)screenMemory.delete(screenMemory.keys().next().value);
  }
  function restoreScreen(token,revision) {
    const saved=screenMemory.get(location.hash);
    if(!saved||token!==epoch||revision!==interaction)return;
    view.querySelectorAll('.sg-cards').forEach(row=>row.scrollLeft=saved.rows[row.closest('.sg-row').dataset.rowKey]||0);
    const matches=saved.key?[...view.querySelectorAll('a[href]')].filter(node=>node.getAttribute('href')===saved.key):[];
    const target=matches.find(node=>node.closest('.sg-row')?.dataset.rowKey===saved.rowKey)||matches[0];
    if(target)target.focus({preventScroll:true});
    view.scrollTop=saved.top;
    // A new Continue Watching row can move the saved card. Keep that card visible
    // without selecting its duplicate in another row or resetting horizontal scroll.
    if(target){const box=target.getBoundingClientRect(),area=view.getBoundingClientRect();if(box.bottom>area.bottom-20)view.scrollTop+=box.bottom-area.bottom+20;else if(box.top<area.top+20)view.scrollTop+=box.top-area.top-20;}
  }
  function previewCard(node) {
    if(host().mobile)return;
    clearTimeout(previewTimer);
    const sequence=++previewSequence,token=epoch;
    const meta=cards.get(node.dataset.card),slot=doc.getElementById('sg-hero-slot');
    // Avoid network work while browsing lower rows and never move a focused hero button.
    if(!meta||!slot||view.scrollTop>120)return;
    previewTimer=setTimeout(async()=>{
      let full=meta;
      try {full=(await resolveMeta(meta.type||'movie',meta.id||meta._id,meta)).meta;}catch(_){}
      if(sequence!==previewSequence||token!==epoch||doc.activeElement!==node||view.scrollTop>120)return;
      slot.innerHTML=hero(full);
    },450);
  }
  const e = escapeHTML;
  const host = () => global.StreamGlassHost || {};
  function diagnostic(event, fields) { if (host().log) host().log(event, fields || {}); }
  function notify(message) {
    let node = doc.getElementById('sg-toast');
    if (!node) { node=doc.createElement('div');node.id='sg-toast';node.setAttribute('role','status');doc.body.append(node); }
    node.textContent=message;node.hidden=false;clearTimeout(statusTimer);statusTimer=setTimeout(()=>{node.hidden=true;},6500);
  }
  function showMessage(title, message) {
    if (host().showMessage) return host().showMessage(title,message);
    notify(title + ': ' + message);return Promise.resolve();
  }
  function pendingText(title, subtitle) { return '<div class="sg-empty" role="status"><span class="sg-spinner"></span><h2>'+e(title)+'</h2>'+(subtitle?'<p>'+e(subtitle)+'</p>':'')+'</div>'; }
  function empty(title, message, action, label) { return '<div class="sg-empty"><h2>'+e(title)+'</h2><p>'+e(message)+'</p>'+(action?'<button class="sg-button" data-action="'+e(action)+'">'+e(label||'Retry')+'</button>':'')+'</div>'; }
  function setScreen(html, route) {
    cancelSearch();
    if(recommendationController){recommendationController.abort();recommendationController=null;}
    clearInterval(heroTimer);heroTimer=null;clearTimeout(previewTimer);++previewSequence;
    view.innerHTML=html;view.scrollTop=0;doc.body.dataset.dxRoute=route;
    root.querySelectorAll('[data-nav]').forEach(node=>{const selected=node.dataset.nav===route;node.classList.toggle('selected',selected);if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
    if(host().screenChanged)host().screenChanged(route);
  }
  function setAccount() {
    const node=doc.getElementById('sg-account');
    const user=profile.auth&&profile.auth.user;
    if (node) {node.textContent=user?'Account':'Sign in';node.title=user?'Stremio account':'Sign in to Stremio';}
    if(host().accountChanged)host().accountChanged(!!user);
  }
  async function refreshProfile() { const state=await core.getState('ctx');profile=state.profile||{};setAccount();return profile; }
  async function fetchJSON(url, useCache=true, signal=null) {
    const canonical=safeURL(url);
    if (!canonical) throw new Error('Invalid addon URL.');
    const prior=cache.get(canonical);
    if (useCache&&prior&&prior.expires>Date.now()) return prior.promise;
    const controller=new AbortController();
    const abort=()=>controller.abort();
    if(signal){if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});}
    const timer=setTimeout(()=>controller.abort(),20000);
    const promise=fetch(canonical,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}}).then(async response=>{
      if(!response.ok) throw new Error('Addon returned HTTP '+response.status+'.');
      return response.json();
    }).catch(error=>{cache.delete(canonical);throw error;}).finally(()=>{clearTimeout(timer);if(signal)signal.removeEventListener('abort',abort);});
    if(useCache){cache.set(canonical,{promise,expires:Date.now()+180000});if(cache.size>120)cache.delete(cache.keys().next().value);}
    return promise;
  }
  async function pollState(model,predicate,timeout=15000) {
    const deadline=Date.now()+timeout;
    while(Date.now()<deadline) { const state=await core.getState(model);if(predicate(state)) return state;await delay(150); }
    throw new Error('The request timed out. Check the connection and try again.');
  }
  function installed() { return (profile.addons||[]).filter(addon=>addon&&addon.manifest&&safeURL(addon.transportUrl)); }
  function catalogs(search=false) {
    const output=[];
    installed().forEach(addon=>(addon.manifest.catalogs||[]).forEach(catalog=>{
      const extras=catalog.extra||[];
      const searchable=extras.some(extra=>extra.name==='search');
      const unsupportedRequired=extras.some(extra=>extra.isRequired&&!(search&&extra.name==='search'));
      if(search?!searchable||unsupportedRequired:unsupportedRequired) return;
      output.push({addon,catalog,key:addon.transportUrl+'|'+catalog.type+'|'+catalog.id});
    }));
    return output;
  }
  function card(meta, options={}) {
    if(!meta) return '';
    const id=meta.id||meta._id;if(!id) return '';
    const type=meta.type||'movie';const key=type+':'+id;cards.set(key,meta);if(cards.size>800)cards.delete(cards.keys().next().value);
    const href=detailHash(type,id,options.videoId||(meta.state&&meta.state.videoId));
    const poster=safeURL(options.wide?(meta.background||meta.poster):meta.poster);
    const progress=progressFraction(meta.progress);
    const rating=meta.imdbRating||meta.rating;
    const caption=options.recommendations?meta.recommendationReason:options.wide&&progress>0?Math.round(progress*100)+'% watched':(meta.releaseInfo||meta.year|| (type==='series'?'Series':'Movie'));
    return '<a class="sg-card meta-item-container'+(options.wide?' sg-card-wide':'')+(options.recommendations?' sg-recommendation':'')+'" href="'+e(href)+'" data-card="'+e(key)+'" aria-label="'+e(meta.name||id)+(options.recommendations?'. '+e(caption):'')+'">'+
      '<div class="sg-poster poster-container">'+(poster?'<img src="'+e(poster)+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">':'<span class="sg-poster-placeholder">'+e(meta.name||id)+'</span>')+
      (rating?'<span class="sg-rating"><b>IMDb</b> '+e(rating)+'</span>':'')+(meta.watched?'<span class="sg-watched">✓</span>':'')+
      (progress>0?'<span class="sg-progress"><i style="width:'+Math.round(progress*100)+'%"></i></span>':'')+'</div><span class="sg-card-title title-label">'+e(meta.name||id)+'</span><span class="sg-card-caption">'+e(caption)+'</span></a>';
  }
  function row(title, items, index, options={}) {
    return '<section class="sg-row meta-row-container" data-row-key="'+e(Number.isInteger(index)?'catalog:'+index:title)+'"><div class="sg-row-heading"><h2>'+e(title)+'</h2><span class="sg-row-count" aria-live="off"></span>'+(Number.isInteger(index)?'<a class="sg-see-all" href="#/discover?catalog='+index+'">See All <span>›</span></a>':'')+'</div><div class="sg-cards meta-items-container">'+items.map(item=>card(item,options)).join('')+'</div></section>';
  }
  function hero(meta,index=0) {
    if(host().renderHero)return host().renderHero(meta);
    const type=meta.type||'movie',id=meta.id||meta._id;
    const picture=safeURL(meta.background||meta.poster),logo=safeURL(meta.logo);
    const genres=(meta.genres||[]).slice(0,3).join(' · ');
    return '<section class="dx-hero is-first sg-hero"><div class="dx-hero-slide is-active"><div class="dx-hero-backdrop"'+(picture?' style="background-image:url(&quot;'+e(picture)+'&quot;)"':'')+'></div><div class="dx-hero-shade"></div><div class="dx-hero-content">'+
      '<div class="dx-hero-kicker"><b>IN THE SPOTLIGHT</b><span>'+e(type==='series'?'SERIES':'MOVIE')+'</span></div>'+(logo?'<img class="dx-hero-logo" src="'+e(logo)+'" alt="'+e(meta.name)+'">':'<h1 class="dx-hero-title">'+e(meta.name)+'</h1>')+
      '<div class="dx-hero-meta">'+(meta.imdbRating?'<span class="sg-hero-rating">IMDb '+e(meta.imdbRating)+'</span>':'')+'<span>'+e(meta.releaseInfo||meta.year||'')+'</span><span>'+e(genres)+'</span></div><p class="dx-hero-desc">'+e(meta.description||'Explore this title and choose a stream from your installed addons.')+'</p><div class="dx-hero-actions"><a class="dx-btn sg-button sg-primary" href="'+e(detailHash(type,id))+'">▶ Watch now</a><a class="dx-btn sg-button" href="'+e(detailHash(type,id))+'"><span class="sg-info-icon" aria-hidden="true">i</span> More Info</a></div></div></div></section>';
  }
  async function home(token) {
    const filter=new URLSearchParams(location.hash.split('?')[1]||'').get('type')||'';
    const filters='<div class="sg-home-filters" aria-label="Browse titles">'+[['','All'],['movie','Movies'],['series','Series']].map(([value,label])=>'<a class="sg-filter'+(filter===value?' selected':'')+'" href="#/board'+(value?'?type='+value:'')+'"'+(filter===value?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</div>'; 
    setScreen('<div class="sg-home board-content">'+filters+'<div id="sg-hero-slot">'+pendingText('Loading your catalogues')+'</div><div id="sg-home-rows" class="sg-home-rows"></div></div>','board');
    catalogMemory=catalogs();const list=catalogMemory.filter(entry=>!filter||entry.catalog.type===filter);
    const rows=doc.getElementById('sg-home-rows');
    const cw=await core.getState('continue_watching_preview').catch(()=>null);
    if(token!==epoch)return;
    const continuing=(cw&&cw.items||[]).filter(item=>!filter||item.type===filter);
    if(continuing.length)rows.insertAdjacentHTML('beforeend',row('Continue Watching',continuing,null,{wide:true}));
    if(!list.length) {doc.getElementById('sg-hero-slot').innerHTML=empty('Your home starts here','Sign in to sync your Stremio addons, or add a catalog from Addons.','addons','Open Addons');return;}
    const slots=list.map((entry,index)=>{
      const section=doc.createElement('div');section.className='sg-catalog-slot';section.dataset.index=index;section.innerHTML='<section class="sg-row"><h2>'+e(entry.catalog.name||entry.addon.manifest.name)+' · '+e(entry.catalog.type)+'</h2><div class="sg-skeleton-row">'+Array(6).fill('<span></span>').join('')+'</div></section>';rows.append(section);return section;
    });
    let next=0,heroChosen=false;
    await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{
      while(next<list.length&&token===epoch) {
        const index=next++,entry=list[index];
        try {
          const data=await fetchJSON(resourceURL(entry.addon.transportUrl,'catalog',entry.catalog.type,entry.catalog.id));
          if(token!==epoch)return;
          const metas=(data.metas||[]).filter(item=>item&&item.id).map(item=>({...item,type:item.type||entry.catalog.type}));
          if(!metas.length){slots[index].remove();continue;}
          slots[index].innerHTML=row((entry.catalog.name||entry.addon.manifest.name)+' · '+entry.catalog.type,metas.slice(0,24),catalogMemory.indexOf(entry),{wide:index===0&&!host().mobile});
          if(!heroChosen) {
            heroChosen=true;const chosen=metas.find(meta=>meta.background)||metas[0];doc.getElementById('sg-hero-slot').innerHTML=hero(chosen);
            resolveMeta(chosen.type,chosen.id,chosen).then(result=>{if(token===epoch&&!doc.getElementById('sg-hero-slot').contains(doc.activeElement)&&!doc.activeElement.closest('.sg-card')){doc.getElementById('sg-hero-slot').innerHTML=hero(result.meta);}}).catch(()=>{});
          }
        } catch(error) {
          if(token!==epoch)return;
          slots[index].innerHTML='<section class="sg-row"><h2>'+e(entry.catalog.name||entry.addon.manifest.name)+'</h2><p class="sg-muted">This catalog could not load. The addon may be offline or block TV requests.</p><button class="sg-button" data-action="refresh">Retry</button></section>';
          diagnostic('catalog_failed',{index});
        }
      }
    }));
    if(token===epoch&&!heroChosen)doc.getElementById('sg-hero-slot').innerHTML=empty('No titles loaded','Check the connection or try another catalog addon.','refresh');
  }
  function cancelSearch() {
    if(!searchSession)return;
    clearTimeout(searchSession.timer);
    if(searchSession.controller)searchSession.controller.abort();
    searchSession.revision++;
    searchSession=null;
  }
  function currentSearch(session,revision) {
    return session===searchSession&&session.token===epoch&&session.revision===revision&&session.results.isConnected;
  }
  function searchHint(session) {
    session.results.innerHTML=empty('Find your next watch','Type at least 2 characters for live results, or press Search for a one-letter title.');
    session.results.setAttribute('aria-busy','false');
    session.status.textContent='Results update as you type.';
  }
  function updateSearchQuery(session) {
    const query=session.input.value.trim();
    if(query===session.query)return false;
    session.query=query;
    clearTimeout(session.timer);session.revision++;
    if(session.controller)session.controller.abort();
    session.requested=null;
    // Changing only the fragment preserves the input node, native keyboard and
    // caret, and does not add a browser-history entry for every keystroke.
    const hash='#/search'+(query?'?search='+encodeURIComponent(query):'');
    try {global.history.replaceState(null,'',hash);screenHash=hash;}catch(_){/* Some hosts restrict history; detailOrigin still retains the query. */}
    return true;
  }
  function queueSearch() {
    const session=searchSession;if(!session)return;
    const changed=updateSearchQuery(session);
    if(session.composing)return;
    if(!changed&&session.requested===session.query)return;
    clearTimeout(session.timer);
    if(session.query.length<2){searchHint(session);return;}
    session.status.textContent='Waiting for you to finish typing…';
    session.results.innerHTML=pendingText('Searching your addons');
    session.results.setAttribute('aria-busy','true');
    session.timer=setTimeout(()=>runSearch(session),450);
  }
  async function runSearch(session) {
    if(session!==searchSession||session.token!==epoch||session.composing)return;
    clearTimeout(session.timer);updateSearchQuery(session);
    const query=session.query;
    if(!query){searchHint(session);return;}
    if(session.requested===query)return;
    if(session.controller)session.controller.abort();
    session.controller=new AbortController();
    const signal=session.controller.signal,revision=++session.revision;
    session.requested=query;
    const list=catalogs(true),results=session.results;
    results.setAttribute('aria-busy','true');session.status.textContent='Searching your addons…';
    if(!list.length){results.innerHTML=empty('No search addons','Install an addon with a searchable catalog.','addons','Open Addons');results.setAttribute('aria-busy','false');session.status.textContent='No searchable catalogs installed.';return;}
    results.innerHTML='';let count=0,failed=0,next=0;
    const slots=list.map(()=>{const node=doc.createElement('div');results.append(node);return node;});
    const loading=doc.createElement('div');loading.innerHTML=pendingText('Finding titles');results.append(loading);
    // Four concurrent requests at most, cancelled immediately when text changes.
    await Promise.all(Array.from({length:Math.min(4,list.length)},async()=>{
      while(next<list.length&&currentSearch(session,revision)){
        const index=next++,entry=list[index];
        try {
          const data=await fetchJSON(resourceURL(entry.addon.transportUrl,'catalog',entry.catalog.type,entry.catalog.id,{search:query}),false,signal);
          if(!currentSearch(session,revision))return;
          const metas=(data.metas||[]).filter(item=>item&&item.id).slice(0,40).map(item=>({...item,type:item.type||entry.catalog.type}));
          if(metas.length){count+=metas.length;slots[index].innerHTML=row((entry.catalog.name||entry.addon.manifest.name)+' · '+entry.catalog.type,metas);loading.hidden=true;}
        }catch(_){if(!currentSearch(session,revision))return;failed++;}
      }
    }));
    if(!currentSearch(session,revision))return;
    loading.remove();results.setAttribute('aria-busy','false');
    session.status.textContent=count?count+' results'+(failed?' · Some addons could not be reached.':''):(failed?'Search could not finish. Press Search to retry.':'No matching titles.');
    if(!count)results.innerHTML=empty(failed?'Search unavailable':'No results',failed?'Check your connection, then press Search to retry.':'Try another title or add another searchable catalog.');
    if(failed)session.requested=null; // Permit an explicit retry of failed requests.
  }
  async function search(token,query) {
    setScreen('<section class="sg-page search-content"><h1>Find your next watch</h1><form id="sg-search-form" class="sg-search-form" role="search"><input id="sg-search-input" type="search" autocomplete="off" spellcheck="false" placeholder="Movies, series, anime…" aria-label="Search titles" aria-describedby="sg-search-status" value="'+e(query)+'"><button class="sg-button sg-primary" type="submit">Search</button></form><p id="sg-search-status" class="sg-search-status" role="status" aria-live="polite"></p><div id="sg-search-results" aria-busy="false"></div></section>','search');
    const session={token,query:query.trim(),revision:0,requested:null,composing:false,input:doc.getElementById('sg-search-input'),results:doc.getElementById('sg-search-results'),status:doc.getElementById('sg-search-status')};
    searchSession=session;
    if(query.trim())await runSearch(session);else searchHint(session);
  }
  async function discover(token,params) {
    catalogMemory=catalogs();const supplied=Number(params.get('catalog')||0);const index=Math.max(0,Math.min(catalogMemory.length-1,Number.isFinite(supplied)?supplied:0));
    const entry=catalogMemory[index];activeCatalog={index,skip:0,count:0,token,entry,genre:params.get('genre')||''};
    const genreExtra=entry&&(entry.catalog.extra||[]).find(item=>item.name==='genre');
    setScreen('<section class="sg-page discover-content"><h1>Discover</h1><div class="sg-filters"><label>Catalog<select id="sg-catalog-picker">'+catalogMemory.map((item,i)=>'<option value="'+i+'"'+(i===index?' selected':'')+'>'+e((item.catalog.name||item.addon.manifest.name)+' · '+item.catalog.type)+'</option>').join('')+'</select></label>'+(genreExtra&&genreExtra.options?'<label>Genre<select id="sg-genre-picker"><option value="">All genres</option>'+genreExtra.options.map(genre=>'<option'+(genre===activeCatalog.genre?' selected':'')+'>'+e(genre)+'</option>').join('')+'</select></label>':'')+'</div><div id="sg-discover-grid" class="sg-grid"></div><div id="sg-discover-status">'+pendingText('Loading catalog')+'</div></section>','discover');
    if(!entry){doc.getElementById('sg-discover-status').innerHTML=empty('No catalogs installed','Sign in or add a catalog addon.','addons','Open Addons');return;}
    await nextCatalogPage();
  }
  async function nextCatalogPage() {
    const current=activeCatalog;if(!current||current.busy)return;current.busy=true;
    const status=doc.getElementById('sg-discover-status');if(status)status.innerHTML=pendingText('Loading titles');
    try {
      const data=await fetchJSON(resourceURL(current.entry.addon.transportUrl,'catalog',current.entry.catalog.type,current.entry.catalog.id,{skip:current.skip||undefined,genre:current.genre||undefined}));
      if(epoch!==current.token)return;
      const metas=data.metas||[],grid=doc.getElementById('sg-discover-grid');
      grid.insertAdjacentHTML('beforeend',metas.map(meta=>card({...meta,type:meta.type||current.entry.catalog.type})).join(''));
      current.skip+=metas.length;current.count+=metas.length;
      const canPage=(current.entry.catalog.extra||[]).some(extra=>extra.name==='skip');
      status.innerHTML=!current.count?empty('No titles found','Choose another catalog or genre.'):canPage&&metas.length?'<button class="sg-button" data-action="catalog-more">Load more</button>':'';
    } catch(_) {if(epoch===current.token)status.innerHTML=empty('Catalog unavailable','The addon could not be reached.','catalog-more');}
    finally{current.busy=false;}
  }
  async function loadLibrary(type=null,sort='lastwatched',page=1) {
    await core.dispatch(loadAction('LibraryWithFilters',{request:{type,sort,page}}),'library');
    return core.getState('library');
  }
  async function recommendations(token,params) {
    const engine=global.StreamGlassRecommendations;
    const filter=['movie','series','anime'].includes(params.get('type'))?params.get('type'):'';
    const filters=[['','All picks'],['movie','Movies'],['series','Series'],['anime','Anime']].map(([value,label])=>'<a class="sg-filter'+(value===filter?' selected':'')+'" href="#/picks'+(value?'?type='+value:'')+'"'+(value===filter?' aria-current="page"':'')+'>'+label+'</a>').join('');
    setScreen('<section class="sg-page sg-picks"><header class="sg-picks-header"><div><span class="sg-eyebrow">PICKED FOR YOU</span><h1>Your next good watch.</h1><p>Inspired by what you watch and save. A few familiar threads, something new to discover.</p></div><button class="sg-button" data-action="recommendations-refresh">Refresh picks</button></header><div class="sg-picks-filters" aria-label="Recommendation type">'+filters+'</div><p id="sg-picks-note" class="sg-muted" role="status">Reading your available Stremio library and watch progress…</p><div id="sg-picks-results" aria-busy="true">'+pendingText('Finding your next watch','Matching titles from your installed catalogues.')+'</div></section>','picks');
    const controller=new AbortController();recommendationController=controller;
    const current=()=>token===epoch&&recommendationController===controller;
    const results=doc.getElementById('sg-picks-results'),note=doc.getElementById('sg-picks-note');
    let timer;
    try {
      const state=await loadLibrary(null,'lastwatched',5);if(!current())return;
      const libraryItems=state.catalog||[],selected=engine.selectSeeds(libraryItems);
      if(!selected.length){note.textContent='Your recommendations start with a few titles.';results.innerHTML=empty('Make it yours',profile.auth?'Watch or save some movies and series, then come back for personal picks.':'Sign in to use your synced library, or watch and save titles on this TV.','account',profile.auth?'Open account':'Sign in');return;}
      const sources=installed();
      const signature=JSON.stringify([profile.auth&&profile.auth.user&&profile.auth.user._id,libraryItems.map(item=>[engine.key(item),item.watched,item.progress,item.name]),sources.map(addon=>addon.transportUrl)]);
      let snapshot=recommendationSnapshot;
      if(!snapshot||snapshot.signature!==signature||snapshot.expires<Date.now()) {
        timer=setTimeout(()=>controller.abort(),40000);
        let failures=0;
        const mapBounded=async(items,limit,fn)=>{
          const output=new Array(items.length);let next=0;
          await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
            while(next<items.length&&current()&&!controller.signal.aborted){const index=next++;try{output[index]=await fn(items[index]);}catch(_){failures++;}}
          }));return output.filter(Boolean);
        };
        const metadata=async item=>{
          for(const addon of sources.filter(source=>supports(source,'meta',item.type,item.id||item._id)).slice(0,2)){
            if(controller.signal.aborted)break;
            try{const data=await fetchJSON(resourceURL(addon.transportUrl,'meta',item.type,item.id||item._id),false,controller.signal);if(data.meta)return {...item,...data.meta,id:item.id||item._id,type:item.type};}catch(_){if(!controller.signal.aborted)failures++;}
          }
          return item;
        };
        // Interleave media types so one addon's long film list cannot take every slot.
        const available=catalogs(),groups=['movie','series','anime'].map(type=>available.filter(entry=>entry.catalog.type===type));
        const chosen=[];for(let i=0;chosen.length<8&&groups.some(group=>group[i]);i++)for(const group of groups)if(group[i]&&chosen.length<8)chosen.push(group[i]);
        note.textContent='Looking for connections in your watched and saved titles…';
        const [seeds,batches]=await Promise.all([
          mapBounded(selected,2,async item=>({...await metadata(item),signal:item.signal,weight:item.weight})),
          mapBounded(chosen,3,async entry=>{
            const data=await fetchJSON(resourceURL(entry.addon.transportUrl,'catalog',entry.catalog.type,entry.catalog.id),false,controller.signal);
            return (Array.isArray(data.metas)?data.metas:[]).filter(item=>item&&item.id).slice(0,60).map(item=>({...item,type:item.type||entry.catalog.type}));
          })
        ]);
        if(!current())return;
        const unique=new Map();batches.flat().forEach(item=>{if(!unique.has(engine.key(item)))unique.set(engine.key(item),item);});
        const excluded=new Set(libraryItems.map(engine.key));
        const incomplete=[...unique.values()].filter(item=>!excluded.has(engine.key(item))&&!engine.labels(item.genres).length&&!engine.labels(item.director).length&&!engine.labels(item.cast).length);
        const byType=['movie','series','anime'].map(type=>incomplete.filter(item=>item.type===type));
        const missing=[];for(let i=0;missing.length<24&&byType.some(group=>group[i]);i++)for(const group of byType)if(group[i]&&missing.length<24)missing.push(group[i]);
        if(missing.length&&!controller.signal.aborted){
          note.textContent='Checking title details to find better matches…';
          const enriched=await mapBounded(missing,2,metadata);enriched.forEach(item=>unique.set(engine.key(item),item));
        }
        if(!current())return;
        snapshot={signature,expires:Date.now()+180000,seeds,candidates:[...unique.values()],partial:controller.signal.aborted||failures>0};
        // Only retain complete results. Refresh always retries unavailable addons.
        if(!snapshot.partial)recommendationSnapshot=snapshot;
      }
      const picks=engine.recommend(libraryItems,snapshot.seeds,snapshot.candidates,{type:filter,limit:24});
      if(!current())return;
      note.textContent='Based on '+snapshot.seeds.length+' recent watched, started or saved '+(snapshot.seeds.length===1?'title':'titles')+'. New discoveries from your catalogues.'+(state.selectable&&state.selectable.nextPage?' Using your latest 500 library entries.':'')+(snapshot.partial?' Some addons did not finish. Refresh to try again.':'');
      if(!picks.length){results.innerHTML=empty('No new matches yet',snapshot.partial?'Some addons could not be reached. Refresh to try again.':'Try another type, add a catalogue with genre metadata, or watch and save more titles.','recommendations-refresh','Try again');}
      else results.innerHTML=row('Your next watch',picks.slice(0,4),null,{wide:true,recommendations:true})+(picks.length>4?row('More to explore',picks.slice(4),null,{recommendations:true}):'');
      diagnostic('recommendations_ready',{seedCount:snapshot.seeds.length,candidateCount:snapshot.candidates.length,resultCount:picks.length,partial:snapshot.partial});
    } finally {clearTimeout(timer);if(current())results.setAttribute('aria-busy','false');}
  }
  async function library(token,params) {
    setScreen('<section class="sg-page library-content"><h1>Your Library</h1><div class="sg-filters"><label>Type<select id="sg-library-type"><option value="">Everything</option><option value="movie">Movies</option><option value="series">Series</option><option value="anime">Anime</option></select></label><label>Sort<select id="sg-library-sort"><option value="lastwatched">Recently watched</option><option value="name">Name</option><option value="watched">Watched first</option><option value="notwatched">Unwatched first</option></select></label><button class="sg-button" data-action="sync">Sync account</button></div><div id="sg-library-grid" class="sg-grid"></div><div id="sg-library-status">'+pendingText('Loading your library')+'</div></section>','library');
    doc.getElementById('sg-library-type').value=params.get('type')||'';doc.getElementById('sg-library-sort').value=params.get('sort')||'lastwatched';
    const state=await loadLibrary(params.get('type')||null,params.get('sort')||'lastwatched');if(token!==epoch)return;renderLibrary(state);
  }
  function renderLibrary(state,append=false) {
    const grid=doc.getElementById('sg-library-grid'),status=doc.getElementById('sg-library-status');if(!grid||!status)return;
    const html=(state.catalog||[]).map(item=>card(item)).join('');if(append)grid.insertAdjacentHTML('beforeend',html);else grid.innerHTML=html;
    status.innerHTML=!(state.catalog||[]).length?empty('Your library is empty',profile.auth?'Open a title and choose Add to Library.':'Sign in to sync your saved titles and watch progress.','account',profile.auth?'Account':'Sign in'):(state.selectable&&state.selectable.nextPage?'<button class="sg-button" data-action="library-more">Load more</button>':'');
  }
  async function resolveMeta(type,id,fallback) {
    const sources=installed().filter(addon=>supports(addon,'meta',type,id));
    if(!sources.length)throw new Error('No installed addon provides details for this title.');
    const attempts=sources.map(async addon=>{
      const data=await fetchJSON(resourceURL(addon.transportUrl,'meta',type,id));if(!data.meta)throw new Error('No details returned.');
      return {meta:{...fallback,...data.meta,id:data.meta.id||id,type:data.meta.type||type},addon};
    });
    return Promise.any(attempts).catch(()=>{throw new Error('Title details could not load. The addon may be offline or block TV requests.');});
  }
  function episodes(meta,selectedVideo) {
    const videos=meta.videos||[];
    if(meta.type==='movie'&&videos.length<=1)return '';
    if(!videos.length)return '<p class="sg-muted">This addon has not provided any episodes yet.</p>';
    const seasons=[...new Set(videos.map(video=>Number.isFinite(Number(video.season))?Number(video.season):0))].sort((a,b)=>a-b);
    const active=videos.find(video=>video.id===selectedVideo)||videos.find(video=>!video.released||Date.parse(video.released)<=Date.now())||videos[0];
    const season=Number(active.season)||0;
    return '<section class="sg-episodes"><div class="sg-row-heading"><h2>Episodes</h2>'+(seasons.length>1?'<select id="sg-season" aria-label="Season">'+seasons.map(item=>'<option value="'+item+'"'+(item===season?' selected':'')+'>'+e(item?'Season '+item:'Specials')+'</option>').join('')+'</select>':'')+'</div><div id="sg-episode-list">'+episodeList(meta,season,selectedVideo)+'</div></section>';
  }
  function episodeList(meta,season,selectedVideo) {
    return (meta.videos||[]).filter(video=>(Number(video.season)||0)===Number(season)).map(video=>{
      const upcoming=video.released&&Date.parse(video.released)>Date.now(),image=safeURL(video.thumbnail);
      return '<button class="sg-episode'+(video.id===selectedVideo?' selected':'')+'" data-video="'+e(video.id)+'"'+(upcoming?' disabled':'')+'>'+(image?'<img src="'+e(image)+'" alt="" loading="lazy">':'<span class="sg-episode-number">'+e(video.episode||'▶')+'</span>')+'<span><b>'+e((video.episode?'E'+video.episode+' · ':'')+(video.title||video.name||'Episode'))+'</b><small>'+e(upcoming?'Available '+String(video.released).slice(0,10):(video.overview||video.description||''))+'</small></span><span>›</span></button>';
    }).join('');
  }
  async function details(token,type,id,videoId) {
    currentDetail=null;setScreen(pendingText('Loading title'),'detail');
    const result=await resolveMeta(type,id,cards.get(type+':'+id));if(token!==epoch)return;
    const meta=result.meta;
    // Loading this model lets the core manage watched flags consistently with other Stremio clients.
    await core.dispatch(loadAction('MetaDetails',{metaPath:path('meta',type,id),streamPath:videoId?path('stream',type,videoId):null,guessStream:false}),'meta_details');
    const cw=await core.getState('continue_watching_preview').catch(()=>({items:[]}));
    const resumable=(cw.items||[]).find(item=>(item._id||item.id)===id);
    const requested=videoId||(resumable&&resumable.state&&resumable.state.videoId);
    const videos=meta.videos||[],first=videos.find(video=>video.id===requested)||videos.find(video=>(Number(video.season)||0)>0&&(!video.released||Date.parse(video.released)<=Date.now()))||videos.find(video=>!video.released||Date.parse(video.released)<=Date.now());
    const selectedVideo=requested||(meta.behaviorHints&&meta.behaviorHints.defaultVideoId)||(first&&first.id)||id;
    const detailState=await core.getState('meta_details');if(token!==epoch)return;
    const inLibrary=!!(detailState.libraryItem&&!detailState.libraryItem.removed);
    currentDetail={...result,type,id,videoId:selectedVideo,streams:[],token,inLibrary};
    const backdrop=safeURL(meta.background||meta.poster),logo=safeURL(meta.logo);
    setScreen('<section class="sg-detail metadetails-container">'+(backdrop?'<div class="background-image-layer sg-detail-background"><img src="'+e(backdrop)+'" alt=""></div>':'')+'<div class="sg-detail-content"><a class="sg-back" href="'+e(detailOrigin)+'">‹ Back to browsing</a><div class="sg-detail-top"><div class="sg-detail-info"><span class="sg-eyebrow">'+e(type==='series'?'SERIES':'FILM')+'</span>'+(logo?'<img class="sg-detail-logo" src="'+e(logo)+'" alt="'+e(meta.name)+'">':'<h1>'+e(meta.name)+'</h1>')+'<div class="sg-detail-meta">'+(meta.imdbRating?'<b>IMDb '+e(meta.imdbRating)+'</b>':'')+'<span>'+e(meta.releaseInfo||'')+'</span><span>'+e(meta.runtime||'')+'</span></div><p class="sg-detail-description">'+e(meta.description||'No description provided by this addon.')+'</p><div class="sg-detail-genres">'+e((meta.genres||[]).join(' · '))+'</div><div class="sg-detail-actions"><button class="sg-button sg-primary" data-action="focus-streams">▶ Choose a stream</button><button id="sg-library-toggle" class="sg-button" data-action="library-toggle">'+(inLibrary?'✓ In Library':'+ Add to Library')+'</button></div>'+episodes(meta,selectedVideo)+'</div><aside class="sg-stream-panel" aria-label="Streams"><h2 id="sg-stream-heading">'+e(streamHeading(meta,selectedVideo))+'</h2><p class="sg-muted sg-stream-note">Pick your preferred quality to start watching.</p><div id="sg-streams">'+pendingText('Finding streams')+'</div></aside></div></div></section>','detail');
    if(host().detailReady)host().detailReady({inLibrary,resumable:!!(resumable&&resumable.state&&resumable.state.timeOffset)});
    await streams(currentDetail,selectedVideo);
  }
  function streamHeading(meta,videoId) {const video=(meta.videos||[]).find(item=>item.id===videoId);return video&&video.season!=null?'S'+video.season+' E'+video.episode+' · Streams':'Available streams';}
  async function streams(detail,videoId) {
    if(!detail)return;detail.videoId=videoId;detail.streams=[];const identity=Symbol('streams');detail.streamIdentity=identity;
    const target=doc.getElementById('sg-streams');if(!target)return;
    target.innerHTML=pendingText('Finding streams');doc.getElementById('sg-stream-heading').textContent=streamHeading(detail.meta,videoId);
    doc.querySelectorAll('[data-video]').forEach(button=>button.classList.toggle('selected',button.dataset.video===videoId));
    const addons=installed().filter(addon=>supports(addon,'stream',detail.type,videoId));
    const embedded=((detail.meta.videos||[]).find(video=>video.id===videoId)||{}).streams||[];
    let loaded=0,failures=0;target.innerHTML='';
    const display=(list,addon)=>{
      if(detail!==currentDetail||detail.streamIdentity!==identity||detail.token!==epoch)return;
      if(!Array.isArray(list)||!list.length)return;
      const section=doc.createElement('section');section.className='sg-stream-group';section.innerHTML='<h3>'+e(addon.manifest.name)+'</h3>';
      list.forEach(stream=>{
        const index=detail.streams.length;detail.streams.push({stream,addon,videoId});
        const direct=!!safeURL(stream.url),button=doc.createElement('button');button.className='sg-stream';button.dataset.stream=index;
        button.innerHTML='<span class="sg-stream-badges">'+streamBadges(stream).map(tag=>'<span>'+e(tag)+'</span>').join('')+'</span><span class="sg-stream-name">'+e(stream.name||addon.manifest.name)+'</span><span class="sg-stream-description">'+e(stream.description||stream.title||stream.behaviorHints&&stream.behaviorHints.filename||'Play stream')+'</span><small>'+e(direct?'▶ Play this stream':stream.infoHash?'Torrent, requires a streaming server':'External source, unavailable on this TV')+'</small>';
        section.append(button);
      });target.append(section);loaded+=list.length;
    };
    if(embedded.length)display(embedded,detail.addon);
    if(!addons.length&&!embedded.length){target.innerHTML=empty('No stream addons','Configure Torrentio with TorBox on your phone, then sign in here with the same Stremio account.','addons','Open Addons');return;}
    const loading=doc.createElement('p');loading.className='sg-muted';loading.textContent='Contacting your stream addons…';target.append(loading);
    await Promise.all(addons.map(async addon=>{
      try {const data=await fetchJSON(resourceURL(addon.transportUrl,'stream',detail.type,videoId),false);display(data.streams||[],addon);}catch(_){failures++;}
    }));
    if(detail!==currentDetail||detail.streamIdentity!==identity||detail.token!==epoch)return;
    loading.remove();
    if(!loaded)target.innerHTML=empty('No streams returned',failures?'Some addons could not be reached. Check your connection and addon configuration.':'Try another title or check Torrentio and TorBox in your Stremio account.','streams-retry');
  }
  async function collectSubtitles(type,videoId,stream) {
    const existing=(stream.subtitles||[]).filter(item=>safeURL(item.url));
    const addons=installed().filter(addon=>supports(addon,'subtitles',type,videoId));
    const results=await Promise.allSettled(addons.map(addon=>fetchJSON(resourceURL(addon.transportUrl,'subtitles',type,videoId,{filename:stream.behaviorHints&&stream.behaviorHints.filename}))));
    for(const result of results)if(result.status==='fulfilled')existing.push(...(result.value.subtitles||[]).filter(item=>safeURL(item.url)));
    const seen=new Set();return existing.filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;}).map(item=>({...item,label:item.label||item.lang||'Subtitle'})).slice(0,120);
  }
  async function play(index) {
    if(pendingPlayback||activePlayback||!currentDetail)return;
    const detail=currentDetail,item=detail.streams[index];if(!item)return;
    const stream=item.stream,url=safeURL(stream.url);
    if(!url){await showMessage('A direct link is needed',stream.infoHash?'This is a raw torrent. Select a Torrentio + TorBox cached direct stream. This webOS app does not download torrents.':'This addon returned an external-player link. Select a direct HTTP or HTTPS stream instead.');return;}
    pendingPlayback=true;notify('Opening stream…');
    try {
      const subtitlesPromise=collectSubtitles(detail.type,item.videoId,stream);
      await core.dispatch(loadAction('Player',{stream,streamRequest:{base:item.addon.transportUrl,path:path('stream',detail.type,item.videoId)},metaRequest:{base:detail.addon.transportUrl,path:path('meta',detail.type,detail.id)},subtitlesPath:path('subtitles',detail.type,item.videoId)}),'player');
      // Core must load the library record before the first progress event, or resume could be overwritten.
      const state=await pollState('player',value=>value.metaItem&&value.metaItem.type==='Ready',20000);
      if(detail!==currentDetail||detail.token!==epoch){await core.dispatch({action:'Unload'},'player');return;}
      const lib=state.libraryItem&&state.libraryItem.state;
      const startMs=lib&&lib.video_id===item.videoId?Number(lib.timeOffset)||0:0;
      const subtitles=await Promise.race([subtitlesPromise,delay(3000).then(()=>mergeSubtitles(stream.subtitles,state.subtitles))]);
      if(detail!==currentDetail||detail.token!==epoch){await core.dispatch({action:'Unload'},'player');return;}
      const settings=profile.settings||{},video=(detail.meta.videos||[]).find(value=>value.id===item.videoId);
      activePlayback={returnHash:location.hash,videoId:item.videoId,id:detail.id,type:detail.type,ready:true};lastProgress=null;
      location.hash='#/player/'+encodeURIComponent(item.videoId);
      const payload={url,hash:location.hash,videoId:item.videoId,title:detail.meta.name||'StreamGlass TV',subtitle:video&&video.season!=null?'S'+video.season+' E'+video.episode+(video.title?' · '+video.title:''):'',startMs,headers:stream.behaviorHints&&stream.behaviorHints.proxyHeaders&&stream.behaviorHints.proxyHeaders.request||{},subtitles,subtitleLanguage:settings.subtitlesLanguage||'',audioLanguage:settings.audioLanguage||'',subtitleStyle:{size:settings.subtitlesSize,offset:settings.subtitlesOffset,bold:settings.subtitlesBold,text:settings.subtitlesTextColor,background:settings.subtitlesBackgroundColor,outline:settings.subtitlesOutlineColor,opacity:settings.subtitlesOpacity}};
      if(!host().play)throw new Error('The webOS player did not load.');
      host().play(payload);diagnostic('playback_started',{resume:startMs>0,subtitles:subtitles.length});
      const playback=activePlayback;
      subtitlesPromise.then(later=>{
        // Slow subtitle addons must not delay video startup or disappear from the menu.
        // Keep existing indices stable if a subtitle has already been selected.
        if(activePlayback===playback){payload.subtitles=mergeSubtitles(payload.subtitles,later);if(host().updateSubtitles)host().updateSubtitles(payload.subtitles);}
      }).catch(()=>{});
    } catch(error) {activePlayback=null;notify('The stream could not open. Check your connection or try another stream.');diagnostic('playback_setup_failed',{});await core.dispatch({action:'Unload'},'player').catch(()=>{});}
    finally {pendingPlayback=false;}
  }
  function onProgress(timeMs,durationMs,paused) {
    const playback=activePlayback;if(!playback||!playback.ready)return;
    const now=Date.now(),action=playbackUpdate(lastProgress,timeMs,durationMs,now);lastProgress={time:Math.max(0,Number(timeMs)||0),wall:now};
    progressQueue=progressQueue.then(async()=>{
      if(activePlayback!==playback)return;
      if(Number(durationMs)>0)await core.dispatch(action,'player');
      await core.dispatch(playerAction('PausedChanged',{paused:!!paused}),'player');
    }).catch(()=>diagnostic('progress_update_failed',{}));
    return progressQueue;
  }
  async function onClose(info={}) {
    const playback=activePlayback;if(!playback)return;
    await onProgress(info.timeMs||0,info.durationMs||0,true);await progressQueue;
    if(info.ended)await core.dispatch(playerAction('Ended'),'player').catch(()=>{});
    await core.dispatch({action:'Unload'},'player').catch(()=>{});
    activePlayback=null;lastProgress=null;
    await core.dispatch(ctxAction('SyncLibraryWithAPI'),'ctx').catch(()=>{});
    location.replace(playback.returnHash||'#/board');
  }
  async function addonPage() {
    const list=installed();
    setScreen('<section class="sg-page addons-content"><h1>Addons</h1><p class="sg-lead">Addons, including your configured Torrentio + TorBox addon, sync from your Stremio account.</p><div class="sg-toolbar"><button class="sg-button sg-primary" data-action="sync">Sync account</button><button class="sg-button" data-action="account">'+(profile.auth?'Account':'Sign in')+'</button></div><form id="sg-addon-form" class="sg-addon-form"><label for="sg-addon-url">Install from a manifest link</label><div><input id="sg-addon-url" type="text" autocomplete="off" spellcheck="false" placeholder="https://addon.example/manifest.json"><button class="sg-button" type="submit">Install</button></div><small>For Torrentio configuration, use Stremio on your phone first, then sync here.</small></form><div class="sg-addon-grid">'+list.map((addon,index)=>'<article class="sg-addon-card"><div class="sg-addon-header">'+(safeURL(addon.manifest.logo)?'<img src="'+e(safeURL(addon.manifest.logo))+'" alt="">':'<span class="sg-addon-icon">＋</span>')+'<div><h2>'+e(addon.manifest.name)+'</h2><small>'+e(addon.manifest.version||'')+'</small></div></div><p>'+e(addon.manifest.description||'')+'</p><div class="sg-addon-types">'+e((addon.manifest.types||[]).join(' · '))+'</div>'+(!(addon.flags&&addon.flags.protected)?'<button class="sg-button" data-remove-addon="'+index+'">Remove addon</button>':'<span class="sg-muted">Default catalog</span>')+'</article>').join('')+'</div></section>','addons');
  }
  async function installAddon(form) {
    const input=doc.getElementById('sg-addon-url'),button=form.querySelector('button');button.disabled=true;
    try {
      const url=manifestURL(input.value),manifest=await fetchJSON(url,false);
      if(!manifest.id||!manifest.name||!manifest.version||!Array.isArray(manifest.resources)||!Array.isArray(manifest.types))throw new Error('The link did not return a valid Stremio addon manifest.');
      await core.dispatch(ctxAction('InstallAddon',{transportUrl:url,manifest,flags:{official:false,protected:false}}),'ctx');
      await refreshProfile();await addonPage();notify('Addon installed.');
    }catch(error){notify(error.message&&error.message.startsWith('The link')?error.message:'Could not install the addon. Check the URL and its connection.');}
    finally{button.disabled=false;}
  }
  async function sync() {
    if(!profile.auth){location.hash='#/account';return;}
    notify('Syncing your Stremio account…');cache.clear();
    await Promise.all([core.dispatch(ctxAction('PullAddonsFromAPI'),'ctx'),core.dispatch(ctxAction('SyncLibraryWithAPI'),'ctx')]);
    // Completion events refresh the view even if the network takes longer than expected.
    notify('Sync requested. Changes appear when Stremio responds.');
  }
  function settingsPage() {
    const prefs=profile.settings||{};
    const languages=[['eng','English'],['spa','Spanish'],['hye','Armenian'],['fra','French'],['deu','German'],['rus','Russian'],['ara','Arabic'],['jpn','Japanese'],['kor','Korean'],['zho','Chinese']];
    const languageOptions=(selected,off)=>'<option value="'+(off?'none':'')+'"'+((off?selected==='none':!selected)?' selected':'')+'>'+(off?'Off':'Original / default')+'</option>'+languages.map(([value,label])=>'<option value="'+value+'"'+(selected===value?' selected':'')+'>'+label+'</option>').join('');
    setScreen('<section class="sg-page settings-content"><h1>Settings</h1><div class="sections-container sg-settings"><button class="sg-settings-row" data-action="account"><span><b>Stremio account</b><small>'+(profile.auth?'Signed in. Your addons, library and watch progress sync through Stremio.':'Sign in to sync your library and addons.')+'</small></span><span>›</span></button><button class="sg-settings-row" data-action="appearance"><span><b>StreamGlass TV</b><small>App information and diagnostics</small></span><span>›</span></button><form id="sg-prefs-form"><label class="sg-settings-row"><span><b>Preferred audio</b><small>Used when the TV exposes matching audio tracks.</small></span><select name="audioLanguage">'+languageOptions(prefs.audioLanguage,false)+'</select></label><label class="sg-settings-row"><span><b>Preferred subtitles</b><small>Choose a default language for external subtitle files.</small></span><select name="subtitlesLanguage">'+languageOptions(prefs.subtitlesLanguage,true)+'</select></label><label class="sg-settings-row"><span><b>Subtitle size</b></span><select name="subtitlesSize">'+[75,100,125,150,175,200].map(value=>'<option value="'+value+'"'+(Number(prefs.subtitlesSize||100)===value?' selected':'')+'>'+value+'%</option>').join('')+'</select></label><button class="sg-button sg-primary" type="submit">Save playback settings</button></form><button class="sg-settings-row" data-action="sync"><span><b>Sync account</b><small>Refresh installed addons and your library.</small></span><span>↻</span></button><p class="sg-muted">StreamGlass TV 0.4.0 · Unofficial webOS 25 port of the DX.BI interface.<br>4K video support depends on the stream format and your TV. External WebVTT and converted SRT subtitles are supported.</p></div></section>','settings');
  }
  function accountPage() {
    if(profile.auth){setScreen('<section class="sg-page sg-account-page"><div class="sg-account-box"><h1>Your Stremio account</h1><p>Signed in. Addons, saved titles and watch progress use your Stremio account.</p><div class="sg-toolbar"><button class="sg-button sg-primary" data-action="sync">Sync account</button><button class="sg-button" data-action="logout">Sign out</button></div><a class="sg-text-link" href="#/board">Back to Home</a></div></section>','account');return;}
    setScreen('<section class="sg-page sg-account-page"><div class="sg-account-box"><span class="sg-account-mark">STREAMGLASS</span><h1>Sign in to Stremio</h1><p>Use the account that has your Torrentio + TorBox addon.</p><form id="sg-login-form"><label for="sg-email">Email</label><input id="sg-email" name="email" type="email" autocomplete="username" required><label for="sg-password">Password</label><input id="sg-password" name="password" type="password" autocomplete="current-password" required><p id="sg-login-status" role="status"></p><button class="sg-button sg-primary" type="submit">Sign in</button></form><p class="sg-muted">For a social-login account, set a Stremio password on your phone or computer first.</p><a class="sg-text-link" href="#/board">Browse without signing in</a></div></section>','account');
  }
  async function login(form) {
    const email=form.elements.email.value.trim(),password=form.elements.password.value,button=form.querySelector('button'),status=doc.getElementById('sg-login-status');
    if(!email||!password)return;button.disabled=true;status.textContent='Signing in…';
    let loginError=null;
    const remove=core.on('event',event=>{if(event&&event.event==='Error'&&event.args&&event.args.source&&event.args.source.event==='UserAuthenticated')loginError=true;});
    try {
      await core.dispatch(ctxAction('Authenticate',{type:'Login',email,password,facebook:false}),'ctx');
      form.elements.password.value='';
      const deadline=Date.now()+25000;
      while(Date.now()<deadline&&!loginError){await refreshProfile();if(profile.auth)break;await delay(200);}
      if(!profile.auth)throw new Error('Sign-in failed. Check your email, password and connection.');
      await core.dispatch(ctxAction('PullAddonsFromAPI'),'ctx');await core.dispatch(ctxAction('SyncLibraryWithAPI'),'ctx');await delay(500);await refreshProfile();location.hash='#/board';notify('Signed in to Stremio.');
    }catch(error){status.textContent='Sign-in failed. Check your email, password and connection.';diagnostic('login_failed',{});}
    finally{button.disabled=false;if(typeof remove==='function')remove();}
  }
  async function render() {
    const parsed=parseHash(location.hash);
    if(parsed.route==='player'&&activePlayback)return;
    rememberScreen();screenHash=location.hash;const revision=interaction;
    const token=++epoch;
    if(recommendationController)recommendationController.abort();
    if(activePlayback){if(host().closePlayer)host().closePlayer();return;}
    currentDetail=null;
    try {
      await refreshProfile();if(token!==epoch)return;
      if(parsed.route==='board'||parsed.route==='')return await home(token);
      if(parsed.route==='search')return await search(token,parsed.query.get('search')||'');
      if(parsed.route==='discover')return await discover(token,parsed.query);
      if(parsed.route==='library')return await library(token,parsed.query);
      if(parsed.route==='picks')return await recommendations(token,parsed.query);
      if(parsed.route==='detail'||parsed.route==='metadetails')return await details(token,parsed.parts[1]||'movie',parsed.parts[2]||'',parsed.query.get('video'));
      if(parsed.route==='addons')return await addonPage();
      if(parsed.route==='settings')return settingsPage();
      if(parsed.route==='account')return accountPage();
      location.replace('#/board');
    }catch(error){if(token===epoch)setScreen(empty('Could not load this page',error.message||'Check your connection and try again.','refresh'),parsed.route);diagnostic('screen_failed',{route:parsed.route});}
    finally {restoreScreen(token,revision);}
  }
  async function action(name,node) {
    if(name==='refresh')return render();
    if(name==='recommendations-refresh'){recommendationSnapshot=null;return render();}
    if(name==='account'||name==='addons'){location.hash='#/'+name;return;}
    if(name==='appearance'){if(host().showSettings)host().showSettings();return;}
    if(name==='sync')return sync();
    if(name==='logout'){await core.dispatch(ctxAction('Logout'),'ctx');await refreshProfile();cache.clear();recommendationSnapshot=null;accountPage();notify('Signed out of Stremio.');return;}
    if(name==='catalog-more')return nextCatalogPage();
    if(name==='library-more'){await core.dispatch({action:'LibraryWithFilters',args:{action:'LoadNextPage'}},'library');return renderLibrary(await core.getState('library'));}
    if(name==='streams-retry'&&currentDetail)return streams(currentDetail,currentDetail.videoId);
    if(name==='focus-streams'){if(host().showStreams){host().showStreams();return;}const target=doc.querySelector('#sg-streams button');if(target){target.focus();target.scrollIntoView({block:'nearest'});}return;}
    if(name==='library-toggle'&&currentDetail){const detail=currentDetail;node.disabled=true;try{await core.dispatch(ctxAction(detail.inLibrary?'RemoveFromLibrary':'AddToLibrary',detail.inLibrary?detail.id:detail.meta),'ctx');detail.inLibrary=!detail.inLibrary;node.textContent=detail.inLibrary?'✓ In Library':'+ Add to Library';if(host().libraryChanged)host().libraryChanged(detail.inLibrary);notify(detail.inLibrary?'Added to your library.':'Removed from your library.');}finally{node.disabled=false;}return;}
  }
  function back() {
    if(pendingPlayback){++epoch;location.hash='#/board';return true;}
    const parsed=parseHash(location.hash);
    if(parsed.route==='board'||!parsed.route)return false;
    if(parsed.route==='detail'||parsed.route==='metadetails'){location.hash=detailOrigin;return true;}
    location.hash='#/board';return true;
  }
  async function start() {
    if(started)return;started=true;core=global.StreamGlassCore;
    if(!core)throw new Error('Stremio core is not available.');
    root=doc.getElementById('app');if(!root){root=doc.createElement('div');root.id='app';doc.body.append(root);}
    root.innerHTML='<div class="main-nav-bars-container sg-app"><nav class="horizontal-nav-bar sg-nav"><a class="logo-container sg-brand" href="#/board" aria-label="StreamGlass Home"></a><div class="sg-nav-links">'+[['board','Home'],['picks','For you'],['discover','Discover'],['library','Library'],['addons','Addons'],['settings','Settings']].map(([route,label])=>'<a class="nav-tab-button" data-nav="'+route+'" href="#/'+route+'">'+label+'</a>').join('')+'</div><a class="sg-nav-search" href="#/search" aria-label="Search"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg></a><button id="sg-account" data-action="account" class="sg-account-button">Sign in</button></nav><main id="sg-view" tabindex="-1">'+pendingText('Starting StreamGlass TV')+'</main></div>';
    if(host().mount)host().mount(root);
    view=doc.getElementById('sg-view');
    root.addEventListener('click',event=>{
      const link=event.target.closest('a[href]');
      if(link&&link.getAttribute('href').startsWith('#/detail/')&&parseHash(location.hash).route!=='detail')detailOrigin=searchSession?'#/search?search='+encodeURIComponent(searchSession.query):(location.hash||'#/board');
      const actionNode=event.target.closest('[data-action]');if(actionNode){event.preventDefault();Promise.resolve(action(actionNode.dataset.action,actionNode)).catch(()=>notify('The action could not complete. Please try again.'));return;}
      const episode=event.target.closest('[data-video]');if(episode&&currentDetail){streams(currentDetail,episode.dataset.video).catch(()=>notify('Could not load streams.'));if(host().showStreams)host().showStreams();return;}
      const stream=event.target.closest('[data-stream]');if(stream){play(Number(stream.dataset.stream));return;}
      const remove=event.target.closest('[data-remove-addon]');if(remove){const addon=installed()[Number(remove.dataset.removeAddon)];if(addon)core.dispatch(ctxAction('UninstallAddon',addon),'ctx').then(refreshProfile).then(addonPage).then(()=>notify('Addon removed.')).catch(()=>notify('Could not remove the addon.'));}
    });
    root.addEventListener('submit',event=>{
      event.preventDefault();const form=event.target;
      if(form.id==='sg-search-form'&&searchSession)runSearch(searchSession).catch(()=>notify('Search could not finish. Try again.'));
      if(form.id==='sg-login-form')login(form);
      if(form.id==='sg-addon-form')installAddon(form);
      if(form.id==='sg-prefs-form'){const prefs={...profile.settings,audioLanguage:form.elements.audioLanguage.value||null,subtitlesLanguage:form.elements.subtitlesLanguage.value==='none'?null:form.elements.subtitlesLanguage.value,subtitlesSize:Number(form.elements.subtitlesSize.value)};core.dispatch(ctxAction('UpdateSettings',prefs),'ctx').then(refreshProfile).then(()=>notify('Playback settings saved.')).catch(()=>notify('Settings could not be saved.'));}
    });
    root.addEventListener('input',event=>{
      if(event.target.id==='sg-search-input'&&searchSession){if(event.isComposing)searchSession.composing=true;queueSearch();}
      const form=event.target.closest('form');if(form)form.dataset.sgDirty='true';
    });
    root.addEventListener('compositionstart',event=>{
      if(event.target.id!=='sg-search-input'||!searchSession)return;
      searchSession.composing=true;clearTimeout(searchSession.timer);searchSession.revision++;
      if(searchSession.controller)searchSession.controller.abort();searchSession.requested=null;
    });
    root.addEventListener('compositionend',event=>{
      if(event.target.id!=='sg-search-input'||!searchSession)return;
      searchSession.composing=false;queueSearch();
    });
    root.addEventListener('change',event=>{
      if(event.target.id==='sg-search-input')queueSearch();
      const form=event.target.closest('form');if(form)form.dataset.sgDirty='true';
      if(event.target.id==='sg-catalog-picker')location.hash='#/discover?catalog='+event.target.value;
      if(event.target.id==='sg-genre-picker')location.hash='#/discover?catalog='+activeCatalog.index+'&genre='+encodeURIComponent(event.target.value);
      if(event.target.id==='sg-library-type'||event.target.id==='sg-library-sort')location.hash='#/library?type='+encodeURIComponent(doc.getElementById('sg-library-type').value)+'&sort='+doc.getElementById('sg-library-sort').value;
      if(event.target.id==='sg-season'&&currentDetail){doc.getElementById('sg-episode-list').innerHTML=episodeList(currentDetail.meta,event.target.value,currentDetail.videoId);}
    });
    root.addEventListener('error',event=>{
      const img=event.target;if(img.tagName!=='IMG')return;
      if(img.matches('.dx-hero-logo,.sg-detail-logo')){
        const title=doc.createElement('h1');title.className=img.matches('.dx-hero-logo')?'dx-hero-title':'';title.textContent=img.alt||'Untitled';img.replaceWith(title);
      }else if(img.closest('.sg-poster')){
        const label=doc.createElement('span');label.className='sg-poster-placeholder';label.textContent=img.closest('.sg-card').getAttribute('aria-label')||'No artwork';img.replaceWith(label);
      }else img.classList.add('sg-image-failed');
    },true);
    root.addEventListener('focusin',event=>{
      if(view.contains(event.target))view.sgLastFocus=event.target;
      const cardNode=event.target.closest('.sg-card');
      if(cardNode){
        const rowNode=cardNode.closest('.sg-row');
        if(rowNode){const items=[...rowNode.querySelectorAll('.sg-card')];const counter=rowNode.querySelector('.sg-row-count');if(counter)counter.textContent=(items.indexOf(cardNode)+1)+' / '+items.length;}
        previewCard(cardNode);
      }else{clearTimeout(previewTimer);++previewSequence;}
    });
    doc.addEventListener('keydown',()=>{interaction++;},true);
    doc.addEventListener('pointerdown',()=>{interaction++;},true);
    global.addEventListener('hashchange',render);
    await core.init({appVersion:'0.4.0',shellVersion:'webos25'});global.core=core;global.services={core};
    core.on('event', event => {
      if (!event) return;
      const addonsChanged=/^(AddonsPulledFromAPI|AddonInstalled|AddonUninstalled|AddonUpgraded|UserLoggedOut)$/.test(event.event||'');
      const libraryChanged=/^(LibraryItemsPulledFromAPI|UserLoggedOut)$/.test(event.event||'');
      if(!addonsChanged&&!libraryChanged&&event.event!=='UserPulledFromAPI')return;
      refreshAddons=refreshAddons||addonsChanged;refreshLibrary=refreshLibrary||libraryChanged;
      clearTimeout(refreshTimer);
      refreshTimer=setTimeout(async () => {
        const updateAddons=refreshAddons,updateLibrary=refreshLibrary;
        refreshAddons=false;refreshLibrary=false;
        try {
          await refreshProfile();
          const route=parseHash(location.hash).route;
          const affectsScreen=(updateAddons&&/^(board|picks|addons|discover|search)$/.test(route))||(updateLibrary&&/^(board|picks|library)$/.test(route));
          const active=doc.activeElement;
          const editing=active&&active.matches('input,textarea,select');
          // An API completion must never clear a typed search, addon URL or settings form.
          const formInProgress=!!root.querySelector('form[data-sg-dirty]');
          if(affectsScreen&&!activePlayback&&!pendingPlayback&&!editing&&!formInProgress&&!doc.querySelector('.sg-host-modal'))await render();
        } catch (_) { diagnostic('account_refresh_failed', {}); }
      },300);
    });
    await refreshProfile();
    if(profile.auth){core.dispatch(ctxAction('PullAddonsFromAPI'),'ctx').catch(()=>{});core.dispatch(ctxAction('SyncLibraryWithAPI'),'ctx').catch(()=>{});}
    await render();diagnostic('shell_ready',{signedIn:!!profile.auth});
  }
  global.StreamGlassShell={start,render,back,onProgress,onClose,helpers,get state(){return {route:parseHash(location.hash).route,signedIn:!!profile.auth,addonCount:installed().length,playing:!!activePlayback};}};
})(typeof window==='object'?window:null);
