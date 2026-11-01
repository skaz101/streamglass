/* StreamGlass recommendations. Copyright (C) 2026 StreamGlass contributors.
 * GPL-3.0-or-later. Content-based matching; no remote profiling service. */
(function (global) {
  'use strict';
  const key = item => String(item.type || 'movie') + ':' + String(item.id || item._id || '');
  const normalize = value => String(value || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
  function labels(values) {
    return [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string').map(normalize).map(value => /^(sci fi|scifi|science fiction)$/.test(value) ? 'science fiction' : value).filter(Boolean))];
  }
  function selectSeeds(library, limit = 12) {
    const seen = new Set();
    return (library || []).filter(item => {
      if (!item || !(item.id || item._id) || !['movie','series','anime'].includes(item.type)) return false;
      const id = key(item); if (seen.has(id)) return false; seen.add(id); return true;
    }).map((item, index) => {
      const signal = item.watched ? 'watched' : Number(item.progress) >= 5 ? 'started' : 'saved';
      return {...item, id:item.id || item._id, signal, weight:({watched:3,started:2,saved:1}[signal]) / (1 + index / 30)};
    }).sort((a,b) => b.weight - a.weight).slice(0, limit);
  }
  function overlap(first, second) {
    if (!first.length || !second.length) return 0;
    return 2 * first.filter(value => second.includes(value)).length / (first.length + second.length);
  }
  function features(meta) { return {genres:labels(meta.genres), cast:labels(meta.cast).slice(0,8), director:labels(meta.director)}; }
  function reason(seed) {
    const name = seed.name || seed.id || seed._id;
    if (seed.signal === 'watched') return 'Because you watched ' + name;
    if (seed.signal === 'started') return 'Because you started ' + name;
    return 'Similar to ' + name + ' in your library';
  }
  function recommend(library, seeds, candidates, options = {}) {
    const excluded = new Set((library || []).filter(Boolean).map(key));
    const seen = new Set();
    const known = (seeds || []).map(seed => ({...seed, features:features(seed)}));
    const ranked = [];
    for (const meta of candidates || []) {
      if (!meta || !(meta.id || meta._id) || excluded.has(key(meta)) || seen.has(key(meta))) continue;
      seen.add(key(meta));
      if (options.type && meta.type !== options.type) continue;
      const candidate = features(meta);
      let best = null, bestScore = 0, total = 0;
      for (const seed of known) {
        const similarity = overlap(candidate.genres, seed.features.genres) * .75 + overlap(candidate.director, seed.features.director) * .35 + overlap(candidate.cast, seed.features.cast) * .18;
        // A popular title with no metadata match must never receive a made-up reason.
        if (!similarity) continue;
        const score = (similarity + (meta.type === seed.type ? .1 : 0)) * seed.weight;
        total += score;
        if (score > bestScore) { bestScore = score; best = seed; }
      }
      if (!best) continue;
      const rating = Math.max(0, Math.min(10, Number(meta.imdbRating || meta.rating) || 0));
      ranked.push({meta, score:bestScore + total / Math.max(1, known.length) * .15 + rating * .008, seed:key(best), genre:candidate.genres[0] || '', reason:reason(best)});
    }
    const output = [], genres = new Map(), sources = new Map();
    while (ranked.length && output.length < (options.limit || 24)) {
      // Small repeat penalties create variety without promoting unrelated titles.
      const adjusted = item => item.score / (1 + (genres.get(item.genre) || 0) * .12 + (sources.get(item.seed) || 0) * .08);
      let index = 0;
      for (let i = 1; i < ranked.length; i++) if (adjusted(ranked[i]) > adjusted(ranked[index])) index = i;
      const [chosen] = ranked.splice(index, 1);
      genres.set(chosen.genre, (genres.get(chosen.genre) || 0) + 1);
      sources.set(chosen.seed, (sources.get(chosen.seed) || 0) + 1);
      output.push({...chosen.meta, recommendationReason:chosen.reason});
    }
    return output;
  }
  const api = {key, labels, selectSeeds, recommend};
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.StreamGlassRecommendations = api;
})(typeof window === 'undefined' ? null : window);
