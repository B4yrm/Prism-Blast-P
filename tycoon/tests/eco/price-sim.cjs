// Species prices against the REAL simulation (Node, seeded, 30 FPS steps; the cash register is collected every 200 steps
// so that a full till never holds customers back, as tests/boat-timeline.cjs does).
//   P1  every upgrade level, research and boost: rawPrice with eco on = original × ONE factor (the expected mix of the
//       harbor tier); eco off, prices off or tracking off: the original, bit for bit; prodPrice and priceMul never change
//   P2  steadyRate and the offline formula of main.js: multiplied by the factor once (not twice); with a factory unchanged;
//       the offline earnings at page load are computed before eco switches on (checked in the page by save-compare-eco)
//   P3  every sale: the register grows by exactly round(Σ product prices + Σ fresh prices × factor of the shelf's species mix)
//   P4  plain / eco off / tracking only: the whole economy identical; prices on: the flows (stocks, boats, haulers, customers,
//       units sold) identical, only the money differs
//   P5  directions: sardine only < start mix ≈ 1 < tuna only (paired runs, same flows)
//   P6  save → fresh modules → load: the same factors and the same fresh-fish price
//   P7  never NaN / Infinity / ≤ 0, even with a damaged shelf composition
//   node tests/eco/price-sim.cjs [out.json]   → exit code 1 on failure
const assert = require('node:assert/strict');
const fs = require('fs');
const { bundle, fresh } = require('./_load.cjs');
const { SCEN, buildSave, seedRandom, simState } = require('./_scen.cjs');

const GAME = bundle('price-game', `
export { G, stat, steadyRate } from './core/economy.js';
export { Sim } from './sim/sim.js';
export { bus } from './core/bus.js';
export { fresh as freshSave } from './core/state.js';
export * as A from './eco/adapter.js';
export { initEco } from './eco/state-eco.js';
export { priceFactor } from './eco/price.js';
export { catchWeights } from './eco/defs-eco.js';
`);
const DT = 1 / 30, results = [];
const check = (name, fn) => {
  const t0 = Date.now();
  try { const info = fn(); results.push({ name, pass: true, ms: Date.now() - t0, ...(info ? { info } : {}) }); console.log('ok   ' + name); }
  catch (e) { results.push({ name, pass: false, ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 700) }); console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).slice(0, 700)); }
};

// mode: 'plain' (no adapter) | 'off' | 'species' (tracking only) | 'on' (tracking + prices)
function world(cfg, mode, o = {}) {
  const m = fresh(GAME), S = buildSave(m.freshSave, cfg);
  if (o.created) S.created = o.created;
  m.G.S = S;
  if (mode !== 'plain') {
    assert.equal(m.A.install({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G }).ok, true);
    m.initEco(S); m.A.ecoState.on = mode !== 'off'; m.A.ecoState.systems.price = mode === 'on';
  }
  const rnd = seedRandom(o.seed || 4242), sim = new m.Sim(), tr = m.A.ecoState.species;
  if (mode === 'species' || mode === 'on') { assert.equal(m.A.activate(sim, m.G), true); if (o.weights) tr.setWeights(o.weights); }
  return { m, S, sim, rnd, tr, mode, origRaw: m.stat.rawPrice.ecoOrig, origProd: m.stat.prodPrice.ecoOrig };
}
const flowState = sim => { const S = sim.S; return JSON.stringify([S.stock, S.stats.caught, S.stats.sold, S.stats.soldProd, S.xp, S.level,
  sim.workers.map(w => [w.state, w.m.x, w.m.y, w.t, w.carry]), sim.boats.map(b => [b.state, b.load, b.m.x, b.m.y, b.t]), sim.customers.length, sim.convey.length]); };
const revenue = (S, r0) => S.stats.earned + S.register - r0;
function play(w, secs, o = {}) {
  const flows = [], full = [], n = Math.round(secs * 30);
  for (let k = 0; k < n; k++) {
    w.sim.update(DT);
    if (k % 200 === 199) w.sim.collect(true);
    if (k % 15 === 0) { flows.push(flowState(w.sim)); if (o.full) full.push(simState(w.sim)); }
  }
  return { flows, full };
}

