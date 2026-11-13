// Render benchmark: the same scenes on every preset.
//   node tests/bench.cjs out.json [path/to/index.html]
// Scenes: "fit" (opening view, whole complex), "harbour" (zoomed on the quay
// with a boat sailing) and "fleet" (4 boats, zoomed on the harbour after 20
// game seconds, so boats are backing out, sailing and coming in), "fleetmax" (the
// same with engine and nets at 30 and the outer jetties built). Metrics over 5 s: frame time (rAF), Phaser update time,
// WebGL draw calls per frame, texture memory, JS heap. Headless Chromium with a
// software GPU, 844×390 at DPR 2.75: compare runs with each other, not with phones.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const URL = 'file://' + path.resolve(process.argv[3] || path.join(__dirname, '../index.html'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const out = {};
  const only = (process.env.BENCH_ONLY || '').split(',').filter(Boolean);   // e.g. BENCH_ONLY=medium/fleet
  for (const preset of ['low', 'medium', 'high']) for (const scene of ['fit', 'harbour', 'fleet', 'fleetmax']) {
    if (only.length && !only.includes(`${preset}/${scene}`)) continue;
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.75 });
    await ctx.addInitScript(([q, fleet]) => {
      const base = { v: 1, settings: { quality: q }, stats: { caught: 5, sold: 5 }, lastSeen: Date.now() };
      if (fleet) Object.assign(base, { money: 500, boats: 4, workers: 6, level: 9, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 } });
      // fleetmax: engine and nets at 30, outer jetties built (older builds ignore the flag)
      if (fleet === 'max') Object.assign(base, { harborOuter: +(new URLSearchParams(location.search).get('outer') || 1), up: { harbor: { cap: 30, speed: 30, net: 30 } } });
      if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1); localStorage.setItem('fishingTycoon.save', JSON.stringify(base)); }
      // count WebGL draw calls
      const patch = proto => { for (const fn of ['drawElements', 'drawArrays']) { const o = proto[fn]; proto[fn] = function () { window.__draws = (window.__draws || 0) + 1; return o.apply(this, arguments); }; } };
      if (window.WebGLRenderingContext) patch(WebGLRenderingContext.prototype);
      if (window.WebGL2RenderingContext) patch(WebGL2RenderingContext.prototype);
    }, [preset, scene === 'fleetmax' ? 'max' : scene === 'fleet']);
    const p = await ctx.newPage();
    await p.goto(URL + (process.env.BENCH_OUTER ? '?outer=' + process.env.BENCH_OUTER : ''));   // BENCH_OUTER=2: jetties with head arms (loop berths)
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').sim && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(async scene => {
      document.querySelectorAll('[data-m]').forEach(x => x.click());
      const w = __game.scene.getScene('world'), cam = w.cameras.main, dpr = __quality.dpr;
      if (scene === 'fleet' || scene === 'fleetmax') {
        // 20 game seconds (scene updates only, nothing drawn): boats leaving, sailing, coming in
        let T = performance.now();
        for (let k = 0; k < 600; k++) { T += 1000 / 30; w.update(T, 1000 / 30); }
        cam.setZoom(0.9 * dpr); cam.centerOn((12 - 31) * 32, (12 + 31) * 16);
      } else {
        // put the first boat on its way out so wakes are visible
        let n = 0; while (w.sim.boats[0].state !== 'out' && n++ < 2000) w.sim.update(0.1);
      }
      if (scene === 'harbour') { cam.setZoom(1.0 * dpr); cam.centerOn((11 - 27) * 32, (11 + 27) * 16); }
      await new Promise(r => setTimeout(r, 1500));
      const orig = w.sys.sceneUpdate; let un = 0, ut = 0;
      w.sys.sceneUpdate = function (t, d) { const a = performance.now(); orig.call(w, t, d); ut += performance.now() - a; un++; };
      const frames = []; let last = performance.now(); window.__draws = 0; let draws0 = 0;
      await new Promise(res => { const t0 = performance.now(); const tick = now => { frames.push(now - last); last = now; if (now - t0 < 5000) requestAnimationFrame(tick); else res(); }; requestAnimationFrame(tick); });
      const draws = window.__draws - draws0;
      w.sys.sceneUpdate = orig;
      let px = 0; for (const k of __game.textures.getTextureKeys()) { const s = __game.textures.get(k).source[0]; if (s) px += s.width * s.height; }
      frames.sort((a, b) => a - b);
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      return { frames: frames.length, frameMsAvg: +avg.toFixed(1), frameMsP90: +frames[Math.floor(frames.length * 0.9)].toFixed(1), fps: +(1000 / avg).toFixed(1),
        updateMsAvg: +(ut / Math.max(1, un)).toFixed(2), drawCallsPerFrame: +(draws / frames.length).toFixed(1),
        textureMB: +(px * 4 / 1048576).toFixed(1), heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), objects: w.children.length };
    }, scene);
    out[`${preset}/${scene}`] = r;
    console.error(preset, scene, JSON.stringify(r));
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(process.argv[2] || 'bench.json', JSON.stringify(out, null, 1));
})();
