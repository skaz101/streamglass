// Exercise actual React cards with a missing optimized image, metadata updates,
// and a failed original URL. The original artwork is retried at most once.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require('playwright');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'streamglass-artwork-'));let browser;
 try{
  await build({entryPoints:[path.resolve(__dirname,'../src/react/app.jsx')],outfile:path.join(temp,'app.js'),bundle:true,format:'iife',target:'chrome87',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'}});
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://images.metahub.space/**',async route=>{
   const url=route.request().url();requests.push(url);
   if(url.includes('/small/')&&!url.includes('/tt5/')||url.includes('/tt3/'))return route.fulfill({status:404,body:'Missing'});
   return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#444"/></svg>'});
  });
  await page.setContent('<main id="cards"></main>');
  await page.addScriptTag({path:path.join(temp,'app.js')});
  await page.evaluate(()=>{
   window.api={mobile:false,registerCard(){},safeURL:src=>src||'',progressFraction:()=>0,detailHash:(type,id)=>'#/detail/'+type+'/'+id};
   window.renderArt=(id,mobile=false,size='medium')=>{
    api.mobile=mobile;
    const meta={id:'stable-id',type:'movie',name:'A title',background:`https://images.metahub.space/background/${size}/${id}/img`,poster:`https://images.metahub.space/poster/medium/${id}/img`};
    StreamGlassUI.region(document.getElementById('cards'),{api,rows:[{title:'Titles',items:[meta],wide:mobile}]});
   };
   renderArt('tt1');document.querySelector('.sg-card').focus();window.card=document.activeElement;window.art=card.querySelector('img');
  });
  await page.waitForFunction(()=>document.querySelector('img')?.dataset.artReady==='true');
  assert.equal(await page.locator('img').getAttribute('src'),'https://images.metahub.space/background/medium/tt1/img');
  assert.deepEqual(requests.slice(0,2),['https://images.metahub.space/background/small/tt1/img','https://images.metahub.space/background/medium/tt1/img']);
  assert.equal(await page.evaluate(()=>document.activeElement===card&&art===card.querySelector('img')),true,'Fallback preserves the focused card and image element');
  await page.evaluate(()=>renderArt('tt2'));
  await page.waitForFunction(()=>document.querySelector('img')?.dataset.artReady==='true'&&document.querySelector('img').src.includes('/tt2/'));
  assert.ok(requests.includes('https://images.metahub.space/background/small/tt2/img'),'New metadata tries its optimized artwork independently');
  await page.evaluate(()=>renderArt('tt3'));
  await page.locator('.sg-poster-placeholder').waitFor();
  assert.equal(requests.filter(url=>url.includes('/tt3/')).length,2,'A missing variant and original end at the title placeholder without a retry loop');
  assert.equal(await page.evaluate(()=>document.activeElement===card),true);
  const before=requests.length;
  await page.evaluate(()=>renderArt('tt4',true));
  await page.waitForFunction(()=>document.querySelector('img')?.dataset.artReady==='true');
  assert.deepEqual(requests.slice(before),['https://images.metahub.space/background/medium/tt4/img'],'Mobile wide cards retain their original artwork URL');
  // Different originals can share one small variant. A late decode for the old
  // fallback must not undo readiness after the newer request has completed.
  await page.evaluate(()=>{
   window.raceDecodes=[];window.originalDecode=HTMLImageElement.prototype.decode;
   HTMLImageElement.prototype.decode=function(){
    return this.src.includes('/small/tt5/')?new Promise(resolve=>raceDecodes.push(resolve)):originalDecode.call(this);
   };
   renderArt('tt5');window.raceImage=document.querySelector('img');
  });
  await page.waitForFunction(()=>raceDecodes.length>0);
  const oldDecodeCount=await page.evaluate(()=>raceDecodes.length);
  await page.evaluate(()=>renderArt('tt5',false,'large'));
  await page.waitForFunction(count=>raceDecodes.length>count,oldDecodeCount);
  await page.evaluate(count=>raceDecodes.slice(count).forEach(resolve=>resolve()),oldDecodeCount);
  await page.waitForFunction(()=>document.querySelector('img')?.dataset.artReady==='true');
  await page.evaluate(async count=>{
   raceDecodes.slice(0,count).forEach(resolve=>resolve());
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   HTMLImageElement.prototype.decode=originalDecode;
  },oldDecodeCount);
  assert.equal(await page.locator('img').getAttribute('data-art-ready'),'true','An older decode cannot hide the current decoded thumbnail');
  assert.equal(await page.evaluate(()=>document.activeElement===card&&document.querySelector('img')===raceImage),true,'Out-of-order decoding preserves the focused card and its image');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,tvThumbnailFallback:true,stableFocus:true,metadataChange:true,boundedRetries:true,mobileUnchanged:true,staleDecodeIgnored:true}));
 }finally{if(browser)await browser.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
