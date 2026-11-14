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
const [A, B] = process.argv.slice(2).map(f => 'file://' + path.resolve(f));
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const STRONG = { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 };
const SCEN = [
  { name: 'start: 1 boat, 1 hauler', boats: 1, workers: 1, tier: { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 }, up: {}, secs: 300, fps: 30 },
  { name: 'mid: 4 boats, 6 haulers, factory', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 300, fps: 30 },
  { name: 'high warehouse level (pick/drop 0.04 s), 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } }, secs: 300, fps: 30 },
  { name: 'max 30/30, loop berths, 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } }, outer: 2, secs: 300, fps: 30 },
  { name: 'mid at 15 FPS', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 180, fps: 15 },
  { name: 'mid at 60 FPS', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 180, fps: 60 },
];
async function run(b, url, sc) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, harborOuter: sc.outer || 0, settings: { quality: sc.quality || 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(sc => {
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    __game.loop.sleep();
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, S = sim.S, F = w.fleet;
    const trace = [], unloads = []; let shownAway = 0, shown = 0;
    const cw = w.craneWork.bind(w);
    w.craneWork = bt => {
      unloads.push([+(T / 1000).toFixed(3), bt.i]);
      const moored = F.mooredSite(bt) >= 0, before = JSON.stringify([w.cranes.map(c => c.t), w.slipCarts ? w.slipCarts.carts.map(c => c.busy) : 0, F.jetties.carts.map(c => c.busy)]);
      cw(bt);
      const after = JSON.stringify([w.cranes.map(c => c.t), w.slipCarts ? w.slipCarts.carts.map(c => c.busy) : 0, F.jetties.carts.map(c => c.busy)]);
      if (before !== after) { shown++; if (!moored) shownAway++; }
    };
    const ms = 1000 / sc.fps; let T = performance.now();
    const n = Math.round(sc.secs * sc.fps), every = Math.round(sc.fps / 2);
    for (let k = 0; k < n; k++) {
      T += ms; __game.step(T, ms);
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
  const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
  for (const [n, sc] of SCEN.entries()) {
    if (only && !only.includes(n)) continue;
    const ra = await run(b, A, sc), rb = await run(b, B, sc);
    let firstDiff = null;
    for (let i = 0; i < Math.max(ra.trace.length, rb.trace.length); i++) if (JSON.stringify(ra.trace[i]) !== JSON.stringify(rb.trace[i])) { firstDiff = { sample: i, seconds: i / 2, before: ra.trace[i], after: rb.trace[i] }; break; }
    const res = { scenario: sc.name, fps: sc.fps, seconds: sc.secs, samples: ra.trace.length, identical: !firstDiff && JSON.stringify(ra.unloads) === JSON.stringify(rb.unloads), unloadEventsIdentical: JSON.stringify(ra.unloads) === JSON.stringify(rb.unloads), unloadEvents: rb.unloads.length,
      before: { money: ra.money, caught: ra.caught, sold: ra.sold, stock: ra.stock, unloadingShown: ra.shown, shownWithBoatAway: ra.shownAway },
      after: { money: rb.money, caught: rb.caught, sold: rb.sold, stock: rb.stock, unloadingShown: rb.shown, shownWithBoatAway: rb.shownAway }, firstDiff, errors: [...ra.errs, ...rb.errs].slice(0, 3) };
    fs.writeFileSync(path.join(dir, `regress-${n}.json`), JSON.stringify(res, null, 1));
    console.log(JSON.stringify({ n, scenario: res.scenario, identical: res.identical, unloadEvents: res.unloadEvents, before: res.before, after: res.after, firstDiff: !!firstDiff, errors: res.errors }));
  }
  await b.close();
  const out = SCEN.map((_, n) => path.join(dir, `regress-${n}.json`)).filter(f => fs.existsSync(f)).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  fs.writeFileSync(path.join(dir, 'regress.json'), JSON.stringify(out, null, 1));
  process.exit(out.every(r => r.identical && !r.after.shownWithBoatAway && !r.errors.length) ? 0 : 1);
})();
