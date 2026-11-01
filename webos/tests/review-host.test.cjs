// StreamGlass host contract checks. GPL-3.0-or-later.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function host() {
  const listeners = new Map();
  const document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  const window = {addEventListener(name, callback) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(callback);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/host.js'), 'utf8'), {
    window, document,
    navigator: {userAgent: 'Chrome/120.0.0 webOS', onLine: true},
    screen: {width: 1920, height: 1080},
    console: {info() {}},
    performance: {now: () => 1000},
    location: {hash: '#/board'},
  });
  return {window, document, listeners};
}

test('diagnostic export excludes credentials, URLs and arbitrary strings', () => {
  const {window} = host();
  window.StreamGlassDiagnostics.log('request_failed', {
    code: 403, timeMs: 1500, paused: true,
    authKey: 'private-auth-key', url: 'https://debrid.example/private-token/movie',
    password: 'never-export-me', message: 'also-private', width: Infinity,
  });
  const text = window.StreamGlassDiagnostics.export();
  const event = JSON.parse(text).events[0];
  assert.equal(event.code, 403);
  assert.equal(event.timeMs, 1500);
  assert.equal(event.paused, true);
  assert.equal(event.authKey, undefined);
  assert.equal(event.url, undefined);
  assert.equal(event.width, undefined);
  assert.doesNotMatch(text, /private|never-export/);
});

test('diagnostic event history is bounded', () => {
  const {window} = host();
  for (let i = 0; i < 230; i++) window.StreamGlassDiagnostics.log('sample', {count: i});
  const events = JSON.parse(window.StreamGlassDiagnostics.export()).events;
  assert.equal(events.length, 200);
  assert.equal(events[0].count, 30);
});

test('remote Enter event with document target does not crash navigation', () => {
  const {document, listeners} = host();
  assert.doesNotThrow(() => listeners.get('keydown')[0]({
    key: 'Enter', keyCode: 13, target: document,
    preventDefault() {}, stopImmediatePropagation() {},
  }));
});
