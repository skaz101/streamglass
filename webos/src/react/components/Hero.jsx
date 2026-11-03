/* StreamGlass featured carousel. GPL-3.0-or-later. */
import React,{useEffect,useRef,useState} from 'react';
import './hero.css';

const DURATION=8000;
const identity=item=>item?`${item.type||'movie'}:${item.id||item._id}`:'';
function Artwork({src}){
  const [frames,setFrames]=useState({current:'',previous:''});
  useEffect(()=>{
    let alive=true,cleanup;const image=new Image();image.referrerPolicy='no-referrer';
    image.onload=async()=>{
      try{await image.decode();}catch(_){}
      if(!alive)return;
      setFrames(current=>current.current===src?current:{current:src,previous:current.current});
      cleanup=setTimeout(()=>{if(alive)setFrames(current=>({...current,previous:''}));},720);
    };
    image.onerror=()=>{if(alive)setFrames({current:'',previous:''});};
    if(src)image.src=src;else setFrames({current:'',previous:''});
    return()=>{alive=false;image.onload=null;image.onerror=null;clearTimeout(cleanup);};
  },[src]);
  return <>{frames.previous?<img data-react-art="true" className="sg-react-hero-art sg-hero-art-leaving" src={frames.previous} alt="" referrerPolicy="no-referrer"/>:null}{frames.current?<img key={frames.current} data-react-art="true" className="sg-react-hero-art sg-hero-art-entering" src={frames.current} alt="" referrerPolicy="no-referrer"/>:null}</>;
}
function Logo({src,name}){
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[src]);
  return src&&!failed?<img data-react-art="true" className="sg-react-hero-logo" src={src} alt={name} referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<h1>{name}</h1>;
}

export default function Hero({items,api}){
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false),[preview,setPreview]=useState(null),[full,setFull]=useState(null);
  const root=useRef(null),timer=useRef({elapsed:0,last:0}),gesture=useRef(null),suppressClick=useRef(0),hover=useRef(false),latest=useRef(null);
  const selected=index%Math.max(1,items.length),item=preview||items[selected],key=identity(item);
  latest.current={items,paused,preview,selected};
  const reset=()=>{timer.current.elapsed=0;timer.current.last=0;};
  const move=delta=>{reset();setPreview(null);setIndex(value=>(value+delta+items.length)%items.length);};
  useEffect(()=>{
    const show=event=>{if(event.detail){reset();setPreview(event.detail);}};
    window.addEventListener('streamglass:preview',show);
    return()=>window.removeEventListener('streamglass:preview',show);
  },[]);
  useEffect(()=>{
    let alive=true;setFull(null);reset();
    if(item&&api.resolveMeta)Promise.resolve().then(()=>api.resolveMeta(item.type||'movie',item.id||item._id,item)).then(result=>{if(alive)setFull(result.meta);}).catch(()=>{});
    return()=>{alive=false;};
  },[key,api]);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');let frame,alive=true,lastSecond=-1;
    const tick=now=>{
      if(!alive)return;
      const current=latest.current,node=root.current,active=document.activeElement;
      const blocked=current.paused||current.preview||media.matches||document.hidden||hover.current||gesture.current||node?.contains(active)||active?.closest('.sg-card')||(document.getElementById('sg-view')?.scrollTop||0)>100||current.items.length<2;
      const elapsed=timer.current;
      if(elapsed.last&&!blocked)elapsed.elapsed+=Math.min(now-elapsed.last,100);
      elapsed.last=now;
      if(node){
        node.dataset.slideshow=blocked?'paused':'playing';
        const fill=node.querySelector('[data-current-timer]');
        if(fill)fill.style.transform=`scaleX(${Math.min(1,elapsed.elapsed/DURATION)})`;
        const second=Math.ceil((DURATION-elapsed.elapsed)/1000);
        if(second!==lastSecond){lastSecond=second;const bar=node.querySelector('[role="progressbar"]');if(bar){bar.setAttribute('aria-valuenow',String(Math.round(elapsed.elapsed/DURATION*100)));bar.setAttribute('aria-valuetext',`${Math.max(0,second)} seconds remaining`);}}
      }
      if(elapsed.elapsed>=DURATION){reset();setIndex(value=>(value+1)%current.items.length);}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{alive=false;cancelAnimationFrame(frame);};
  },[]);
  if(!item)return null;
  const meta=identity(full)===key?full:item,href=api.detailHash(meta.type||'movie',meta.id||meta._id),picture=api.safeURL(meta.background||meta.poster),logo=api.safeURL(meta.logo);
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
  };
  return <section id="sg-hero-slot" className="sg-react-hero sg-hero sg-hero-premium" aria-label="Featured titles" aria-roledescription="carousel" ref={root}
    onPointerEnter={event=>{if(event.pointerType==='mouse')hover.current=true;}}
    onPointerLeave={event=>{if(event.pointerType==='mouse')hover.current=false;}}
    onPointerDown={event=>{
      if(event.pointerType==='mouse'||!event.isPrimary||items.length<2||event.target.closest('.sg-carousel-controls'))return;
      gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,started:performance.now(),axis:null};
    }}
    onPointerMove={event=>{
      const current=gesture.current;if(!current||current.id!==event.pointerId)return;
      const dx=event.clientX-current.x,dy=event.clientY-current.y;
      if(!current.axis&&Math.max(Math.abs(dx),Math.abs(dy))>10){
        current.axis=Math.abs(dx)>Math.abs(dy)*1.25?'x':'y';
        if(current.axis==='x')root.current?.setPointerCapture(event.pointerId);
      }
      if(current.axis==='x'){event.preventDefault();root.current.dataset.dragging='true';root.current.style.setProperty('--sg-swipe-x',`${Math.max(-36,Math.min(36,dx*.16))}px`);}
    }}
    onPointerUp={event=>finishGesture(event)} onPointerCancel={event=>finishGesture(event,true)}
    onClickCapture={event=>{if(performance.now()<suppressClick.current){event.preventDefault();event.stopPropagation();}}}>
    <Artwork src={picture}/>
    <div key={key} className="sg-react-hero-copy"><span>{meta.type==='series'?'Series':'Movie'}</span><Logo src={logo} name={meta.name}/>
      <p>{(meta.genres||[]).slice(0,3).join(' · ')}{meta.imdbRating?' · IMDb '+meta.imdbRating:''}</p><p className="sg-hero-synopsis">{meta.description||'Find something worth watching.'}</p>
      <div className="sg-react-hero-actions sg-mobile-hero-actions"><a className="sg-button sg-primary" href={href+(api.mobile?'?play=1':'')}>▶ {api.mobile?'Play':'Watch now'}</a><a className="sg-button" href={href}>More info</a></div></div>
    {items.length>1?<>
      <div className="sg-hero-timeline" role="progressbar" aria-label="Time until next featured title" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
        {items.map((entry,position)=><span className="sg-hero-timer-track" data-state={position===selected?'current':position<selected?'complete':'next'} key={identity(entry)} aria-hidden="true"><i data-current-timer={position===selected?'true':undefined}/></span>)}
      </div>
      <div className="sg-carousel-controls"><button type="button" aria-label="Previous featured title" onClick={()=>move(-1)}>‹</button><span aria-live="off">{selected+1} / {items.length}</span><button type="button" aria-label="Next featured title" onClick={()=>move(1)}>›</button><button type="button" aria-label={paused?'Resume featured slideshow':'Pause featured slideshow'} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?'▶':'Ⅱ'}</button></div>
    </>:null}
  </section>;
}
