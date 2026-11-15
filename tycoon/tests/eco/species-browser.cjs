// Species tracking in the real page (headless Chromium; the game is stepped frame by frame, drawing included,
// exactly like tests/workers-regress.cjs, and eco is switched on with ?eco=1):
//   1. the whole game, 300 s at 30 FPS, mid and max: identical in base / eco off / eco on (the simulation state
//      every 0.5 s, the final save without S.eco, the number of global-random draws); with eco on, an in-page audit
//      every 2 s (species sum = stock, boats / haulers / conveyor, ledger) finds nothing; S.eco is not written while off
//   2. save and reload: S.eco.mix / omix hold the composition (valid, varied); the next page attaches to the same
//      composition (whole-number counts equal to those at save time) and keeps auditing clean
//   3. rollback: the same save through the production index.html and through the T1.2 eco build keeps S.eco
//      value for value; back in the eco build: status ok, no repairs, tracking continues
//   4. a save played by the production build in between (stock changed, composition stale): the eco build attaches
//      and audits clean afterwards
//   5. S.eco of a newer schema: ?eco=1 does NOT switch tracking on, S.eco stays byte-identical
//   6. a T1.2-format S.eco (no omix) is upgraded and tracked
//   node tests/eco/species-browser.cjs <base.html> <eco.html> <old-prod.html> <old-t12-eco.html> [out.json]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [BASE, ECO, OLDPROD, OLDT12] = process.argv.slice(2, 6).map(f => 'file://' + path.resolve(f));
const ECO_ON = ECO + '?eco=species', OUT = process.argv[6];   // tracking only: since T1.4, ?eco=1 also switches prices on, which change the cash register by design
const root = path.resolve(__dirname, '../..');
const BLANK = path.join(root, '.preview', 'blank.html');
fs.mkdirSync(path.dirname(BLANK), { recursive: true }); fs.writeFileSync(BLANK, '<!doctype html><meta charset="utf-8"><title>blank</title>');
const BLANK_URL = 'file://' + BLANK, KEY = 'fishingTycoon.save';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const FIX = n => JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures', `save-${n}.json`), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LOCS = ['quay', 'wh', 'mRaw', 'facOut', 'mProd'];

const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const CFG = {
  mid: { v: 1, money: 500, boats: 4, workers: 6, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, stats: { caught: 5, sold: 5 }, created: 1700000000000 },
  max: { v: 1, money: 500, boats: 4, workers: 10, level: 12, harborOuter: 2, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } }, stats: { caught: 5, sold: 5 }, created: 1700000000000 },
};

