// Workers phase A: the unloading indicator, boat by boat.
// Slips 1–2 have a crane, slips 3–4 now a small slip cart, the outer (loop) berths the jetty carts.
// Per boat: how many of the simulation's unload events were shown, and by what; per site: frames in which
// the indicator works while no boat is moored there (must be 0; a cart driving back to its parking spot
// after the boat has left is counted apart as "parking").
//   node tests/unload-show.cjs <build.html>  → test-results/workers/unload-show.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(process.argv[2]);
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const STRONG = { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 };
const SCEN = [
  { name: 'slips: 4 boats, mid', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 480 },
  { name: 'slips: 4 boats, high cargo (quay often full)', boats: 4, workers: 3, tier: { harbor: 3, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 }, up: { harbor: { cap: 20, speed: 10, net: 12 } }, secs: 480 },
  { name: 'loop berths: max 30/30', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } }, outer: 2, secs: 480 },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const sc of SCEN) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, harborOuter: sc.outer || 0, settings: { quality: 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE);
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(secs => {
      document.querySelectorAll('[data-m]').forEach(x => x.click());
      __game.loop.sleep();
      let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, fps = 30, ms = 1000 / fps;
      // the indicators: id → { active(), parking() }
      const ind = {};
      w.cranes.forEach((c, n) => ind['crane' + n] = { active: () => c.t > 0, parking: () => false });
      (w.slipCarts ? w.slipCarts.carts : []).forEach((c, n) => ind['slipcart' + n] = { active: () => c.busy > 0 || (c.s > 0 && c.dir > 0), parking: () => c.busy <= 0 && c.s > 0 && c.dir < 0 });
      F.jetties.carts.forEach((c, n) => { if (c) ind['jettycart' + n] = { active: () => c.busy > 0 || (c.s > 0 && c.dir > 0), parking: () => c.busy <= 0 && c.s > 0 && c.dir < 0 }; });
      const snap = () => Object.fromEntries(Object.entries(ind).map(([k, v]) => [k, v.active()]));
      const perBoat = sim.boats.map((_, i) => ({ boat: i + 1, unloadEvents: 0, notMoored: 0, shownBy: {}, sites: {} }));
      const siteOf = {};                                  // indicator → sites it served
      const cw = w.craneWork.bind(w);
      let busyBefore;
      w.craneWork = bt => {
        const pb = perBoat[bt.i], site = F.mooredSite(bt); pb.unloadEvents++;
        if (site < 0) { pb.notMoored++; cw(bt); return; }
        pb.sites[site] = (pb.sites[site] || 0) + 1;
        const cr = w.cranes.map(c => c.t), sl = w.slipCarts ? w.slipCarts.carts.map(c => c.busy) : [], jt = F.jetties.carts.map(c => c && c.busy);
        cw(bt);
        let by = 'none';
        w.cranes.forEach((c, n) => { if (c.t !== cr[n]) by = 'crane' + n; });
        (w.slipCarts ? w.slipCarts.carts : []).forEach((c, n) => { if (c.busy !== sl[n]) by = 'slipcart' + n; });
        F.jetties.carts.forEach((c, n) => { if (c && c.busy !== jt[n]) by = 'jettycart' + n; });
        pb.shownBy[by] = (pb.shownBy[by] || 0) + 1;
        if (by !== 'none') (siteOf[by] = siteOf[by] || new Set()).add(site);
      };
      const stray = {}, parking = {}, frames = {}, activeWhenMoored = {};
      let T = performance.now();
      for (let k = 0; k < secs * fps; k++) {
        T += ms; __game.step(T, ms);
        const moored = new Set(sim.boats.map(bt => F.mooredSite(bt)).filter(s => s >= 0));
        for (const [id, v] of Object.entries(ind)) {
          const sites = siteOf[id]; if (!sites) continue;
          const anyMoored = [...sites].some(s => moored.has(s));
          if (v.active()) { frames[id] = (frames[id] || 0) + 1; if (!anyMoored) stray[id] = (stray[id] || 0) + 1; }
          if (v.parking() && !anyMoored) parking[id] = (parking[id] || 0) + 1;
        }
      }
      return { perBoat, indicators: Object.fromEntries(Object.entries(siteOf).map(([k, s]) => [k, { sites: [...s], activeSeconds: +((frames[k] || 0) / fps).toFixed(1), activeWithNoBoatMooredFrames: stray[k] || 0, parkingAfterDepartureSeconds: +((parking[k] || 0) / fps).toFixed(1) }])) };
    }, sc.secs);
    await ctx.close();
    out.push({ scenario: sc.name, ...r, errors: errs.slice(0, 3) }); console.error(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  const ok = out.every(o => !o.errors.length && Object.values(o.indicators).every(i => !i.activeWithNoBoatMooredFrames) && o.perBoat.every(pb => !pb.shownBy.none));
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/unload-show.json'), JSON.stringify({ ok, runs: out }, null, 1));
  console.log('ok', ok);
  process.exit(ok ? 0 : 1);
})();