// ---- P1 -------------------------------------------------------------------------------------------------------
check('P1 every upgrade level, research, boost and harbor tier: rawPrice = original × one factor; prodPrice / priceMul unchanged; off = original', () => {
  const w = world(SCEN.start, 'on'), { m, S } = w, st = m.stat;
  assert.equal(st.priceMul.ecoOrig, undefined, 'priceMul must not be wrapped');
  let n = 0;
  const real = Date.now;
  try {
    for (const tier of [1, 2, 3]) for (const price of [0, 1, 5, 10, 20, 30]) for (const cold of [0, 3, 15, 30]) for (const brand of [0, 1, 3]) for (const boost of [false, true]) {
      S.tier.harbor = tier; S.up.market.price = price; S.up.warehouse.cold = cold; S.up.factory.qual = cold; S.research.lv.brand = brand; S.boostUntil = boost ? real() + 1e9 : 0;
      const f = m.priceFactor(m.catchWeights(tier)), orig = w.origRaw();
      m.A.ecoState.on = true; m.A.ecoState.systems.price = true;
      assert.equal(st.rawPrice(), orig * f, `tier ${tier} price ${price} cold ${cold} brand ${brand} boost ${boost}`);
      assert.equal(st.prodPrice(), w.origProd(), 'prodPrice changed');
      m.A.ecoState.systems.price = false; assert.equal(st.rawPrice(), orig, 'prices off');
      m.A.ecoState.systems.price = true; m.A.ecoState.systems.species = false; assert.equal(st.rawPrice(), orig, 'tracking off'); m.A.ecoState.systems.species = true;
      if (!m.A.ecoState.species.attached) m.A.activate(w.sim, m.G);
      m.A.ecoState.on = false; assert.equal(st.rawPrice(), orig, 'eco off');
      n++;
    }
    // boost doubles the price with eco on too
    m.A.ecoState.on = true; S.boostUntil = 0; const a = st.rawPrice(); S.boostUntil = real() + 1e9; assert.equal(st.rawPrice(), 2 * a);
  } finally { w.rnd.restore(); }
  return { states: n, factorsByTier: [1, 2, 3].map(t => +m.priceFactor(m.catchWeights(t)).toFixed(4)) };
});

// ---- P2 -------------------------------------------------------------------------------------------------------
check('P2 steadyRate and the offline formula: one factor without a factory, unchanged with a factory', () => {
  const out = {};
  for (const [key, cfg] of [['start (no factory, tier 1)', SCEN.start], ['no factory, tier 3', { ...SCEN.nohaul, workers: 6 }], ['mid (factory)', SCEN.mid]]) {
    const w = world(cfg, 'on'), { m } = w;
    m.A.ecoState.on = false; const s0 = m.steadyRate();
    m.A.ecoState.on = true; const s1 = m.steadyRate(), f = m.A.rawPriceFactor();
    const secs = 3600, off0 = Math.floor(s0 * secs * 0.5), off1 = Math.floor(s1 * secs * 0.5);
    if (cfg.tier.factory) { assert.equal(s1, s0, key + ': steadyRate changed although it uses the product price'); }
    else {
      assert.ok(Math.abs(s1 - s0 * f) <= 1e-12 * s0, `${key}: steadyRate ${s1} vs ${s0} × ${f}`);
      assert.ok(Math.abs(off1 - Math.floor(s0 * f * secs * 0.5)) <= 1, `${key}: offline ${off1}`);
      if (f !== 1) assert.ok(Math.abs(off1 - Math.floor(s0 * f * f * secs * 0.5)) > 1, key + ': looks like the factor was applied twice');
    }
    out[key] = { steadyOff: +s0.toFixed(4), steadyOn: +s1.toFixed(4), factor: +f.toFixed(4), offlineHourOff: off0, offlineHourOn: off1 };
    w.rnd.restore();
  }
  return out;
});

