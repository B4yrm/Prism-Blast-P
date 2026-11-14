// Eco skeleton in the real page (headless Chromium):
//   1. load order: the adapter is installed exactly once, before main.js loaded the save; the contract holds;
//      a second install is refused; wrappers are one level deep; no page error, no ECOERR line
//   2. the build without ECO has no eco layer at all
//   3. the whole game stepped frame by frame (seeded, as tests/workers-regress.cjs does), 120 s at 30 FPS,
//      is identical in: the build without ECO, the ECO build with eco off, the ECO build with eco on (clock only)
//   node tests/eco/eco-browser.cjs <base.html> <eco.html> [out.json]   → exit code 1 on failure
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [BASE, ECO] = process.argv.slice(2, 4).map(f => 'file://' + path.resolve(f));
const OUT = process.argv[4];
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
// same deterministic start as tests/workers-regress.cjs
const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};
const SAVE = { v: 1, money: 500, boats: 4, workers: 6, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 },
  up: { harbor: { cap: 6, speed: 10, net: 8 } }, stats: { caught: 5, sold: 5 } };
const ready = p => p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });

async function open(b, url, opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 200, height: 100 } });
  if (opts.freeze) await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(s => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1); localStorage.setItem('fishingTycoon.save', JSON.stringify({ ...s, lastSeen: Date.now() })); }, SAVE);
  const p = await ctx.newPage(), errs = [], logs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => logs.push(m.text()));
  await p.goto(url); await ready(p);
  return { ctx, p, errs, logs };
}

async function stepped(b, url, ecoOn) {
  const { ctx, p, errs } = await open(b, url, { freeze: true });
  const r = await p.evaluate(on => {
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    if (on) window.__eco.setOn(true);
    __game.loop.sleep(); window.__go = true; { const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const sim = __game.scene.getScene('world').sim, S = sim.S, trace = [];
    let T = 1e5;
    for (let k = 0; k < 120 * 30; k++) {
      T += 1000 / 30; __game.step(T, 1000 / 30);
      if (k % 15 === 0) trace.push(JSON.stringify([S.money, S.register, S.stock, S.stats, sim.workers.map(x => [x.state, x.m.x, x.m.y, x.t, x.carry]), sim.boats.map(x => [x.state, x.load, x.m.x, x.m.y]), sim.customers.length]));
    }
    return { trace, money: S.money, caught: S.stats.caught, sold: S.stats.sold, clock: window.__eco ? window.__eco.clock : null };
  }, ecoOn);
  await ctx.close();
  return { ...r, errs };
}

(async () => {
  const b = await chromium.launch({ args: ARGS });
  const res = [];
  const check = (name, pass, info) => res.push({ name, pass: !!pass, ...(info ? { info } : {}) });

  { // 1. ECO page
    const { ctx, p, errs, logs } = await open(b, ECO);
    const r = await p.evaluate(() => {
      const e = window.__eco, proto = __game.scene.getScene('world').sim.constructor.prototype;
      const before = { installed: e.installed, attempts: e.attempts, beforeLoad: e.installedBeforeLoad, on: e.on, result: e.result, contract: e.contract(), version: e.version };
      const upd = proto.update, again = e.reinstall();
      return { ...before, again, attemptsAfter: e.attempts, sameUpdate: proto.update === upd, depth1: typeof proto.update.ecoOrig === 'function' && proto.update.ecoOrig.ecoOrig === undefined, clock: e.clock };
    });
    check('eco page: installed once, before the save was loaded, contract ok', r.installed && r.attempts === 1 && r.beforeLoad === true && r.result.ok && r.contract.length === 0 && r.on === false, r);
    check('eco page: second install refused, wrapper unchanged and one level deep', r.again.ok === false && /already/.test(r.again.reason) && r.sameUpdate && r.depth1, { again: r.again });
    check('eco page: eco off by default, clock not running', r.on === false && r.clock.hours === 0 && r.clock.acc === 0, r.clock);
    check('eco page: no page error, no ECOERR', !errs.length && !logs.some(l => l.startsWith('ECOERR')), { errs, ecoerr: logs.filter(l => l.startsWith('ECOERR')) });
    await ctx.close();
  }
  { // 2. base page
    const { ctx, p, errs } = await open(b, BASE);
    const r = await p.evaluate(() => ({ eco: typeof window.__eco, wrapped: !!__game.scene.getScene('world').sim.constructor.prototype.update.ecoOrig }));
    check('base page: no eco layer', r.eco === 'undefined' && !r.wrapped && !errs.length, { ...r, errs });
    await ctx.close();
  }
  { // 3. stepped equivalence
    const a = await stepped(b, BASE, false), off = await stepped(b, ECO, false), on = await stepped(b, ECO, true);
    const diff = (x, y) => x.trace.findIndex((t, k) => t !== y.trace[k]);
    const dOff = diff(a, off), dOn = diff(a, on);
    check('stepped 120 s @30 FPS: base == eco off', dOff === -1 && a.trace.length === off.trace.length && !off.errs.length, { firstDiffSec: dOff < 0 ? null : dOff / 2, samples: a.trace.length, money: Math.floor(a.money), caught: a.caught, sold: a.sold });
    check('stepped 120 s @30 FPS: base == eco on (clock only), clock = 2 game hours', dOn === -1 && !on.errs.length && on.clock.hours === 2, { firstDiffSec: dOn < 0 ? null : dOn / 2, clock: on.clock, offClock: off.clock });
  }
  await b.close();
  const out = { test: 'eco skeleton in the page', pass: res.every(r => r.pass), results: res };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.pass ? 0 : 1);
})();
