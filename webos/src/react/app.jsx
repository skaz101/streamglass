import React, {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Button} from './components/ui/button';
import {catalogRank,catalogTitle,dateKey,monthDays,releases} from './calendar.mjs';
import './theme.css';
import {Screens} from './screens';

const roots=new Map();
const regions=new Map();
function Empty({title,children}){return <div className="sg-react-empty"><h2>{title}</h2><p>{children}</p></div>;}
function Loading({title='Loading your titles'}){return <div className="sg-react-loading" role="status"><p>{title}</p><div className="sg-skeleton-row" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i}/>)}</div></div>;}
function Artwork({src,className='',alt='',fallback=null}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return src&&!failed?<img data-react-art="true" className={className} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event=>{event.stopPropagation();setFailed(true);}}/>:fallback;
}
function Card({meta,api,wide=false,recommendations=false}){
  const id=meta.id||meta._id,type=meta.type||'movie';
  const progress=api.progressFraction(meta.progress);
  useEffect(()=>{api.registerCard(meta);},[api,meta]);
  return <a className={`sg-card meta-item-container${wide?' sg-card-wide':''}${recommendations?' sg-recommendation':''}`} href={api.detailHash(type,id,meta.state?.videoId)} data-card={`${type}:${id}`} aria-label={meta.name||id}>
    <div className="sg-poster poster-container"><Artwork src={api.safeURL(wide?(meta.background||meta.poster):meta.poster)} fallback={<span className="sg-poster-placeholder">{meta.name}</span>}/>
      {meta.imdbRating?<span className="sg-rating"><b>IMDb</b> {meta.imdbRating}</span>:null}{meta.watched?<span className="sg-watched">✓</span>:null}{progress>0?<span className="sg-progress"><i style={{width:Math.round(progress*100)+'%'}}/></span>:null}</div>
    <span className="sg-card-title title-label">{meta.name||id}</span><span className="sg-card-caption">{recommendations?meta.recommendationReason:meta.releaseInfo||meta.year||(type==='series'?'Series':'Movie')}</span>
  </a>;
}
function Row({title,items,api,index,wide=false,recommendations=false}){
  title=title.replace(/\s·\s(movie|series|anime)$/i,(suffix,type)=>{
    const base=title.slice(0,-suffix.length),label=type.toLowerCase()==='movie'?'Movies':type.toLowerCase()==='series'?'Series':'Anime';
    return base.toLowerCase().endsWith(label.toLowerCase())?'':' · '+label;
  });
  return <section className="sg-row meta-row-container" data-row-key={Number.isInteger(index)?'catalog:'+index:title}><div className="sg-row-heading"><h2>{title}</h2><span className="sg-row-count"/>{Number.isInteger(index)?<a className="sg-see-all" href={'#/discover?catalog='+index}>See All <span>›</span></a>:null}</div><div className="sg-cards meta-items-container">{items.map(meta=><Card key={`${meta.type}:${meta.id||meta._id}`} meta={meta} api={api} wide={wide} recommendations={recommendations}/>)}</div></section>;
}
function HeroArt({src}){
  const [frames,setFrames]=useState({current:'',previous:''});
  useEffect(()=>{
    let alive=true,timer;const image=new Image();image.referrerPolicy='no-referrer';
    image.onload=()=>{if(!alive)return;setFrames(current=>({current:src,previous:current.current}));timer=setTimeout(()=>{if(alive)setFrames(current=>({...current,previous:''}));},650);};
    image.onerror=()=>{if(alive)setFrames({current:'',previous:''});};
    if(src)image.src=src;else setFrames({current:'',previous:''});
    return()=>{alive=false;image.onload=null;image.onerror=null;clearTimeout(timer);};
  },[src]);
  return <>{frames.previous?<img data-react-art="true" className="sg-react-hero-art sg-react-hero-outgoing" src={frames.previous} alt="" referrerPolicy="no-referrer"/>:null}{frames.current?<img data-react-art="true" key={frames.current} className="sg-react-hero-art" src={frames.current} alt="" referrerPolicy="no-referrer"/>:null}</>;
}
function Hero({items,api}){
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[full,setFull]=useState(null),[preview,setPreview]=useState(null);
  const container=useRef(null),hover=useRef(false);
  const item=preview||items[index%Math.max(1,items.length)];
  useEffect(()=>{const listener=event=>setPreview(event.detail);window.addEventListener('streamglass:preview',listener);return()=>window.removeEventListener('streamglass:preview',listener);},[]);
  useEffect(()=>{
    let alive=true;setFull(null);
    if(item)api.resolveMeta(item.type,item.id,item).then(result=>{if(alive)setFull(result.meta);}).catch(()=>{});
    return()=>{alive=false;};
  },[item?.id,item?.type,api]);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const timer=setInterval(()=>{
      const active=document.activeElement;
      if(paused||preview||media.matches||document.hidden||hover.current||container.current?.contains(active)||active?.closest('.sg-card')||document.getElementById('sg-view').scrollTop>100)return;
      setIndex(value=>(value+1)%items.length);
    },8000);
    return()=>clearInterval(timer);
  },[items.length,paused,preview]);
  if(!item)return null;
  const meta=full?.id===item.id&&full?.type===item.type?full:item,href=api.detailHash(meta.type,meta.id),picture=api.safeURL(meta.background||meta.poster),logo=api.safeURL(meta.logo);
  const move=delta=>{setPreview(null);setIndex(value=>(value+delta+items.length)%items.length);};
  return <section id="sg-hero-slot" className="sg-react-hero sg-hero" aria-label="Featured titles" aria-roledescription="carousel" ref={container} onMouseEnter={()=>{hover.current=true;}} onMouseLeave={()=>{hover.current=false;}}>
    <HeroArt src={picture}/>
    <div key={item.id} className="sg-react-hero-copy"><span>{meta.type==='series'?'Series':'Movie'}</span>{logo?<Artwork className="sg-react-hero-logo" src={logo} alt={meta.name} fallback={<h1>{meta.name}</h1>}/>:<h1>{meta.name}</h1>}
      <p>{(meta.genres||[]).slice(0,3).join(' · ')}{meta.imdbRating?' · IMDb '+meta.imdbRating:''}</p><p className="sg-hero-synopsis">{meta.description||'Find your next watch in your installed catalogs.'}</p>
      <div className="sg-react-hero-actions sg-mobile-hero-actions"><a className="sg-button sg-primary" href={href+(api.mobile?'?play=1':'')}>▶ {api.mobile?'Play':'Watch now'}</a><a className="sg-button" href={href}>More info</a></div></div>
    {items.length>1?<div className="sg-carousel-controls"><button type="button" aria-label="Previous featured title" onClick={()=>move(-1)}>‹</button><span aria-live="off">{index+1} / {items.length}</span><button type="button" aria-label="Next featured title" onClick={()=>move(1)}>›</button><button type="button" aria-label={paused?'Resume featured slideshow':'Pause featured slideshow'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'▶':'Ⅱ'}</button></div>:null}
  </section>;
}
function Home({api,params,onReady}){
  const filter=params.get('type')||'';
  const [state,setState]=useState({loading:true,rows:[],continuing:[]});
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    const entries=api.catalogs().map((entry,index)=>({...entry,index})).filter(entry=>!filter||entry.catalog.type===filter).sort((a,b)=>catalogRank(a)-catalogRank(b));
    const rows=entries.map(entry=>({entry,loading:true,items:[]}));let next=0;
    setState({loading:false,rows:[...rows],continuing:[]});
    api.continueWatching().then(items=>{if(alive)setState(value=>({...value,continuing:items.filter(item=>!filter||item.type===filter)}));});
    Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
      while(alive&&next<entries.length){
        const position=next++,entry=entries[position];
        try{const data=await api.catalog(entry,{},controller.signal);rows[position]={entry,items:(data.metas||[]).filter(meta=>meta?.id).slice(0,24).map(meta=>({...meta,type:meta.type||entry.catalog.type}))};}
        catch(_){rows[position]={entry,items:[],error:true};}
        if(alive)setState(value=>({...value,rows:[...rows]}));
      }
    }));
    return()=>{alive=false;controller.abort();};
  },[api,filter]);
  useLayoutEffect(()=>{onReady?.();},[state,onReady]);
  const featured=state.rows.find(row=>row.loading||row.items.length)?.items.slice(0,8)||[];
  return <div className="sg-home board-content"><div className="sg-home-filters" aria-label="Browse titles">{[['','All'],['movie','Movies'],['series','Series']].map(([value,label])=><a key={value} className={'sg-filter'+(filter===value?' selected':'')} aria-current={filter===value?'page':undefined} href={'#/board'+(value?'?type='+value:'')}>{label}</a>)}<a className="sg-filter sg-calendar-link" href="#/calendar">Release calendar</a></div>
    {featured.length?<Hero items={featured} api={api}/>:state.rows.some(row=>row.loading)||state.loading?<Loading title="Loading your catalogues"/>:<Empty title={state.rows.length?'No titles loaded':'Your home starts here'}>Sign in or manage your <a href="#/addons">addons</a> to find something to watch.</Empty>}
    <div id="sg-home-rows" className="sg-home-rows">{state.continuing.length?<Row title="Continue Watching" items={state.continuing} api={api} wide/>:null}{state.rows.map(({entry,items,loading,error})=><div className="sg-catalog-slot" key={entry.key}>{loading?<Loading title={catalogTitle(entry)}/>:error?<Empty title={catalogTitle(entry)}>This catalog could not load. <button className="sg-button" data-action="refresh">Retry</button></Empty>:items.length?<Row title={catalogTitle(entry)} items={items} index={entry.index} api={api}/>:null}</div>)}</div></div>;
}
function Calendar({api}){
  const today=dateKey(new Date().toISOString());
  const [month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState(null),[version,setVersion]=useState(0);
  const [state,setState]=useState({loading:true,events:[],missing:0,count:0,done:0});
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    setState({loading:true,events:[],missing:0,count:0,done:0});
    const deadline=setTimeout(()=>controller.abort(),45000);
    api.calendarLibrary().then(async library=>{
      const items=(library.catalog||[]).filter(item=>!item.removed);let next=0,done=0,missing=0;const events=[];
      if(alive)setState(value=>({...value,count:items.length}));
      await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
        while(alive&&!controller.signal.aborted&&next<items.length){
          const item=items[next++];let meta=item;
          try{meta=await api.calendarMeta(item,controller.signal,version>0);}catch(_){}
          const dated=releases(meta);if(!dated.length)missing++;events.push(...dated);done++;
          if(alive)setState({loading:done<items.length,events:[...events].sort((a,b)=>a.day.localeCompare(b.day)||a.name.localeCompare(b.name)),missing,count:items.length,done,limited:!!library.selectable?.nextPage});
        }
      }));
      if(alive)setState(value=>({...value,loading:false,partial:controller.signal.aborted}));
    }).catch(()=>{if(alive)setState(value=>({...value,loading:false,error:true}));}).finally(()=>clearTimeout(deadline));
    return()=>{alive=false;clearTimeout(deadline);controller.abort();};
  },[api,version]);
  const events=state.events.filter(item=>day?item.day===day:item.day.startsWith(month));
  const counts=new Map();state.events.forEach(item=>counts.set(item.day,(counts.get(item.day)||0)+1));
  const date=new Date(month+'-01T12:00:00');
  const changeMonth=delta=>{const next=new Date(date.getFullYear(),date.getMonth()+delta,1,12);setMonth(next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0'));setDay(null);};
  return <section className="sg-page sg-calendar"><header className="sg-calendar-header"><div><h1>Your release calendar</h1><p>New episodes and movies from your saved titles. Something to look forward to.</p></div><Button onClick={()=>setVersion(value=>value+1)} disabled={state.loading}>Refresh</Button></header>
    <p className="sg-calendar-note" role="status">{state.loading?`Checking release dates · ${state.done} of ${state.count} titles`:state.error?'Your library could not load. Refresh to try again.':`${state.events.length} dated releases from ${state.count} saved titles.`}{state.partial?` Checked ${state.done} of ${state.count} titles. Some addons took too long; refresh to try again.`:''}{state.missing?` Dates unavailable for ${state.missing} titles.`:''}{state.limited?' Showing your latest 500 library entries.':''}</p>
    <div className="sg-calendar-layout"><div className="sg-calendar-month"><div className="sg-calendar-toolbar"><Button aria-label="Previous month" onClick={()=>changeMonth(-1)}>‹</Button><h2>{date.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><Button aria-label="Next month" onClick={()=>changeMonth(1)}>›</Button></div><div className="sg-calendar-week" aria-hidden="true">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(label=><span key={label}>{label}</span>)}</div><div className="sg-calendar-grid" role="group" aria-label="Release dates">{monthDays(month).map((value,index)=>value?<button type="button" key={value} aria-pressed={day===value} data-today={value===today} aria-label={`${new Date(value+'T12:00:00').toLocaleDateString(undefined,{dateStyle:'long'})}, ${counts.get(value)||0} releases`} onClick={()=>setDay(current=>current===value?null:value)}>{Number(value.slice(-2))}{counts.has(value)?<i/>:null}</button>:<span key={'blank'+index}/>)}</div><div className="sg-calendar-toolbar"><Button onClick={()=>{setMonth(today.slice(0,7));setDay(today);}}>Today</Button><Button onClick={()=>setDay(null)}>Whole month</Button></div><p className="sg-calendar-note">Dates come from your addons and may change. Times use your device’s time zone.</p></div>
    <div className="sg-calendar-agenda" aria-busy={state.loading}>{!events.length?<Empty title={state.loading?'Finding release dates':state.count?'No releases scheduled here':'Your calendar starts with your list'}>{state.loading?'Dates will appear as your addons respond.':state.count?'Try another day or month. Some addons don’t provide release dates.':<>Save a movie or series to <a href="#/library">My List</a> to follow its releases.</>}</Empty>:events.map((event,index)=><React.Fragment key={event.key}>{index===0||events[index-1].day!==event.day?<h3 className="sg-calendar-day">{new Date(event.day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h3>:null}<a className="sg-release-item" href={api.detailHash(event.type,event.id,event.videoId)}><Artwork src={api.safeURL(event.poster)}/><span><b>{event.name}</b><small>{event.episode}</small></span></a></React.Fragment>)}</div></div>
  </section>;
}
class Boundary extends React.Component{
  state={error:false};static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<Empty title="This screen could not load"><button className="sg-button" data-action="refresh">Try again</button></Empty>:this.props.children;}
}
window.StreamGlassUI={
  mount(node,props){const {route,api,params}=props;const root=createRoot(node);roots.set(node,root);flushSync(()=>root.render(<Boundary>{route==='calendar'?<Calendar api={api}/>:route==='board'?<Home api={api} params={params} onReady={props.onReady}/>:<Screens {...props}/>}</Boundary>));},
  region(node,{items=[],rows,api,append=false}){
    let state=regions.get(node);if(!state){state={root:createRoot(node),items:[]};regions.set(node,state);}
    state.items=append?[...state.items,...items]:items;
    flushSync(()=>state.root.render(rows?<>{rows.map((row,index)=><Row key={index} {...row} api={api}/>)}</>:<>{state.items.map(meta=><Card key={`${meta.type}:${meta.id||meta._id}`} meta={meta} api={api}/>)}</>));
  },
  clear(node){for(const [element,state] of regions){if(element===node||node.contains(element)){flushSync(()=>state.root.unmount());regions.delete(element);}}},
  unmount(node){this.clear(node);const root=roots.get(node);if(root){flushSync(()=>root.unmount());roots.delete(node);}}
};
