// PROOF that the species ledger can follow the fish without changing the protected simulation files.
//
// Claim: every write to S.stock.* happens inside one of four Sim methods (updBoat, updWorker, updFactory,
// updCustomers; `serve` only runs inside updCustomers), and inside one call each of them makes exactly one kind
// of write. So the stock before and after one call says exactly what that call did.
//
// Method: run the real, unmodified simulation (no eco adapter) with S.stock behind a Proxy that records every
// write, with every Sim method wrapped to know which one is running. Then check:
//   1. no write happens outside the four methods (not in update(), collect(), sync(), pickJob()...)
//   2. per call, the writes are exactly the expected shape:
//        updBoat       0 or 1 write, on quay, +k, k = the boat's load decrease (only while docked)
//        updWorker     pick: 1 write on job.src, −carry   |   drop: 1 write on job.dst, = min(cap, old + carry)   |   else none
//        updFactory    some writes on facOut (+1 each) and then some on wh (−1 each), nothing else; conveyor length changes by the same numbers
//        updCustomers  only mProd / mRaw, −1 each (never the clamp of a negative shelf)
//   3. static: nothing outside src/sim and src/eco writes to a stock object (source scan)
//   node tests/eco/stock-writers.cjs [out.json]   → exit code 1 on failure
const fs = require('fs'), path = require('path');
const { bundle, fresh, root } = require('./_load.cjs');
const { SCEN, buildSave, seedRandom } = require('./_scen.cjs');

const GAME = bundle('writers-game', `
export { G } from './core/economy.js';
export { Sim } from './sim/sim.js';
export { fresh as freshSave } from './core/state.js';
`);
const OBSERVED = ['updBoat', 'updWorker', 'updFactory', 'updCustomers'];
const problems = [], report = { scenarios: [], static: null };
const fail = msg => { if (problems.length < 40) problems.push(msg); };

function runScenario(name, cfg, secs, mutate) {
  const m = fresh(GAME), S = buildSave(m.freshSave, cfg);
  m.G.S = S;
  const writes = [];                       // every write to S.stock, with the stack of Sim methods running
  const stack = [];
  S.stock = new Proxy(S.stock, { set(t, prop, value) { writes.push({ loc: prop, old: t[prop], value, stack: stack.slice() }); t[prop] = value; return true; } });
  const proto = m.Sim.prototype;
  const calls = { updBoat: 0, updWorker: 0, updFactory: 0, updCustomers: 0 }, wrote = { quay: 0, pick: 0, drop: 0, clampedDrop: 0, facOut: 0, wh: 0, sale: 0, other: 0 };
  let cur = null;                          // the observed call in progress
  for (const n of Object.getOwnPropertyNames(proto)) {
    const d = Object.getOwnPropertyDescriptor(proto, n);
    if (n === 'constructor' || typeof d.value !== 'function') continue;
    const o = d.value;
    proto[n] = function (...a) {
      stack.push(n);
      const first = writes.length;
      let pre = null;
      if (OBSERVED.includes(n) && !cur) {
        calls[n]++;
        const st = this.S.stock;
        pre = { n, a, first, load: n === 'updBoat' ? a[0].load : 0, state: n === 'updBoat' ? a[0].state : n === 'updWorker' ? a[0].state : '',
          carry: n === 'updWorker' ? a[0].carry : 0, job: n === 'updWorker' ? a[0].job : null, conv: this.convey.length, sim: this };
        cur = pre;
      }
      try { return o.apply(this, a); }
      finally {
        stack.pop();
        if (pre) { cur = null; analyse(pre, writes.slice(first), this); }
      }
    };
  }
  function analyse(c, w, sim) {
    for (const x of w) if (!x.stack.includes(c.n)) fail(`${name}: write outside ${c.n}: ${x.loc}`);
    if (c.n === 'updBoat') {
      const b = c.a[0];
      if (w.length > 1) fail(`${name}: updBoat made ${w.length} writes`);
      if (w.length === 1) {
        const x = w[0], k = x.value - x.old;
        if (x.loc !== 'quay' || !(k > 0)) fail(`${name}: updBoat wrote ${x.loc} by ${k}`);
        if (c.state !== 'dock' || k !== c.load - b.load) fail(`${name}: updBoat write ${k} but load went ${c.load} → ${b.load} in state ${c.state}`);
        wrote.quay++;
      } else if (c.state === 'dock' && b.load < c.load) fail(`${name}: updBoat unloaded without a stock write`);
    } else if (c.n === 'updWorker') {
      const wk = c.a[0];
      if (c.state === 'pick') {
        if (w.length > 1) fail(`${name}: pick made ${w.length} writes`);
        if (w.length === 1) { const x = w[0]; if (x.loc !== c.job.src || x.old - x.value !== wk.carry || !(wk.carry > 0)) fail(`${name}: pick wrote ${x.loc} ${x.old}→${x.value}, carry ${wk.carry}, src ${c.job.src}`); wrote.pick++; }
        else if (wk.carry > 0) fail(`${name}: pick without a stock write but carry ${wk.carry}`);
      } else if (c.state === 'drop') {
        if (wk.state !== 'drop') {
          if (w.length !== 1) fail(`${name}: drop made ${w.length} writes`);
          else { const x = w[0], want = Math.min(sim.cap(c.job.dst), x.old + c.carry); if (x.loc !== c.job.dst || x.value !== want) fail(`${name}: drop wrote ${x.loc} ${x.old}→${x.value}, expected ${c.job.dst} → ${want}`); wrote.drop++; if (x.value !== x.old + c.carry) wrote.clampedDrop++; }
        } else if (w.length) fail(`${name}: drop in progress made writes`);
      } else if (w.length) fail(`${name}: updWorker in state ${c.state} wrote stock`);
    } else if (c.n === 'updFactory') {
      let phase = 0, exits = 0, entries = 0;
      for (const x of w) {
        const d = x.value - x.old;
        if (x.loc === 'facOut' && d === 1 && phase === 0) { exits++; wrote.facOut++; }
        else if (x.loc === 'wh' && d === -1) { phase = 1; entries++; wrote.wh++; }
        else fail(`${name}: updFactory wrote ${x.loc} by ${d} (phase ${phase})`);
      }
      if (sim.convey.length !== c.conv - exits + entries) fail(`${name}: conveyor ${c.conv} → ${sim.convey.length}, writes say −${exits} +${entries}`);
    } else if (c.n === 'updCustomers') {
      for (const x of w) { if (!((x.loc === 'mProd' || x.loc === 'mRaw') && x.value - x.old === -1)) fail(`${name}: updCustomers wrote ${x.loc} by ${x.value - x.old}`); else wrote.sale++; }
    }
  }
  // writes made while no observed method was running
  const rnd = seedRandom();
  try {
    const sim = new m.Sim(), dt = 1 / 30, n = Math.round(secs * 30);
    for (let k = 0; k < n; k++) { if (mutate) mutate(k, S, sim); sim.update(dt); }
    for (const x of writes) if (!OBSERVED.some(o => x.stack.includes(o))) fail(`${name}: write to ${x.loc} outside the four methods (stack ${x.stack.join('>') || 'none'})`);
  } finally { rnd.restore(); }
  const total = writes.length;
  report.scenarios.push({ scenario: name, seconds: secs, stockWrites: total, calls, wrote });
  return { total, calls, wrote };
}

