const test=require('node:test');
const assert=require('node:assert/strict');
const modulePromise=import('../src/react/curated.mjs');
const date=(month,day)=>new Date(2026,month-1,day,12);
test('curated discovery is independent of user addons and labels actual catalog sources',async()=>{
 const {getCuratedRows,CINEMETA_URL,STREAMING_CATALOGS_URL}=await modulePromise;
 const rows=getCuratedRows({now:date(3,1)});
 assert.equal(rows.length,10);assert.equal(new Set(rows.map(row=>row.key)).size,10);
 assert.ok(rows.find(row=>row.key==='nfx-movie').url.startsWith(STREAMING_CATALOGS_URL));
 assert.equal(rows.find(row=>row.key==='featured-series').url,CINEMETA_URL+'/catalog/series/imdbRating.json');
 assert.ok(rows.find(row=>row.key==='top-series').description.includes('not an all-time'));
 assert.ok(getCuratedRows({type:'series'}).every(row=>row.type==='series'));
});
test('seasonal collections have explicit nearby windows including the Christmas year boundary',async()=>{
 const {seasonalCollection}=await modulePromise;
 assert.equal(seasonalCollection(date(9,30)),null);
 for(const [m,d] of [[10,1],[10,31],[11,7]])assert.equal(seasonalCollection(date(m,d)).key,'halloween');
 assert.equal(seasonalCollection(date(11,8)),null);assert.equal(seasonalCollection(date(11,19)),null);
 for(const [m,d] of [[11,20],[12,25],[1,6]])assert.equal(seasonalCollection(date(m,d)).key,'christmas');
 assert.equal(seasonalCollection(date(1,7)),null);assert.equal(seasonalCollection(new Date(NaN)),null);
});
function fixture(url){
 const parts=new URL(url).pathname.split('/');const type=parts[2];
 if(parts[1]==='meta')return {meta:{id:parts[3].replace('.json',''),name:'Fixture anime',type,genre:['Animation']}};
 return {metas:[{id:'tt123',name:'Fixture',type},{id:'tt123',name:'Fixture duplicate',type},{id:'wrong',name:'Invalid'}]};
}
test('load limits active requests, deduplicates rows, caches settled data and bypasses cache on refresh',async()=>{
 const {loadCuratedRows,clearCuratedCache}=await modulePromise;clearCuratedCache();
 let active=0,max=0,calls=0;const delivered=[];
 const fetcher=async url=>{calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,2));active--;return {ok:true,json:async()=>fixture(url)};};
 const first=await loadCuratedRows({now:date(3,1),fetcher,onRow:(row,index)=>delivered.push([row.key,index])});
 assert.ok(max<=4);assert.equal(first.length,10);assert.equal(delivered.length,10);assert.equal(first[0].items.length,1);
 const cachedCalls=calls;await loadCuratedRows({now:date(3,1),fetcher});assert.equal(calls,cachedCalls);
 await loadCuratedRows({now:date(3,1),fetcher,refresh:true});assert.ok(calls>cachedCalls);
});
test('provider failure stays an honest failed provider row, without relabeling unrelated titles',async()=>{
 const {loadCuratedRows,clearCuratedCache,STREAMING_CATALOGS_URL}=await modulePromise;clearCuratedCache();
 const rows=await loadCuratedRows({type:'movie',now:date(3,1),fetcher:async url=>({ok:!url.startsWith(STREAMING_CATALOGS_URL),json:async()=>fixture(url)})});
 assert.equal(rows.find(row=>row.key==='nfx-movie').items.length,0);
 assert.ok(rows.find(row=>row.key==='hbm-movie').error);
 assert.ok(rows.find(row=>row.key==='featured-movies').items.length);
});
test('cancellation stops callbacks and queued work; fallback rejects non-IMDb IDs',async()=>{
 const {loadCuratedRows,clearCuratedCache,resolveCuratedMeta}=await modulePromise;clearCuratedCache();
 let calls=0,callbacks=0;const controller=new AbortController();
 const pending=loadCuratedRows({signal:controller.signal,onRow:()=>callbacks++,fetcher:async(url,{signal})=>{calls++;return new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});});}});
 await new Promise(r=>setTimeout(r,5));controller.abort();await assert.rejects(pending,{name:'AbortError'});
 assert.ok(calls<=4);assert.equal(callbacks,0);
 await assert.rejects(()=>resolveCuratedMeta('series','kitsu:1'),/No curated metadata/);
});
test('overall deadline finishes with explicit partial collections',async()=>{
 const {loadCuratedRows,clearCuratedCache}=await modulePromise;clearCuratedCache();
 const rows=await loadCuratedRows({now:date(3,1),deadlineMs:10,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))});
 assert.equal(rows.length,10);assert.ok(rows.every(row=>row.error&&!row.loading));
});
