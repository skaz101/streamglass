// Copyright (C) 2026 StreamGlass contributors. GPL-3.0-or-later.
// Independent client for the MIT Stremio core worker's documented RPC contract.
(function (root) {
  'use strict';
  const listeners = new Map();
  const pending = new Map();
  let serial = 0;
  let worker = null;
  let initializing = null;
  let ready = false;
  let generation = 0;

  function emit(name, value) {
    for (const listener of listeners.get(name) || []) {
      try { listener(value); } catch (error) { console.warn('[StreamGlass] Core listener failed:', error.name); }
    }
  }

  function failAll(message) {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error(message));
    }
    pending.clear();
    ready = false;
    emit('error', { message });
  }

  // Only the core's four host operations are exposed to the worker. Requests
  // cannot traverse the DOM or call arbitrary window methods.
  async function hostRequest(request) {
    const name = Array.isArray(request.path) ? request.path.join('.') : '';
    const args = Array.isArray(request.args) ? request.args : [];
    switch (name) {
      case 'location.hash': return root.location.hash;
      case 'localStorage.getItem': return root.localStorage.getItem(args[0]);
      case 'localStorage.setItem': return root.localStorage.setItem(args[0], args[1]);
      case 'localStorage.removeItem': return root.localStorage.removeItem(args[0]);
      case 'onCoreEvent': {
        const event = args[0] || {};
        emit('raw', event);
        if (event.name === 'NewState') emit('state', event.args);
        if (event.name === 'CoreEvent') {
          emit('event', event.args);
          if (event.args && event.args.event === 'Error') emit('error', event.args.args);
        }
        if (typeof root.onCoreEvent === 'function') root.onCoreEvent(event);
        return undefined;
      }
      default: throw new Error('Unsupported core host operation');
    }
  }

  function call(path, args) {
    if (!worker) return Promise.reject(new Error('Stremio core is not initialized'));
    const id = 'sg-' + (++serial);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Stremio core request timed out'));
      }, 30000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ request: { id, path, args } });
    });
  }

  const api = {
    version: '0.66.0',
    get ready() { return ready; },
    init(options) {
      if (initializing) return initializing;
      const launch = ++generation;
      initializing = (async () => {
        if (typeof root.__StreamGlassWorkerSource !== 'string') throw new Error('Bundled Stremio core is missing');
        const url = URL.createObjectURL(new Blob([root.__StreamGlassWorkerSource], { type: 'text/javascript' }));
        try { worker = new Worker(url); } finally { URL.revokeObjectURL(url); }
        const launchedWorker = worker;
        const failWorker = message => {
          if (generation !== launch) return;
          generation++;
          launchedWorker.terminate();
          worker = null;
          initializing = null;
          failAll(message);
        };
        launchedWorker.addEventListener('error', () => failWorker('Stremio core worker failed. Open Developer Mode logs for details.'));
        launchedWorker.addEventListener('messageerror', () => failWorker('Stremio core message could not be read'));
        launchedWorker.addEventListener('message', async ({ data }) => {
          if (generation !== launch) return;
          if (data && data.response) {
            const response = data.response;
            const item = pending.get(response.id);
            if (!item) return;
            pending.delete(response.id);
            clearTimeout(item.timer);
            const result = response.result || {};
            if ('error' in result) item.reject(result.error instanceof Error ? result.error : new Error(String(result.error && result.error.message || result.error)));
            else item.resolve(result.data);
          }
          if (data && data.request) {
            let result;
            try { result = { data: await hostRequest(data.request) }; }
            catch (error) { result = { error: { name: error.name, message: error.message } }; }
            if (generation === launch) launchedWorker.postMessage({ response: { id: data.request.id, result } });
          }
        });
        await call(['init'], [{ appVersion: '0.1.0', shellVersion: 'webos25', ...(options || {}) }]);
        ready = true;
        emit('ready', true);
        return api;
      })().catch(error => {
        if (generation === launch) {
          generation++;
          if (worker) worker.terminate();
          worker = null;
          initializing = null;
        }
        throw error;
      });
      return initializing;
    },
    getState(model) { return call(['getState'], [model]); },
    dispatch(action, model) { return call(['dispatch'], [action, model, root.location.hash]); },
    encodeStream(stream) { return call(['encodeStream'], [stream]); },
    decodeStream(stream) { return call(['decodeStream'], [stream]); },
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return () => api.off(name, listener);
    },
    off(name, listener) { if (listeners.has(name)) listeners.get(name).delete(listener); },
    destroy() {
      generation++;
      failAll('Stremio core was closed');
      if (worker) worker.terminate();
      worker = null;
      ready = false;
      initializing = null;
    },
  };
  root.StreamGlassCore = api;
  root.core = api;
})(window);