// ---- in-page helpers (passed to evaluate) ---------------------------------------------------------------------------
// Independent audit of the tracker's snapshot against the live simulation. Returns a list of problems.
const AUDIT = () => {
  const e = window.__eco, w = __game.scene.getScene('world'), sim = w.sim, S = sim.S, snap = e.species.snapshot(), errs = [];
  const sum = v => v.reduce((a, b) => a + b, 0), REF = [0.55, 0.35, 0.10, 0, 0];
  if (!snap.attached) return ['tracker not attached'];
  for (const l of ['quay', 'wh', 'mRaw', 'facOut', 'mProd']) {
    if (Math.abs(sum(snap.qty[l]) - S.stock[l]) > 1e-6) errs.push(`${l}: ${sum(snap.qty[l])} vs ${S.stock[l]}`);
    if (sum(snap.counts[l]) !== S.stock[l]) errs.push(`${l} whole-number counts ${sum(snap.counts[l])} vs ${S.stock[l]}`);
    if (snap.qty[l].some(x => !(x >= -1e-9))) errs.push(l + ' negative');
    const f = ['quay', 'wh', 'mRaw'].includes(l) ? 'mix' : 'omix', sh = S.eco[f][l];
    if (S.stock[l] > 0) { for (let i = 0; i < 5; i++) if (Math.abs(sh[i] - snap.qty[l][i] / S.stock[l]) > 1e-9) { errs.push(`S.eco.${f}.${l} is not the tracked composition`); break; } }
    else if (JSON.stringify(sh) !== JSON.stringify(REF) || S.eco.q[l] !== 1) errs.push(`empty ${l}: not the reference mix / quality 1`);
  }
  let aboard = 0, carried = 0;
  for (const b of sim.boats) if (b.state === 'back' || b.state === 'dock') aboard += b.load;
  for (const k of sim.workers) carried += k.carry;
  if (Math.abs(sum(snap.aboard) - aboard) > 1e-6) errs.push(`aboard ${sum(snap.aboard)} vs ${aboard}`);
  if (Math.abs(sum(snap.carried) - carried) > 1e-6) errs.push(`carried ${sum(snap.carried)} vs ${carried}`);
  if (snap.conveyorUnits !== sim.convey.length) errs.push(`conveyor ${snap.conveyorUnits} vs ${sim.convey.length}`);
  if (snap.residual.some(r => Math.abs(r) > 1e-6)) errs.push('ledger residual ' + JSON.stringify(snap.residual));
  if (snap.violations.n) errs.push('tracker: ' + snap.violations.first[0]);
  for (const f of ['mix', 'omix']) for (const l of Object.keys(S.eco[f])) if (Math.abs(sum(S.eco[f][l]) - 1) > 1e-9) errs.push(`S.eco.${f}.${l} shares do not sum to 1`);
  return errs;
};
// Steps the game `secs` seconds at `fps`. Returns the trace, audit errors (only when `audit`), random draws.
const STEP = ({ secs, fps, audit, traceEvery }) => {
  document.querySelectorAll('[data-m]').forEach(x => x.click());
  __game.loop.sleep(); window.__go = true;
  if (!window.__stepPatched) { window.__stepPatched = true; const gs = __game.step.bind(__game); __game.step = (t, d) => { __game.loop.delta = d; __game.loop.rawDelta = d; return gs(t, d); }; }
  let seed = 4242, calls = 0; const real = Math.random; Math.random = () => { calls++; return (seed = (seed * 16807) % 2147483647) / 2147483647; };
  const sim = __game.scene.getScene('world').sim, S = sim.S, trace = [], errors = [];
  let T = 1e5 + (window.__T || 0); const ms = 1000 / fps, n = Math.round(secs * fps), every = Math.round(fps / 2), aEvery = Math.round(fps * 2);
  for (let k = 0; k < n; k++) {
    T += ms; __game.step(T, ms);
    if (traceEvery && k % every === 0) trace.push(JSON.stringify([S.money, S.register, S.stock, S.stats, sim.workers.map(x => [x.state, x.m.x, x.m.y, x.t, x.carry]), sim.boats.map(x => [x.state, x.load, x.m.x, x.m.y]), sim.customers.length]));
    if (audit && k % aEvery === 0) { const e = window.__AUDIT(); if (e.length && errors.length < 4) errors.push(`${(k / fps).toFixed(1)} s: ${e.slice(0, 3).join(' | ')}`); }
  }
  window.__T = (window.__T || 0) + n * ms;
  const final = JSON.stringify({ ...S, eco: undefined, ecoBak: undefined, lastSeen: undefined });
  Math.random = real;
  return { trace, errors, calls, final, eco: JSON.parse(JSON.stringify(S.eco || null)) };
};

const ready = p => p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
async function newPage(b, frozen = true) {
  const ctx = await b.newContext({ viewport: { width: 200, height: 100 } });
  if (frozen) await ctx.addInitScript(FREEZE);
  await ctx.addInitScript(`window.__AUDIT = ${AUDIT.toString()};`);
  const p = await ctx.newPage(); p.errs = []; p.logs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => p.logs.push(m.text()));
  await p.goto(BLANK_URL);
  return { ctx, p };
}
const put = (p, S) => p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(S)]);
const raw = p => p.evaluate(k => localStorage.getItem(k), KEY);
async function visit(p, url) {                       // open a build and wait until the game is up
  const e0 = p.errs.length, l0 = p.logs.length;
  await p.goto(url); await ready(p);
  return { errs: () => p.errs.slice(e0), logs: () => p.logs.slice(l0) };
}
async function leave(p) { await p.goto(BLANK_URL); return JSON.parse(await raw(p)); }          // pagehide: the game saves
const step = (p, o) => p.evaluate(STEP, o);

