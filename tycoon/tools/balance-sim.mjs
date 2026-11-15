// Balance simulation for the eco species prices (T1.4).
//
// Runs the REAL simulation (src/sim, src/core, bundled with esbuild; no drawing) from the same start state with the same
// seeds, once with the original economy and once with eco on (species tracking + species prices), and compares the money
// earned. The cash register is collected every 200 steps (6.7 s), as tests/boat-timeline.cjs does, so a full till never
// holds customers back: then the two runs sell exactly the same units at the same moments (checked), and the only
// difference is the price, i.e. a paired comparison with no noise from the simulation.
//
// Acceptance (exit code 1 if any fails):
//   • start (harbor tier 1, reference catch mix), 600 s, 8 seeds: every seed and the mean within ±10 % of the original
//   • eco off: the whole economy identical to the original (state every 0.5 s, the final save, global-random draws)
//   • prices on: the flows identical to the original (units sold, stocks, boats, haulers, customers)
//   • no fresh-fish price is NaN, Infinity, zero or negative
//
//   node tools/balance-sim.mjs [outDir]      → <outDir>/balance-sim.json and balance-sim.md (default test-results/eco/t1.4)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { bundle, fresh, root } = require('../tests/eco/_load.cjs');
const { SCEN, buildSave, seedRandom, simState } = require('../tests/eco/_scen.cjs');

const OUT = path.resolve(process.argv[2] || path.join(root, 'test-results/eco/t1.4'));
const GAME = bundle('balance-game', `
export { G, stat, steadyRate } from './core/economy.js';
export { Sim } from './sim/sim.js';
export { bus } from './core/bus.js';
export { fresh as freshSave } from './core/state.js';
export * as A from './eco/adapter.js';
export { initEco, SPECIES } from './eco/state-eco.js';
export { priceFactor, speciesFactors, PRICE_NORM, BASE_PRICE, FACTOR_MIN, FACTOR_MAX } from './eco/price.js';
export { catchWeights, CATCH_WEIGHTS } from './eco/defs-eco.js';
`);
const DT = 1 / 30;

const flowState = sim => { const S = sim.S; return JSON.stringify([S.stock, S.stats.caught, S.stats.sold, S.stats.soldProd, S.xp,
  sim.workers.map(w => [w.state, w.m.x, w.m.y, w.t, w.carry]), sim.boats.map(b => [b.state, b.load, b.m.x, b.m.y, b.t]), sim.customers.length, sim.convey.length]); };

// One run. mode: 'plain' | 'off' | 'on'. Worlds are made and played one at a time (each seeds the global random generator).
function run(cfg, mode, seed, secs, weights) {
  const m = fresh(GAME), S = buildSave(m.freshSave, cfg);
  S.created = 1700000000000 + seed * 7919;                 // a different eco catch stream per seed
  m.G.S = S;
  if (mode !== 'plain') { m.A.install({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G }); m.initEco(S); m.A.ecoState.on = mode === 'on'; }
  const rnd = seedRandom(1000 + seed), sim = new m.Sim(), tr = m.A.ecoState.species;
  if (mode === 'on') { m.A.activate(sim, m.G); if (weights) tr.setWeights(weights); }
  const origRaw = mode === 'plain' ? m.stat.rawPrice : m.stat.rawPrice.ecoOrig;
  // fresh-fish part of every sale (before the simulation rounds the sale to whole money)
  let rawNominal = 0, rawPriced = 0, badPrices = 0, prices = 0;
  const serve = m.Sim.prototype.serve;
  m.Sim.prototype.serve = function (c) {
    const st = this.S.stock, q0 = st.mRaw, f = mode === 'on' ? m.A.rawPriceFactor.call(null) : 1;
    const shelf = mode === 'on' && tr.attached ? tr.qty.mRaw.reduce((a, b) => a + b, 0) : 0;
    const fs = mode === 'on' ? (shelf > 0 ? m.priceFactor(tr.qty.mRaw) : m.priceFactor(tr.weights())) : 1;
    const r = serve.call(this, c), d = q0 - st.mRaw;
    if (d > 0) { const p = origRaw(); rawNominal += d * p; rawPriced += d * p * fs; }
    return r;
  };
  const inner = m.stat.rawPrice;
  m.stat.rawPrice = function () { const v = inner.apply(this, arguments); prices++; if (!(Number.isFinite(v) && v > 0)) badPrices++; return v; };
  const r0 = S.stats.earned + S.register, flows = [], full = [], n = Math.round(secs * 30);
  for (let k = 0; k < n; k++) {
    sim.update(DT);
    if (k % 200 === 199) sim.collect(true);
    if (k % 15 === 0) { flows.push(flowState(sim)); full.push(simState(sim)); }
  }
  rnd.restore();
  return { revenue: S.stats.earned + S.register - r0, sold: S.stats.sold - 5, soldProd: S.stats.soldProd, rawNominal, rawPriced, badPrices, prices, flows, full, draws: rnd.calls,
    sold_by_species: mode === 'on' ? Array.from(tr.ledger.sold).map(x => +x.toFixed(1)) : null, violations: mode === 'on' ? tr.nViolations : 0,
    expected: mode === 'on' ? m.priceFactor(tr.weights()) : 1 };
}

