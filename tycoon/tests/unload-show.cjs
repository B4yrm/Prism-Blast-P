// Workers phase A: the unloading indicator, boat by boat.
// Slips 1–2 have a crane, slips 3–4 now a small slip cart, the outer (loop) berths the jetty carts.
// Per boat: how many of the simulation's unload events were shown, and by what; per site: frames in which
// the indicator works while no boat is moored there (must be 0; a cart driving back to its parking spot
// after the boat has left is counted apart as "parking").
//   node tests/unload-show.cjs <build.html>  → test-results/workers/unload-show.json
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
const BUILDS = process.argv.slice(2);
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
  for (const FILEP of BUILDS) for (const sc of SCEN) {
    const FILE = 'file://' + path.resolve(FILEP);
    const ctx = await b.newContext({ viewport: VIEW });
    await ctx.addInitScript(FREEZE);
    await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, harborOuter: sc.outer || 0, settings: { quality: 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE);
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(secs => {
      document.querySelectorAll('[data-m]').forEach(x => x.click());
      __game.loop.sleep(); window.__go = true; { const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }   // as Phaser's own loop would set it
      let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, fps = 30, ms = 1000 / fps;
      // the indicators: id → { active(), parking() }
      const ind = {};
      w.cranes.forEach((c, n) => ind['crane' + n] = { active: () => c.t > 0, parking: () => false });
      (w.slipCarts ? w.slipCarts.carts : []).forEach((c, n) => ind['slipcart' + n] = { active: () => c.busy > 0 || (c.s > 0 && c.dir > 0), parking: () => c.busy <= 0 && c.s > 0 && c.dir < 0 });
      F.jetties.carts.forEach((c, n) => { if (c) ind['jettycart' + n] = { active: () => c.busy > 0 || (c.s > 0 && c.dir > 0), parking: () => c.busy <= 0 && c.s > 0 && c.dir < 0 }; });
      const snap = () => Object.fromEntries(Object.entries(ind).map(([k, v]) => [k, v.active()]));
      const perBoat = sim.boats.map((_, i) => ({ boat: i + 1, unloadEvents: 0, notMoored: 0, shownBy: {}, sites: {} }));
      const siteOf = {}, LASTSET = {}; let K = -1;                                  // indicator → sites it served
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
        if (by === 'none') F.jetties.carts.forEach((c, n) => { if (c && LASTSET[n] === K) by = 'jettycart' + n + ' (set this frame by the other berth)'; });
        F.jetties.carts.forEach((c, n) => { if (c && c.busy !== jt[n]) LASTSET[n] = K; });
        pb.shownBy[by] = (pb.shownBy[by] || 0) + 1;
        if (by !== 'none') (siteOf[by] = siteOf[by] || new Set()).add(site);
      };
      const stray = {}, parking = {}, frames = {}, episodes = {}, run = {};
      let T = 1e5 /* the same clock start in every run: the boats time their moves on it */;
      for (let k = 0; k < secs * fps; k++) {
        K = k; T += ms; __game.step(T, ms);
        const moored = new Set(sim.boats.map(bt => F.mooredSite(bt)).filter(s => s >= 0));
        for (const [id, v] of Object.entries(ind)) {
          const sites = siteOf[id]; if (!sites) continue;
          const anyMoored = [...sites].some(s => moored.has(s));
          if (v.active()) { frames[id] = (frames[id] || 0) + 1; if (!anyMoored) stray[id] = (stray[id] || 0) + 1; }
          if (v.active() && !anyMoored) run[id] = (run[id] || 0) + 1; else if (run[id]) { (episodes[id] = episodes[id] || []).push([+((k - run[id]) / fps).toFixed(2), +(run[id] / fps).toFixed(2)]); run[id] = 0; }
          if (v.parking() && !anyMoored) parking[id] = (parking[id] || 0) + 1;
        }
      }
      return { perBoat, indicators: Object.fromEntries(Object.entries(siteOf).map(([k, s]) => [k, { sites: [...s], activeSeconds: +((frames[k] || 0) / fps).toFixed(1), activeWithNoBoatMooredFrames: stray[k] || 0, episodes: (episodes[k] || []).slice(0, 6), parkingAfterDepartureSeconds: +((parking[k] || 0) / fps).toFixed(1) }])) };
    }, sc.secs);
    await ctx.close();
    out.push({ build: FILEP, scenario: sc.name, ...r, errors: errs.slice(0, 3) }); console.error(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  // pass: (1) every unload event of every boat shown by an indicator; (2) the new slip carts never work while no
  // boat is moored in their slip; (3) the existing cranes and jetty carts behave exactly as in the old build
  // (they are not part of this change). Judged on the last build given; (3) only when two builds are given.
  const last = BUILDS[BUILDS.length - 1], NEW = out.filter(o => o.build === last), OLD = out.filter(o => o.build !== last);
  const checks = NEW.map(o => {
    const old = OLD.find(q => q.scenario === o.scenario);
    const missing = o.perBoat.reduce((a, pb) => a + (pb.shownBy.none || 0), 0);
    const slipStray = Object.entries(o.indicators).filter(([k]) => k.startsWith('slipcart')).reduce((a, [, v]) => a + v.activeWithNoBoatMooredFrames, 0);
    const existingSame = !old || Object.entries(o.indicators).filter(([k]) => !k.startsWith('slipcart')).every(([k, v]) => old.indicators[k] && JSON.stringify(old.indicators[k]) === JSON.stringify(v));
    return { scenario: o.scenario, eventsNotShown: missing, slipCartFramesWithoutBoat: slipStray, existingIndicatorsAsBefore: existingSame, errors: o.errors.length, pass: !missing && !slipStray && existingSame && !o.errors.length };
  });
  const ok = checks.every(c => c.pass);
  out.unshift({ checks });
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/unload-show.json'), JSON.stringify({ ok, runs: out }, null, 1));
  console.log('ok', ok);
  process.exit(ok ? 0 : 1);
})();