(async () => {
  const b = await chromium.launch({ args: ARGS });
  const results = [];
  const check = (group, name, pass, info) => { results.push({ group, name, pass: !!pass, ...(info ? { info } : {}) }); console.log((pass ? 'ok   ' : 'FAIL ') + group + ' | ' + name + (pass ? '' : '  ' + JSON.stringify(info).slice(0, 400))); };

  // ---- 1. identity and in-page audit --------------------------------------------------------------------------
  for (const key of ['mid', 'max']) {
    const runs = {};
    for (const [mode, url] of [['base', BASE], ['off', ECO], ['on', ECO_ON]]) {
      const { ctx, p } = await newPage(b);
      await put(p, { ...CFG[key], lastSeen: Date.now() });
      const v = await visit(p, url);
      const eco0 = mode === 'base' ? null : await p.evaluate(() => JSON.stringify(__game.scene.getScene('world').sim.S.eco));
      const on = mode === 'base' ? null : await p.evaluate(() => window.__eco.on);
      if (mode === 'on') await p.evaluate(() => window.__eco.species.ensure());
      const r = await step(p, { secs: 300, fps: 30, audit: mode === 'on', traceEvery: true });
      const snap = mode === 'on' ? await p.evaluate(() => window.__eco.species.snapshot()) : null;
      const eco1 = mode === 'base' ? null : await p.evaluate(() => JSON.stringify(__game.scene.getScene('world').sim.S.eco));
      runs[mode] = { ...r, on, snap, eco0, eco1, errs: p.errs.slice(), ecoerr: v.logs().filter(l => l.startsWith('ECOERR')) };
      await ctx.close();
    }
    const diffAt = m => runs.base.trace.findIndex((t, k) => t !== runs[m].trace[k]);
    check(key, '1 eco off: the whole game (300 s @30 FPS) is identical to base; S.eco not written; tracking never attached', runs.off.on === false && diffAt('off') === -1 && runs.off.final === runs.base.final && runs.off.calls === runs.base.calls && runs.off.eco0 === runs.off.eco1 && !runs.off.errs.length,
      { diffAtSample: diffAt('off'), draws: [runs.base.calls, runs.off.calls] });
    check(key, '1 eco on (?eco=1): the whole game is identical to base (state every 0.5 s, final save, global-random draws)', runs.on.on === true && diffAt('on') === -1 && runs.on.final === runs.base.final && runs.on.calls === runs.base.calls && !runs.on.errs.length && !runs.on.ecoerr.length,
      { diffAtSample: diffAt('on'), draws: [runs.base.calls, runs.on.calls], ecoerr: runs.on.ecoerr, errs: runs.on.errs });
    const ev = runs.on.snap && runs.on.snap.ledger.events;
    check(key, '1 eco on: in-page audit every 2 s clean; no violation; nothing assumed; every kind of move seen', !runs.on.errors.length && runs.on.snap.violations.n === 0 && ev.assumed === 0 && ['catch', 'unload', 'pick', 'drop', 'entry', 'exit', 'sale'].every(k => ev[k] > 0),
      { errors: runs.on.errors, events: ev, caught: runs.on.snap.ledger.caught.map(x => Math.round(x)), sold: runs.on.snap.ledger.sold.map(x => +x.toFixed(1)) });
    check(key, '1 eco on: S.eco carries a varied composition (the saved game really holds tracked species)', runs.on.eco1 !== runs.on.eco0 && [...Object.values(JSON.parse(runs.on.eco1).mix), ...Object.values(JSON.parse(runs.on.eco1).omix)].some(a => a.filter(x => x > 0).length >= 4),
      { mix: JSON.parse(runs.on.eco1).mix, omix: JSON.parse(runs.on.eco1).omix });
  }

  // ---- 2 + 3. save, reload, rollback ------------------------------------------------------------------------------
  {
    const F = FIX('mid');
    const { ctx, p } = await newPage(b);
    await put(p, F);
    // session 1: eco on, 200 s, leave
    let v = await visit(p, ECO_ON); await p.evaluate(() => window.__eco.species.ensure());
    const st1 = await p.evaluate(() => window.__eco.save.status);
    const r1 = await step(p, { secs: 200, fps: 30, audit: true });
    const snap1 = await p.evaluate(() => window.__eco.species.snapshot());
    const S1 = await leave(p);
    check('save', '2 session 1 (fixture mid, eco on, 200 s): status fresh, audit clean, no page error', st1 === 'fresh' && !r1.errors.length && snap1.violations.n === 0 && !p.errs.length, { st1, errors: r1.errors, errs: p.errs });
    const places = [...Object.values(S1.eco.mix), ...Object.values(S1.eco.omix)], REFV = [0.55, 0.35, 0.10, 0, 0];
    check('save', '2 the save holds a valid, varied composition (shares sum to 1; a place with 4+ species; places away from the reference mix)',
      places.every(a => a.length === 5 && Math.abs(a.reduce((x, c) => x + c, 0) - 1) < 1e-9) && places.some(a => a.filter(x => x > 0).length >= 4) && places.filter(a => a.some((x, i) => Math.abs(x - REFV[i]) > 1e-3)).length >= 2 && S1.v === 1 && S1.eco.v === 1 && !JSON.stringify(S1.eco).includes('null') && !JSON.stringify(S1.eco).includes('NaN'),
      { mix: S1.eco.mix, omix: S1.eco.omix, catchStream: S1.eco.rng.catch });
    check('save', '2 the catch stream moved on in the save (it continues after a reload)', !eq(S1.eco.rng.catch, JSON.parse(JSON.stringify(FIXECO(F))).rng && FIXECO(F).rng.catch));
    // session 2: reload, same composition
    v = await visit(p, ECO_ON); await p.evaluate(() => window.__eco.species.ensure());
    const rep2 = await p.evaluate(() => window.__eco.save), snap2 = await p.evaluate(() => window.__eco.species.snapshot());
    let maxQ = 0, countDiff = 0, sumOk = true;
    for (const l of LOCS) { for (let i = 0; i < 5; i++) { maxQ = Math.max(maxQ, Math.abs(snap1.qty[l][i] - snap2.qty[l][i])); countDiff = Math.max(countDiff, Math.abs(snap1.counts[l][i] - snap2.counts[l][i])); } if (snap2.counts[l].reduce((a, c) => a + c, 0) !== S1.stock[l]) sumOk = false; }
    check('save', '2 reload: status ok, no repairs; the tracker attaches to the same composition (quantities equal, whole-number counts equal, sums = stock)', rep2.status === 'ok' && rep2.repairs.length === 0 && maxQ < 1e-6 && countDiff === 0 && sumOk, { rep2, maxQ, countDiff });
    const r2 = await step(p, { secs: 120, fps: 30, audit: true });
    const S2 = await leave(p);
    check('save', '2 continue 120 s after the reload: audit clean', !r2.errors.length && !p.errs.length, { errors: r2.errors, errs: p.errs });

    // rollback: production build, then the T1.2 eco build
    v = await visit(p, OLDPROD); const R1 = await leave(p);
    check('rollback', '3 production index.html loads and saves it: S.eco identical value for value, progress untouched', eq(R1.eco, S2.eco) && eq({ ...R1, lastSeen: 0 }, { ...S2, lastSeen: 0 }) && !p.errs.length, { ecoEqual: eq(R1.eco, S2.eco), diffKeys: Object.keys(S2).filter(k => k !== 'lastSeen' && !eq(R1[k], S2[k])) });
    v = await visit(p, OLDT12); const rep12 = await p.evaluate(() => window.__eco.save); const R2 = await leave(p);
    check('rollback', '3 T1.2 eco build (does not know omix): status ok, S.eco identical including omix, progress untouched', rep12.status === 'ok' && rep12.repairs.length === 0 && eq(R2.eco, S2.eco) && !!R2.eco.omix && !p.errs.length, { rep12, ecoEqual: eq(R2.eco, S2.eco) });
    v = await visit(p, ECO_ON); await p.evaluate(() => window.__eco.species.ensure());
    const rep3 = await p.evaluate(() => window.__eco.save), snap3 = await p.evaluate(() => window.__eco.species.snapshot());
    let maxQ3 = 0; for (const l of LOCS) for (let i = 0; i < 5; i++) maxQ3 = Math.max(maxQ3, Math.abs(snap2.qty[l][i] - snap3.qty[l][i]));
    // (snap2 was taken before the 120 s, so compare with the saved composition instead)
    let maxS3 = 0; for (const l of LOCS) { const f = ['quay', 'wh', 'mRaw'].includes(l) ? 'mix' : 'omix'; for (let i = 0; i < 5; i++) maxS3 = Math.max(maxS3, Math.abs(snap3.qty[l][i] - S2.eco[f][l][i] * S2.stock[l])); }
    const r3 = await step(p, { secs: 90, fps: 30, audit: true });
    check('rollback', '3 back in the eco build: status ok, no repairs, tracker attaches to the saved composition, audit clean', rep3.status === 'ok' && rep3.repairs.length === 0 && maxS3 < 1e-6 && !r3.errors.length && !p.errs.length, { rep3, maxS3, errors: r3.errors });
    await ctx.close();
  }

  // ---- 4. a save played by the production build in between -----------------------------------------------------------
  {
    const { ctx, p } = await newPage(b, false);                    // real time: the old build plays on its own
    await put(p, FIX('max'));
    await visit(p, ECO_ON); await p.evaluate(() => window.__eco.species.ensure());
    await ctx.close();
    const { ctx: c2, p: p2 } = await newPage(b, true);
    await put(p2, FIX('max'));
    let v = await visit(p2, ECO_ON); await p2.evaluate(() => window.__eco.species.ensure());
    await step(p2, { secs: 150, fps: 30, audit: true });
    const Sa = await leave(p2);
    c2.close();
    const { ctx: c3, p: p3 } = await newPage(b, false);            // production build, real time, 25 s
    await put(p3, Sa);
    await p3.goto(OLDPROD); await ready(p3); await p3.waitForTimeout(25000); const Sb = await leave(p3);
    const moved = LOCS.filter(l => Sb.stock[l] !== Sa.stock[l]);
    await c3.close();
    const { ctx: c4, p: p4 } = await newPage(b, true);
    await put(p4, Sb);
    v = await visit(p4, ECO_ON); await p4.evaluate(() => window.__eco.species.ensure());
    const rep = await p4.evaluate(() => window.__eco.save);
    const r = await step(p4, { secs: 120, fps: 30, audit: true });
    check('played-old', '4 production build played 25 s between two eco sessions (stock moved in ' + moved.join(',') + '): the eco build attaches, repairs only empty places, audit clean afterwards',
      moved.length > 0 && ['ok', 'repaired'].includes(rep.status) && rep.repairs.every(x => /empty place/.test(x)) && !r.errors.length && !p4.errs.length, { rep, moved, errors: r.errors, errs: p4.errs });
    await c4.close();
  }

  // ---- 5. newer S.eco schema -------------------------------------------------------------------------------------------
  {
    const F = FIX('mid'); F.eco = { v: 2, mix: 'a newer format', extra: { deep: [1, { x: 2 }] } };
    const { ctx, p } = await newPage(b);
    await put(p, F);
    const v = await visit(p, ECO_ON);
    const rep = await p.evaluate(() => window.__eco.save), on = await p.evaluate(() => window.__eco.on), setOn = await p.evaluate(() => window.__eco.setOn(true)), att = await p.evaluate(() => window.__eco.species.ensure());
    const r = await step(p, { secs: 60, fps: 30, audit: false });
    const S = await leave(p);
    check('future', '5 ?eco=1 on a newer S.eco: tracking stays off (setOn refused, never attached), S.eco byte-identical after 60 s of play and a save, one ECOERR line', rep.status === 'future' && on === false && setOn === false && !att && eq(S.eco, F.eco) && S.ecoBak === undefined && v.logs().filter(l => l.startsWith('ECOERR')).length === 1 && !p.errs.length, { rep, on, setOn, att });
    await ctx.close();
  }

  // ---- 6. T1.2-format S.eco (no omix) ------------------------------------------------------------------------------------
  {
    const F = FIX('mid');
    const { ctx, p } = await newPage(b);
    await put(p, F);
    await visit(p, ECO); const S12 = await leave(p);              // the eco build of this task creates S.eco ...
    delete S12.eco.omix;                                           // ... which we make look like a T1.2 save
    await put(p, S12);
    const v = await visit(p, ECO_ON); await p.evaluate(() => window.__eco.species.ensure());
    const rep = await p.evaluate(() => window.__eco.save);
    const r = await step(p, { secs: 120, fps: 30, audit: true });
    const S = await leave(p);
    check('upgrade', '6 T1.2-format S.eco (no omix): status repaired (omix filled), tracked, audit clean, other S.eco fields kept', rep.status === 'repaired' && rep.repairs.length > 0 && rep.repairs.every(x => /^omix/.test(x)) && !r.errors.length && !!S.eco.omix && eq(S.eco.seed, S12.eco.seed) && !p.errs.length, { rep, errors: r.errors });
    await ctx.close();
  }

  await b.close();
  const out = { test: 'species tracking in the page', pass: results.every(r => r.pass), passed: results.filter(r => r.pass).length, total: results.length, results };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ pass: out.pass, passed: out.passed, total: out.total }));
  process.exit(out.pass ? 0 : 1);
})();

// the S.eco that a fixture will get on its first load (for comparing the catch stream before and after play)
function FIXECO(F) {
  const { bundle, fresh } = require('./_load.cjs');
  const E = fresh(bundle('state-eco-fixeco', "export * from './eco/state-eco.js';"));
  const S = JSON.parse(JSON.stringify(F)); E.initEco(S); return S.eco;
}
