/* StreamGlass curated discovery. GPL-3.0-or-later.
 * Catalog endpoints verified 2026-11-03. No provider membership is inferred.
 * Cinemeta manifest: https://v3-cinemeta.strem.io/manifest.json
 * Streaming Catalogs source: https://github.com/rleroi/Stremio-Streaming-Catalogs-Addon
 * Source's vue/.env identifies the public deployment below. Provider rows describe
 * its catalog listings, not originals or a promise of availability in a region.
 */
export const CINEMETA_URL='https://v3-cinemeta.strem.io';
export const STREAMING_CATALOGS_URL='https://7a82163c306e-stremio-netflix-catalog-addon.baby-beamup.club';
export const CURATED_SOURCE_NOTE='Discovery by Cinemeta and Streaming Catalogs. Provider availability varies by country. Playback uses your installed addons.';
const cache=new Map();
const CACHE_MS=15*60*1000;
const ANIME_MOVIES=['tt0245429','tt5311514','tt0119698','tt0094625','tt0347149','tt0876563'];
const ANIME_SERIES=['tt1355642','tt2560140','tt0877057','tt0213338','tt12343534','tt9335498'];
const SEASONS={
 halloween:{title:'Halloween nights',description:'A handpicked mix of spooky classics and family favorites.',ids:['tt0077651','tt0087800','tt0107688','tt0107120','tt0327597','tt0087332','tt0094721','tt0070047']},
 christmas:{title:'Christmas favorites',description:'A handpicked collection for the festive season.',ids:['tt0099785','tt0319343','tt0038650','tt0170016','tt4729430','tt0097958','tt0338348','tt0104431']},
 valentines:{title:'A little romance',description:'Handpicked stories for Valentine’s season.',ids:['tt0332280','tt3783958','tt0120338','tt0112471','tt0211915','tt2194499']},
 summer:{title:'Summer escapes',description:'Handpicked adventures and sunlit stories for summer.',ids:['tt0114709','tt0083866','tt0107290','tt0073195','tt0266543','tt0119116']}
};
export function seasonalCollection(now=new Date()){
 const date=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(date.getTime()))return null;
 const month=date.getMonth()+1,day=date.getDate();
 const key=(month===10||month===11&&day<=7)?'halloween':(month===11&&day>=20||month===12||month===1&&day<=6)?'christmas':(month===2&&day<=16)?'valentines':month>=6&&month<=8?'summer':null;
 return key?{key,...SEASONS[key],ids:[...SEASONS[key].ids]}:null;
}
function catalog(key,title,type,base,id,source,description){
 return {key,title,type,source,sourceUrl:base,description,url:`${base}/catalog/${type}/${id}.json`,items:[],loading:true};
}
function selection(key,title,type,ids,description){return {key,title,type,ids:[...ids],source:'StreamGlass selection · metadata by Cinemeta',sourceUrl:CINEMETA_URL,description,items:[],loading:true};}
export function getCuratedRows({type='',now=new Date()}={}){
 const season=seasonalCollection(now);
 return [
  catalog('featured-movies','Featured · Movies','movie',CINEMETA_URL,'imdbRating','Cinemeta','Featured movies from Cinemeta.'),
  catalog('featured-series','Featured · Series','series',CINEMETA_URL,'imdbRating','Cinemeta','Featured series from Cinemeta.'),
  ...(season?[selection('season-'+season.key,season.title,'movie',season.ids,season.description)]:[]),
  ...[['nfx','Netflix'],['hbm','HBO Max']].flatMap(([id,name])=>['movie','series'].map(type=>catalog(`${id}-${type}`,`${name} · ${type==='movie'?'Movies':'Series'}`,type,STREAMING_CATALOGS_URL,id,'Streaming Catalogs','Listed by Streaming Catalogs. Availability varies by country; these are not necessarily originals.'))),
  selection('anime-movies','Anime · Movies','movie',ANIME_MOVIES,'Handpicked anime films, with details from Cinemeta.'),
  selection('anime-series','Anime · Series','series',ANIME_SERIES,'Handpicked anime series, with details from Cinemeta.'),
  catalog('top-movies','Top · Movies','movie',CINEMETA_URL,'top','Cinemeta','Popular movies in Cinemeta’s current catalog; not an all-time rating chart.'),
  catalog('top-series','Top · Series','series',CINEMETA_URL,'top','Cinemeta','Popular series in Cinemeta’s current catalog; not an all-time rating chart.')
 ].filter(row=>!type||row.type===type);
}
export function clearCuratedCache(){cache.clear();}
function cancelled(){const error=new Error('Discovery cancelled');error.name='AbortError';return error;}
function cleanMeta(meta,type){
 const id=meta?.id||meta?.imdb_id;
 return meta&&typeof id==='string'&&/^tt\d+$/.test(id)&&typeof meta.name==='string'?{...meta,id,type,genres:Array.isArray(meta.genres)?meta.genres:Array.isArray(meta.genre)?meta.genre:[]}:null;
}
async function requestJSON(url,{signal,refresh=false,fetcher=globalThis.fetch,timeoutMs=12000}={}){
 if(signal?.aborted)throw cancelled();
 const previous=cache.get(url);
 if(!refresh&&previous&&previous.expires>Date.now())return previous.value;
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(abort,timeoutMs);
 try{
  const response=await fetcher(url,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Catalog unavailable');
  const value=await response.json();
  if(controller.signal.aborted)throw cancelled();
  cache.set(url,{value,expires:Date.now()+CACHE_MS});
  while(cache.size>128)cache.delete(cache.keys().next().value);
  return value;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
// Fallback for curated IMDb titles when the user's installed addons cannot supply metadata.
// Returns the same shape as the shell's resolveMeta; does not alter stream addons.
export async function resolveCuratedMeta(type,id,signal,options={}){
 if(!['movie','series'].includes(type)||!/^tt\d+$/.test(String(id)))throw new Error('No curated metadata for this title');
 const data=await requestJSON(`${CINEMETA_URL}/meta/${type}/${encodeURIComponent(id)}.json`,{...options,signal});
 const meta=cleanMeta(data?.meta,type);
 if(!meta||meta.id!==id)throw new Error('Title details unavailable');
 return {meta,addon:{transportUrl:CINEMETA_URL+'/manifest.json',manifest:{id:'com.linvo.cinemeta',name:'Cinemeta',types:['movie','series'],resources:['meta']}}};
}
function limiter(limit,signal){
 let active=0;const queue=[];
 function pump(){
  while(active<limit&&queue.length){
   const job=queue.shift();
   if(signal.aborted){job.reject(cancelled());continue;}
   active++;
   Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{active--;pump();});
  }
 }
 return work=>new Promise((resolve,reject)=>{queue.push({work,resolve,reject});pump();});
}
export async function loadCuratedRows({type='',now=new Date(),signal,refresh=false,onRow,fetcher=globalThis.fetch,timeoutMs=12000,deadlineMs=40000}={}){
 if(signal?.aborted)throw cancelled();
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener('abort',abort,{once:true});
 const deadline=setTimeout(abort,deadlineMs),run=limiter(4,controller.signal);
 const rows=getCuratedRows({type,now});
 const options={signal:controller.signal,refresh,fetcher,timeoutMs};
 try{
  return await Promise.all(rows.map(async(descriptor,index)=>{
   let row;
   try{
    let items,partial=false;
    if(descriptor.ids){
     const results=await Promise.allSettled(descriptor.ids.map(id=>run(()=>resolveCuratedMeta(descriptor.type,id,controller.signal,options))));
     items=results.filter(item=>item.status==='fulfilled').map(item=>item.value.meta);
     partial=items.length<descriptor.ids.length;
    }else{
     const data=await run(()=>requestJSON(descriptor.url,options));
     items=(Array.isArray(data?.metas)?data.metas:[]).map(meta=>cleanMeta(meta,descriptor.type)).filter(Boolean);
    }
    const unique=new Map(items.map(item=>[item.id,item]));
    row={...descriptor,items:[...unique.values()].slice(0,24),loading:false,partial};
    if(!row.items.length)row.error='This collection is unavailable right now.';
   }catch(_){row={...descriptor,items:[],loading:false,error:'This collection could not load. Pull to refresh and try again.'};}
   if(signal?.aborted)throw cancelled();
   onRow?.(row,index);
   return row;
  }));
 }finally{clearTimeout(deadline);signal?.removeEventListener('abort',abort);}
}
