import {useEffect,useRef,useState} from 'react';
export default function useRefresh(){
 const [revision,setRevision]=useState(0),pending=useRef(null);
 const finish=(ok=true)=>{pending.current?.resolve(ok);pending.current=null;};
 useEffect(()=>()=>finish(),[]);
 const refresh=()=>{
  if(pending.current)return pending.current.promise;
  let resolve;const promise=new Promise(done=>{resolve=done;});pending.current={promise,resolve};setRevision(value=>value+1);return promise;
 };
 return {revision,refresh,finish};
}
