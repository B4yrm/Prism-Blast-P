// Save comparison that knows about the new S.eco key (tests/save-compare.cjs reports the key as the one difference).
// The same four saves as tests/save-compare.cjs (current / old minimal / one hour away / max with loop berths) are loaded into
//   base (before eco)   |   eco build, eco off   |   eco build, eco on (?eco=1)
// with the same fixed clock and seed, then played 60 s of game time. Compared:
//   • the state right after loading, the offline offer and the state after 60 s: IDENTICAL in all three once `eco` / `ecoBak` are set aside
//   • S.eco apart: base has none; eco off creates it at load and never changes it; eco on keeps it valid (no repairs needed on the next load)
//     and really holds tracked species (the composition left the reference mix) — and every other key is still the same as in base
//   node tests/eco/save-compare-eco.cjs <base.html> <eco.html> [out.json]   → exit code 1 on failure
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const { bundle, fresh } = require('./_load.cjs');
const E = fresh(bundle('state-eco-savecmp', "export * from './eco/state-eco.js';"));
const [BASE, ECO] = process.argv.slice(2, 4).map(f => 'file://' + path.resolve(f));
const ECO_ON = ECO + '?eco=1', OUT = process.argv[4];
const VIEW = { width: 200, height: 100 };
const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};
const BASE_T = 1.8e12;
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const SAVES = {
  current: { v: 1, money: 1234.5, register: 40, boats: 3, workers: 5, level: 9, xp: 12, settings: { quality: 'medium' }, tier: { harbor: 2, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 4, speed: 6, net: 3 }, warehouse: { cap: 3, load: 2, cold: 1 } }, stock: { quay: 7, wh: 20, facOut: 3, mRaw: 5, mProd: 2 }, stats: { caught: 900, sold: 700 }, lastSeen: BASE_T - 30e3 },
  oldMinimal: { v: 1, money: 300, boats: 2, workers: 2, level: 4, stats: { caught: 120, sold: 80 }, lastSeen: BASE_T - 30e3 },
  hourAway: { v: 1, money: 5000, boats: 4, workers: 6, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, stats: { caught: 5000, sold: 4500 }, lastSeen: BASE_T - 3600e3 },
  maxLoopBerths: { v: 1, money: 99999, boats: 4, workers: 10, level: 30, harborOuter: 2, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 30, speed: 30, net: 30 } }, stats: { caught: 90000, sold: 80000 }, lastSeen: BASE_T - 30e3 },
};
async function run(b, url, save) {
  const ctx = await b.newContext({ viewport: VIEW });
  await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(([save, BASE_T]) => {
    window.__T = 0; Date.now = () => BASE_T + window.__T;
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify(save));
  }, [save, BASE_T]);
  const p = await ctx.newPage(); const errs = [], logs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => logs.push(m.text()));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(() => {
    __game.loop.sleep(); window.__go = true; { const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }
    const w = __game.scene.getScene('world'), S = w.sim.S, clean = o => { const c = JSON.parse(JSON.stringify(o)); delete c.lastSeen; return c; };
    const modal = document.getElementById('modal'), offerText = modal && !modal.hidden ? modal.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null;
    const afterLoad = clean(S);
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let T = 1e5;
    for (let k = 0; k < 60 * 30; k++) { T += 1000 / 30; window.__T += 1000 / 30; __game.step(T, 1000 / 30); }
    const snap = window.__eco ? window.__eco.species.snapshot() : null;
    return { afterLoad, offerText, after60: clean(S), on: window.__eco ? window.__eco.on : null, violations: snap ? snap.violations.n : null, events: snap ? snap.ledger.events : null };
  });
  await ctx.close();
  return { ...r, errs: errs.slice(0, 3), ecoerr: logs.filter(l => l.startsWith('ECOERR')) };
}
const split = S => { const { eco, ecoBak, ...rest } = S; return { rest, eco, ecoBak }; };
const diff = (a, b, pre = '') => {
  const out = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    if (x && y && typeof x === 'object' && typeof y === 'object') out.push(...diff(x, y, pre + k + '.'));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${pre}${k}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [name, save] of Object.entries(SAVES)) {
    const base = await run(b, BASE, save), off = await run(b, ECO, save), on = await run(b, ECO_ON, save);
    const B = [split(base.afterLoad), split(base.after60)], O = [split(off.afterLoad), split(off.after60)], N = [split(on.afterLoad), split(on.after60)];
    const dOff = [diff(B[0].rest, O[0].rest), diff(B[1].rest, O[1].rest)], dOn = [diff(B[0].rest, N[0].rest), diff(B[1].rest, N[1].rest)];
    // S.eco
    const offUnchanged = JSON.stringify(O[0].eco) === JSON.stringify(O[1].eco) && !!O[0].eco;
    const onAfterLoadSameAsOff = JSON.stringify(N[0].eco) === JSON.stringify(O[0].eco);
    const copy = JSON.parse(JSON.stringify({ ...N[1].rest, eco: N[1].eco })), rep = E.initEco(copy);
    const REF = E.REF_MIX, moved = ['mix', 'omix'].some(f => Object.values(N[1].eco[f]).some(a => a.some((x, i) => Math.abs(x - REF[i]) > 1e-6)));
    const res = {
      save: name, baseHasNoEco: B[0].eco === undefined && B[1].eco === undefined,
      offIdenticalToBase: !dOff[0].length && !dOff[1].length, onIdenticalToBase: !dOn[0].length && !dOn[1].length,
      offerIdentical: base.offerText === off.offerText && base.offerText === on.offerText, offlineOffer: base.offerText,
      ecoOffCreatedAtLoadAndNeverChanged: offUnchanged, ecoOnSameAtLoad: onAfterLoadSameAsOff,
      ecoOnTracked: on.on === true && on.violations === 0 && moved && on.events.catch > 0, ecoOnNextLoad: { status: rep.status, repairs: rep.repairs },
      diffs: { off: dOff.map(d => d.slice(0, 5)), on: dOn.map(d => d.slice(0, 5)) }, events: on.events, violations: on.violations,
      errors: [...base.errs, ...off.errs, ...on.errs], ecoerr: [...off.ecoerr, ...on.ecoerr], money: [Math.floor(base.after60.money), Math.floor(off.after60.money), Math.floor(on.after60.money)],
    };
    out.push(res); console.log(JSON.stringify({ save: name, offIdenticalToBase: res.offIdenticalToBase, onIdenticalToBase: res.onIdenticalToBase, offerIdentical: res.offerIdentical, ecoOffNeverChanged: offUnchanged, ecoOnTracked: res.ecoOnTracked, ecoOnNextLoad: res.ecoOnNextLoad, errors: res.errors.length }));
  }
  await b.close();
  const ok = out.every(r => r.baseHasNoEco && r.offIdenticalToBase && r.onIdenticalToBase && r.offerIdentical && r.ecoOffCreatedAtLoadAndNeverChanged && r.ecoOnSameAtLoad && r.ecoOnTracked && r.ecoOnNextLoad.status === 'ok' && !r.ecoOnNextLoad.repairs.length && !r.errors.length && !r.ecoerr.length);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ test: 'save comparison with the eco key set aside', pass: ok, runs: out }, null, 1));
  console.log(JSON.stringify({ pass: ok }));
  process.exit(ok ? 0 : 1);
})();