// ---- P3 -------------------------------------------------------------------------------------------------------
function exactSales(cfg, secs, o = {}) {
  const w = world(cfg, 'on', o), { m, tr } = w, proto = m.Sim.prototype, serve = proto.serve;
  let sales = 0, rawUnits = 0, prodUnits = 0, wrong = [], notInSale = 0;
  proto.serve = function (c) {
    const S = this.S, st = S.stock, r0 = S.register, p0 = st.mProd, q0 = st.mRaw;
    const sh = Float64Array.from(tr.qty.mRaw), t = sh.reduce((a, b) => a + b, 0);
    const f = t > 0 ? m.priceFactor(sh) : m.priceFactor(tr.weights()), pp = w.origProd(), rp = w.origRaw();
    if (!m.A.ecoState.inSale) notInSale++;
    const r = serve.call(this, c);
    const dP = p0 - st.mProd, dR = q0 - st.mRaw;
    if (dP + dR > 0) {
      let a = 0; for (let i = 0; i < dP; i++) a += pp; for (let i = 0; i < dR; i++) a += rp * f;
      const want = Math.round(a), got = S.register - r0;
      if (got !== want && wrong.length < 5) wrong.push({ got, want, dP, dR, f });
      sales++; rawUnits += dR; prodUnits += dP;
    }
    return r;
  };
  play(w, secs); w.rnd.restore();
  assert.equal(notInSale, 0, 'a sale happened outside the sale context');
  assert.deepEqual(wrong, [], 'sale amounts differ');
  assert.equal(w.tr.nViolations, 0);
  return { sales, rawUnits, prodUnits };
}
check('P3 every sale: register += round(products × price + fresh fish × price × shelf factor), start (raw only), 600 s', () => exactSales(SCEN.start, 600));
check('P3 every sale, mid (factory: products and fresh fish), 600 s', () => exactSales(SCEN.mid, 600));
check('P3 every sale, tuna only (factor at its limit), 300 s', () => exactSales(SCEN.start, 300, { weights: [0, 0, 0, 0, 1] }));

// ---- P4 -------------------------------------------------------------------------------------------------------
for (const key of ['start', 'mid', 'max']) {
  check(`P4 ${key}: plain = eco off = tracking only (whole economy); prices on: same flows, only money differs`, () => {
    const runs = {};
    for (const mode of ['plain', 'off', 'species', 'on']) {
      const w = world(SCEN[key], mode), r0 = w.S.stats.earned + w.S.register, d0 = 0;
      const r = play(w, 600, { full: true });
      runs[mode] = { ...r, rev: revenue(w.S, r0), draws: w.rnd.calls, sold: w.S.stats.sold, soldProd: w.S.stats.soldProd };
      w.rnd.restore();
    }
    for (const mode of ['off', 'species']) {
      const i = runs.plain.full.findIndex((t, k) => t !== runs[mode].full[k]);
      assert.equal(i, -1, `${mode}: economy differs at ${i * 0.5} s`); assert.equal(runs[mode].draws, runs.plain.draws);
    }
    const j = runs.plain.flows.findIndex((t, k) => t !== runs.on.flows[k]);
    assert.equal(j, -1, `prices on: the flows differ at ${j * 0.5} s`);
    assert.equal(runs.on.draws, runs.plain.draws, 'prices on: global-random draws differ');
    return { revenuePlain: Math.round(runs.plain.rev), revenueOn: Math.round(runs.on.rev), ratio: +(runs.on.rev / runs.plain.rev).toFixed(4), unitsSold: runs.plain.sold, ofWhichProducts: runs.plain.soldProd };
  });
}

// ---- P5 -------------------------------------------------------------------------------------------------------
check('P5 directions (paired, 600 s): sardine only < start mix ≈ 1 < tuna only', () => {
  const ratio = weights => {
    // one world at a time: each world seeds the global random generator when it is made and restores it after its run
    const p = world(SCEN.start, 'plain'), a0 = p.S.stats.earned + p.S.register; play(p, 600); p.rnd.restore();
    const q = world(SCEN.start, 'on', { weights }), b0 = q.S.stats.earned + q.S.register; play(q, 600); q.rnd.restore();
    return revenue(q.S, b0) / revenue(p.S, a0);
  };
  const sard = ratio([1, 0, 0, 0, 0]), mix = ratio(null), tuna = ratio([0, 0, 0, 0, 1]);
  // not bounded below by ×0.764: the simulation rounds every sale to whole money (Math.round in Sim.serve), and at the start
  // a fresh fish costs 4, so one sardine sells for round(4 × 0.764) = 3, i.e. ×0.75 (P3 checks every sale amount exactly)
  assert.ok(sard < 0.95 && sard >= 0.70, 'sardine only ' + sard);
  assert.ok(Math.abs(mix - 1) < 0.10, 'start mix ' + mix);
  assert.ok(tuna > 1.5 && tuna <= 2.5 + 1e-9, 'tuna only ' + tuna);
  return { sardineOnly: +sard.toFixed(4), startMix: +mix.toFixed(4), tunaOnly: +tuna.toFixed(4), note: 'the initial stock is the start mix, so the pure-species runs move towards ×0.764 / ×2.5 over time; every sale is rounded to whole money by the simulation, which at a price of 4 turns ×0.764 into ×0.75 for one-fish sales' };
});

