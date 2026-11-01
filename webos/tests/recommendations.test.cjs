// GPL-3.0-or-later
const test=require('node:test');
const assert=require('node:assert/strict');
const {selectSeeds,recommend,labels}=require('../src/recommendations.js');
const film=(id,genres=['Drama'],extra={})=>({id,type:'movie',name:id,genres,...extra});
test('Watched and started titles outweigh recent saves; recent history breaks ties',()=>{
  const selected=selectSeeds([film('saved'),film('started',[],{progress:30}),film('watched',[],{watched:true}),film('older',[],{watched:true})]);
  assert.deepEqual(selected.map(item=>item.id),['watched','older','started','saved']);
  assert.deepEqual(selected.map(item=>item.signal),['watched','watched','started','saved']);
});
test('Seeds normalize library IDs, deduplicate, cap work and ignore unsupported types',()=>{
  const items=Array.from({length:30},(_,i)=>({_id:String(i),type:'movie'}));
  assert.equal(selectSeeds([...items,...items,{id:'tv',type:'channel'}]).length,12);
  assert.equal(selectSeeds(items)[0].id,'0');
});
test('No history means no invented personal recommendations',()=>{
  assert.deepEqual(recommend([],[],[film('new')]),[]);
});
test('Excludes saved, watched and in-progress titles and deduplicates catalogues',()=>{
  const history=[film('saved'),film('watched',['Drama'],{watched:true}),film('started',['Drama'],{progress:30})];
  const result=recommend(history,selectSeeds(history),[...history,film('new'),film('new')]);
  assert.deepEqual(result.map(item=>item.id),['new']);
  assert.match(result[0].recommendationReason,/Because you watched watched/);
});
test('Matches metadata instead of recommending unrelated highly rated titles',()=>{
  const history=[film('space',['Science Fiction'],{watched:true})];
  const result=recommend(history,selectSeeds(history),[film('unrelated',['Romance'],{imdbRating:10}),film('similar',['Sci-Fi'],{imdbRating:7}),film('unknown',[])]);
  assert.deepEqual(result.map(item=>item.id),['similar']);
  assert.deepEqual(labels(['SCI-FI','Science Fiction',' drama ','Drama']),['science fiction','drama']);
});
test('Explanations distinguish starting, saving and finishing a title',()=>{
  for(const [extra,reason] of [[{progress:25},'Because you started seed'],[{},'Similar to seed in your library'],[{watched:true},'Because you watched seed']]){
    const history=[film('seed',['Drama'],extra)];
    assert.equal(recommend(history,selectSeeds(history),[film('new')])[0].recommendationReason,reason);
  }
});
test('Director and cast can provide a real match when genre metadata is missing',()=>{
  const history=[film('seed',[],{director:['A Director'],cast:['An Actor']})];
  const result=recommend(history,selectSeeds(history),[film('cast',[],{cast:['An Actor']}),film('director',[],{director:['A Director']})]);
  assert.deepEqual(result.map(item=>item.id),['director','cast']);
});
test('Type filters, limits and deterministic ordering survive mixed addon catalogues',()=>{
  const history=[film('seed')],candidates=[film('one'),film('series',['Drama'],{type:'series'}),film('two')];
  assert.deepEqual(recommend(history,selectSeeds(history),candidates,{type:'movie',limit:1}).map(item=>item.id),['one']);
  assert.deepEqual(recommend(history,selectSeeds(history),candidates),recommend(history,selectSeeds(history),candidates));
});
test('Comparable matches from a second genre enter before repetitive near-duplicates',()=>{
  const history=[film('drama',['Drama'],{watched:true}),film('comedy',['Comedy'],{watched:true})];
  const candidates=[...Array.from({length:10},(_,i)=>film('d'+i)),film('c',['Comedy'])];
  const result=recommend(history,selectSeeds(history),candidates);
  assert.ok(result.slice(0,3).some(item=>item.id==='c'));
});
