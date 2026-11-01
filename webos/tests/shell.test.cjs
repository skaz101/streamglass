const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../src/shell.js');

test('addon resource URLs retain configured paths and safely encode identifiers', () => {
  const url = h.resourceURL('https://addon.example/torbox=SECRET/manifest.json','stream','series','tt123:1:2');
  assert.equal(url,'https://addon.example/torbox=SECRET/stream/series/tt123%3A1%3A2.json');
  const search=h.resourceURL('https://addon.example/manifest.json','catalog','movie','top',{search:'A & B/part 2',skip:100});
  assert.equal(search,'https://addon.example/catalog/movie/top/search=A%20%26%20B%2Fpart%202&skip=100.json');
});

test('addon URL acceptance rejects script, file and malformed manifests', () => {
  assert.equal(h.safeURL('javascript:alert(1)'),'');
  assert.equal(h.safeURL('file:///etc/passwd'),'');
  assert.equal(h.manifestURL('stremio://addon.example/config/manifest.json'),'https://addon.example/config/manifest.json');
  assert.throws(()=>h.manifestURL('https://addon.example/not-manifest'),/manifest/);
  assert.throws(()=>h.manifestURL('data:text/html,test'));
});

test('resource filters honor types and ID prefixes', () => {
  const addon={manifest:{types:['movie','series'],resources:['meta',{name:'stream',types:['series'],idPrefixes:['tt']}],idPrefixes:['tt']}};
  assert.equal(h.supports(addon,'meta','movie','tt12'),true);
  assert.equal(h.supports(addon,'meta','movie','kitsu:12'),false);
  assert.equal(h.supports(addon,'stream','movie','tt12'),false);
  assert.equal(h.supports(addon,'stream','series','tt12:1:1'),true);
});

test('metadata and route content cannot break HTML or hash routing', () => {
  assert.equal(h.escapeHTML('<img src=x onerror="oops">'), '&lt;img src=x onerror=&quot;oops&quot;&gt;');
  const hash=h.detailHash('series','kitsu:1/2','id?&=');
  const parsed=h.parseHash(hash);
  assert.equal(parsed.parts[1],'series');assert.equal(parsed.parts[2],'kitsu:1/2');
  assert.equal(parsed.query.get('video'),'id?&=');
});

test('Stremio progress percentages become correct fractions', () => {
  assert.equal(h.progressFraction(50),.5);
  assert.equal(h.progressFraction(100),1);
  assert.equal(h.progressFraction(-15),0);
  assert.equal(h.progressFraction(null),0);
});

test('progress uses milliseconds and distinguishes backwards and forwards seeks', () => {
  const previous={time:60000,wall:100000};
  assert.deepEqual(h.playbackUpdate(previous,63000,120000,103000),{
    action:'Player',args:{action:'TimeChanged',args:{time:63000,duration:120000,device:'streamglass-webos'}}
  });
  assert.equal(h.playbackUpdate(previous,50000,120000,100500).args.action,'Seek');
  assert.equal(h.playbackUpdate(previous,90000,120000,100500).args.action,'Seek');
  assert.equal(h.playbackUpdate(null,60000,120000,100000).args.action,'TimeChanged');
});

test('core messages follow the MIT Stremio action envelope', () => {
  assert.deepEqual(h.ctxAction('Authenticate',{type:'Login',email:'test@example.invalid',password:'fixture',facebook:false}),{
    action:'Ctx',args:{action:'Authenticate',args:{type:'Login',email:'test@example.invalid',password:'fixture',facebook:false}}
  });
  assert.deepEqual(h.loadAction('LibraryWithFilters',{request:{type:null,sort:'lastwatched',page:1}}),{
    action:'Load',args:{model:'LibraryWithFilters',args:{request:{type:null,sort:'lastwatched',page:1}}}
  });
});


test('late subtitle results retain existing choices and remove duplicates', () => {
  const first=[{url:'https://subs.example/first.vtt',lang:'eng'}];
  const merged=h.mergeSubtitles(first,[{url:'https://subs.example/second.vtt',lang:'spa'},...first,{url:'javascript:alert(1)'}]);
  assert.equal(merged.length,2);assert.equal(merged[0],first[0]);assert.equal(merged[1].lang,'spa');
});

test('stream badges only report formats named by the addon', () => {
  assert.deepEqual(h.streamBadges({name:'Torrentio 2160p',title:'Movie.HEVC.HDR10.Atmos'}),['4K','HDR','HEVC','Atmos']);
  assert.deepEqual(h.streamBadges({name:'Torrentio 1080p',title:'Movie H.264 AAC'}),['1080p']);
  assert.deepEqual(h.streamBadges({name:'TorBox',description:'Unknown format'}),[]);
  assert.deepEqual(h.streamBadges({title:'Movie.DoVi.2160p.x265'}),['4K','Dolby Vision','HEVC']);
});
