const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function boot() {
  class MockWorker {
    static instances = [];
    constructor() { this.listeners = {}; this.stopped = false; MockWorker.instances.push(this); }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    emit(name, data) { for (const callback of this.listeners[name] || []) callback(data); }
    postMessage({ request }) {
      if (!request) return;
      queueMicrotask(() => this.emit('message', { data: { response: { id: request.id, result: { data: request.path[0] === 'init' ? undefined : { fromWorker: MockWorker.instances.indexOf(this) } } } } }));
    }
    terminate() { this.stopped = true; }
  }
  const window = { __StreamGlassWorkerSource: '/* test */', location: { hash: '#/' }, localStorage: new Map() };
  const context = vm.createContext({ window, Worker: MockWorker, Blob, URL, setTimeout, clearTimeout, console });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core-client.js'), 'utf8'), context);
  return { api: window.StreamGlassCore, MockWorker };
}

test('worker crash resets core and stale worker errors cannot stop replacement', async () => {
  const { api, MockWorker } = boot();
  await api.init();
  const old = MockWorker.instances[0];
  assert.equal(api.ready, true);
  old.emit('error', {});
  assert.equal(api.ready, false);
  assert.equal(old.stopped, true);
  await api.init();
  assert.equal(MockWorker.instances.length, 2);
  old.emit('messageerror', {});
  assert.equal(api.ready, true);
  assert.equal((await api.getState('ctx')).fromWorker, 1);
  api.destroy();
  assert.equal(MockWorker.instances[1].stopped, true);
});

test('one initialization is shared and destroy permits a clean retry', async () => {
  const { api, MockWorker } = boot();
  const first = api.init();
  assert.equal(first, api.init());
  await first;
  api.destroy();
  await api.init();
  assert.equal(MockWorker.instances.length, 2);
  assert.equal(api.ready, true);
  api.destroy();
});
