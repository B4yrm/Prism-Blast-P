// Workers phase A regression: the same save, the same seed, the whole game stepped frame by frame
// (__game.step, so drawing runs too and shares Math.random with the simulation exactly as in play).
// Records the simulation every 0.5 s — money, register, stocks, every hauler's state / position / timer /
// load, every boat's state / load, customers — plus every unload event, and compares two builds.
// Also checks in each build: unloading shown (crane, slip cart, jetty cart) only while that boat is moored.
//   node tests/workers-regress.cjs <before.html> <after.html>  → test-results/workers/regress.json
//   ONLY=0,2 runs only those scenarios; each finished scenario is saved at once in test-results/workers/regress-<n>.json,
//   and regress.json is rebuilt from all regress-<n>.json files present
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
// small viewport: drawing still runs every frame (same code, same random draws), only the pixel fill is cheaper
// (108 ms → 1.8 ms a frame in SwiftShader). Both builds always run with the same viewport. VIEW=844x390 to change.
// deterministic start: Math.random is seeded just before the world (and its simulation) is created, and the
// world does not update until the test steps it (window.__go), so no real-time frame runs in between
const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };    // particles, tweens, clocks too
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};
const VIEW = (([w, h]) => ({ width: w, height: h }))((process.env.VIEW || '200x100').split('x').map(Number));
const [A, B] = process.argv.slice(2).map(f => 'file://' + path.resolve(f));
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const STRONG = { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 };
const SCEN = [
  { name: 'start: 1 boat, 1 hauler', boats: 1, workers: 1, tier: { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 }, up: {}, secs: 600, fps: 30 },
  { name: 'mid: 4 boats, 6 haulers, factory', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 600, fps: 30 },
  { name: 'high warehouse level (pick/drop 0.04 s), 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } }, secs: 600, fps: 30 },
  { name: 'max 30/30, loop berths, 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } }, outer: 2, secs: 600, fps: 30 },
  { name: 'mid at 15 FPS', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 300, fps: 15 },
  { name: 'mid at 60 FPS', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 300, fps: 60 },
];
async function run(b, url, sc, view = VIEW) {
  const ctx = await b.newContext({ viewport: view });
    await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, harborOuter: sc.outer || 0, settings: { quality: sc.quality || 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(sc => {
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    __game.loop.sleep(); window.__go = true; { const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }   // as Phaser's own loop would set it
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, S = sim.S, F = w.fleet;
    const trace = [], unloads = []; let shownAway = 0, shown = 0;
    const cw = w.craneWork.bind(w);
    w.craneWork = bt => {
      unloads.push([K, bt.i]);                     // frame number (not the clock: its start differs per run)
      const moored = F.mooredSite(bt) >= 0, before = JSON.stringify([w.cranes.map(c => c.t), w.slipCarts ? w.slipCarts.carts.map(c => c.busy) : 0, F.jetties.carts.map(c => c.busy)]);
      cw(bt);
      const after = JSON.stringify([w.cranes.map(c => c.t), w.slipCarts ? w.slipCarts.carts.map(c => c.busy) : 0, F.jetties.carts.map(c => c.busy)]);
      if (before !== after) { shown++; if (!moored) shownAway++; }
    };
    const ms = 1000 / sc.fps; let T = 1e5 /* the same clock start in every run: the boats time their moves on it */, K = -1;
    const n = Math.round(sc.secs * sc.fps), every = Math.round(sc.fps / 2);
    for (let k = 0; k < n; k++) {
      K = k; T += ms; __game.step(T, ms);
      if (k % every === 0) trace.push([Math.round(S.money * 100), Math.round(S.register * 100), S.stock.quay, S.stock.wh, S.stock.facOut, S.stock.mRaw, S.stock.mProd,
        sim.workers.map(x => [x.state, +x.m.x.toFixed(4), +x.m.y.toFixed(4), +x.t.toFixed(4), x.carry]), sim.boats.map(x => [x.state, x.load, +x.m.x.toFixed(3), +x.m.y.toFixed(3)]), sim.customers.length, S.stats.caught, S.stats.sold]);
    }
    // walk-cycle rate of hauler sprites (frame changes per second while walking) — new build only has view.phase
    return { trace, unloads, shown, shownAway, money: Math.floor(S.money), caught: S.stats.caught, sold: S.stats.sold, stock: { ...S.stock } };
  }, sc);
  await ctx.close();
  return { ...r, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = path.join(__dirname, '../test-results/workers'); fs.mkdirSync(dir, { recursive: true });
  // the small viewport does not change the simulation: the new build, mid scenario, 120 s, at 844×390 vs VIEW
  if (process.env.VIEWCHECK) {
    const sc = { ...SCEN[1], secs: 120 }, big = await run(b, B, sc, { width: 844, height: 390 }), small = await run(b, B, sc);
    let first = null; for (let i = 0; i < Math.max(big.trace.length, small.trace.length); i++) if (JSON.stringify(big.trace[i]) !== JSON.stringify(small.trace[i])) { first = i / 2; break; }
    const res = { note: 'the render code draws from the same Math.random as the simulation, partly depending on what is on screen, so a different viewport gives a different (equally deterministic) random stream; before/after are therefore always compared at the same viewport', check: 'viewport 844x390 vs ' + VIEW.width + 'x' + VIEW.height, seconds: 120, samples: big.trace.length, identical: first === null && JSON.stringify(big.unloads) === JSON.stringify(small.unloads), firstDiffAtSecond: first, big: first !== null ? big.trace[first * 2] : null, small: first !== null ? small.trace[first * 2] : null, errors: [...big.errs, ...small.errs] };
    fs.writeFileSync(path.join(dir, 'regress-viewport.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
    await b.close(); process.exit(res.identical ? 0 : 1);
  }
  const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
  for (const [n, sc] of SCEN.entries()) {
    if (only && !only.includes(n)) continue;
    if (process.env.SECS) sc.secs = +process.env.SECS;                  // extra runs only (TAG names their file)
    const ra = await run(b, A, sc), rb = await run(b, B, sc);
    let firstDiff = null;
    for (let i = 0; i < Math.max(ra.trace.length, rb.trace.length); i++) if (JSON.stringify(ra.trace[i]) !== JSON.stringify(rb.trace[i])) { firstDiff = { sample: i, seconds: i / 2, before: ra.trace[i], after: rb.trace[i] }; break; }
    const res = { scenario: sc.name, fps: sc.fps, seconds: sc.secs, samples: ra.trace.length, identical: !firstDiff && JSON.stringify(ra.unloads) === JSON.stringify(rb.unloads), unloadEventsIdentical: JSON.stringify(ra.unloads) === JSON.stringify(rb.unloads), unloadEvents: rb.unloads.length,
      before: { money: ra.money, caught: ra.caught, sold: ra.sold, stock: ra.stock, unloadingShown: ra.shown, shownWithBoatAway: ra.shownAway },
      after: { money: rb.money, caught: rb.caught, sold: rb.sold, stock: rb.stock, unloadingShown: rb.shown, shownWithBoatAway: rb.shownAway }, firstDiff, errors: [...ra.errs, ...rb.errs].slice(0, 3) };
    res.viewport = VIEW; fs.writeFileSync(path.join(dir, `regress-${n}${process.env.TAG || ''}.json`), JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ n, scenario: res.scenario, identical: res.identical, unloadEvents: res.unloadEvents, before: res.before, after: res.after, firstDiff: !!firstDiff, errors: res.errors }));
  }
  await b.close();
  if (process.env.TAG) { await b.close(); return; }
  const out = SCEN.map((_, n) => path.join(dir, `regress-${n}.json`)).filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.writeFileSync(path.join(dir, 'regress.json'), JSON.stringify(out, null, 1));
  process.exit(out.every(r => r.identical && !r.after.shownWithBoatAway && !r.errors.length) ? 0 : 1);
})();
