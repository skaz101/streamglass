import React, {useEffect,useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Button} from './components/ui/button';
import {catalogRank,catalogTitle,dateKey,monthDays,releases} from './calendar.mjs';
import './theme.css';
import {Screens} from './screens';
import Hero from './components/Hero';
import PullRefresh from './components/PullRefresh';
import useRefresh from './hooks/useRefresh';
import {readHomeMode} from './preferences.mjs';
import {getCuratedRows,loadCuratedRows,resolveCuratedMeta,CURATED_SOURCE_NOTE} from './curated.mjs';

const roots=new Map();
const regions=new Map();
function Empty({title,children}){return <div className="sg-react-empty"><h2>{title}</h2><p>{children}</p></div>;}
function Loading({title='Loading your titles',hero=false}){return <div className={`sg-react-loading${hero?' sg-hero-loading':''}`} role="status"><p>{title}</p><div className="sg-skeleton-row" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i}/>)}</div></div>;}
function Artwork({src,className='',alt='',fallback=null}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return src&&!failed?<img data-react-art="true" className={className} src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={event=>{event.stopPropagation();setFailed(true);}}/>:fallback;
}
function Card({meta,api,wide=false,recommendations=false,rank}){
  const id=meta.id||meta._id,type=meta.type||'movie';
  const progress=api.progressFraction(meta.progress);
  useEffect(()=>{api.registerCard(meta);},[api,meta]);
  return <a className={`sg-card meta-item-container${wide?' sg-card-wide':''}${recommendations?' sg-recommendation':''}${rank?' sg-card-ranked':''}`} href={api.detailHash(type,id,meta.state?.videoId)} data-card={`${type}:${id}`} aria-label={meta.name||id}>
    {rank?<span className="sg-card-rank" aria-hidden="true">{rank}</span>:null}<div className="sg-poster poster-container"><Artwork src={api.safeURL(wide?(meta.background||meta.poster):meta.poster)} fallback={<span className="sg-poster-placeholder">{meta.name}</span>}/>
      {meta.imdbRating?<span className="sg-rating"><b>IMDb</b> {meta.imdbRating}</span>:null}{meta.watched?<span className="sg-watched">✓</span>:null}{progress>0?<span className="sg-progress"><i style={{width:Math.round(progress*100)+'%'}}/></span>:null}</div>
    <span className="sg-card-title title-label">{meta.name||id}</span><span className="sg-card-caption">{recommendations?meta.recommendationReason:meta.releaseInfo||meta.year||(type==='series'?'Series':'Movie')}</span>
  </a>;
}
function Row({title,description,items,api,index,wide=false,recommendations=false,ranked=false}){
  title=title.replace(/\s·\s(movie|series|anime)$/i,(suffix,type)=>{
    const base=title.slice(0,-suffix.length),label=type.toLowerCase()==='movie'?'Movies':type.toLowerCase()==='series'?'Series':'Anime';
    return base.toLowerCase().endsWith(label.toLowerCase())?'':' · '+label;
  });
  return <section className={`sg-row meta-row-container${ranked?' sg-ranked-row':''}`} data-row-key={Number.isInteger(index)?'catalog:'+index:title}><div className="sg-row-heading"><h2>{title}</h2><span className="sg-row-count"/>{Number.isInteger(index)?<a className="sg-see-all" href={'#/discover?catalog='+index}>See All <span>›</span></a>:null}</div>{description?<p className="sg-curated-note">{description}</p>:null}<div className="sg-cards meta-items-container">{(ranked?items.slice(0,10):items).map((meta,position)=><Card rank={ranked?position+1:undefined} key={`${meta.type}:${meta.id||meta._id}`} meta={meta} api={api} wide={wide} recommendations={recommendations}/>)}</div></section>;
}
function Home({api,params,onReady}){
  const filter=params.get('type')||'',mode=readHomeMode();
  const {revision,refresh,finish}=useRefresh();
  const [state,setState]=useState({loading:true,rows:[],continuing:[]});
  useEffect(()=>{
    let alive=true;const controller=new AbortController();
    const descriptors=mode==='curated'?getCuratedRows({type:filter}):api.catalogs().map((entry,index)=>({...entry,index})).filter(entry=>!filter||entry.catalog.type===filter).sort((a,b)=>catalogRank(a)-catalogRank(b));
    setState(value=>({...value,loading:true,rows:revision?value.rows:descriptors.map(entry=>({entry,loading:true,items:[]}))}));
    const continuing=api.continueWatching().then(items=>{if(alive)setState(value=>({...value,continuing:items.filter(item=>!filter||item.type===filter)}));}).catch(()=>{});
    let work,successfulRows=0;
    if(mode==='curated'){
      work=loadCuratedRows({type:filter,signal:controller.signal,refresh:revision>0,onRow:(row,index)=>{
        if(!alive)return;
        if(!row.error)successfulRows++;
        setState(value=>{const rows=[...value.rows];rows[index]={entry:descriptors[index],items:row.items,loading:false,error:row.error};return {...value,rows};});
      }});
    }else{
      let next=0;
      work=Promise.all(Array.from({length:Math.min(4,descriptors.length)},async()=>{
        while(alive&&next<descriptors.length){
          const position=next++,entry=descriptors[position];let row;
          try{const data=await api.catalog(entry,{},controller.signal,revision>0);row={entry,items:(data.metas||[]).filter(meta=>meta?.id).slice(0,24).map(meta=>({...meta,type:meta.type||entry.catalog.type}))};}
          catch(_){row={entry,items:[],error:'This catalog could not load.'};}
          if(!row.error)successfulRows++;
          if(alive)setState(value=>{const rows=[...value.rows];rows[position]=row;return {...value,rows};});
        }
      }));
    }
    Promise.all([work,continuing]).catch(()=>{}).finally(()=>{if(alive){setState(value=>({...value,loading:false}));finish(!descriptors.length||successfulRows>0);}});
    return()=>{alive=false;controller.abort();};
  },[api,filter,mode,revision]);
  useLayoutEffect(()=>{onReady?.();},[state,onReady]);
  // Stable first rows drive the billboard, even when lower collections finish first.
  const leads=mode==='curated'&&!filter?state.rows.slice(0,2):state.rows.slice(0,1);
  const readyLeads=leads.filter(row=>row.items.length);
  const topFeatures=Array.from({length:8},(_,index)=>readyLeads[index%readyLeads.length]?.items[Math.floor(index/readyLeads.length)]).filter(Boolean);
  const featured=mode==='curated'?(leads.some(row=>row.loading)?[]:topFeatures.length?topFeatures:state.rows.find(row=>row.items.length)?.items.slice(0,8)||[]):state.rows.find(row=>row.loading||row.items.length)?.items.slice(0,8)||[];
  const title=entry=>mode==='curated'?entry.title:catalogTitle(entry);
  const topRows=mode==='curated'?state.rows.filter(row=>row.entry.key.startsWith('top-')):[];
  const otherRows=mode==='curated'?state.rows.filter(row=>!row.entry.key.startsWith('top-')):state.rows;
  const renderRow=({entry,items,loading,error})=><div className="sg-catalog-slot" key={entry.key}>{loading?<Loading title={title(entry)}/>:items.length?<Row ranked={mode==='curated'&&entry.key.startsWith('top-')} title={title(entry)} description={mode==='curated'&&entry.key.startsWith('season-')?entry.description:null} items={items} index={mode==='addons'?entry.index:undefined} api={api}/>:<section className="sg-row sg-curated-empty"><h2>{title(entry)}</h2><p>{error?'This collection is temporarily unavailable.':"No titles are available in this collection yet."}</p></section>}</div>;
  return <div className="sg-home board-content"><PullRefresh mobile={api.mobile} onRefresh={refresh}/><div className="sg-home-filters" aria-label="Browse titles">{[['','All'],['movie','Movies'],['series','Series']].map(([value,label])=><a key={value} className={'sg-filter'+(filter===value?' selected':'')} aria-current={filter===value?'page':undefined} href={'#/board'+(value?'?type='+value:'')}>{label}</a>)}<a className="sg-filter sg-calendar-link" href="#/calendar" aria-label="Release calendar">Calendar</a></div>
    {featured.length?<Hero items={featured} api={api}/>:state.loading?<Loading hero title="Setting the scene"/>:<Empty title={mode==='curated'?'Your Home couldn’t load':'Your home starts here'}>{mode==='curated'?(api.mobile?'Check your connection and pull down to try again.':'Check your connection and choose Refresh to try again.'):<>Sign in or manage your <a href="#/addons">addons</a> to find something to watch.</>}</Empty>}

    <div id="sg-home-rows" className="sg-home-rows">{topRows.map(renderRow)}{state.continuing.length?<Row title="Continue Watching" items={state.continuing} api={api} wide/>:null}{otherRows.map(renderRow)}</div><div className="sg-home-toolbar"><a className="sg-curated-note" href="#/settings">{mode==='curated'?'Curated for your next watch':'Your addon catalogs'} <span aria-hidden="true">⌄</span></a>{!api.mobile?<Button onClick={refresh} disabled={state.loading}>Refresh</Button>:<button className="sg-refresh-accessible" onClick={refresh} disabled={state.loading}>Refresh Home</button>}</div>{mode==='curated'?<p className="sg-curated-note sg-curated-attribution">{CURATED_SOURCE_NOTE}</p>:null}</div>;
}
function Calendar({api}){
  const today=dateKey(new Date().toISOString());
  const [month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState(null);
  const refreshState=useRefresh();
  const [state,setState]=useState({loading:true,events:[],missing:0,count:0,done:0});
  useEffect(()=>{
    let alive=true,refreshOK=true;const controller=new AbortController();
    setState(value=>refreshState.revision?{...value,loading:true,done:0,error:false,partial:false}:{loading:true,events:[],missing:0,count:0,done:0});
    const deadline=setTimeout(()=>controller.abort(),45000);
    api.calendarLibrary().then(async library=>{
      const items=(library.catalog||[]).filter(item=>!item.removed);let next=0,done=0,missing=0;const events=[];
      if(alive)setState(value=>({...value,count:items.length}));
      await Promise.all(Array.from({length:Math.min(4,items.length)},async()=>{
        while(alive&&!controller.signal.aborted&&next<items.length){
          const item=items[next++];let meta=item;
          try{meta=await api.calendarMeta(item,controller.signal,refreshState.revision>0);}catch(_){}
          const dated=releases(meta);if(!dated.length)missing++;events.push(...dated);done++;
          if(alive&&(!refreshState.revision||done===items.length))setState({loading:done<items.length,events:[...events].sort((a,b)=>a.day.localeCompare(b.day)||a.name.localeCompare(b.name)),missing,count:items.length,done,limited:!!library.selectable?.nextPage});
        }
      }));
      if(alive)setState(value=>({...value,events:[...events].sort((a,b)=>a.day.localeCompare(b.day)||a.name.localeCompare(b.name)),missing,count:items.length,done,limited:!!library.selectable?.nextPage,loading:false,partial:controller.signal.aborted}));
    }).catch(()=>{refreshOK=false;if(alive)setState(value=>({...value,loading:false,error:true}));}).finally(()=>{clearTimeout(deadline);if(alive)refreshState.finish(refreshOK&&!controller.signal.aborted);});
    return()=>{alive=false;clearTimeout(deadline);controller.abort();};
  },[api,refreshState.revision]);
  const events=state.events.filter(item=>day?item.day===day:item.day.startsWith(month));
  const counts=new Map();state.events.forEach(item=>counts.set(item.day,(counts.get(item.day)||0)+1));
  const date=new Date(month+'-01T12:00:00');
  const changeMonth=delta=>{const next=new Date(date.getFullYear(),date.getMonth()+delta,1,12);setMonth(next.getFullYear()+'-'+String(next.getMonth()+1).padStart(2,'0'));setDay(null);};
  return <section className="sg-page sg-calendar"><PullRefresh mobile={api.mobile} onRefresh={refreshState.refresh}/><header className="sg-calendar-header"><div><h1>Your release calendar</h1><p>New episodes and movies from your saved titles. Something to look forward to.</p></div>{!api.mobile?<Button onClick={refreshState.refresh} disabled={state.loading}>Refresh</Button>:<button className="sg-refresh-accessible" onClick={refreshState.refresh} disabled={state.loading}>Refresh calendar</button>}</header>
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
  resolveCuratedMeta,
  mount(node,props){const {route,api,params}=props;const root=createRoot(node);roots.set(node,root);flushSync(()=>root.render(<Boundary>{route==='calendar'?<Calendar api={api}/>:route==='board'?<Home api={api} params={params} onReady={props.onReady}/>:<><PullRefresh mobile={api.mobile&&['picks','library','discover','search'].includes(route)} onRefresh={()=>api.refresh?.()}/><Screens {...props}/></>}</Boundary>));},
  region(node,{items=[],rows,api,append=false}){
    let state=regions.get(node);if(!state){state={root:createRoot(node),items:[]};regions.set(node,state);}
    state.items=append?[...state.items,...items]:items;
    flushSync(()=>state.root.render(rows?<>{rows.map((row,index)=><Row key={index} {...row} api={api}/>)}</>:<>{state.items.map(meta=><Card key={`${meta.type}:${meta.id||meta._id}`} meta={meta} api={api}/>)}</>));
  },
  clear(node){for(const [element,state] of regions){if(element===node||node.contains(element)){flushSync(()=>state.root.unmount());regions.delete(element);}}},
  unmount(node){this.clear(node);const root=roots.get(node);if(root){flushSync(()=>root.unmount());roots.delete(node);}}
};
