// Are the boats DRAWN identically with and without the eco layer? (deterministic answer to the boat-sync timing noise)
// tests/boat-sync.cjs measures how late the drawn boats are against the simulation, but its start-up frames run in real
// time, so even the same build gives different numbers from run to run. Here the game is stepped frame by frame from a frozen,
// seeded start (the harness of tests/workers-regress.cjs) and, every 0.5 s, the complete visual state of the fleet is
// recorded: every drawn boat's position, heading, phase, mode and plan leg, the fleet's own timing statistics (arrivals, lag
// mean / max, waits) and the simulation's boats. base, eco off and eco on (?eco=1) must give the identical record.
// Scenarios are the boat-sync saves with the most failures in the repeated runs (4 boats; engine / nets levels as in boat-sync).
//   node tests/eco/boat-visual-identity.cjs <base.html> <eco.html> [out.json] [secs]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [BASE, ECO] = process.argv.slice(2, 4).map(f => 'file://' + path.resolve(f));
const ECO_ON = ECO + '?eco=1', OUT = process.argv[4], SECS = +(process.argv[5] || 900);
const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};
const SCEN = [
  { name: 'start-fleet4', up: {} },
  { name: 'mid-fleet4 (engine 6, nets 3)', up: { cap: 4, speed: 6, net: 3 } },
  { name: 'mid+-fleet4 (engine 10, nets 8)', up: { cap: 6, speed: 10, net: 8 } },
];
async function run(b, url, sc) {
  const ctx = await b.newContext({ viewport: { width: 200, height: 100 } });
  await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, harborOuter: 0, boats: 4, workers: 6, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 },
      up: { harbor: { cap: 0, speed: 0, net: 0, ...sc.up } }, research: { lv: {}, active: null }, stats: { caught: 1, sold: 1 }, created: 1700000000000, lastSeen: Date.now() })); }, sc);
  const p = await ctx.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(secs => {
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    __game.loop.sleep(); window.__go = true; { const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), F = w.fleet, sim = w.sim, rec = [];
    const num = x => typeof x === 'number' ? +x.toFixed(6) : x;
    let T = 1e5; const n = Math.round(secs * 30);
    for (let k = 0; k < n; k++) {
      T += 1000 / 30; __game.step(T, 1000 / 30);
      if (k % 15 === 0) rec.push(JSON.stringify([
        F.boats.map(v => [num(v.x), num(v.y), num(v.h), v.phase, v.mode, v.c, v.trip ? 1 : 0, v.st ? [v.st.leg, num(v.st.s)] : null]),
        sim.boats.map(x => [x.state, x.load, num(x.m.x), num(x.m.y), num(x.t)]), F.logLine()]));
    }
    return { rec, last: F.logLine() };
  }, SECS);
  await ctx.close();
  return { ...r, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const sc of SCEN) {
    const base = await run(b, BASE, sc), off = await run(b, ECO, sc), on = await run(b, ECO_ON, sc);
    const first = (x, y) => { const i = x.rec.findIndex((t, k) => t !== y.rec[k]); return i < 0 ? null : { sample: i, seconds: i / 2 }; };
    const res = { scenario: sc.name, seconds: SECS, samples: base.rec.length, offIdentical: !first(base, off) && base.rec.length === off.rec.length, onIdentical: !first(base, on) && base.rec.length === on.rec.length,
      firstDiffOff: first(base, off), firstDiffOn: first(base, on), fleetLine: base.last, errors: [...base.errs, ...off.errs, ...on.errs].slice(0, 3) };
    out.push(res); console.log(JSON.stringify(res));
  }
  await b.close();
  const pass = out.every(r => r.offIdentical && r.onIdentical && !r.errors.length);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ test: 'drawn boats identical in base / eco off / eco on', pass, runs: out }, null, 1));
  console.log(JSON.stringify({ pass }));
  process.exit(pass ? 0 : 1);
})();
