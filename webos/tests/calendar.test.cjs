const test=require('node:test');
const assert=require('node:assert/strict');
test('Calendar accepts exact dates, handles leap years and rejects fabricated dates',async()=>{
 const {dateKey,monthDays}=await import('../src/react/calendar.mjs');
 assert.equal(dateKey('2026'),null);assert.equal(dateKey('2026-02-30'),null);assert.equal(dateKey('2024-02-29'),'2024-02-29');
 assert.equal(dateKey('2026-02-29'),null);assert.equal(dateKey('nonsense'),null);
 assert.ok(dateKey('2026-11-02T23:30:00-08:00'));
 assert.equal(monthDays('2024-02').filter(Boolean).length,29);
 assert.equal(monthDays('2026-11')[0],'2026-11-01');
});
test('Calendar preserves episode links, ignores year-only metadata, and deduplicates',async()=>{
 const {releases}=await import('../src/react/calendar.mjs');
 assert.deepEqual(releases({id:'film',type:'movie',releaseInfo:'2026'}),[]);
 const episode={id:'show:1:2',released:'2026-11-03',season:1,episode:2,title:'Home'};
 const results=releases({id:'show',name:'Show',type:'series',videos:[episode,episode,{id:'unknown',released:'2026'}]});
 assert.equal(results.length,1);assert.equal(results[0].videoId,'show:1:2');assert.equal(results[0].episode,'S1 · E2 · Home');
 assert.equal(releases({id:'film',type:'movie',videos:[{released:'2026-11-03'}]})[0].day,'2026-11-03');
});
test('Catalog ordering uses provider labels without inventing popularity',async()=>{
 const {catalogRank,catalogTitle}=await import('../src/react/calendar.mjs');
 const entry=(name,type)=>({catalog:{name,type},addon:{manifest:{name:'Addon'}}});
 assert.equal(catalogTitle(entry('Popular','movie')),'Popular · Movies');assert.equal(catalogTitle(entry('Popular Series','series')),'Popular Series');
 assert.ok(catalogRank(entry('Popular','movie'))<catalogRank(entry('Featured','movie')));
 assert.ok(catalogRank(entry('Featured','movie'))<catalogRank(entry('My custom catalog','movie')));
});
