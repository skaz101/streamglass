const test=require('node:test');
const assert=require('node:assert/strict');
test('TV rail thumbnails use the verified CDN variant without rewriting addon or signed artwork',async()=>{
  const {tvRailArtwork}=await import('../src/react/artwork.mjs');
  for(const size of ['medium','large'])assert.equal(tvRailArtwork(`https://images.metahub.space/background/${size}/tt6611324/img`),'https://images.metahub.space/background/small/tt6611324/img');
  for(const src of [undefined,'','https://images.metahub.space/background/small/tt1/img','https://images.metahub.space/poster/medium/tt1/img','https://images.metahub.space/background/medium/tt1/img?token=keep','https://images.metahub.space/background/medium/tt1/img#keep','https://cdn.example/background/medium/tt1/img','http://images.metahub.space/background/medium/tt1/img','https://images.metahub.space.evil.invalid/background/medium/tt1/img'])assert.equal(tvRailArtwork(src),src);
});