const run = [
  ['start', SCEN.start, 600], ['mid', SCEN.mid, 600], ['high', SCEN.high, 600], ['max', SCEN.max, 600],
  ['no haulers (full quay)', SCEN.nohaul, 400],
];
for (const [name, cfg, secs] of run) runScenario(name, cfg, secs);
// capacity lowered below the stock while haulers carry: the simulation cuts deliveries short
runScenario('warehouse capacity lowered at 100 s', SCEN.mid, 400, (k, S) => { if (k === 3000) { S.up.warehouse.cap = 0; S.tier.warehouse = 1; } });

// coverage: every kind of write was really seen
const sum = key => report.scenarios.reduce((a, s) => a + s.wrote[key], 0);
for (const key of ['quay', 'pick', 'drop', 'facOut', 'wh', 'sale']) if (sum(key) === 0) fail('coverage: no ' + key + ' write seen in any scenario');
if (sum('clampedDrop') === 0) fail('coverage: no delivery was cut short by a full place in any scenario');
report.coverage = Object.fromEntries(['quay', 'pick', 'drop', 'clampedDrop', 'facOut', 'wh', 'sale'].map(k => [k, sum(k)]));

// static scan: outside src/sim and src/eco nothing may write to a stock object. A write is a member of `stock`
// (or of a local alias of it, `const st = x.stock`) on the left of =, +=, -=, ++, --, or the whole object replaced.
const hits = [], seen = [];
const memberOf = n => `(?:\\w+\\.)*${n}(?:\\.\\w+|\\[[^\\]]+\\])`;
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f), rel = path.relative(path.join(root, 'src'), p);
    if (fs.statSync(p).isDirectory()) { if (rel !== 'sim' && rel !== 'eco') walk(p); continue; }
    if (!/\.js$/.test(f)) continue;
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    const names = ['stock'];
    for (const l of lines) { const mm = l.match(/(?:const|let|var)\s+(\w+)\s*=\s*[\w.()]*\.stock\b\s*[;,]/); if (mm) names.push(mm[1]); }
    lines.forEach((l, i) => {
      if (!names.some(n => new RegExp('\\b' + n + '\\b').test(l))) return;
      seen.push(`src/${rel}:${i + 1}`);
      const code = l.replace(/\/\/.*$/, '');
      const write = names.some(n => new RegExp(`(?:\\+\\+|--)\\s*${memberOf(n)}|${memberOf(n)}\\s*(?:\\+\\+|--|[-+*/%]?=(?!=))`).test(code))
        || /\.stock\s*=(?!=)/.test(code) || /Object\.assign\([^)]*stock/.test(code);
      if (write) hits.push(`src/${rel}:${i + 1}: ${l.trim().slice(0, 100)}`);
    });
  }
})(path.join(root, 'src'));
report.static = { filesWithStockMentions: [...new Set(seen.map(x => x.split(':')[0]))], linesChecked: seen.length, writes: hits };
for (const u of hits) fail('static: write to stock outside src/sim: ' + u);

const out = { test: 'S.stock writers', pass: problems.length === 0, problems, ...report };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify({ pass: out.pass, problems, coverage: report.coverage, scenarios: report.scenarios.map(s => ({ s: s.scenario, writes: s.stockWrites, calls: s.calls })), static: report.static }, null, 1));
process.exit(out.pass ? 0 : 1);