const scenarios = [
  { id: 'start-600', name: 'start, reference mix (harbor tier 1, no factory)', cfg: SCEN.start, secs: 600, seeds: 8, accept: true },
  { id: 'start-1800', name: 'start, reference mix, long run', cfg: SCEN.start, secs: 1800, seeds: 4 },
  { id: 'sardine-600', name: 'start, sardine only', cfg: SCEN.start, secs: 600, seeds: 4, weights: [1, 0, 0, 0, 0] },
  { id: 'tuna-600', name: 'start, tuna only', cfg: SCEN.start, secs: 600, seeds: 4, weights: [0, 0, 0, 0, 1] },
  { id: 'mid-1800', name: 'mid: harbor tier 3 mix, factory, long run', cfg: SCEN.mid, secs: 1800, seeds: 4 },
  { id: 'high-600', name: 'high: harbor tier 3 mix, 10 haulers, factory tier 3', cfg: SCEN.high, secs: 600, seeds: 4 },
  { id: 'notier3-600', name: 'harbor tier 3 mix, no factory (all fish sold fresh)', cfg: { ...SCEN.nohaul, workers: 6 }, secs: 600, seeds: 4 },
];

const report = { tool: 'tools/balance-sim.mjs', date: new Date().toISOString().slice(0, 10), node: process.version, scenarios: [], acceptance: {} };
const m0 = fresh(GAME);
report.prices = { base: m0.BASE_PRICE, norm: m0.PRICE_NORM, limits: [m0.FACTOR_MIN, m0.FACTOR_MAX], perSpecies: m0.speciesFactors().map((x, i) => ({ species: m0.SPECIES[i], raw: +x.raw.toFixed(4), factor: +x.factor.toFixed(4) })),
  expectedByTier: [1, 2, 3].map(t => ({ tier: t, weights: m0.CATCH_WEIGHTS[t], factor: +m0.priceFactor(m0.CATCH_WEIGHTS[t]).toFixed(4) })) };
let okAll = true;
const fail = msg => { okAll = false; (report.acceptance.failures ||= []).push(msg); };

