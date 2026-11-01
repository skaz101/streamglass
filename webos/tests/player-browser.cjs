// StreamGlass player smoke test. Requires Playwright and ffmpeg; GPL-3.0-or-later.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {spawnSync} = require('node:child_process');
const {chromium} = require('playwright');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'streamglass-player-'));
  let browser, server;
  try {
    const generated = spawnSync('ffmpeg', ['-v','error','-f','lavfi','-i','color=c=blue:s=640x360:r=25','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','15','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',path.join(dir,'test.mp4')]);
    assert.equal(generated.status, 0, 'ffmpeg could not create test media: ' + generated.stderr);
    const video = fs.readFileSync(path.join(dir, 'test.mp4'));
    const html = '<!doctype html><html><head><link rel="stylesheet" href="/player.css"></head><body><button id="previous">Previous</button><script src="/player.js"></script><script>window.progressEvents=[];window.closeEvents=[];window.player=new WebOSPlayer({onProgress:(...args)=>progressEvents.push(args),onClose:info=>closeEvents.push(info)});window.addEventListener("keydown",e=>{if(player.handleKey(e)){e.preventDefault();e.stopImmediatePropagation();}},true);</script></body></html>';
    server = http.createServer((req, res) => {
      if (req.url === '/') { res.setHeader('Content-Type','text/html'); res.end(html); }
      else if (req.url === '/player.js' || req.url === '/player.css') {
        res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'text/css');
        res.end(fs.readFileSync(path.join(__dirname, '..', 'src', req.url.slice(1))));
      } else if (req.url.endsWith('.srt')) {
        const send = () => { res.setHeader('Content-Type', 'text/plain'); res.end('1\n00:00:00,000 --> 00:00:14,000\nSmoke test subtitle\n'); };
        if (req.url.startsWith('/slow')) setTimeout(send, 500); else send();
      } else if (req.url === '/video.mp4') {
        res.setHeader('Content-Type', 'video/mp4'); res.setHeader('Accept-Ranges', 'bytes');
        const range = req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);
        if (range) {
          const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
          res.writeHead(206, {'Content-Range': `bytes ${start}-${end}/${video.length}`, 'Content-Length': end - start + 1}); res.end(video.subarray(start,end+1));
        } else { res.setHeader('Content-Length', video.length); res.end(video); }
      } else {res.statusCode = 404; res.end();}
    });
    await new Promise((resolve) => server.listen(0,'127.0.0.1',resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const options = {headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']};
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) options.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(options);
    const page = await browser.newPage({viewport: {width:1280,height:720}});
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate((origin) => player.play({url: origin + '/video.mp4', title:'Local H.264/AAC test', hash:'#/player/fixture', videoId:'fixture', startMs:3000, subtitles:[{url:origin+'/test.srt',lang:'eng',label:'English'}], subtitleLanguage:'en'}), origin);
    await page.waitForFunction(() => player.video && !player.video.paused && player.video.currentTime >= 3 && player.video.videoWidth === 640);
    await page.waitForFunction(() => player.video.textTracks.length === 1 && player.video.textTracks[0].cues && player.video.textTracks[0].cues.length === 1);
    assert.equal(await page.evaluate(() => player.video.textTracks[0].mode), 'showing');
    await page.evaluate(() => player.handleKey({keyCode:19}));
    assert.equal(await page.evaluate(() => player.video.paused), true);
    await page.evaluate(() => { player.seekTo(7); player.showControls(false); });
    await page.waitForFunction(() => Math.abs(player.video.currentTime - 7) < .2);
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => player.video.currentTime < .1);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => player.controlsShown), true);
    await page.evaluate(() => player.subtitleMenu());
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => player.subtitleChoice), 'off');
    await page.evaluate(() => { player.handleKey({keyCode:415}); window.dispatchEvent(new Event('pagehide')); });
    assert.equal(await page.evaluate(() => player.video.paused), true);
    assert.ok(await page.evaluate(() => progressEvents.length >= 3));
    await page.evaluate(() => player.close());
    assert.equal(await page.evaluate(() => player.active()), null);
    assert.equal(await page.evaluate(() => closeEvents[0].videoId), 'fixture');
    await page.evaluate((origin) => {player.play({url: origin+'/video.mp4', subtitles:[{url:origin+'/slow.srt'}]});player.selectSubtitle('external:0');player.close();player.play({url:origin+'/video.mp4'});}, origin);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => player.video.textTracks.length), 0, 'old subtitle request leaked into next stream');
    await page.evaluate(() => player.close());
    await page.evaluate((origin) => player.play({url:origin+'/video.mp4',headers:{Referer:'https://example.test'}}), origin);
    assert.match(await page.locator('.webos-player-message').innerText(), /custom request headers/);
    await page.evaluate(() => player.close());
    assert.deepEqual(errors, [], 'browser runtime exceptions');
    console.log('PASS: native H.264/AAC play, saved-position resume, SRT captions, pause/seek/remote, subtitles off, pagehide progress, close, stale-request cleanup, unsupported-header error.');
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, {recursive:true, force:true});
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
