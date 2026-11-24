const test=require('node:test');
const assert=require('node:assert/strict');
const snapshots=import('../src/react/catalogSnapshot.mjs');
const copy=value=>JSON.parse(JSON.stringify(value));
const titles=()=>[
  {id:'tt100',type:'movie',name:'First title',poster:'https://example.com/first.jpg',genres:['Drama'],state:{videoId:'tt100',progress:{timeOffset:10,duration:100}}},
  {id:'tt101',type:'series',name:'Second title',genres:['Comedy'],releaseInfo:'2026',links:[{name:'Cast',category:'Cast',url:'https://example.com/cast'}]}
];
test('unchanged catalog data retains row, array and card references without another cache',async()=>{
  const {refreshedRow}=await snapshots;
  const before={entry:{key:'top-movies',title:'Top movies',items:[],ids:['tt100']},items:titles(),loading:false};
  assert.equal(refreshedRow(before,copy(before)),before);
});
test('changed nested metadata, removed properties, artwork and membership update only their title',async()=>{
  const {retainCatalogItems}=await snapshots;
  for(const change of [title=>title.state.progress.timeOffset=20,title=>title.poster='https://example.com/new.jpg',title=>delete title.genres,title=>title.watched=true,title=>title.type='series']){
    const before=titles(),incoming=copy(before);change(incoming[0]);
    const after=retainCatalogItems(before,incoming);
    assert.equal(after[0],incoming[0]);assert.equal(after[1],before[1]);assert.notEqual(after,before);
  }
});
test('new order, additions, removal and type identity are retained in the incoming order',async()=>{
  const {retainCatalogItems}=await snapshots,before=titles();
  const reordered=retainCatalogItems(before,copy(before).reverse());
  assert.deepEqual(reordered,[before[1],before[0]]);assert.notEqual(reordered,before);
  assert.deepEqual(retainCatalogItems(before,copy(before).slice(1)),[before[1]]);
  const added={id:'tt102',type:'movie',name:'New title'};
  assert.deepEqual(retainCatalogItems(before,[...copy(before),added]),[...before,added]);
  assert.deepEqual(retainCatalogItems(before,[]),[]);
});
test('large or deeply nested addon payloads stop comparison and safely use fresh metadata',async()=>{
  const {retainCatalogItems}=await snapshots;
  for(const extra of [{videos:Array.from({length:300},(_,index)=>({id:'video:'+index}))},{nested:{a:{b:{c:{d:{e:{f:{g:{value:1}}}}}}}}}]){
    const before=[{...titles()[0],...extra}],incoming=copy(before);
    assert.equal(retainCatalogItems(before,incoming)[0],incoming[0]);
  }
});
test('failed refresh retains titles; successful recovery clears stale status and detects descriptor changes',async()=>{
  const {refreshedRow}=await snapshots,before={entry:{key:'top-movies',title:'Top movies'},items:titles(),loading:false};
  const failed=refreshedRow(before,{entry:before.entry,items:[],error:'Offline'});
  assert.equal(failed.items,before.items);assert.equal(failed.stale,true);
  const recovered=refreshedRow(failed,copy(before));assert.equal(recovered.items,before.items);assert.equal(recovered.stale,undefined);assert.equal(recovered.error,undefined);
  const next={...copy(before),entry:{key:'top-series',title:'Top series'}};
  assert.deepEqual(refreshedRow(before,next).entry,next.entry);
});
test('season insertion retains existing categories by key and a failed new collection stays empty',async()=>{
  const {prepareCatalogRows,refreshedRow}=await snapshots;
  const {getCuratedRows}=await import('../src/react/curated.mjs');
  const descriptors=now=>getCuratedRows({now:new Date(now+'T12:00:00')});
  const before=descriptors('2026-11-19').map(entry=>({entry,items:titles(),loading:false}));
  const added=descriptors('2026-11-20'),prepared=prepareCatalogRows(before,added);
  assert.deepEqual(prepared.map(row=>row.entry.key),added.map(entry=>entry.key));
  const provider=before.find(row=>row.entry.key==='nfx-movie');
  assert.equal(prepared.find(row=>row.entry.key==='nfx-movie'),provider,'The shifted provider retains its row and card references');
  const seasonal=prepared.find(row=>row.entry.key==='season-christmas');
  assert.deepEqual(seasonal.items,[]);assert.equal(seasonal.loading,true);
  const failure={entry:seasonal.entry,items:[],loading:false,error:'Unavailable'};
  assert.equal(refreshedRow(seasonal,failure),failure);
  assert.equal(refreshedRow(provider,failure),failure,'A failed new category cannot inherit another category’s titles');
});
test('season removal discards vanished rows without shifting or duplicating retained categories',async()=>{
  const {prepareCatalogRows}=await snapshots;
  const {getCuratedRows}=await import('../src/react/curated.mjs');
  const descriptors=now=>getCuratedRows({now:new Date(now+'T12:00:00')});
  const before=descriptors('2027-01-06').map(entry=>({entry,items:titles(),loading:false}));
  const remaining=descriptors('2027-01-07'),prepared=prepareCatalogRows(before,remaining);
  assert.deepEqual(prepared.map(row=>row.entry.key),remaining.map(entry=>entry.key));
  assert.equal(prepared.length,before.length-1);
  assert.equal(new Set(prepared.map(row=>row.entry.key)).size,prepared.length);
  assert.ok(prepared.every(row=>row===before.find(prior=>prior.entry.key===row.entry.key)));
  assert.equal(prepared.some(row=>row.entry.key==='season-christmas'),false);
});
