// Preserve unchanged catalog objects at the response boundary so memoized rails
// can keep their cards. Do not keep another catalog cache or compare during render.
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
function sameJSON(left,right,budget={remaining:256},depth=0){
  if(--budget.remaining<0)return false;
  if(Object.is(left,right))return true;
  if(depth>=8||!left||!right||typeof left!=='object'||typeof right!=='object')return false;
  if(Array.isArray(left)){
    if(!Array.isArray(right)||left.length!==right.length||left.length>budget.remaining)return false;
    return left.every((value,index)=>sameJSON(value,right[index],budget,depth+1));
  }
  if(Object.getPrototypeOf(left)!==Object.prototype||Object.getPrototypeOf(right)!==Object.prototype)return false;
  const keys=Object.keys(left);
  if(keys.length!==Object.keys(right).length||keys.length>budget.remaining)return false;
  return keys.every(key=>own(right,key)&&sameJSON(left[key],right[key],budget,depth+1));
}
const key=meta=>`${meta.type||'movie'}:${meta.id||meta._id}`;
export function retainCatalogItems(previous,incoming){
  if(previous===incoming||!previous?.length||!incoming.length)return incoming;
  const byKey=new Map(previous.map(meta=>[key(meta),meta]));
  const items=incoming.map(meta=>{
    const prior=byKey.get(key(meta));
    return prior&&sameJSON(prior,meta)?prior:meta;
  });
  return items.length===previous.length&&items.every((meta,index)=>meta===previous[index])?previous:items;
}
export function prepareCatalogRows(previous,descriptors){
  const byKey=new Map(previous.map(row=>[row.entry.key,row]));
  // Seasonal collections can appear or disappear while Home stays mounted.
  // Retain each surviving collection by identity, in the new descriptor order.
  return descriptors.map(entry=>{
    const prior=entry.key==null?undefined:byKey.get(entry.key);
    return prior?(sameJSON(prior.entry,entry)?prior:{...prior,entry}):{entry,loading:true,items:[]};
  });
}
export function refreshedRow(previous,next){
  // Failed refreshes retain usable titles and the remote's focused card.
  if(next.error&&previous?.items.length&&next.entry.key!=null&&previous.entry.key===next.entry.key)return {...previous,loading:false,stale:true,error:next.error};
  if(!previous)return next;
  const items=retainCatalogItems(previous.items,next.items);
  if(items===previous.items&&sameJSON(previous.entry,next.entry)&&!!previous.loading===!!next.loading&&previous.error===next.error&&!previous.stale)return previous;
  return items===next.items?next:{...next,items};
}
