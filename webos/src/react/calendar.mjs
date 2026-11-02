// Exact addon dates only: a release year is not a release date.
export function dateKey(value) {
  if(typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value))return null;
  const date=new Date(value);
  const literal=new Date(value.slice(0,10)+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||!Number.isFinite(literal.getTime())||literal.toISOString().slice(0,10)!==value.slice(0,10))return null;
  // Date-only values retain the publisher's date. Timestamps use local time.
  return value.length===10?value:[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function releases(meta) {
  const id=meta.id||meta._id,type=meta.type||'movie';
  const videos=type==='movie'?[{released:meta.released||meta.videos?.[0]?.released}]:meta.videos||[];
  const seen=new Set();
  return videos.flatMap(video=>{
    const day=dateKey(video.released),key=type+':'+id+':'+(video.id||day);
    if(!day||seen.has(key))return [];
    seen.add(key);
    return [{key,day,id,type,videoId:type==='movie'?undefined:video.id,name:meta.name||id,poster:meta.poster,episode:type==='movie'?'Movie':[(video.season!=null?'S'+video.season:''),(video.episode!=null?'E'+video.episode:''),video.title||video.name].filter(Boolean).join(' · ')}];
  });
}
export function monthDays(month) {
  const [year,number]=month.split('-').map(Number);
  const start=new Date(year,number-1,1),count=new Date(year,number,0).getDate();
  return [...Array(start.getDay()).fill(null),...Array.from({length:count},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))];
}
export function catalogTitle(entry) {
  const type=entry.catalog.type==='movie'?'Movies':entry.catalog.type==='series'?'Series':entry.catalog.type;
  const name=entry.catalog.name||entry.addon.manifest.name;
  return name.toLowerCase().endsWith(type.toLowerCase())?name:name+' · '+type;
}
export function catalogRank(entry) {
  const name=entry.catalog.name||'';
  return /popular|top|trending/i.test(name)?0:/featured/i.test(name)?1:2;
}
