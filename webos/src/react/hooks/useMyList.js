import {useEffect,useRef,useState} from 'react';

export const titleKey=meta=>`${meta.type||'movie'}:${meta.id||meta._id}`;

// Read membership once for the billboard. A completed save always belongs to
// the title that was tapped, even if the person swipes while it is in flight.
export function useMyList(api){
  const [state,setState]=useState({titles:new Set(),loading:true,error:false,pending:''});
  const [revision,setRevision]=useState(0);
  const alive=useRef(false),busy=useRef(false);
  useEffect(()=>{
    alive.current=true;
    return()=>{alive.current=false;};
  },[]);
  useEffect(()=>{
    if(!api.mobile)return;
    const controller=new AbortController();
    setState(value=>({...value,loading:true,error:false}));
    Promise.resolve().then(()=>api.savedTitles(controller.signal)).then(titles=>{
      if(!controller.signal.aborted)setState(value=>({...value,titles,loading:false}));
    }).catch(()=>{if(!controller.signal.aborted)setState(value=>({...value,loading:false,error:true}));});
    return()=>controller.abort();
  },[api,revision]);
  const toggle=async meta=>{
    if(busy.current||state.loading)return;
    if(state.error){setRevision(value=>value+1);return;}
    const key=titleKey(meta),saved=!state.titles.has(key);
    busy.current=true;setState(value=>({...value,pending:key}));
    try{
      await api.saveTitle(meta,saved);
      if(alive.current)setState(value=>{
        const titles=new Set(value.titles);if(saved)titles.add(key);else titles.delete(key);
        return {...value,titles,pending:''};
      });
    }catch(_){
      api.notify?.('Could not update My List. Please try again.');
      if(alive.current)setState(value=>({...value,pending:''}));
    }finally{busy.current=false;}
  };
  return {...state,toggle};
}
