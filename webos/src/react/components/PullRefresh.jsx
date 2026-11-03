import React,{useEffect,useRef,useState} from 'react';
// Gesture progress stays in CSS/ref; React only renders semantic state changes.
export default function PullRefresh({onRefresh,mobile=true}){
 const node=useRef(null),callback=useRef(onRefresh),busy=useRef(false);
 const [phase,setPhase]=useState('idle');callback.current=onRefresh;
 useEffect(()=>{
  if(!mobile)return;
  const view=document.getElementById('sg-view');if(!view)return;
  let start=null,distance=0,locked=false,alive=true,frame=0,settle;
  const paint=()=>{frame=0;if(node.current){node.current.style.setProperty('--pull-distance',Math.min(96,distance)+'px');node.current.style.setProperty('--pull-progress',Math.min(1,distance/72));}};
  const draw=()=>{if(!frame)frame=requestAnimationFrame(paint);};
  const reset=()=>{start=null;locked=false;distance=0;draw();if(alive&&!busy.current)setPhase('idle');};
  const blocked=()=>view.inert||document.body.classList.contains('sg-dialog-open')||!!document.querySelector('.sg-mobile-overlay:not([hidden])');
  const begin=event=>{
   if(busy.current||blocked()||view.scrollTop>0||event.touches.length!==1)return;
   if(event.target.closest('input,textarea,select,[contenteditable]'))return;
   start={x:event.touches[0].clientX,y:event.touches[0].clientY};distance=0;locked=false;
  };
  const move=event=>{
   if(!start||busy.current)return;
   if(event.touches.length!==1||blocked()){reset();return;}
   const dx=event.touches[0].clientX-start.x,dy=event.touches[0].clientY-start.y;
   if(!locked){if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)){reset();return;}if(dy<0||view.scrollTop>0){reset();return;}if(dy<12)return;locked=true;}
   if(event.cancelable)event.preventDefault();
   distance=Math.max(0,dy*.48);setPhase(distance>=72?'ready':'pulling');draw();
  };
  const finish=()=>{
   if(!start)return;start=null;locked=false;
   if(distance<72){reset();return;}
   busy.current=true;setPhase('refreshing');distance=56;draw();
   Promise.resolve().then(()=>callback.current?.()).then(ok=>{if(alive)setPhase(ok===false?'error':'done');},()=>{if(alive)setPhase('error');}).finally(()=>{
    if(!alive)return;busy.current=false;settle=setTimeout(reset,650);
   });
  };
  view.addEventListener('touchstart',begin,{passive:true});view.addEventListener('touchmove',move,{passive:false});view.addEventListener('touchend',finish,{passive:true});view.addEventListener('touchcancel',reset,{passive:true});
  return()=>{alive=false;clearTimeout(settle);cancelAnimationFrame(frame);view.removeEventListener('touchstart',begin);view.removeEventListener('touchmove',move);view.removeEventListener('touchend',finish);view.removeEventListener('touchcancel',reset);};
 },[mobile]);
 if(!mobile)return null;
 return <div ref={node} className="sg-pull-refresh" data-state={phase} role="status" aria-live="polite" aria-atomic="true"><span className="sg-pull-spinner" aria-hidden="true">↻</span><span>{phase==='ready'?'Release to refresh':phase==='refreshing'?'Refreshing…':phase==='done'?'Up to date':phase==='error'?'Could not refresh. Try again.':phase==='pulling'?'Pull to refresh':''}</span></div>;
}
