// Eco adapter contract and safety (Node, real game modules bundled by esbuild):
//   1. contract: every stat function, Sim method and bus function the adapter relies on exists,
//      and a live Sim has the fields later eco tasks will read
//   2. install runs once: a second call, and a second copy of the adapter module, change nothing;
//      wrappers are one level deep
//   3. no crash while G.S does not exist yet (install, tick, wrappers behave like the originals)
//   4. eco off: every wrapped stat returns exactly the original value (also with a modifier registered)
//   5. the whole simulation, 600 s at 30 FPS with a seeded random, is identical without the adapter,
//      with the adapter off and with the adapter on (T1.1: on only runs the clock)
//   node tests/eco/adapter-contract.cjs [out.json]   → exit code 1 on failure
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { bundle, fresh } = require('./_load.cjs');

const GAME = bundle('adapter-game', `
export { G, stat, steadyRate } from './core/economy.js';
export { Sim } from './sim/sim.js';
export { bus } from './core/bus.js';
export { fresh as freshSave } from './core/state.js';
export * as A from './eco/adapter.js';
`);
const ADAPTER_ONLY = bundle('adapter-only', "export * from './eco/adapter.js';");

const results = [];
function check(name, fn) {
  try { const info = fn(); results.push({ name, pass: true, ...(info ? { info } : {}) }); }
  catch (e) { results.push({ name, pass: false, error: String(e && e.message || e).slice(0, 400) }); }
}
const deps = m => ({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G });

function midSave(m) {
  const S = m.freshSave();
  Object.assign(S, { money: 500, boats: 4, workers: 6, level: 12 });
  S.tier = { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 };
  S.up.harbor = { cap: 6, speed: 10, net: 8 }; S.up.market.price = 3; S.up.warehouse.cold = 2; S.research.lv = { nets: 1, brand: 1 };
  S.stats.caught = 5; S.stats.sold = 5;
  return S;
}

check('contract: stat / Sim.prototype / bus', () => {
  const m = fresh(GAME), missing = m.A.checkContract(deps(m));
  assert.deepEqual(missing, []);
  return { stat: m.A.CONTRACT.stat.length, simProto: m.A.CONTRACT.simProto.length };
});

check('contract: fields of a live Sim and of the save', () => {
  const m = fresh(GAME); m.G.S = midSave(m);
  const sim = new m.Sim(); sim.update(0.05);
  const b = sim.boats[0], w = sim.workers[0];
  for (const k of ['i', 'm', 'berth', 'state', 't', 'load']) assert.ok(k in b, 'boat.' + k);
  for (const k of ['i', 'm', 'state', 't', 'job', 'carry', 'kind']) assert.ok(k in w, 'worker.' + k);
  assert.ok(['dock', 'out', 'fish', 'back'].includes(b.state), 'boat state ' + b.state);
  for (const k of ['quay', 'wh', 'facOut', 'mRaw', 'mProd']) { assert.ok(k in sim.res, 'res.' + k); assert.ok(k in m.G.S.stock, 'stock.' + k); }
  for (const k of ['wh', 'mRaw', 'mProd']) assert.ok(k in sim.inc, 'inc.' + k);
  assert.ok(Array.isArray(sim.convey) && Array.isArray(sim.queue) && Array.isArray(sim.customers));
  // the fields the species observers read: a hauler's job names its source and destination, a boat has a cap
  let seenJob = false, seenCap = false;
  for (let k = 0; k < 3000 && !(seenJob && seenCap); k++) { sim.update(0.05); for (const w2 of sim.workers) if (w2.job) { assert.ok(['quay', 'wh', 'facOut'].includes(w2.job.src) && ['wh', 'mRaw', 'mProd'].includes(w2.job.dst), JSON.stringify(w2.job)); seenJob = true; } for (const b2 of sim.boats) if (b2.state === 'back') { assert.ok(Number.isInteger(b2.cap) && b2.load === b2.cap); seenCap = true; } }
  assert.ok(seenJob && seenCap, 'no hauler job / returning boat seen');
  assert.equal(sim.boats.length, 4); assert.equal(sim.workers.length, 6);
});

check('install runs once; wrappers one level deep; second module copy refused', () => {
  const m = fresh(GAME); m.G.S = midSave(m);
  const r1 = m.A.install(deps(m)), w1 = m.stat.rawPrice, u1 = m.Sim.prototype.update;
  const obs1 = m.A.OBSERVED.map(n => m.Sim.prototype[n]);
  const r2 = m.A.install(deps(m));
  assert.equal(r1.ok, true); assert.equal(r2.ok, false); assert.match(r2.reason, /already/);
  assert.equal(m.stat.rawPrice, w1); assert.equal(m.Sim.prototype.update, u1);
  for (const k of m.A.WRAPPED_STATS) { assert.equal(typeof m.stat[k].ecoOrig, 'function', k); assert.equal(m.stat[k].ecoOrig.ecoOrig, undefined, k + ' depth'); }
  assert.equal(m.Sim.prototype.update.ecoOrig.ecoOrig, undefined);
  m.A.OBSERVED.forEach((n, i) => { assert.equal(m.Sim.prototype[n], obs1[i], n + ' replaced by a second install'); assert.equal(typeof m.Sim.prototype[n].ecoOrig, 'function', n); assert.equal(m.Sim.prototype[n].ecoOrig.ecoOrig, undefined, n + ' depth'); });
  assert.deepEqual(m.A.OBSERVED, ['updBoat', 'updWorker', 'updFactory', 'updCustomers']);
  const other = fresh(ADAPTER_ONLY);                 // a second copy of the adapter module, its own state
  const r3 = other.install(deps(m));
  assert.equal(r3.ok, false); assert.equal(m.stat.rawPrice, w1); assert.equal(m.Sim.prototype.update, u1);
  assert.equal(m.A.ecoState.attempts, 2); assert.equal(other.ecoState.installed, false);
  return { first: r1, second: r2, secondCopy: r3 };
});

