// Runs the actual embedded Rust/WASM core from file://, with network mocked.
// No user account or credentials are used or sent anywhere.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = await mkdtemp(path.join(os.tmpdir(), 'streamglass-core-'));
const html = path.join(dir, 'index.html');
const sources = ['generated/core-worker-source.js', 'src/core-client.js'];
await writeFile(html, '<!doctype html><title>Core test</title>' + sources.map(file => '<script src="' + pathToFileURL(path.join(root, file)).href + '"></script>').join(''));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_BIN || undefined,
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  let loginRequests = 0;
  let escapedRequests = 0;
  let acceptLogin = false;
  let libraryWrites = 0;
  const fixtureAddon = { manifest: { id: 'org.streamglass.fixture', version: '1.0.0', name: 'Fixture addon', types: ['movie'], resources: ['meta', 'stream'], catalogs: [] }, transportUrl: 'https://fixtures.invalid/manifest.json', flags: { official: false, protected: false } };
  await page.route(/^https?:/, async route => {
    const reply = value => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(value) });
    if (route.request().url() === 'https://fixtures.invalid/meta/movie/sg-test.json') {
      await reply({ meta: { id: 'sg-test', type: 'movie', name: 'Core test fixture', videos: [{ id: 'sg-test', title: 'Core test fixture', released: '2020-01-01T00:00:00Z' }] } });
    } else if (route.request().url() === 'https://api.strem.io/api/login') {
      loginRequests++;
      if (!acceptLogin) await reply({ error: { code: 1, message: 'Invalid test credentials' } });
      else await reply({ result: { authKey: 'mock-key-only', user: { _id: 'fixture-user', email: 'test@example.invalid', lastModified: '2026-01-01T00:00:00Z', dateRegistered: '2020-01-01T00:00:00Z', premium_expire: null, gdpr_consent: { tos: true, privacy: true, marketing: false, from: 'tests' } } } });
    } else if (route.request().url() === 'https://api.strem.io/api/addonCollectionGet') {
      await reply({ result: { addons: [fixtureAddon], lastModified: '2026-01-01T00:00:00Z' } });
    } else if (route.request().url() === 'https://api.strem.io/api/datastoreGet') {
      await reply({ result: [] });
    } else if (route.request().url() === 'https://api.strem.io/api/datastorePut') {
      libraryWrites++;
      await reply({ result: { success: true } });
    } else {
      escapedRequests++;
      await route.abort();
    }
  });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  const state = await page.evaluate(async () => {
    await StreamGlassCore.init();
    const result = {};
    for (const field of ['ctx', 'library', 'board', 'player', 'continue_watching_preview']) result[field] = await StreamGlassCore.getState(field);
    return result;
  });
  assert.ok(state.ctx.profile);
  assert.ok(Array.isArray(state.ctx.profile.addons));
  assert.ok(Array.isArray(state.library.catalog));
  assert.equal(state.player.selected, null);
  const result = await page.evaluate(async () => {
    const core = StreamGlassCore;
    const errors = [];
    core.on('error', event => errors.push(event));
    await core.dispatch({ action: 'Ctx', args: { action: 'Authenticate', args: { type: 'Login', email: 'test@example.invalid', password: 'not-a-real-password', facebook: false } } }, 'ctx');
    for (let n = 0; n < 100 && !errors.length; n++) await new Promise(resolve => setTimeout(resolve, 50));
    return { errors, authenticated: !!(await core.getState('ctx')).profile.auth };
  });
  assert.equal(loginRequests, 1, 'Invalid login dispatched to intercepted Stremio API exactly once');
  assert.ok(result.errors.length, 'Login error reached UI event listener');
  assert.equal(result.authenticated, false);
  const progress = await page.evaluate(async () => {
    const core = StreamGlassCore;
    const waitFor = async (field, check) => {
      for (let n = 0; n < 100; n++) {
        const state = await core.getState(field);
        if (check(state)) return state;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('Core fixture state did not become ready: ' + field);
    };
    await core.dispatch({ action: 'Ctx', args: { action: 'AddToLibrary', args: { id: 'sg-test', type: 'movie', name: 'Core test fixture' } } }, 'ctx');
    const loadLibrary = { action: 'Load', args: { model: 'LibraryWithFilters', args: { request: { type: null, sort: 'lastwatched', page: 1 } } } };
    await core.dispatch(loadLibrary, 'library');
    const library = await waitFor('library', state => state.catalog.some(item => item._id === 'sg-test'));
    const selected = {
      stream: { url: 'https://fixtures.invalid/video.mp4' },
      streamRequest: { base: 'https://fixtures.invalid/manifest.json', path: { resource: 'stream', type: 'movie', id: 'sg-test', extra: [] } },
      metaRequest: { base: 'https://fixtures.invalid/manifest.json', path: { resource: 'meta', type: 'movie', id: 'sg-test', extra: [] } },
      subtitlesPath: { resource: 'subtitles', type: 'movie', id: 'sg-test', extra: [] },
    };
    const loadPlayer = { action: 'Load', args: { model: 'Player', args: selected } };
    await core.dispatch(loadPlayer, 'player');
    await waitFor('player', state => state.metaItem && state.metaItem.type === 'Ready');
    await core.dispatch({ action: 'Player', args: { action: 'PausedChanged', args: { paused: false } } }, 'player');
    await core.dispatch({ action: 'Player', args: { action: 'TimeChanged', args: { time: 120000, duration: 600000, device: 'streamglass-webos' } } }, 'player');
    const advancing = await waitFor('player', state => state.libraryItem && state.libraryItem.state.timeOffset === 120000);
    await core.dispatch({ action: 'Player', args: { action: 'Seek', args: { time: 60000, duration: 600000, device: 'streamglass-webos' } } }, 'player');
    await core.dispatch({ action: 'Player', args: { action: 'PausedChanged', args: { paused: true } } }, 'player');
    const seeking = await waitFor('player', state => state.libraryItem && state.libraryItem.state.timeOffset === 60000);
    await core.dispatch({ action: 'Unload' }, 'player');
    await new Promise(resolve => setTimeout(resolve, 100));
    core.destroy();
    await core.init();
    await core.dispatch(loadPlayer, 'player');
    const restored = await waitFor('player', state => state.libraryItem && state.libraryItem.state.timeOffset === 60000);
    return { libraryAdded: library.catalog.length === 1, advancedMs: advancing.libraryItem.state.timeOffset, soughtMs: seeking.libraryItem.state.timeOffset, restoredMs: restored.libraryItem.state.timeOffset };
  });
  assert.equal(progress.libraryAdded, true);
  assert.equal(progress.advancedMs, 120000);
  assert.equal(progress.soughtMs, 60000);
  assert.equal(progress.restoredMs, 60000);
  acceptLogin = true;
  const authenticated = await page.evaluate(async () => {
    const core = StreamGlassCore;
    await core.dispatch({ action: 'Ctx', args: { action: 'Authenticate', args: { type: 'Login', email: 'test@example.invalid', password: 'not-a-real-password', facebook: false } } }, 'ctx');
    let ctx;
    for (let n = 0; n < 100; n++) {
      ctx = await core.getState('ctx');
      if (ctx.profile.auth && ctx.profile.addons.some(addon => addon.manifest.id === 'org.streamglass.fixture')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    await core.dispatch({ action: 'Ctx', args: { action: 'AddToLibrary', args: { id: 'sg-auth-test', type: 'movie', name: 'Authenticated fixture' } } }, 'ctx');
    await new Promise(resolve => setTimeout(resolve, 150));
    core.destroy();
    await core.init();
    const restored = await core.getState('ctx');
    return { signedIn: !!ctx.profile.auth, addonSynced: ctx.profile.addons.some(addon => addon.manifest.id === 'org.streamglass.fixture'), signInPersisted: !!restored.profile.auth };
  });
  assert.equal(loginRequests, 2);
  assert.equal(authenticated.signedIn, true);
  assert.equal(authenticated.addonSynced, true);
  assert.equal(authenticated.signInPersisted, true);
  assert.ok(libraryWrites > 0, 'Signed-in library edit reached mocked datastorePut API');
  assert.deepEqual(pageErrors, []);
  console.log(JSON.stringify({ passed: true, browser: browser.version(), core: '0.66.0', protocol: 'file:', boot: true, guestState: true, interceptedInvalidLogin: true, mockedAccount: authenticated, mockedLibraryWrites: libraryWrites, progress, blockedBackgroundRequests: escapedRequests, schemas: Object.fromEntries(Object.entries(state).map(([field, value]) => [field, Object.keys(value)])) }, null, 2));
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
