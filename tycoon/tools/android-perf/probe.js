/* Q10 performance probe. Injected at the top of the DEVELOPMENT pages (base.html / eco.html) of the
 * android-eco-perf workflow only. It is never part of tycoon/index.html, the production APK or a normal
 * dev build. It changes nothing in the game's source; it observes from outside:
 *
 *   - seeds Math.random (same seed for the same run number in every mode)
 *   - seeds the start save into localStorage once, only if the app data is empty (the driver clears it
 *     before every run; a leftover save is reported as a failed run, never used)
 *   - frame source A (the one the FPS numbers are based on): requestAnimationFrame intervals of this page
 *   - frame source B: scene steps (Phaser sceneUpdate calls) and Phaser's own loop.actualFps
 *   - simulation time (sum of dt given to Sim.update) against real time
 *   - JS time inside Sim.update and inside the whole scene update, per frame
 *   - JS heap samples (performance.memory; reported only if the values really move)
 *   - long tasks, visibility changes, JS errors
 *   - after the window: an interleaved off / tracking / prices micro benchmark of Sim.update on the device
 *
 * Every result leaves the page as a console line "PROBE_<TAG> <json>"; the WebView bridge of the APK
 * (MainActivity) forwards console lines to logcat tag FishingTycoon. Lines stay under 3 KB (logcat limit 4 KB).
 */