check('no crash before the save exists (G.S === null)', () => {
  const m = fresh(GAME); assert.equal(m.G.S, null);
  const unwrapped = {};
  for (const k of m.A.WRAPPED_STATS) unwrapped[k] = m.stat[k];
  const r = m.A.install(deps(m));
  assert.equal(r.ok, true); assert.equal(m.A.ecoState.installedBeforeLoad, true);
  m.A.tick({}, 0.05, m.G);                            // off
  m.A.ecoState.on = true; m.A.tick({}, 0.05, m.G); m.A.ecoState.on = false;   // on, still no save
  assert.equal(m.A.ecoState.clock.hours, 0); assert.equal(m.A.ecoState.clock.acc, 0);
  // the originals need the save; the wrappers fail in exactly the same way (no new error of their own)
  for (const k of m.A.WRAPPED_STATS) {
    let e1 = null, e2 = null;
    try { unwrapped[k](); } catch (e) { e1 = e.constructor.name + ': ' + e.message; }
    try { m.stat[k](); } catch (e) { e2 = e.constructor.name + ': ' + e.message; }
    assert.equal(e2, e1, k);
  }
});

check('eco off: wrapped stat values are exactly the originals (many states, modifier registered)', () => {
  const m = fresh(GAME); m.A.install(deps(m));
  let seed = 11; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
  m.A.ecoState.mods.rawPrice = v => v * 2;          // registered but eco is off: must not apply
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const S = midSave(m);
    for (const b of Object.keys(S.up)) for (const t of Object.keys(S.up[b])) S.up[b][t] = rnd(31);
    for (const b of Object.keys(S.tier)) S.tier[b] = b === 'farm' ? 0 : rnd(3) + 1;
    S.research.lv = { nav: rnd(4), nets: rnd(4), ergo: rnd(4), brand: rnd(4), mkt: rnd(4) };
    S.boostUntil = i % 2 ? Date.now() + 1e6 : 0;
    m.G.S = S;
    for (const k of m.A.WRAPPED_STATS) { assert.ok(Object.is(m.stat[k](), m.stat[k].ecoOrig()), k); n++; }
  }
  m.A.ecoState.on = true;                            // the gate works: with eco on the modifier applies
  assert.equal(m.stat.rawPrice(), 2 * m.stat.rawPrice.ecoOrig());
  m.A.ecoState.on = false; m.A.ecoState.mods = {};
  return { comparisons: n };
});

function runSim(mode) {
  const m = fresh(GAME); m.G.S = midSave(m);
  if (mode !== 'plain') { assert.equal(m.A.install(deps(m)).ok, true); m.A.ecoState.on = mode === 'on'; }
  const real = Math.random;
  let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  try {
    const sim = new m.Sim(), S = m.G.S, dt = 1 / 30, trace = [];
    for (let k = 0; k < 600 * 30; k++) {
      sim.update(dt);
      if (k % 15 === 0) trace.push(JSON.stringify([S.money, S.register, S.stock, S.stats, S.xp, S.level,
        sim.workers.map(w => [w.state, w.m.x, w.m.y, w.t, w.carry]), sim.boats.map(b => [b.state, b.load, b.m.x, b.m.y, b.t]), sim.customers.length, sim.convey.length]));
    }
    return { trace, steady: m.steadyRate(), clock: { ...m.A.ecoState.clock }, money: S.money, caught: S.stats.caught, sold: S.stats.sold };
  } finally { Math.random = real; }
}

check('simulation 600 s @30 FPS identical: no adapter / adapter off / adapter on (clock only)', () => {
  const a = runSim('plain'), b = runSim('off'), c = runSim('on');
  for (const [name, r] of [['off', b], ['on', c]]) {
    const i = a.trace.findIndex((t, k) => t !== r.trace[k]);
    assert.equal(i, -1, `${name}: first difference at ${i * 0.5} s`);
    assert.equal(r.steady, a.steady, name + ' steadyRate');
  }
  assert.equal(b.clock.hours, 0);                     // off: the clock does not run
  assert.equal(c.clock.hours, 10);                    // on: 600 s = 10 game hours
  assert.ok(a.caught > 0 && a.sold > 0, 'the simulation really ran');
  return { samples: a.trace.length, money: Math.floor(a.money), caught: a.caught, sold: a.sold, clockOn: c.clock.hours };
});

const pass = results.every(r => r.pass);
const out = { test: 'eco adapter contract', pass, results };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
process.exit(pass ? 0 : 1);