// ---- P6 -------------------------------------------------------------------------------------------------------
check('P6 save → fresh modules → load: same expected factor, same shelf factor, same fresh-fish price', () => {
  const w = world(SCEN.high, 'on');
  play(w, 300); w.rnd.restore();
  const { m, tr } = w;
  const exp1 = m.A.rawPriceFactor(), shelf1 = m.priceFactor(tr.qty.mRaw);
  m.A.ecoState.inSale = true; const sale1 = m.stat.rawPrice(); m.A.ecoState.inSale = false;
  const saved = JSON.stringify(w.S);
  const m2 = fresh(GAME), S2 = JSON.parse(saved); m2.G.S = S2;
  assert.equal(m2.A.install({ stat: m2.stat, Sim: m2.Sim, bus: m2.bus, G: m2.G }).ok, true);
  const rep = m2.initEco(S2); assert.equal(rep.status, 'ok'); m2.A.ecoState.on = true;
  const rnd = seedRandom(9), sim2 = new m2.Sim(); assert.equal(m2.A.activate(sim2, m2.G), true); rnd.restore();
  const exp2 = m2.A.rawPriceFactor(), shelf2 = m2.priceFactor(m2.A.ecoState.species.qty.mRaw);
  m2.A.ecoState.inSale = true; const sale2 = m2.stat.rawPrice(); m2.A.ecoState.inSale = false;
  assert.equal(exp2, exp1); assert.ok(Math.abs(shelf2 - shelf1) < 1e-12, `${shelf1} vs ${shelf2}`); assert.ok(Math.abs(sale2 - sale1) < 1e-9 * sale1, `${sale1} vs ${sale2}`);
  return { expected: +exp1.toFixed(6), shelfBefore: shelf1, shelfAfter: shelf2, priceBefore: sale1, priceAfter: sale2 };
});

// ---- P7 -------------------------------------------------------------------------------------------------------
check('P7 never NaN / Infinity / ≤ 0: every fresh-fish price in 4 runs, and with a damaged shelf composition', () => {
  let calls = 0, bad = 0;
  for (const [cfg, weights] of [[SCEN.start, null], [SCEN.max, null], [SCEN.start, [0, 0, 0, 0, 1]], [SCEN.mid, [1, 0, 0, 0, 0]]]) {
    const w = world(cfg, 'on', { weights }), inner = w.m.stat.rawPrice;
    w.m.stat.rawPrice = function () { const v = inner.apply(this, arguments); calls++; if (!(Number.isFinite(v) && v > 0)) bad++; return v; };
    play(w, 300); w.rnd.restore();
  }
  assert.equal(bad, 0); assert.ok(calls > 100, 'only ' + calls + ' prices seen');
  const w = world(SCEN.start, 'on'); play(w, 30); w.rnd.restore();
  w.tr.qty.mRaw[0] = NaN; w.m.A.ecoState.inSale = true;
  const v = w.m.stat.rawPrice(); w.m.A.ecoState.inSale = false;
  assert.ok(Number.isFinite(v) && v > 0 && v === w.origRaw() * 1, 'damaged shelf: ' + v);
  return { pricesChecked: calls };
});

const pass = results.every(r => r.pass);
const out = { test: 'species prices against the real simulation', pass, passed: results.filter(r => r.pass).length, total: results.length, results };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify({ pass, passed: out.passed, total: out.total }));
process.exit(pass ? 0 : 1);
