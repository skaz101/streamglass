// GPL-3.0-or-later. Player helpers and lifecycle behavior without a TV.
const test = require('node:test');
const assert = require('node:assert/strict');
const {WebOSPlayer, helpers} = require('../src/player.js');

test('direct playback preserves signed query links', () => {
  const value = 'https://cdn.example.test/video.mkv?token=a%2Bb&expires=123';
  assert.equal(helpers.directURL(value), value);
});
test('direct playback rejects torrent, script, local file and credential URLs', () => {
  for (const url of ['magnet:?xt=urn:btih:abc', 'javascript:alert(1)', 'file:///tmp/movie.mp4', 'https://user:pass@example.test/movie.mp4']) assert.throws(() => helpers.directURL(url));
});
test('SRT is converted with BOM, CRLF, identifiers and millisecond precision', () => {
  assert.equal(helpers.subtitlesToVTT('\uFEFF1\r\n00:00:01,250 --> 00:00:03,500\r\nHello, world\r\n'), 'WEBVTT\n\n1\n00:00:01.250 --> 00:00:03.500\nHello, world\n');
});
test('VTT is retained without losing cue settings', () => {
  const value = 'WEBVTT\n\n00:01.000 --> 00:02.000 align:start\nHello';
  assert.equal(helpers.subtitlesToVTT(value), value + '\n');
});
test('unsupported subtitle formats report a usable error', () => {
  assert.throws(() => helpers.subtitlesToVTT('[Script Info]\nTitle: unsupported'), /unsupported/);
});
test('human time includes hours and clamps negative values', () => {
  assert.equal(helpers.formatTime(3672.9), '1:01:12');
  assert.equal(helpers.formatTime(92), '1:32');
  assert.equal(helpers.formatTime(-9), '0:00');
});
test('language preferences match common two-letter and ISO three-letter aliases', () => {
  assert.equal(helpers.languageKey('en-US'), helpers.languageKey('eng'));
  assert.equal(helpers.languageKey('fre'), helpers.languageKey('fr'));
  assert.equal(helpers.languageKey('arm'), helpers.languageKey('hy-AM'));
});
test('audio selection disables other tracks, uses documented enabled API', () => {
  const player = new WebOSPlayer();
  player.video = {audioTracks: [{enabled: true}, {enabled: false}, {enabled: true}]};
  player.selectAudio(1);
  assert.deepEqual(player.video.audioTracks.map((t) => t.enabled), [false, true, false]);
  player.selectAudio(9);
  assert.deepEqual(player.video.audioTracks.map((t) => t.enabled), [false, true, false]);
});
test('preferred audio waits for the matching track', () => {
  const player = new WebOSPlayer();
  player.payload = {audioLanguage: 'en'};
  player.video = {audioTracks: [{language: 'spa', enabled: true}]};
  player.choosePreferredAudio();
  assert.equal(player.preferredAudioApplied, undefined);
  player.video.audioTracks.push({language: 'eng', enabled: false});
  player.choosePreferredAudio();
  assert.deepEqual(player.video.audioTracks.map((t) => t.enabled), [false, true]);
});
test('seeking clamps to stream bounds and reports milliseconds', () => {
  const player = new WebOSPlayer();
  player.video = {currentTime: 20, duration: 90};
  player.progress = () => {};
  player.seekTo(-15);
  assert.equal(player.position(), 0);
  player.seekTo(500);
  assert.equal(player.position(), 89950);
  assert.equal(player.duration(), 90000);
});
test('inactive player yields keys to the app', () => {
  assert.equal(new WebOSPlayer().handleKey({keyCode: 461}), false);
});
test('media pause and play keys control the video without needing DOM focus', () => {
  const player = new WebOSPlayer();
  player.overlay = {};
  let pauseCount = 0, toggleCount = 0;
  player.video = {paused: true, pause() { pauseCount++; }};
  player.toggle = () => { toggleCount++; };
  assert.equal(player.handleKey({keyCode: 19}), true);
  assert.equal(player.handleKey({keyCode: 415}), true);
  assert.equal(pauseCount, 1);
  assert.equal(toggleCount, 1);
});
test('close reports final state and tears down before callback', () => {
  let result, destroyed = false;
  const player = new WebOSPlayer({onClose(value) { result = value; assert.ok(destroyed); }});
  player.overlay = {};
  player.payload = {hash: '#/player/test', videoId: 'episode:1:2'};
  player.video = {currentTime: 12.4, duration: 100};
  player.progress = () => {};
  player.destroy = () => { destroyed = true; player.overlay = null; };
  player.close({ended: true});
  assert.equal(result.timeMs, 12400);
  assert.equal(result.durationMs, 100000);
  assert.equal(result.hash, '#/player/test');
  assert.equal(result.ended, true);
});
test('close attempts source unload and completes teardown after native media failures', () => {
  for (const failure of ['pause', 'removeAttribute', 'load']) {
    const calls = [], diagnostics = [];
    let sourcePresent = true, detached = false, closed = 0;
    const player = new WebOSPlayer({log(event, fields) { diagnostics.push({event, fields}); }, onClose(result) {
      closed++; assert.equal(player.active(), null); assert.equal(player.video, null); assert.ok(detached);
      assert.equal(result.timeMs, 12000); assert.equal(result.durationMs, 60000);
    }});
    player.payload = {};
    player.overlay = {remove() { detached = true; }};
    player.video = {currentTime: 12, duration: 60, paused: false,
      getAttributeNode() { return sourcePresent ? {} : null; }, removeAttributeNode() { sourcePresent = false; calls.push('removeAttributeNode'); }};
    for (const method of ['pause', 'removeAttribute', 'load']) player.video[method] = () => {
      calls.push(method);
      if (method === failure) throw Error('Injected platform failure');
      if (method === 'removeAttribute') sourcePresent = false;
    };
    assert.doesNotThrow(() => player.close({reason: 'hidden'}));
    assert.ok(calls.includes('pause') && calls.includes('removeAttribute') && calls.includes('load'), 'Every media cleanup step is attempted after ' + failure);
    assert.equal(sourcePresent, false, 'The old source is removed even if the convenience method fails');
    assert.equal(closed, 1);
    assert.deepEqual(diagnostics, [{event: 'media-release-failed', fields: {count: 1}}]);
    player.close(); assert.equal(closed, 1, 'Repeated lifecycle events do not close twice');
  }
});
test('subtitle cleanup failures do not prevent video source release', () => {
  const calls = [], player = new WebOSPlayer();
  const originalRevoke = URL.revokeObjectURL;
  try {
    URL.revokeObjectURL = () => { calls.push('revoke'); throw Error('Injected blob failure'); };
    player.abort = {abort() { calls.push('abort'); throw Error('Injected abort failure'); }};
    player.trackElement = {remove() { calls.push('track-remove'); throw Error('Injected track failure'); }, parentNode: {removeChild() { calls.push('track-detach'); }}};
    player.externalTrack = {}; player.blobURL = 'blob:fixture';
    player.video = {pause() { calls.push('pause'); }, removeAttribute() { calls.push('remove-src'); }, load() { calls.push('load'); }};
    assert.doesNotThrow(() => player.releaseMedia());
    assert.deepEqual(calls, ['abort', 'track-remove', 'track-detach', 'revoke', 'pause', 'remove-src', 'load']);
    for (const name of ['abort', 'trackElement', 'externalTrack', 'blobURL']) assert.equal(player[name], null);
  } finally { URL.revokeObjectURL = originalRevoke; }
});
test('failed source removal cannot reload the old stream during teardown', () => {
  const calls = []; let closed = false;
  const player = new WebOSPlayer({onClose() { closed = true; }});
  player.payload = {}; player.overlay = {remove() { calls.push('detach'); }};
  player.video = {currentTime: 0, duration: 60, pause() { calls.push('pause'); },
    removeAttribute() { throw Error('Injected attribute failure'); }, getAttributeNode() { return {}; },
    removeAttributeNode() { throw Error('Injected fallback failure'); }, load() { calls.push('reload-old-source'); }};
  assert.doesNotThrow(() => player.close());
  assert.deepEqual(calls, ['pause', 'detach']);
  assert.ok(closed); assert.equal(player.video, null);
});
test('DOM removal, focus and diagnostic failures cannot interrupt close notification', () => {
  let detached = false, closed = false;
  const player = new WebOSPlayer({log() { throw Error('Injected logging failure'); }, onClose() { closed = true; assert.equal(player.active(), null); assert.ok(detached); }});
  player.payload = {};
  player.overlay = {remove() { throw Error('Injected remove failure'); }, parentNode: {removeChild() { detached = true; }}};
  player.previousFocus = {isConnected: true, focus() { throw Error('Injected focus failure'); }};
  player.video = {currentTime: 0, duration: 60, pause() {}, removeAttribute() {}, load() {}};
  assert.doesNotThrow(() => player.close());
  assert.ok(closed);
  for (const name of ['video', 'overlay', 'previousFocus', 'abort', 'blobURL']) assert.equal(player[name], null);
});
test('an unreadable native checkpoint cannot block decoder cleanup', () => {
  const calls = []; let result;
  const player = new WebOSPlayer({onClose(value) { result = value; }});
  player.payload = {};
  player.overlay = {remove() { calls.push('detach'); }};
  player.video = {get currentTime() { throw Error('Injected clock failure'); }, duration: 60,
    pause() { calls.push('pause'); }, removeAttribute() { calls.push('remove-src'); }, load() { calls.push('load'); }};
  assert.doesNotThrow(() => player.close());
  assert.deepEqual(calls, ['pause', 'remove-src', 'load', 'detach']);
  assert.equal(result.timeMs, 0); assert.equal(result.durationMs, 60000);
});
test('fatal errors release media even when the native checkpoint is unreadable', () => {
  const calls = [], diagnostics = [];
  const player = new WebOSPlayer({log(event, fields) { diagnostics.push({event, fields}); }});
  player.overlay = {querySelectorAll() { return []; }, querySelector() { return {focus() {}}; }};
  player.seekBar = {}; player.closeMenu = () => {}; player.message = () => {}; player.showControls = () => {};
  player.video = {get currentTime() { throw Error('Injected clock failure'); }, duration: 60,
    pause() { calls.push('pause'); }, removeAttribute() { calls.push('remove-src'); }, load() { calls.push('load'); }};
  assert.doesNotThrow(() => player.fail('The stream could not play.', 3));
  assert.deepEqual(calls, ['pause', 'remove-src', 'load']);
  assert.deepEqual(player.failedState, {timeMs:0, durationMs:60000});
  assert.equal(player.pendingError, 'The stream could not play.');
  assert.deepEqual(diagnostics, [{event:'media-checkpoint-failed',fields:{count:1}}, {event:'playback-error',fields:{code:3}}]);
});
test('subtitle reader caps chunked responses without trusting Content-Length', async () => {
  for (const declared of [undefined, '1']) {
    let cancelled = false;
    const body = new ReadableStream({start(controller) {controller.enqueue(new Uint8Array(8));controller.enqueue(new Uint8Array(8));},cancel() {cancelled = true;}});
    const response = new Response(body, {headers: declared ? {'Content-Length':declared} : {}});
    await assert.rejects(helpers.readSubtitleResponse(response, 10), /too large/);
    assert.ok(cancelled);
  }
});
test('subtitle reader handles UTF-8 characters split between chunks', async () => {
  const bytes = new TextEncoder().encode('héllo');
  const response = new Response(new ReadableStream({start(controller) {controller.enqueue(bytes.slice(0,2));controller.enqueue(bytes.slice(2));controller.close();}}));
  assert.equal(await helpers.readSubtitleResponse(response, 10), 'héllo');
});
test('resume retries when metadata seek is not yet applied, then stops', () => {
  const player = new WebOSPlayer();
  let currentTime = 0, attempts = 0;
  player.video = {duration:100,get currentTime(){return currentTime;},set currentTime(value){if (++attempts > 1) currentTime=value;}};
  player.resumeTarget = 35; player.resumePending = true; player.resumeAttempts = 0; player.progress = () => {};
  player.applyResume(); assert.equal(player.resumePending, true);
  player.applyResume(); assert.equal(player.resumePending, false); assert.equal(currentTime, 35);
  player.applyResume(); assert.equal(attempts, 2);
});
test('user seeking cancels an outstanding resume retry', () => {
  const player = new WebOSPlayer();
  player.video = {currentTime:0,duration:100};player.progress = () => {};
  player.resumeTarget = 35;player.resumePending = true;player.resumeAttempts = 0;
  player.seekTo(10);player.applyResume();assert.equal(player.video.currentTime, 10);
});
