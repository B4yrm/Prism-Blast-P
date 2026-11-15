// node tests/eco/micro-overhead.cjs [out.json]  → prints (and writes) JSON
// Cost of the eco layer on the real Sim (Node, no drawing): 18,000 Sim.update calls = 600 s at 30 FPS, in three scenarios,
// plain (no adapter) / adapter installed, eco off / eco on with species tracking (the tracker's own audits included, the test's not).
// Interleaved, 7 rounds each, median. Also 2,000,000 wrapped stat calls (plain vs installed).
const fs = require('fs');
const { bundle, fresh } = require('./_load.cjs');
const { SCEN, buildSave, seedRandom } = require('./_scen.cjs');
const F = bundle('micro', `export { G, stat } from './core/economy.js'; export { Sim } from './sim/sim.js'; export { bus } from './core/bus.js'; export { fresh as freshSave } from './core/state.js'; export * as A from './eco/adapter.js'; export { initEco } from './eco/state-eco.js';`);
function setup(cfg, mode) {
  const m = fresh(F), S = buildSave(m.freshSave, cfg); m.G.S = S;
  if (mode !== 'plain') { m.A.install({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G }); m.initEco(S); m.A.ecoState.on = mode === 'on'; }
  return m;
}
function simRun(cfg, mode) {
  const m = setup(cfg, mode), rnd = seedRandom();
  const sim = new m.Sim(); const t = process.hrtime.bigint();
  for (let k = 0; k < 18000; k++) sim.update(1 / 30);
  const ms = Number(process.hrtime.bigint() - t) / 1e6; rnd.restore(); return ms;
}
function statRun(mode) { const m = setup(SCEN.mid, mode); let x = 0; const t = process.hrtime.bigint(); for (let k = 0; k < 1e6; k++) x += m.stat.rawPrice() + m.stat.boatSpeed(); return Number(process.hrtime.bigint() - t) / 1e6; }
const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
const out = { node: process.version, perUpdate_us: {}, simUpdate18000_ms: {}, stat2e6calls_ms: {} };
for (const key of ['start', 'mid', 'max']) {
  for (const mode of ['plain', 'off', 'on']) { simRun(SCEN[key], mode); }                // warm-up
  const r = { plain: [], off: [], on: [] };
  for (let i = 0; i < 7; i++) for (const mode of ['plain', 'off', 'on']) r[mode].push(simRun(SCEN[key], mode));
  out.simUpdate18000_ms[key] = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +med(v).toFixed(1)]));
  out.perUpdate_us[key] = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +(med(v) / 18).toFixed(2)]));
}
statRun('plain'); statRun('off');
const sr = { plain: [], off: [] }; for (let i = 0; i < 7; i++) for (const mode of ['plain', 'off']) sr[mode].push(statRun(mode));
out.stat2e6calls_ms = Object.fromEntries(Object.entries(sr).map(([k, v]) => [k, +med(v).toFixed(1)]));
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
