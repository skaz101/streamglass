// React route lifecycle, carousel controls, dates and reduced motion on both layouts.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>body{margin:0;background:#101014;color:white;font-family:Arial}#sg-view{height:100vh;overflow:auto}.sg-page{padding:30px}</style><div id="app"><main id="sg-view"></main></div>');
  await page.addStyleTag({path:path.resolve(__dirname,'../build/shell.css')});
  await page.addStyleTag({path:path.resolve(__dirname,'../build/react-ui.css')});
  await page.addScriptTag({path:path.resolve(__dirname,'../build/react-ui.js')});
  await page.evaluate(()=>{
   const today=new Date();const day=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
   const items=[{id:'one',type:'series',name:'A quieter tomorrow',description:'A familiar place. An unexpected story.',genres:['Drama'],videos:[{id:'one:1:2',season:1,episode:2,title:'Coming home',released:day}]},{id:'two',type:'movie',name:'Across the water',released:day}];
   const entries=[{key:'popular',catalog:{name:'Popular',type:'movie'},addon:{manifest:{name:'Fixture'}}},{key:'featured',catalog:{name:'Featured',type:'series'},addon:{manifest:{name:'Fixture'}}}];
   window.requests=0;window.testAPI={mobile:false,registerCard(){},safeURL(){return '';},progressFraction(){return 0;},detailHash(type,id,video){return '#/detail/'+type+'/'+id+(video?'?video='+encodeURIComponent(video):'');},catalogs(){return entries;},catalog(){return Promise.resolve({metas:items});},continueWatching(){return Promise.resolve([]);},resolveMeta(type,id,fallback){window.requests++;return Promise.resolve({meta:fallback});},calendarLibrary(){return Promise.resolve({catalog:items});},calendarMeta(item){return Promise.resolve(item);}};
   window.mountTest=route=>{const node=document.getElementById('sg-view');StreamGlassUI.unmount(node);StreamGlassUI.mount(node,{route,api:window.testAPI,params:new URLSearchParams()});};
   window.mountTest('board');
  });
  await page.getByRole('heading',{name:'A quieter tomorrow'}).waitFor();
  await page.getByRole('button',{name:'Next featured title'}).click();
  await page.getByRole('heading',{name:'Across the water'}).waitFor();
  await page.getByRole('button',{name:'Pause featured slideshow'}).click();
  assert.equal(await page.getByRole('button',{name:'Resume featured slideshow'}).getAttribute('aria-pressed'),'true');
  await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>requests)<=3,'Metadata requests remain bounded during rerenders');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.sg-react-hero-copy').evaluate(node=>getComputedStyle(node).animationName),'none');
  await page.evaluate(()=>mountTest('calendar'));
  await page.getByRole('link',{name:'A quieter tomorrow S1 · E2 · Coming home'}).waitFor();
  assert.ok((await page.getByRole('link',{name:'A quieter tomorrow S1 · E2 · Coming home'}).getAttribute('href')).includes('one%3A1%3A2'));
  await page.getByRole('button',{name:'Next month',exact:true}).click();await page.getByRole('heading',{name:'No releases scheduled here'}).waitFor();
  await page.getByRole('button',{name:'Today',exact:true}).click();await page.locator('.sg-release-item').first().waitFor();
  const shots=path.resolve(__dirname,'../test-results');await fs.mkdir(shots,{recursive:true});
  await page.screenshot({path:path.join(shots,'react-calendar-tv.png')});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(shots,'react-calendar-mobile.png')});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Calendar fits phone width');
  for(const route of ['board','calendar','board','calendar'])await page.evaluate(route=>mountTest(route),route);
  await page.waitForTimeout(200);assert.deepEqual(errors,[]);
  console.log('React carousel, calendar, route cleanup, phone layout and reduced motion passed.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