(function () {
  'use strict';
  var cfg = window.__PERF_CFG || {};
  var q = new URLSearchParams(location.search);
  var KEY = 'fishingTycoon.save';
  function out(tag, o) { try { console.log('PROBE_' + tag + ' ' + (typeof o === 'string' ? o : JSON.stringify(o))); } catch (e) { /* never break the game */ } }
  var errors = { n: 0, first: null };
  window.addEventListener('error', function (e) { errors.n++; if (!errors.first) errors.first = String(e.message).slice(0, 200); });
  window.addEventListener('unhandledrejection', function (e) { errors.n++; if (!errors.first) errors.first = 'promise ' + String(e.reason && e.reason.message).slice(0, 200); });

  // ---- seeded Math.random (mulberry32); run number and seed come from the page address
  var seed = (+q.get('seed') || cfg.seedBase || 1) >>> 0, rs = seed;
  Math.random = function () {
    rs = (rs + 0x6D2B79F5) | 0;
    var t = Math.imul(rs ^ (rs >>> 15), 1 | rs);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- storage state at boot, then the identical start save
  var boot = { mode: q.get('mode') || 'unknown', run: +q.get('run') || 0, seed: seed, search: location.search, preset: cfg.preset, saveName: cfg.saveName,
    saveSha256: cfg.saveSha256, probe: cfg.probeVersion, ua: navigator.userAgent, hadSave: null, lsKeys: null, ssKeys: null, cookieLen: document.cookie.length };
  try { boot.lsKeys = localStorage.length; boot.hadSave = localStorage.getItem(KEY) !== null; } catch (e) { boot.hadSave = 'storage-error'; }
  try { boot.ssKeys = sessionStorage.length; } catch (e) { boot.ssKeys = null; }
  if (boot.hadSave === false && boot.lsKeys === 0 && cfg.save) {
    var s = JSON.parse(JSON.stringify(cfg.save));
    s.lastSeen = Date.now();                       // no offline-earnings pop-up
    s.settings = Object.assign({}, s.settings, { quality: cfg.preset });
    try { localStorage.setItem(KEY, JSON.stringify(s)); boot.seeded = true; } catch (e) { boot.seeded = false; }
  } else boot.seeded = false;
  boot.screen = { w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio, sw: screen.width, sh: screen.height };
  boot.perfMemory = !!performance.memory;
  out('BOOT', boot);
  if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(function (e) { out('STORAGE', { usage: e.usage, quota: e.quota }); }).catch(function () {});

  var lt = { n: 0, ms: 0 }, hidden = 0;
  document.addEventListener('visibilitychange', function () { if (document.hidden) hidden++; });
  try { new PerformanceObserver(function (l) { l.getEntries().forEach(function (e) { lt.n++; lt.ms += e.duration; }); }).observe({ type: 'longtask', buffered: false }); } catch (e) { /* not supported */ }

  var startedAt = performance.now();
  function world() { var g = window.__game; return g && g.scene && g.scene.getScene && g.scene.getScene('world'); }
  function ready() { var w = world(); return !!(w && w.sim && w.sys && document.getElementById('ui') && !document.getElementById('loader')); }
  function ecoState() {
    var e = window.__eco;
    if (!e) return { present: false, on: false, systems: null };
    return { present: true, version: e.version, on: !!e.on, systems: e.systems };
  }
  var waitTimer = setInterval(function () {
    if (performance.now() - startedAt > (cfg.bootTimeoutS || 150) * 1000) { clearInterval(waitTimer); out('FAIL', { reason: 'world not ready in time' }); return; }
    if (!ready()) return;
    clearInterval(waitTimer);
    // one more beat so that worldReady listeners (eco switch-on, UI) have run
    setTimeout(begin, 1500);
  }, 200);

  function pct(a, p) { var i = Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1)); return a[i]; }
  function begin() {
    var w = world();
    out('READY', { mode: boot.mode, run: boot.run, elapsedS: +((performance.now() - startedAt) / 1000).toFixed(1), quality: window.__quality && window.__quality.name,
      canvas: w.game.canvas.width + 'x' + w.game.canvas.height, screen: { w: innerWidth, h: innerHeight, dpr: window.devicePixelRatio }, renderer: w.game.renderer && (w.game.renderer.type === 2 ? 'webgl' : 'canvas'),
      eco: ecoState(), boats: w.sim.boats.length, workers: w.sim.workers.length, errors: errors.n });
    // instrumentation: Sim.update (JS time and simulated seconds) and the whole scene update
    var acc = { simN: 0, simMs: 0, simDt: 0, sceneN: 0, sceneMs: 0, on: false };
    var simOrig = w.sim.update, sceneOrig = w.sys.sceneUpdate;
    w.sim.update = function (dt) { if (!acc.on) return simOrig.call(this, dt); var a = performance.now(); simOrig.call(this, dt); acc.simMs += performance.now() - a; acc.simN++; acc.simDt += dt; };
    w.sys.sceneUpdate = function (t, d) { if (!acc.on) return sceneOrig.call(this, t, d); var a = performance.now(); sceneOrig.call(this, t, d); acc.sceneMs += performance.now() - a; acc.sceneN++; };
    setTimeout(function () {
      out('SYNC_BEGIN', { warmupS: cfg.warmupS });                      // warm-up is over; the host resets gfxinfo / takes memory snapshot now
      setTimeout(function () { measure(w, acc, simOrig, sceneOrig); }, (cfg.syncGapS || 12) * 1000);
    }, cfg.warmupS * 1000);
  }

  function measure(w, acc, simOrig, sceneOrig) {
    var frames = new Float32Array(60 * (cfg.durationS + 10)), n = 0, last = 0, t0 = performance.now(), running = true;
    var heap = [], fpsSamples = [], g = w.game;
    acc.on = true; var lt0 = { n: lt.n, ms: lt.ms }, hid0 = hidden, err0 = errors.n;
    function sample() { if (performance.memory) heap.push(performance.memory.usedJSHeapSize); fpsSamples.push(g.loop.actualFps); }
    sample();
    var sampler = setInterval(sample, 5000);
    out('WINDOW_BEGIN', { durationS: cfg.durationS });
    function tick(now) {
      if (!running) return;
      if (last) { if (n < frames.length) frames[n++] = now - last; }
      last = now;
      if (now - t0 < cfg.durationS * 1000) requestAnimationFrame(tick); else finish(now);
    }
    requestAnimationFrame(tick);
    function finish(now) {
      running = false; acc.on = false; clearInterval(sampler); sample();
      out('WINDOW_END', { frames: n });                                  // host reads gfxinfo / meminfo right now
      var f = Array.prototype.slice.call(frames, 0, n).map(function (x) { return +x.toFixed(1); });
      var sorted = f.slice().sort(function (a, b) { return a - b; });
      var sum = f.reduce(function (a, b) { return a + b; }, 0), elapsedS = (now - t0) / 1000;
      var result = {
        mode: boot.mode, run: boot.run, source: 'requestAnimationFrame intervals of the page (WebView)', frames: n, elapsedS: +elapsedS.toFixed(2), rafSumS: +(sum / 1000).toFixed(2),
        fpsMean: +(n / (sum / 1000)).toFixed(2), frameMsMedian: pct(sorted, 0.5), frameMsP95: pct(sorted, 0.95), frameMsP99: pct(sorted, 0.99), frameMsMax: sorted[sorted.length - 1],
        jank25Pct: +(100 * f.filter(function (x) { return x > 25; }).length / n).toFixed(2), slow50Pct: +(100 * f.filter(function (x) { return x > 50; }).length / n).toFixed(2),
        sceneSteps: acc.sceneN, sceneStepsPerS: +(acc.sceneN / elapsedS).toFixed(2), sceneMsMean: +(acc.sceneMs / Math.max(1, acc.sceneN)).toFixed(3),
        simUpdates: acc.simN, simMsMean: +(acc.simMs / Math.max(1, acc.simN)).toFixed(4), simSeconds: +acc.simDt.toFixed(2), simRatio: +(acc.simDt / elapsedS).toFixed(4),
        phaserFpsSamples: fpsSamples.map(function (x) { return +x.toFixed(1); }), heapSamplesMB: heap.map(function (x) { return +(x / 1048576).toFixed(2); }),
        longTasks: lt.n - lt0.n, longTaskMs: +(lt.ms - lt0.ms).toFixed(0), visibilityHidden: hidden - hid0, jsErrors: errors.n - err0, jsErrorFirst: errors.first,
        eco: ecoState(), quality: window.__quality && window.__quality.name, boats: w.sim.boats.length, workers: w.sim.workers.length
      };
      out('RESULT', result);
      // raw intervals, 400 numbers a line, so the host can recompute every statistic
      for (var i = 0, k = 0; i < f.length; i += 400, k++) out('RAW', k + ' ' + f.slice(i, i + 400).join(','));
      out('RAW_END', { chunks: Math.ceil(f.length / 400), frames: f.length });
      w.sim.update = simOrig; w.sys.sceneUpdate = sceneOrig;
      setTimeout(function () { micro(w); }, (cfg.endGapS || 25) * 1000);   // idle gap: host collects dumpsys output
    }
  }

  // Interleaved micro benchmark of Sim.update with the eco adapter off / tracking / prices. State is not reset
  // (it drifts the same way for every block); the page is thrown away afterwards (pm clear).
  function micro(w) {
    var N = cfg.microSteps || 4000, R = cfg.microRounds || 6, res = { plain: [], tracking: [], prices: [] }, e = window.__eco;
    function block() { var a = performance.now(); for (var i = 0; i < N; i++) w.sim.update(1 / 30); return (performance.now() - a) * 1000 / N; }   // µs per call
    var variants = e ? [
      ['off', function () { e.setOn(false); }],
      ['tracking', function () { e.setOn(true); e.setSystems({ species: true, price: false }); e.species.ensure(); }],
      ['prices', function () { e.setOn(true); e.setSystems({ species: true, price: true }); e.species.ensure(); }]
    ] : [['plain', function () {}]];
    var names = { off: 'plain', tracking: 'tracking', prices: 'prices', plain: 'plain' };
    for (var r = 0; r < R + 1; r++) {                                   // round 0 is warm-up (JIT), discarded
      for (var v = 0; v < variants.length; v++) { variants[v][1](); var us = block(); if (r > 0) res[names[variants[v][0]]].push(+us.toFixed(3)); }
    }
    out('MICRO', { unit: 'microseconds per Sim.update call (dt 1/30), N=' + N + ' calls per block, ' + R + ' interleaved rounds', hasEco: !!e, res: res });
    out('DONE', { mode: boot.mode, run: boot.run, errorsTotal: errors.n, errorFirst: errors.first });
  }
})();
