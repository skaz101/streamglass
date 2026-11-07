/*
 * StreamGlass webOS player, modified 2026-11-06.
 * Copyright (C) 2026 contributors. GPL-3.0-or-later; see ../../LICENSE.
 * Uses public HTMLMediaElement APIs, including LG's documented audioTracks API.
 */
(function (root) {
  'use strict';

  const KEYS = {13: 'Enter', 27: 'Escape', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 461: 'Back', 415: 'MediaPlay', 19: 'MediaPause', 413: 'MediaStop', 412: 'MediaRewind', 417: 'MediaFastForward', 179: 'MediaPlayPause'};
  const LANGUAGES = {en: 'eng', fr: 'fra', fre: 'fra', de: 'deu', ger: 'deu', es: 'spa', it: 'ita', ja: 'jpn', ko: 'kor', zh: 'zho', chi: 'zho', ar: 'ara', hy: 'hye', arm: 'hye', pt: 'por', ru: 'rus'};
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const languageKey = (value) => {
    const short = String(value || '').toLowerCase().split(/[-_]/)[0];
    return LANGUAGES[short] || short;
  };
  function directURL(value) {
    const url = new URL(String(value));
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error('Choose a direct HTTP or HTTPS stream. Torrent and magnet links need a streaming server.');
    return url.href;
  }
  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }
  function subtitlesToVTT(input) {
    const text = String(input).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (/^WEBVTT(?:[ \t]|\n|$)/.test(text)) return text + '\n';
    if (!/(?:\d{2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text)) throw new Error('This subtitle format is unsupported. Choose WebVTT or SRT.');
    // SRT numbering is legal WebVTT cue identification. Convert only timestamp lines.
    return 'WEBVTT\n\n' + text.split('\n').map((line) => {
      if (!line.includes('-->')) return line;
      return line.replace(/(\d{2}:\d{2}(?::\d{2})?),(\d{3})/g, '$1.$2');
    }).join('\n') + '\n';
  }
  async function readSubtitleResponse(response, limit = 5 * 1024 * 1024) {
    if (Number(response.headers.get('content-length')) > limit) {
      if (response.body) await response.body.cancel();
      throw new Error('Subtitle file is too large.');
    }
    // Chromium 120 supports streamed fetch. Do not allocate an unbounded response body on a TV.
    if (!response.body || typeof response.body.getReader !== 'function') throw new Error('This TV could not read the subtitle response.');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = '';
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > limit) { await reader.cancel(); throw new Error('Subtitle file is too large.'); }
        text += decoder.decode(item.value, {stream: true});
      }
      return text + decoder.decode();
    } finally { reader.releaseLock(); }
  }
  function errorMessage(code) {
    return ({1: 'Playback was interrupted.', 2: 'The stream could not be downloaded. Check your connection or choose another link.', 3: 'The TV could not decode this stream. Choose a different video or audio format.', 4: 'The TV cannot play this link or format. Try another stream, such as H.264 with AAC audio.'})[code] || 'The stream could not play. Try another link.';
  }

  class WebOSPlayer {
    constructor(options) {
      this.options = options || {};
      this.session = 0;
      this.overlay = null;
      this.video = null;
      this.payload = null;
      this.pendingError = null;
      this.controlsShown = true;
      this.menu = null;
      this.subtitleSequence = 0;
      this.abort = null;
      this.blobURL = null;
    }
    log(event, fields) {
      // No URLs, tokens, file names or account data are sent to the logger.
      if (typeof this.options.log === 'function') this.options.log(event, fields || {});
    }
    active() {
      if (!this.overlay) return null;
      return {hash: this.payload.hash, videoId: this.payload.videoId, timeMs: this.position(), durationMs: this.duration(), paused: this.video.paused};
    }
    position() { if (this.failedState) return this.failedState.timeMs; return Math.max(0, Math.round((this.video && Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0) * 1000)); }
    duration() { if (this.failedState) return this.failedState.durationMs; return Math.max(0, Math.round((this.video && Number.isFinite(this.video.duration) ? this.video.duration : 0) * 1000)); }
    progress() {
      if (!this.overlay) return;
      const duration = this.duration(), time = this.position();
      this.time.textContent = formatTime(time / 1000) + ' / ' + (duration ? formatTime(duration / 1000) : '--:--');
      this.seekBar.value = duration ? clamp(time / duration * 1000, 0, 1000) : 0;
      this.seekBar.setAttribute('aria-valuetext', this.time.textContent);
      this.playButton.textContent = this.video.paused ? 'Play' : 'Pause';
      if (typeof this.options.onProgress === 'function') this.options.onProgress(time, duration, this.video.paused);
      this.updateSkip();
    }
    play(payload) {
      this.destroy();
      if (document.hidden) throw new Error('Return to StreamGlass before opening a stream.');
      this.failedState = null;
      this.payload = payload || {};
      payload = this.payload;
      this.pendingError = null;
      this.controlsShown = true;
      this.subtitleSequence = 0;
      this.subtitleChoice = 'off';
      this.resumeTarget = Math.max(0, Number(payload.startMs) || 0) / 1000;
      this.resumePending = this.resumeTarget > 0;
      this.resumeAttempts = 0;
      this.preferredAudioApplied = false;
      this.skipped = new Set();
      this.previousFocus = document.activeElement;
      const session = ++this.session;
      const root = document.createElement('section');
      root.className = 'webos-player';
      root.setAttribute('aria-label', 'Video player');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.innerHTML = '<video data-webos-player="true" playsinline preload="auto"></video><div class="webos-player-top"><h1></h1><p></p></div><div class="webos-player-message" role="status" aria-live="polite"></div><div class="webos-player-controls"><div class="webos-player-seek-row"><input class="webos-player-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek"><span class="webos-player-time"></span></div><div class="webos-player-buttons"><button data-action="close">Back</button><button data-action="rewind">−10 seconds</button><button data-action="play">Pause</button><button data-action="forward">+10 seconds</button><button data-action="audio">Audio</button><button data-action="subtitles">Subtitles</button><button data-action="skip" hidden>Skip intro</button></div></div>';
      this.overlay = root;
      this.video = root.querySelector('video');
      this.video.autoplay = false;
      root.querySelector('h1').textContent = String(payload.title || 'Video');
      root.querySelector('.webos-player-top p').textContent = String(payload.subtitle || '');
      this.status = root.querySelector('.webos-player-message');
      this.time = root.querySelector('.webos-player-time');
      this.seekBar = root.querySelector('.webos-player-seek');
      this.playButton = root.querySelector('[data-action="play"]');
      this.skipButton = root.querySelector('[data-action="skip"]');
      document.body.append(root);
      document.documentElement.classList.add('webos-playing');
      this.playButton.focus();
      const current = () => this.session === session && this.overlay === root && !this.failedState;
      this.visibilityHandler = () => {
        if (this.overlay === root && document.hidden) this.close({reason: 'hidden'});
      };
      this.pageHideHandler = () => {
        if (this.overlay === root) this.close({reason: 'pagehide'});
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('pagehide', this.pageHideHandler);
      const on = (name, fn) => this.video.addEventListener(name, () => { if (current()) fn(); });
      on('loadedmetadata', () => {
        this.applyResume();
        this.choosePreferredAudio();
        if (this.payload.subtitleLanguage && !/^(none|off|null)$/i.test(this.payload.subtitleLanguage)) {
          const language = languageKey(this.payload.subtitleLanguage);
          const index = (this.payload.subtitles || []).findIndex((s) => languageKey(s.lang) === language);
          if (index >= 0 && this.subtitleChoice === 'off') this.selectSubtitle('external:' + index);
        }
        this.log('metadata', {durationSeconds: Math.round(this.video.duration || 0), width: this.video.videoWidth, height: this.video.videoHeight, audioTracks: this.video.audioTracks ? this.video.audioTracks.length : 0});
        this.progress();
      });
      on('canplay', () => this.applyResume());
      on('playing', () => { this.message(''); this.progress(); this.scheduleHide(); });
      on('waiting', () => this.message('Buffering…'));
      on('stalled', () => this.message('Waiting for the stream…'));
      on('pause', () => { this.progress(); this.showControls(); });
      on('seeked', () => this.progress());
      on('durationchange', () => this.progress());
      on('ended', () => { this.progress(); this.close({ended: true}); });
      on('error', () => this.fail(errorMessage(this.video.error && this.video.error.code)));
      on('timeupdate', () => this.updateSkip());
      if (this.video.audioTracks) this.video.audioTracks.addEventListener('addtrack', () => { if (current()) this.choosePreferredAudio(); });
      root.addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (button) this.action(button.dataset.action);
        else if (event.target === this.video) this.showControls(!this.controlsShown);
      });
      root.addEventListener('pointermove', () => this.showControls(true, false));
      this.seekBar.addEventListener('input', () => {
        if (this.duration()) this.seekTo(Number(this.seekBar.value) / 1000 * this.duration() / 1000);
      });
      this.interval = setInterval(() => { if (current()) this.progress(); }, 5000);
      this.message('Loading stream…');
      try {
        const url = directURL(payload.url);
        if (payload.headers && Object.keys(payload.headers).length) throw new Error('This stream requires custom request headers, which the webOS video player cannot send. Choose another direct debrid stream.');
        this.video.src = url;
        this.video.load();
        this.video.play().catch((error) => { if (current()) this.playRejected(error); });
        this.log('load', {protocol: new URL(url).protocol, resume: Number(payload.startMs) > 0});
      } catch (error) { this.fail(error.message); }
      return this.active();
    }
    choosePreferredAudio() {
      const tracks = this.video && this.video.audioTracks;
      if (!tracks || !tracks.length || this.preferredAudioApplied || !this.payload.audioLanguage) return;
      const language = languageKey(this.payload.audioLanguage);
      for (let i = 0; i < tracks.length; i++) {
        if (languageKey(tracks[i].language) === language) {
          this.selectAudio(i);
          this.preferredAudioApplied = true;
          return;
        }
      }
    }
    message(text) {
      if (!this.status) return;
      this.status.textContent = text;
      this.status.hidden = !text;
    }
    playRejected(error) {
      // Autoplay denial is recoverable with OK; decoder/network failures are not.
      if (error && error.name === 'NotAllowedError') {
        this.message('Press Play to start the stream.');
        this.showControls();
      } else this.fail(errorMessage(this.video && this.video.error && this.video.error.code));
    }
    fail(text) {
      if (!this.overlay || this.failedState) return;
      this.failedState = {timeMs: this.position(), durationMs: this.duration()};
      this.pendingError = text;
      clearInterval(this.interval);
      this.releaseMedia();
      this.closeMenu(false);
      this.seekBar.disabled = true;
      this.overlay.querySelectorAll('[data-action]').forEach((button) => { button.disabled = button.dataset.action !== 'close'; });
      this.overlay.querySelector('[data-action="close"]').focus();
      this.message(text);
      this.showControls();
      this.log('playback-error', {message: text});
    }
    applyResume() {
      if (!this.resumePending || this.resumeAttempts >= 3 || !this.video) return;
      const expected = Number.isFinite(this.video.duration) ? Math.min(this.resumeTarget, Math.max(0, this.video.duration - .05)) : this.resumeTarget;
      if (Math.abs(this.video.currentTime - expected) < .5) { this.resumePending = false; return; }
      this.resumeAttempts++;
      this.seekTo(this.resumeTarget, true);
      if (Math.abs(this.video.currentTime - expected) < .5) this.resumePending = false;
    }
    seekTo(seconds, resuming = false) {
      if (!resuming) this.resumePending = false;
      if (!this.video || this.failedState || !Number.isFinite(Number(seconds))) return;
      const max = Number.isFinite(this.video.duration) ? Math.max(0, this.video.duration - 0.05) : Math.max(0, seconds);
      let target = clamp(Number(seconds), 0, max);
      // Seek only within the available seekable window for live/DVR content.
      const ranges = this.video.seekable;
      if (!Number.isFinite(this.video.duration) && ranges && ranges.length) target = clamp(target, ranges.start(0), ranges.end(ranges.length - 1));
      try { this.video.currentTime = target; } catch (_) { this.message('This stream cannot seek yet.'); }
      this.progress();
    }
    seek(offset) { if (this.video) this.seekTo(this.video.currentTime + offset); }
    toggle() {
      if (!this.video || this.failedState) return;
      if (this.video.paused) {
        const session = this.session;
        this.video.play().then(() => { if (this.session === session && !this.failedState) this.pendingError = null; }).catch((error) => { if (this.session === session && !this.failedState) this.playRejected(error); });
      } else this.video.pause();
    }
    action(name) {
      if (this.failedState && name !== 'close') return;
      if (name === 'close') this.close();
      else if (name === 'play') this.toggle();
      else if (name === 'rewind') this.seek(-10);
      else if (name === 'forward') this.seek(10);
      else if (name === 'audio') this.audioMenu();
      else if (name === 'subtitles') this.subtitleMenu();
      else if (name === 'skip' && this.currentSkip) { this.skipped.add(this.currentSkip); this.seekTo(this.currentSkipEnd); }
      if (this.overlay) this.scheduleHide();
    }
    updateSkip() {
      if (!this.video || !this.payload) return;
      // DX.BI skip metadata uses seconds; accept only bounded, finite intervals.
      const endOf = (s) => Number.isFinite(s.end) && s.end >= 0 ? s.end : this.video.duration;
      this.currentSkip = (this.payload.skips || []).find((s) => Number.isFinite(s.start) && Number.isFinite(endOf(s)) && endOf(s) > s.start && this.video.currentTime >= s.start && this.video.currentTime < endOf(s) && !this.skipped.has(s));
      this.currentSkipEnd = this.currentSkip ? endOf(this.currentSkip) : 0;
      if (this.currentSkip && this.payload.autoSkip && this.payload.autoSkip !== 'off') {
        const type = String(this.currentSkip.type || '').toLowerCase();
        const mode = String(this.payload.autoSkip).toLowerCase();
        if (mode === 'all' || (mode === 'intro' && type !== 'credits')) {
          this.skipped.add(this.currentSkip); this.seekTo(this.currentSkipEnd); return;
        }
      }
      this.skipButton.hidden = !this.currentSkip;
      if (this.currentSkip) this.skipButton.textContent = 'Skip ' + String(this.currentSkip.type || 'section');
    }
    showControls(show = true, focus = true) {
      if (!this.overlay) return;
      this.controlsShown = show;
      this.overlay.classList.toggle('webos-controls-hidden', !show);
      if (show && focus && !this.menu && (!this.overlay.contains(document.activeElement) || document.activeElement === this.video)) this.playButton.focus();
      this.scheduleHide();
    }
    scheduleHide() {
      clearTimeout(this.hideTimer);
      if (!this.overlay || this.menu || this.pendingError || this.video.paused) return;
      this.hideTimer = setTimeout(() => { if (this.overlay && !this.menu) this.showControls(false, false); }, 6000);
    }
    openMenu(title, choices, note) {
      this.closeMenu(false);
      this.showControls();
      const menu = document.createElement('div');
      menu.className = 'webos-player-menu';
      menu.setAttribute('role', 'dialog');
      const sheet = document.createElement('div');
      const heading = document.createElement('h2'); heading.textContent = title; sheet.append(heading);
      if (note) { const p = document.createElement('p'); p.textContent = note; sheet.append(p); }
      for (const choice of choices) {
        const button = document.createElement('button');
        button.textContent = (choice.selected ? '✓ ' : '') + choice.label;
        button.setAttribute('aria-pressed', choice.selected ? 'true' : 'false');
        button.addEventListener('click', () => { this.closeMenu(); choice.run(); });
        sheet.append(button);
      }
      const back = document.createElement('button'); back.textContent = 'Back'; back.addEventListener('click', () => this.closeMenu()); sheet.append(back);
      menu.append(sheet);
      this.overlay.append(menu);
      this.menu = menu;
      (sheet.querySelector('[aria-pressed="true"]') || sheet.querySelector('button')).focus();
    }
    closeMenu(focus = true) {
      if (this.menu) { this.menu.remove(); this.menu = null; }
      if (focus && this.overlay) this.playButton.focus();
      this.scheduleHide();
    }
    audioMenu() {
      const tracks = this.video.audioTracks;
      const list = tracks ? Array.from(tracks) : [];
      this.openMenu('Audio', list.map((track, index) => ({label: track.label || track.language || 'Audio ' + (index + 1), selected: track.enabled, run: () => this.selectAudio(index)})), list.length ? '' : 'This stream does not expose selectable audio tracks on this TV. The default audio is used.');
    }
    selectAudio(index) {
      const tracks = this.video && this.video.audioTracks;
      if (!tracks || index < 0 || index >= tracks.length) return;
      try {
        for (let i = 0; i < tracks.length; i++) tracks[i].enabled = i === index;
        this.preferredAudioApplied = true;
        this.log('audio-selected', {index});
      } catch (_) { this.message('The TV could not switch audio tracks for this stream.'); }
    }
    subtitleMenu() {
      const entries = [{label: 'Off', selected: this.subtitleChoice === 'off', run: () => this.selectSubtitle('off')}];
      Array.from(this.video.textTracks || []).forEach((track, index) => {
        if (track === this.externalTrack || !/^(subtitles|captions)$/.test(track.kind)) return;
        entries.push({label: (track.label || track.language || 'Embedded ' + (index + 1)) + ' (embedded)', selected: this.subtitleChoice === 'embedded:' + index, run: () => this.selectSubtitle('embedded:' + index)});
      });
      (this.payload.subtitles || []).forEach((track, index) => entries.push({label: track.label || track.lang || 'Subtitle ' + (index + 1), selected: this.subtitleChoice === 'external:' + index, run: () => this.selectSubtitle('external:' + index)}));
      this.openMenu('Subtitles', entries, 'External WebVTT and SRT subtitles are supported. Embedded subtitles appear only when the TV exposes them.');
    }
    async selectSubtitle(choice) {
      if (!this.video || this.failedState) return;
      const sequence = ++this.subtitleSequence, session = this.session;
      if (this.abort) this.abort.abort();
      this.abort = null;
      Array.from(this.video.textTracks || []).forEach((track) => { track.mode = 'disabled'; });
      if (this.trackElement) this.trackElement.remove();
      this.trackElement = null; this.externalTrack = null;
      if (this.blobURL) URL.revokeObjectURL(this.blobURL);
      this.blobURL = null;
      this.subtitleChoice = 'off';
      if (choice === 'off') { this.message(''); return; }
      if (choice.startsWith('embedded:')) {
        const track = this.video.textTracks[Number(choice.split(':')[1])];
        if (track) { track.mode = 'showing'; this.applySubtitleStyle(track); this.subtitleChoice = choice; }
        return;
      }
      const subtitle = (this.payload.subtitles || [])[Number(choice.split(':')[1])];
      if (!subtitle) return;
      const controller = new AbortController(); this.abort = controller;
      this.message('Loading subtitles…');
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
      try {
        const response = await fetch(directURL(subtitle.url), {signal: controller.signal, credentials: 'omit'});
        if (!response.ok) throw new Error('Subtitle request failed (' + response.status + ').');
        const source = await readSubtitleResponse(response);
        const vtt = subtitlesToVTT(source);
        if (session !== this.session || sequence !== this.subtitleSequence || !this.overlay) return;
        const blob = URL.createObjectURL(new Blob([vtt], {type: 'text/vtt'}));
        this.blobURL = blob;
        const track = document.createElement('track');
        this.trackElement = track;
        track.kind = 'subtitles'; track.label = subtitle.label || subtitle.lang || 'Subtitles';
        track.srclang = subtitle.lang || 'und'; track.src = blob;
        track.addEventListener('load', () => {
          if (session !== this.session || sequence !== this.subtitleSequence) return;
          this.externalTrack = track.track;
          track.track.mode = 'showing';
          this.applySubtitleStyle(track.track);
          this.subtitleChoice = choice;
          this.message('');
          this.log('subtitles-selected', {source: 'external', format: /^WEBVTT/.test(source) ? 'vtt' : 'srt'});
        });
        track.addEventListener('error', () => { if (session === this.session && sequence === this.subtitleSequence) this.message('The TV could not load these subtitles. Try another subtitle file.'); });
        this.video.append(track);
        this.externalTrack = track.track;
        track.track.mode = 'showing';
      } catch (error) {
        if (session !== this.session || sequence !== this.subtitleSequence || (error.name === 'AbortError' && !timedOut)) return;
        this.message(timedOut ? 'Subtitle request timed out. Try another subtitle.' : error.message === 'Failed to fetch' ? 'Subtitles could not be fetched. The subtitle server may block this TV (CORS). Try another subtitle.' : error.message);
        this.log('subtitle-error', {kind: timedOut ? 'Timeout' : error.name || 'Error'});
      } finally {
        clearTimeout(timeout);
        if (this.abort === controller) this.abort = null;
      }
    }
    applySubtitleStyle(track) {
      const style = this.payload.subtitleStyle || {};
      const validColor = (value, fallback) => typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent|white|black|yellow)$/i.test(value) ? value : fallback;
      const size = clamp(Number(style.size) || 100, 50, 200);
      this.overlay.style.setProperty('--webos-subtitle-size', (size / 100 * 3.2) + 'vh');
      this.overlay.style.setProperty('--webos-subtitle-color', validColor(style.text, '#ffffff'));
      this.overlay.style.setProperty('--webos-subtitle-bg', validColor(style.background, 'rgba(0,0,0,0.55)'));
      this.overlay.style.setProperty('--webos-subtitle-weight', style.bold ? '700' : '400');
      if (track.cues && Number.isFinite(Number(style.offset))) {
        const line = clamp(100 - Number(style.offset), 10, 95);
        Array.from(track.cues).forEach((cue) => { try { cue.snapToLines = false; cue.line = line; } catch (_) {} });
      }
    }
    handleKey(event) {
      if (!this.overlay) return false;
      const key = KEYS[event.keyCode] || event.key;
      if (!['Back','Escape','Backspace','Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaRewind','MediaFastForward'].includes(key)) return false;
      if (key === 'Back' || key === 'Escape' || key === 'Backspace') {
        if (this.menu) this.closeMenu();
        else if (this.controlsShown && !this.pendingError) this.showControls(false);
        else this.close();
        return true;
      }
      if (key === 'MediaStop') { this.close(); return true; }
      if (this.failedState) {
        if (key === 'Enter') this.close();
        return true;
      }
      if (key === 'MediaPlay') { if (this.video.paused) this.toggle(); return true; }
      if (key === 'MediaPause') { this.video.pause(); return true; }
      if (key === 'MediaPlayPause') { this.toggle(); return true; }
      if (key === 'MediaRewind' || key === 'MediaFastForward') { this.seek(key === 'MediaRewind' ? -10 : 10); this.showControls(); return true; }
      if (this.menu) {
        const items = Array.from(this.menu.querySelectorAll('button'));
        const index = Math.max(0, items.indexOf(document.activeElement));
        if (key === 'Enter') items[index].click();
        else items[clamp(index + (key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 1), 0, items.length - 1)].focus();
        return true;
      }
      if (!this.controlsShown) {
        if (key === 'ArrowLeft' || key === 'ArrowRight') this.seek(key === 'ArrowLeft' ? -10 : 10);
        else { this.showControls(); this.playButton.focus(); }
        return true;
      }
      if (key === 'Enter') {
        if (document.activeElement === this.seekBar) this.toggle();
        else if (this.overlay.contains(document.activeElement) && document.activeElement.tagName === 'BUTTON') document.activeElement.click();
        else this.toggle();
      } else if (document.activeElement === this.seekBar) {
        if (key === 'ArrowLeft' || key === 'ArrowRight') this.seek(key === 'ArrowLeft' ? -10 : 10);
        else if (key === 'ArrowDown') this.playButton.focus();
      } else if (key === 'ArrowUp') this.seekBar.focus();
      else if (key === 'ArrowDown') this.showControls(false);
      else {
        const buttons = Array.from(this.overlay.querySelectorAll('.webos-player-buttons button')).filter((b) => !b.hidden);
        const index = buttons.indexOf(document.activeElement);
        buttons[clamp(index + (key === 'ArrowLeft' ? -1 : 1), 0, buttons.length - 1)].focus();
      }
      this.scheduleHide();
      return true;
    }
    close(details) {
      if (!this.overlay) return;
      const result = Object.assign({timeMs: this.position(), durationMs: this.duration(), paused: true, ended: false, error: this.pendingError, hash: this.payload.hash, videoId: this.payload.videoId}, details || {});
      // Release before invoking application code: a failing callback must never
      // leave a decoder or a network request alive in a suspended TV app.
      this.destroy();
      if (typeof this.options.onClose === 'function') this.options.onClose(result);
    }
    releaseMedia() {
      ++this.subtitleSequence;
      if (this.abort) this.abort.abort(); this.abort = null;
      if (this.trackElement) this.trackElement.remove();
      this.trackElement = null; this.externalTrack = null;
      if (this.blobURL) URL.revokeObjectURL(this.blobURL); this.blobURL = null;
      if (this.video) { this.video.pause(); this.video.removeAttribute('src'); this.video.load(); }
    }
    destroy() {
      ++this.session;
      clearInterval(this.interval); clearTimeout(this.hideTimer);
      if (typeof document !== 'undefined' && this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
      if (typeof window !== 'undefined' && this.pageHideHandler) window.removeEventListener('pagehide', this.pageHideHandler);
      this.visibilityHandler = null; this.pageHideHandler = null;
      this.releaseMedia();
      this.overlay && this.overlay.remove();
      this.overlay = null; this.video = null; this.menu = null; this.externalTrack = null; this.trackElement = null;
      this.failedState = null;
      if (typeof document !== 'undefined') document.documentElement.classList.remove('webos-playing');
      if (this.previousFocus && this.previousFocus.isConnected) this.previousFocus.focus();
    }
  }
  const helpers = {directURL, subtitlesToVTT, formatTime, languageKey, errorMessage, readSubtitleResponse};
  if (typeof module !== 'undefined' && module.exports) module.exports = {WebOSPlayer, helpers};
  if (root) root.WebOSPlayer = WebOSPlayer;
})(typeof window === 'undefined' ? null : window);
