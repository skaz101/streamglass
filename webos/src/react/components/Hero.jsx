/* StreamGlass featured carousel. GPL-3.0-or-later. */
import React,{useEffect,useRef,useState} from 'react';
import {useMyList} from '../hooks/useMyList';
import './hero.css';

const DURATION=8000;
const identity=item=>item?`${item.type||'movie'}:${item.id||item._id}`:'';
// Keep artwork and its title together: a slow image must not leave the previous
// film behind the next film's copy and Play action.
function useScene(meta,src,logo){
  const signature=identity(meta)+'|'+(src||'')+'|'+(logo||''),latest=useRef({meta,signature});
  latest.current={meta,signature};
  const [scene,setScene]=useState(()=>({signature:src||logo?'':signature,meta,src:'',previous:'',logoReady:false}));
  const [prepared,setPrepared]=useState(null);
  useEffect(()=>{
    let alive=true,logoTimer,logoDecoded=false;const images=[];
    const decode=source=>{
      if(!source)return Promise.resolve(false);
      return new Promise(resolve=>{
        const image=new Image();images.push(image);image.referrerPolicy='no-referrer';
        image.onload=async()=>{try{await image.decode();}catch(_){}resolve(image.naturalWidth>0);};
        image.onerror=()=>resolve(false);image.src=source;
      });
    };
    const logoResult=decode(logo).then(ready=>{
      logoDecoded=ready;
      if(alive&&latest.current.signature===signature)setPrepared(current=>current?.signature===signature?{...current,logoReady:ready}:current);
      return ready;
    });
    // A missing/slow branding asset must not hold a decoded film or its Play
    // action hostage. If it arrives later, it fades over the readable heading.
    const logoBudget=logo?Promise.race([logoResult,new Promise(resolve=>{logoTimer=setTimeout(()=>resolve(false),240);})]):Promise.resolve(false);
    Promise.all([decode(src),logoBudget]).then(([artReady,logoReady])=>{
      clearTimeout(logoTimer);
      if(!alive||latest.current.signature!==signature)return;
      setPrepared({signature,meta:latest.current.meta,src:artReady?src:'',logoReady:logoReady||logoDecoded});
    });
    return()=>{alive=false;clearTimeout(logoTimer);images.forEach(image=>{image.onload=null;image.onerror=null;});};
  },[signature]);
  useEffect(()=>{
    if(!prepared||prepared.signature!==signature||scene.signature===prepared.signature||scene.previous)return;
    setScene(current=>({...prepared,previous:prepared.src&&current.src!==prepared.src?current.src:''}));
  },[prepared,signature,scene.signature,scene.previous]);
  const settle=picture=>setScene(current=>current.src===picture&&current.previous?{...current,previous:''}:current);
  useEffect(()=>{
    if(!scene.previous)return;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const finish=()=>{if(media.matches)settle(scene.src);};finish();media.addEventListener('change',finish);
    return()=>media.removeEventListener('change',finish);
  },[scene.src,scene.previous]);
  return {meta:scene.signature===signature?meta:scene.meta,frames:{current:scene.src,previous:scene.previous},logoReady:prepared?.signature===scene.signature?prepared.logoReady:scene.logoReady,pending:scene.signature!==signature,settle};
}
// The compositor draws the countdown. JS wakes only on interaction, once per
// second for its accessible value, and at the next slide—not on every frame.
function useCarouselClock({root,timerFill,timeline,clock,wake,hover,gesture,paused,pending,preview,selected,count,sceneKey,advance}){
  const advanceRef=useRef(advance);advanceRef.current=advance;
  useEffect(()=>{
    const node=root.current,fill=timerFill.current,bar=timeline.current;
    if(!node||!fill)return;
    const scroller=node.closest('#sg-view'),media=matchMedia('(prefers-reduced-motion: reduce)');
    if(clock.current.key!==sceneKey)clock.current={key:sceneKey,elapsed:0};
    let started=0,playing=false,animation,deadline,announcement,inView=true,alive=true;
    const elapsed=()=>Math.min(DURATION,clock.current.elapsed+(playing?performance.now()-started:0));
    const describe=()=>{const value=elapsed();bar?.setAttribute('aria-valuenow',String(Math.round(value/DURATION*100)));bar?.setAttribute('aria-valuetext',`${Math.ceil(Math.max(0,DURATION-value)/1000)} seconds remaining`);};
    const stop=()=>{
      clock.current.elapsed=elapsed();playing=false;
      clearTimeout(deadline);clearInterval(announcement);animation?.cancel();animation=null;
      fill.style.transform=`scaleX(${clock.current.elapsed/DURATION})`;
      describe();
    };
    const update=()=>{
      if(!alive)return;
      const active=document.activeElement;
      const blocked=paused||pending||preview||media.matches||document.hidden||!inView||node.closest('[hidden]')||hover.current||gesture.current||node.contains(active)||active?.closest('.sg-card')||(scroller?.scrollTop||0)>100||count<2;
      node.dataset.slideshow=blocked?'paused':'playing';
      if(blocked){if(playing)stop();return;}
      if(playing)return;
      playing=true;started=performance.now();
      const remaining=Math.max(0,DURATION-clock.current.elapsed);
      animation=fill.animate([{transform:`scaleX(${clock.current.elapsed/DURATION})`},{transform:'scaleX(1)'}],{duration:remaining,easing:'linear',fill:'forwards'});
      describe();announcement=setInterval(describe,1000);
      deadline=setTimeout(()=>{stop();clock.current.elapsed=0;advanceRef.current();},remaining);
    };
    const focusOut=()=>queueMicrotask(update);
    const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{inView=entries[0].intersectionRatio>.35;update();},{root:scroller,threshold:[0,.35]}):null;
    observer?.observe(node);
    document.addEventListener('visibilitychange',update);
    document.addEventListener('focusin',update);document.addEventListener('focusout',focusOut);
    scroller?.addEventListener('scroll',update,{passive:true});
    window.addEventListener('streamglass:screenchange',update);media.addEventListener('change',update);
    wake.current=update;fill.style.transform=`scaleX(${clock.current.elapsed/DURATION})`;describe();update();
    return()=>{
      alive=false;stop();observer?.disconnect();wake.current=null;
      document.removeEventListener('visibilitychange',update);
      document.removeEventListener('focusin',update);document.removeEventListener('focusout',focusOut);
      scroller?.removeEventListener('scroll',update);window.removeEventListener('streamglass:screenchange',update);media.removeEventListener('change',update);
    };
  },[sceneKey,selected,count,paused,pending,!!preview]);
}
// A TV may decode an off-DOM Image without uploading its pixels for painting.
// Keep one next image paintable at near-zero opacity, never an entire catalog.
function useTVPrewarming(mobile){
  const [allowed,setAllowed]=useState(false);
  useEffect(()=>{
    if(mobile){setAllowed(false);return;}
    const preferences=[matchMedia('(prefers-reduced-motion: reduce)'),matchMedia('(prefers-reduced-transparency: reduce)')];
    const update=()=>setAllowed(!preferences.some(preference=>preference.matches));update();
    preferences.forEach(preference=>preference.addEventListener('change',update));
    return()=>preferences.forEach(preference=>preference.removeEventListener('change',update));
  },[mobile]);
  return !mobile&&allowed;
}
function Artwork({frames,ambient=false,onSettled,warm=''}){
  const className=ambient?'sg-ambient-art':'sg-react-hero-art';
  const warming=frames.current&&!frames.previous&&warm!==frames.current?warm:'';
  // URL keys preserve the prepared DOM/texture when warming becomes incoming.
  // During a fade only previous+current remain; otherwise current+next remain.
  return [frames.previous,frames.current,warming].filter(Boolean).map(src=>{
    const role=src===frames.current?'entering':src===warming?'warming':'leaving';
    return <img key={src} data-react-art="true" className={`${className} sg-hero-art-${role}`} src={src} alt="" aria-hidden="true" referrerPolicy="no-referrer" onAnimationEnd={event=>{if(src===frames.current&&event.animationName==='sg-premium-art-in')onSettled?.(src);}}/>;
  });
}
function Icon({name}){
  const paths={play:<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>,plus:<path d="M12 4v16M4 12h16"/>,check:<path d="m5 12 4 4L19 6"/>,pause:<path d="M9 5v14M16 5v14"/>,previous:<path d="m15 5-7 7 7 7"/>,next:<path d="m9 5 7 7-7 7"/>,info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>};
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Logo({src,name,ready}){
  return <div className={'sg-hero-title'+(src&&ready?' sg-hero-title-ready':'')}><h1>{name}</h1>{src&&ready?<img data-react-art="true" className="sg-react-hero-logo" src={src} alt="" aria-hidden="true" referrerPolicy="no-referrer"/>:null}</div>;
}

export default function Hero({items,api}){
  const [selectedKey,setSelectedKey]=useState(()=>identity(items[0])),[paused,setPaused]=useState(false),[preview,setPreview]=useState(null),[full,setFull]=useState(null);
  const list=useMyList(api),prewarm=useTVPrewarming(api.mobile);
  const [settledArtwork,setSettledArtwork]=useState('');
  const root=useRef(null),clock=useRef({key:'',elapsed:0}),timerFill=useRef(null),timeline=useRef(null),wake=useRef(null),gesture=useRef(null),suppressClick=useRef(0),hover=useRef(false),latest=useRef(null);
  const selected=Math.max(0,items.findIndex(entry=>identity(entry)===selectedKey)),item=preview||items[selected],key=identity(item);
  latest.current={items,selected};
  const move=delta=>{
    const current=latest.current;if(!current.items.length)return;
    root.current?.style.setProperty('--sg-slide-direction',delta<0?-1:1);
    setPreview(null);setSelectedKey(identity(current.items[(current.selected+delta+current.items.length)%current.items.length]));
  };
  useEffect(()=>{
    const show=event=>{if(event.detail)setPreview(event.detail);};
    window.addEventListener('streamglass:preview',show);
    return()=>window.removeEventListener('streamglass:preview',show);
  },[]);
  useEffect(()=>{
    let alive=true;setFull(null);
    if(item&&api.resolveMeta)Promise.resolve().then(()=>api.resolveMeta(item.type||'movie',item.id||item._id,item)).then(result=>{if(alive)setFull(result.meta);}).catch(()=>{});
    return()=>{alive=false;};
  },[key,api]);
  const incoming=(identity(full)===key?full:item)||{};
  const source=entry=>api.safeURL(entry?.background||entry?.poster);
  const scene=useScene(incoming,source(incoming),api.safeURL(incoming.logo)),meta=scene.meta,frames=scene.frames,shownKey=identity(meta);
  const shownIndex=items.findIndex(entry=>identity(entry)===shownKey),shownPosition=Math.max(0,shownIndex);
  // The requested selection changes before the decoded scene does. Deriving
  // this from selected would discard the warmed node at precisely that moment.
  const warmPicture=prewarm&&frames.current===settledArtwork&&!preview&&shownIndex>=0&&items.length>1?source(items[(shownIndex+1)%items.length]):'';
  useCarouselClock({root,timerFill,timeline,clock,wake,hover,gesture,paused:paused||!!list.pending,pending:scene.pending,preview,selected:shownPosition,count:items.length,sceneKey:shownKey,advance:()=>move(1)});
  const nextItem=items[(selected+1)%items.length],previousItem=items[(selected-1+items.length)%items.length];
  const nextPicture=source(nextItem),previousPicture=source(previousItem),nextLogo=api.safeURL(nextItem?.logo),previousLogo=api.safeURL(previousItem?.logo);
  useEffect(()=>{
    const images=[...new Set([nextPicture,previousPicture,nextLogo,previousLogo])].filter(Boolean).map(src=>{
      const image=new Image();image.referrerPolicy='no-referrer';image.onload=()=>image.decode().catch(()=>{});image.src=src;return image;
    });
    return()=>images.forEach(image=>{image.onload=null;});
  },[nextPicture,previousPicture,nextLogo,previousLogo]);
  if(!item)return null;
  const href=api.detailHash(meta.type||'movie',meta.id||meta._id),logo=api.safeURL(meta.logo);
  const finishGesture=(event,cancelled=false)=>{
    const current=gesture.current;if(!current||current.id!==event.pointerId)return;
    gesture.current=null;
    if(root.current){root.current.dataset.dragging='false';root.current.style.setProperty('--sg-swipe-x','0px');}
    if(current.axis==='x'){
      suppressClick.current=performance.now()+500;
      const distance=event.clientX-current.x,velocity=Math.abs(distance)/Math.max(1,performance.now()-current.started);
      if(!cancelled&&(Math.abs(distance)>56||(Math.abs(distance)>28&&velocity>.4)))move(distance<0?1:-1);
    }
    if(root.current?.hasPointerCapture(event.pointerId))root.current.releasePointerCapture(event.pointerId);
    wake.current?.();
  };
  return <div className="sg-feature-stage">{api.mobile?<div className="sg-home-ambient" aria-hidden="true"><Artwork frames={frames} ambient/></div>:null}<section id="sg-hero-slot" className="sg-react-hero sg-hero sg-hero-premium" aria-label="Featured titles" aria-roledescription="carousel" ref={root}
    onPointerEnter={event=>{if(event.pointerType==='mouse'){hover.current=true;wake.current?.();}}}
    onPointerLeave={event=>{if(event.pointerType==='mouse'){hover.current=false;wake.current?.();}}}
    onPointerDown={event=>{
      if(event.pointerType==='mouse'||!event.isPrimary||items.length<2||event.target.closest('.sg-carousel-controls'))return;
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),axis:null};wake.current?.();
    }}
    onPointerMove={event=>{
      const current=gesture.current;if(!current||current.id!==event.pointerId)return;
      const dx=event.clientX-current.x,dy=event.clientY-current.y;
      if(!current.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10){
        current.axis=Math.abs(dx)>Math.abs(dy)*1.25?'x':'y';
        if(current.axis==='x')root.current?.setPointerCapture(event.pointerId);
      }
      if(current.axis==='x'){event.preventDefault();root.current.dataset.dragging='true';root.current.style.setProperty('--sg-swipe-x',`${Math.max(-72,Math.min(72,dx*.42))}px`);}
    }}
    onPointerUp={event=>finishGesture(event)} onPointerCancel={event=>finishGesture(event,true)}
    onClickCapture={event=>{if(performance.now()<suppressClick.current){event.preventDefault();event.stopPropagation();}}}>
    <div className="sg-hero-scene"><Artwork frames={frames} onSettled={picture=>{scene.settle(picture);if(!api.mobile)setSettledArtwork(picture);}} warm={warmPicture}/><div className="sg-hero-shade"/>
    {api.mobile?<a className="sg-hero-details" href={href} aria-label={`More info about ${meta.name}`}><span><Icon name="info"/></span></a>:null}
    <div className="sg-react-hero-copy"><div key={shownKey} className="sg-hero-story"><Logo src={logo} name={meta.name} ready={scene.logoReady}/>
      <div className="sg-hero-meta"><span>{meta.type==='series'?'Series':'Movie'}</span>{meta.releaseInfo?<span>{String(meta.releaseInfo).slice(0,4)}</span>:null}{meta.imdbRating?<span className="sg-hero-score">IMDb {meta.imdbRating}</span>:null}{(meta.genres||[]).slice(0,2).map(genre=><span key={genre}>{genre}</span>)}</div>{meta.description?<p className="sg-hero-synopsis">{meta.description}</p>:null}</div>
      <div className="sg-react-hero-actions sg-mobile-hero-actions"><a className="sg-button sg-primary" href={href+'?play=1'}><Icon name="play"/>Play</a>{api.mobile?<button type="button" className="sg-button sg-hero-save" disabled={list.loading||!!list.pending} aria-pressed={list.titles.has(shownKey)} aria-busy={list.loading||list.pending===shownKey} aria-label={list.error?'Retry My List':`${list.titles.has(shownKey)?'Remove from':'Add to'} My List: ${meta.name}`} onClick={()=>list.toggle(meta)}><span className="sg-save-icon" key={String(list.titles.has(shownKey))}><Icon name={list.titles.has(shownKey)?'check':'plus'}/></span>{list.error?'Retry':'My List'}</button>:<a className="sg-button" href={href}><Icon name="info"/>More info</a>}</div></div></div>
    {items.length>1?<>
      <div className="sg-hero-timeline" ref={timeline} role="progressbar" aria-label="Time until next featured title" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        {items.map((entry,position)=><span className="sg-hero-timer-track" data-state={position===shownPosition?'current':position<shownPosition?'complete':'next'} key={identity(entry)} aria-hidden="true"><i ref={position===shownPosition?timerFill:undefined} data-current-timer={position===shownPosition?'true':undefined}/></span>)}
      </div>
      <div className="sg-carousel-controls"><button type="button" aria-label="Previous featured title" onClick={()=>move(-1)}><Icon name="previous"/></button><span aria-live="off">{shownPosition+1} / {items.length}</span><button type="button" aria-label="Next featured title" onClick={()=>move(1)}><Icon name="next"/></button><button type="button" aria-label={paused?'Resume featured slideshow':'Pause featured slideshow'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}><Icon name={paused?'play':'pause'}/></button></div>
    </>:null}
  </section></div>;
}