for (const sc of scenarios) {
  const rows = [];
  for (let seed = 0; seed < sc.seeds; seed++) {
    const p = run(sc.cfg, 'plain', seed, sc.secs);
    const on = run(sc.cfg, 'on', seed, sc.secs, sc.weights);
    const row = { seed, revenuePlain: Math.round(p.revenue), revenueEco: Math.round(on.revenue), ratio: on.revenue / p.revenue, unitsSold: p.sold, products: p.soldProd,
      freshShare: p.rawNominal / Math.max(1, p.revenue), realisedFreshFactor: on.rawNominal ? on.rawPriced / on.rawNominal : 1, expectedFactor: on.expected, soldBySpecies: on.sold_by_species };
    const fd = p.flows.findIndex((t, k) => t !== on.flows[k]);
    row.flowsIdentical = fd === -1 && p.draws === on.draws;
    if (!row.flowsIdentical) fail(`${sc.id} seed ${seed}: prices on changed the flows at ${fd * 0.5} s`);
    if (p.badPrices || on.badPrices) fail(`${sc.id} seed ${seed}: ${p.badPrices + on.badPrices} bad prices`);
    if (on.violations) fail(`${sc.id} seed ${seed}: ${on.violations} tracker violations`);
    if (sc.accept) {
      const off = run(sc.cfg, 'off', seed, sc.secs);
      const i = p.full.findIndex((t, k) => t !== off.full[k]);
      row.ecoOffIdentical = i === -1 && off.draws === p.draws && off.revenue === p.revenue;
      if (!row.ecoOffIdentical) fail(`${sc.id} seed ${seed}: eco off differs from the original at ${i * 0.5} s`);
      if (Math.abs(row.ratio - 1) > 0.10) fail(`${sc.id} seed ${seed}: revenue ratio ${row.ratio.toFixed(4)} outside ±10 %`);
    }
    rows.push(row);
  }
  const mean = rows.reduce((a, r) => a + r.ratio, 0) / rows.length;
  const s = { id: sc.id, name: sc.name, seconds: sc.secs, seeds: sc.seeds, weights: sc.weights || 'by harbor tier', meanRatio: mean, minRatio: Math.min(...rows.map(r => r.ratio)), maxRatio: Math.max(...rows.map(r => r.ratio)),
    meanRealisedFreshFactor: rows.reduce((a, r) => a + r.realisedFreshFactor, 0) / rows.length, meanFreshShare: rows.reduce((a, r) => a + r.freshShare, 0) / rows.length, rows };
  if (sc.accept && Math.abs(mean - 1) > 0.10) fail(`${sc.id}: mean ratio ${mean.toFixed(4)} outside ±10 %`);
  report.scenarios.push(s);
  console.log(`${sc.id.padEnd(12)} mean ×${mean.toFixed(4)}  [${s.minRatio.toFixed(4)} … ${s.maxRatio.toFixed(4)}]  fresh ${(100 * s.meanFreshShare).toFixed(0)} %  realised fresh-fish factor ×${s.meanRealisedFreshFactor.toFixed(4)}  flows identical: ${rows.every(r => r.flowsIdentical)}${sc.accept ? '  eco off identical: ' + rows.every(r => r.ecoOffIdentical) : ''}`);
}
report.acceptance.pass = okAll;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'balance-sim.json'), JSON.stringify(report, null, 1));
const pct = x => (x >= 1 ? '+' : '') + ((x - 1) * 100).toFixed(1) + ' %';
let md = `# Balance simulation: species prices (T1.4)\n\nGenerated by \`tools/balance-sim.mjs\` (${report.date}, Node ${report.node}). Real simulation, no drawing, paired runs: same start, same seeds; the register is collected every 200 steps so both runs sell the same units at the same moments (checked: "flows identical"). Ratio = money earned with eco prices ÷ money earned with the original economy.\n\n`;
md += `**Acceptance: ${okAll ? 'PASS' : 'FAIL'}** (start mix within ±10 % for every seed and the mean; eco off identical; flows identical; no bad price).${okAll ? '' : '\n\n' + report.acceptance.failures.map(f => '- ' + f).join('\n')}\n\n`;
md += `## Price factors\n\nfactor(mix) = clamp(value(mix) / value(start mix), ${m0.FACTOR_MIN}, ${m0.FACTOR_MAX}), value(mix) = Σ share × base, value(start mix) = 0.55·0.6 + 0.35·0.9 + 0.10·1.4 = ${m0.PRICE_NORM}.\n\n| species | base | alone, before the limit | alone, applied |\n|---|---|---|---|\n`;
for (const x of report.prices.perSpecies) md += `| ${x.species} | ${m0.BASE_PRICE[report.prices.perSpecies.indexOf(x)]} | ×${x.raw} | ×${x.factor} |\n`;
md += `\nExpected factor of the catch mix by harbor tier (used outside a sale: steadyRate, shop, UI): ${report.prices.expectedByTier.map(t => `tier ${t.tier} ×${t.factor}`).join(', ')}.\n\n## Results\n\n| scenario | seconds × seeds | mean | min … max | fresh fish in the original revenue | realised fresh-fish factor (before rounding) | flows identical |\n|---|---|---|---|---|---|---|\n`;
for (const s of report.scenarios) md += `| ${s.name} | ${s.seconds} × ${s.seeds} | ×${s.meanRatio.toFixed(4)} (${pct(s.meanRatio)}) | ×${s.minRatio.toFixed(4)} … ×${s.maxRatio.toFixed(4)} | ${(100 * s.meanFreshShare).toFixed(0)} % | ${s.meanFreshShare > 0 ? '×' + s.meanRealisedFreshFactor.toFixed(4) : 'no fresh fish sold'} | ${s.rows.every(r => r.flowsIdentical) ? 'yes' : 'NO'} |\n`;
md += `\n### Start mix, 600 s, per seed\n\n| seed | revenue original | revenue eco | ratio | eco off identical |\n|---|---|---|---|---|\n`;
for (const r of report.scenarios[0].rows) md += `| ${r.seed} | ${r.revenuePlain} | ${r.revenueEco} | ×${r.ratio.toFixed(4)} | ${r.ecoOffIdentical ? 'yes' : 'NO'} |\n`;
md += `\nNotes\n- The realised factor of a run differs from the expected one because the catches are random draws (multinomial) from the weights, and the shelf holds what happened to arrive.\n- The game rounds every sale to whole money (Sim.serve). At the start a fresh fish costs 4, so for example one sardine sells for round(4 × 0.764) = 3 (×0.75). The revenue ratio therefore differs from the realised factor by this rounding; the gap shrinks when prices are higher (upgrades).\n- Products from the factory keep their original price in T1.4 (species do not change product prices), so scenarios with a factory move less.\n- Harbor tiers 2 and 3 use the placeholder catch weights of T1.3; their higher factors are an economic effect of eco (more valuable species), not part of the start-mix acceptance.\n`;
fs.writeFileSync(path.join(OUT, 'balance-sim.md'), md);
console.log(JSON.stringify({ pass: okAll, failures: report.acceptance.failures || [] }));
process.exit(okAll ? 0 : 1);
