// node tests/eco/micro-overhead.cjs  → prints JSON (used for test-results/eco/t1.1/micro-overhead.json)
// Cost of the eco wrappers: Sim.update (18,000 steps = 600 s at 30 FPS, mid save) and 1e6 stat calls,
// plain vs adapter installed (off), interleaved, 7 rounds each; reports the median.
const { bundle, fresh } = require('./_load.cjs');
const F = bundle('micro', `export { G, stat } from './core/economy.js'; export { Sim } from './sim/sim.js'; export { bus } from './core/bus.js'; export { fresh as freshSave } from './core/state.js'; export * as A from './eco/adapter.js';`);
function setup(install) {
  const m = fresh(F); const S = m.freshSave();
  Object.assign(S, { money: 500, boats: 4, workers: 6, level: 12 }); S.tier = { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }; S.up.harbor = { cap: 6, speed: 10, net: 8 };
  m.G.S = S; if (install) m.A.install({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G }); return m;
}
const real = Math.random;
function simRun(install) { const m = setup(install); let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const sim = new m.Sim(); const t = process.hrtime.bigint(); for (let k = 0; k < 18000; k++) sim.update(1 / 30); const ms = Number(process.hrtime.bigint() - t) / 1e6; Math.random = real; return ms; }
function statRun(install) { const m = setup(install); let x = 0; const t = process.hrtime.bigint(); for (let k = 0; k < 1e6; k++) x += m.stat.rawPrice() + m.stat.boatSpeed(); const ms = Number(process.hrtime.bigint() - t) / 1e6; return ms; }
const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1];
simRun(false); simRun(true); statRun(false); statRun(true);   // warm-up
const r = { simPlain: [], simEco: [], statPlain: [], statEco: [] };
for (let i = 0; i < 7; i++) { r.simPlain.push(simRun(false)); r.simEco.push(simRun(true)); r.statPlain.push(statRun(false)); r.statEco.push(statRun(true)); }
const o = { node: process.version, simUpdate18000_ms: { plain: +med(r.simPlain).toFixed(1), ecoOff: +med(r.simEco).toFixed(1) }, perUpdate_us: { plain: +(med(r.simPlain) / 18).toFixed(2), ecoOff: +(med(r.simEco) / 18).toFixed(2) },
  stat2e6calls_ms: { plain: +med(r.statPlain).toFixed(1), ecoOff: +med(r.statEco).toFixed(1) }, raw: r };
console.log(JSON.stringify(o));
