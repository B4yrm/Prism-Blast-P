// Species ledger against the REAL simulation (Node, modules bundled by esbuild, seeded random, 30 FPS steps).
// Every step of every run is audited by an independent checker (written here, not the tracker's own):
//   Σ species of every place = the simulation's stock; a boat's cargo = its load while it carries a catch;
//   a hauler's batch = its carry; conveyor units = the simulation's queue; no negative quantity;
//   per species: initial + caught + assumed = in pools + aboard + carried + on the conveyor + sold + lost.
//   A  conservation + identity: start / mid / high / max, 600 s each; the simulation (state every 0.5 s, the final
//      save and the number of global-random draws) is identical with no adapter, adapter off and tracking on;
//      the ledger's caught / sold totals equal the simulation's own counters; species that are not unlocked never appear
//   B  one species only (tuna): every other species is exactly 0 everywhere, always
//   C  two disjoint boat groups (sardine boats, tuna boats): a boat's cargo holds only its group's species; caught per species
//      equals what the simulation's boats brought in
//   D  no haulers: partial unloads and boats held up by a full quay, then haulers arrive
//   E  warehouse capacity lowered while haulers carry: deliveries cut short, the lost fish are counted
//   F  tracking started in the middle of a session: assumed compositions are counted and match what was loaded
//   G  on → off → on: nothing is written to S.eco while off; tracking restarts from the saved composition
//   H  save → fresh modules → load → continue: composition and whole-number counts survive; the audits stay clean
//   I  mutation: with any one observer removed the audits report errors (the audits do catch a missing observation)
//   node tests/eco/species-sim.cjs [out.json]   → exit code 1 on failure
const assert = require('node:assert/strict');
const fs = require('fs');
const { bundle, fresh } = require('./_load.cjs');
const { SCEN, buildSave, seedRandom, simState } = require('./_scen.cjs');

const GAME = bundle('species-game', `
export { G, stat } from './core/economy.js';
export { Sim } from './sim/sim.js';
export { bus } from './core/bus.js';
export { fresh as freshSave } from './core/state.js';
export * as A from './eco/adapter.js';
export { initEco, REF_MIX, SPECIES } from './eco/state-eco.js';
export { roundCounts, sum } from './eco/mix.js';
export { LOCS } from './eco/species.js';
`);
const K = 5, DT = 1 / 30, results = [];
const check = (name, fn) => {
  const t0 = Date.now();
  try { const info = fn(); results.push({ name, pass: true, ms: Date.now() - t0, ...(info ? { info } : {}) }); console.log('ok   ' + name); }
  catch (e) { results.push({ name, pass: false, ms: Date.now() - t0, error: String(e && e.message || e).slice(0, 700) }); console.log('FAIL ' + name + '\n     ' + String(e && e.message || e).slice(0, 700)); }
};

// ---- a world: real simulation, save, adapter in the requested mode -----------------------------------------------
function world(cfg, mode) {                       // mode: 'plain' (no adapter) | 'off' | 'on'
  const m = fresh(GAME), S = buildSave(m.freshSave, cfg);
  m.G.S = S;
  if (mode !== 'plain') {
    const r = m.A.install({ stat: m.stat, Sim: m.Sim, bus: m.bus, G: m.G }); assert.equal(r.ok, true, r.reason);
    assert.notEqual(m.initEco(S).status, 'future'); m.A.ecoState.on = mode === 'on';
  }
  const rnd = seedRandom();
  const sim = new m.Sim();
  return { m, S, sim, rnd, tr: m.A.ecoState.species };
}
const strip = S => JSON.stringify({ ...S, eco: undefined, ecoBak: undefined, lastSeen: undefined });

// ---- the independent auditor --------------------------------------------------------------------------------------
function independent(w, opts = {}) {
  const { m, sim, tr } = w, S = sim.S, out = [];
  const sum = v => { let s = 0; for (let i = 0; i < K; i++) s += v[i]; return s; };
  if (!tr.attached) return ['tracker not attached'];
  const tot = new Float64Array(K);
  for (const l of m.LOCS) {
    const q = tr.qty[l]; let s = 0;
    for (let i = 0; i < K; i++) { if (!(q[i] >= -1e-9)) out.push(`${l}[${i}] = ${q[i]}`); s += q[i]; tot[i] += q[i]; }
    if (!(Math.abs(s - S.stock[l]) <= 1e-6)) out.push(`${l}: species sum ${s} vs stock ${S.stock[l]}`);
  }
  let withCargo = 0, carrying = 0;
  for (const b of sim.boats) {
    const c = tr.cargo.get(b), s = c ? sum(c) : 0, exp = (b.state === 'back' || b.state === 'dock') ? b.load : 0;
    if (!(Math.abs(s - exp) <= 1e-6)) out.push(`boat ${b.i} (${b.state}): cargo ${s} vs load ${exp}`);
    if (c) { withCargo++; for (let i = 0; i < K; i++) tot[i] += c[i]; }
  }
  for (const wk of sim.workers) {
    const t = tr.transit.get(wk), s = t ? sum(t.vec) : 0;
    if (!(Math.abs(s - wk.carry) <= 1e-6)) out.push(`hauler ${wk.i} (${wk.state}): batch ${s} vs carry ${wk.carry}`);
    if (t) { carrying++; for (let i = 0; i < K; i++) tot[i] += t.vec[i]; }
  }
  if (tr.cargo.size !== withCargo) out.push(`cargo map has ${tr.cargo.size} entries for ${withCargo} loaded boats`);
  if (tr.transit.size !== carrying) out.push(`transit map has ${tr.transit.size} entries for ${carrying} carrying haulers`);
  if (tr.conv.length !== sim.convey.length) out.push(`conveyor ${tr.conv.length} vs ${sim.convey.length}`);
  for (const u of tr.conv) for (let i = 0; i < K; i++) tot[i] += u[i];
  const L = tr.ledger;
  for (let i = 0; i < K; i++) { const r = L.init[i] + L.caught[i] + L.assumed[i] - L.sold[i] - L.lost[i] - tot[i]; if (!(Math.abs(r) <= 1e-6)) out.push(`species ${i}: ledger off by ${r}`); }
  if (tr.nViolations) out.push('the tracker reported: ' + tr.violations[0]);
  return out;
}

// Runs `secs` of simulation. hooks: { at: {step: fn}, each: fn(k) }. Returns what was seen.
function play(w, secs, hooks = {}) {
  const trace = [], errors = [];
  const n = Math.round(secs * 30);
  for (let k = 0; k < n; k++) {
    if (hooks.at && hooks.at[k]) hooks.at[k](w, k);
    w.sim.update(DT);
    if (w.tr.attached && w.m.A.ecoState.on) { const e = independent(w); if (e.length) { errors.push(`step ${k} (${(k * DT).toFixed(1)} s): ${e.slice(0, 3).join(' | ')}`); if (errors.length > 3) break; } }
    if (hooks.each) hooks.each(w, k);
    if (k % 15 === 0) trace.push(simState(w.sim));
  }
  return { trace, errors };
}
const mustBeClean = (name, r) => assert.deepEqual(r.errors, [], name + ': ' + r.errors.join(' // '));

// ---- A: conservation and identity ---------------------------------------------------------------------------------
const COUNT = {};
for (const key of ['start', 'mid', 'high', 'max']) {
  check(`A ${SCEN[key].name}: audited every step; simulation identical with no adapter / off / on`, () => {
    const cfg = SCEN[key], res = {};
    for (const mode of ['plain', 'off', 'on']) {
      const w = world(cfg, mode), stats0 = { ...w.S.stats }, eco0 = mode === 'plain' ? null : JSON.stringify(w.S.eco);
      const t0 = Date.now(), r = play(w, cfg.secs);
      res[mode] = { trace: r.trace, ms: Date.now() - t0, final: strip(w.S), draws: w.rnd.calls, stats0, w, errors: r.errors, eco0 };
      w.rnd.restore();
    }
    mustBeClean(key, { errors: res.on.errors });
    for (const mode of ['off', 'on']) {
      const i = res.plain.trace.findIndex((t, k) => t !== res[mode].trace[k]);
      assert.equal(i, -1, `${mode}: the simulation differs from the plain run at ${i * 0.5} s`);
      assert.equal(res[mode].final, res.plain.final, `${mode}: final save differs`);
      assert.equal(res[mode].draws, res.plain.draws, `${mode}: the global random generator was drawn from ${res[mode].draws} times, plain ${res.plain.draws}`);
    }
    assert.equal(res.off.w.tr.attached, false); assert.equal(JSON.stringify(res.off.w.S.eco), res.off.eco0, 'S.eco changed while eco was off');
    const w = res.on.w, tr = w.tr, L = tr.ledger, sumv = v => Array.from(v).reduce((a, b) => a + b, 0);
    assert.equal(tr.nViolations, 0); assert.equal(L.events.assumed, 0);
    assert.ok(Math.abs(sumv(L.caught) - (w.S.stats.caught - res.on.stats0.caught)) < 1e-6, 'caught total vs the simulation\'s own counter');
    assert.ok(Math.abs(sumv(L.sold) - (w.S.stats.sold - res.on.stats0.sold)) < 1e-6, 'sold total vs the simulation\'s own counter');
    assert.equal(sumv(L.lost), 0, 'a normal run loses nothing');
    const tier = cfg.tier.harbor;
    for (let s = 0; s < K; s++) {
      const unlocked = [1, 1, 1, 2, 3][s] <= tier, seen = L.caught[s] > 0;
      assert.equal(seen, unlocked, `species ${s}: caught ${L.caught[s]} but harbor tier ${tier}`);
      if (!unlocked) { assert.equal(L.sold[s], 0); for (const l of w.m.LOCS) assert.equal(tr.qty[l][s], 0, l + ' holds a species that is not unlocked'); }
    }
    if (tier === 3) for (let s = 0; s < K; s++) assert.ok(L.sold[s] > 0, `species ${s} was never sold`);
    const snap = tr.snapshot();
    for (const l of w.m.LOCS) assert.equal(snap.counts[l].reduce((a, b) => a + b, 0), w.S.stock[l], 'whole-number counts of ' + l);
    COUNT[key] = { events: L.events, caught: Array.from(L.caught).map(x => Math.round(x)), sold: Array.from(L.sold).map(x => +x.toFixed(1)), msPerRun: { plain: res.plain.ms, off: res.off.ms, on: res.on.ms }, draws: res.plain.draws };
    return COUNT[key];
  });
}

// ---- B: a single species ------------------------------------------------------------------------------------------
check('B one species only (tuna): every other species is exactly 0 in every place, always', () => {
  const w = world(SCEN.mid, 'on'); w.tr.setWeights([0, 0, 0, 0, 1]);
  const sold0 = w.S.stats.sold, caught0 = w.S.stats.caught;
  let nonzero = 0;
  const r = play(w, 400, { each: (w2) => {
    if (!w2.tr.attached) return;
    for (const l of w2.m.LOCS) for (let s = 0; s < 4; s++) if (w2.tr.qty[l][s] !== 0) nonzero++;
    for (const c of w2.tr.cargo.values()) for (let s = 0; s < 4; s++) if (c[s] !== 0) nonzero++;
    for (const t of w2.tr.transit.values()) for (let s = 0; s < 4; s++) if (t.vec[s] !== 0) nonzero++;
    for (const u of w2.tr.conv) for (let s = 0; s < 4; s++) if (u[s] !== 0) nonzero++;
  } });
  w.rnd.restore(); mustBeClean('B', r);
  const L = w.tr.ledger;
  assert.equal(nonzero, 0, 'a species other than tuna appeared');
  for (let s = 0; s < 4; s++) assert.equal(L.sold[s] + L.caught[s] + L.lost[s], 0);
  assert.equal(L.sold[4], w.S.stats.sold - sold0, 'everything sold is tuna: the ledger must equal the simulation\'s own sold counter');
  assert.equal(L.caught[4], w.S.stats.caught - caught0, 'everything caught is tuna');
  assert.ok(L.sold[4] > 0);
  const snap = w.tr.snapshot();
  for (const l of w.m.LOCS) assert.deepEqual(snap.counts[l], [0, 0, 0, 0, w.S.stock[l]]);
  return { tunaSold: +L.sold[4].toFixed(1), tunaCaught: L.caught[4] };
});

// ---- C: two disjoint boat groups ------------------------------------------------------------------------------------
check('C boats 0 and 2 catch only sardines, boats 1 and 3 only tuna: cargo purity, caught per species = what the boats brought in', () => {
  const w = world(SCEN.max, 'on'), tr = w.tr, brought = [0, 0];
  const origCatch = tr.onCatch.bind(tr);
  tr.onCatch = (b, n) => { const g = b.i % 2; tr.setWeights(g === 0 ? [1, 0, 0, 0, 0] : [0, 0, 0, 0, 1]); origCatch(b, n); brought[g] += n; };
  const prevState = new Map(); let purityBreaks = 0, groupCatches = [0, 0];
  const r = play(w, 600, { each: (w2) => {
    for (const b of w2.sim.boats) {
      const c = tr.cargo.get(b), g = b.i % 2;
      if (c) { const other = g === 0 ? c[4] : c[0]; if (other !== 0 || c[1] || c[2] || c[3]) purityBreaks++; }
      const was = prevState.get(b); if (was === 'fish' && b.state === 'back') groupCatches[g] += b.load; prevState.set(b, b.state);
    }
  } });
  w.rnd.restore(); mustBeClean('C', r);
  assert.equal(purityBreaks, 0, 'a boat held a species of the other group');
  assert.equal(tr.ledger.caught[0], groupCatches[0]); assert.equal(tr.ledger.caught[4], groupCatches[1]);       // the simulation's own loads at the moment of the catch
  assert.equal(brought[0], groupCatches[0]); assert.equal(brought[1], groupCatches[1]);
  assert.equal(tr.ledger.caught[1] + tr.ledger.caught[2] + tr.ledger.caught[3], 0);
  assert.ok(groupCatches[0] > 500 && groupCatches[1] > 500);
  return { sardineCaught: groupCatches[0], tunaCaught: groupCatches[1] };
});

// ---- D: no haulers, full quay, partial unloads ----------------------------------------------------------------------
check('D no haulers: the quay fills, boats unload part of their catch and wait with the rest; then haulers arrive', () => {
  const w = world(SCEN.nohaul, 'on');
  const proto = w.m.Sim.prototype, o = proto.updBoat;
  let partial = 0, heldUp = 0, maxAboardWhileBlocked = 0;
  proto.updBoat = function (b, dt) {
    const l0 = b.load, s0 = b.state, r = o.call(this, b, dt);
    if (s0 === 'dock' && l0 > 0 && b.load > 0 && b.load < l0) partial++;
    if (b.blocked && b.load > 0) { heldUp++; maxAboardWhileBlocked = Math.max(maxAboardWhileBlocked, b.load); }
    return r;
  };
  const r = play(w, 400, { at: { 6000: (w2) => { w2.S.workers = 3; } } });
  w.rnd.restore(); mustBeClean('D', r);
  assert.ok(partial > 0, 'no partial unload happened'); assert.ok(heldUp > 100, 'no boat was held up by a full quay');
  assert.equal(w.tr.nViolations, 0);
  assert.ok(w.sim.workers.length === 3 && w.tr.ledger.events.pick > 0, 'haulers started working');
  return { partialUnloadSteps: partial, boatHeldUpSteps: heldUp, mostAboardWhileHeldUp: maxAboardWhileBlocked, picksAfterHaulersArrived: w.tr.ledger.events.pick };
});

// ---- E: a delivery cut short ------------------------------------------------------------------------------------------
check('E warehouse capacity lowered while haulers carry: the cut-short deliveries are counted with their species, the audits stay clean', () => {
  const w = world(SCEN.mid, 'on');
  const r = play(w, 400, { at: { 3000: (w2) => { w2.S.up.warehouse.cap = 0; w2.S.tier.warehouse = 1; } } });
  w.rnd.restore(); mustBeClean('E', r);
  const L = w.tr.ledger, lost = Array.from(L.lost).reduce((a, b) => a + b, 0);
  assert.ok(L.events.clamped > 0 && lost > 0, `no cut-short delivery happened (clamped ${L.events.clamped})`);
  assert.equal(w.tr.nViolations, 0);
  return { cutShort: L.events.clamped, fishLost: +lost.toFixed(2), lostBySpecies: Array.from(L.lost).map(x => +x.toFixed(2)) };
});

// ---- F: tracking starts in the middle of a session -------------------------------------------------------------------
check('F tracking started mid-session: boats, haulers and conveyor units already loaded are assumed and counted; everything afterwards is audited', () => {
  const w = world(SCEN.mid, 'off');
  let r0 = play(w, 150); assert.equal(w.tr.attached, false);
  let inBoats = 0, carried = 0;
  for (const b of w.sim.boats) if ((b.state === 'back' || b.state === 'dock') && b.load > 0) inBoats += b.load;
  for (const wk of w.sim.workers) carried += wk.carry;
  const conv = w.sim.convey.length;
  assert.ok(inBoats + carried + conv > 0, 'nothing was in flight at the moment tracking starts');
  w.m.A.ecoState.on = true;
  const r = play(w, 300); w.rnd.restore(); mustBeClean('F', r);
  const L = w.tr.ledger, assumed = Array.from(L.assumed).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(assumed - (inBoats + carried + conv)) < 1e-6, `assumed ${assumed} vs in flight ${inBoats + carried + conv}`);
  assert.equal(w.tr.nViolations, 0);
  return { inBoats, carried, conveyorUnits: conv, assumedEvents: L.events.assumed };
});

// ---- G: on → off → on ----------------------------------------------------------------------------------------------------
check('G on → off → on: nothing is written to S.eco while off; tracking restarts from the saved composition', () => {
  const w = world(SCEN.mid, 'on');
  const r1 = play(w, 120); mustBeClean('G1', r1);
  const ecoAtOff = JSON.stringify(w.S.eco), snapAtOff = w.tr.snapshot();
  w.m.A.ecoState.on = false;
  const r2 = play(w, 90); assert.equal(w.tr.attached, false);
  assert.equal(JSON.stringify(w.S.eco), ecoAtOff, 'S.eco was written while eco was off');
  w.m.A.ecoState.on = true;
  const r3 = play(w, 120); w.rnd.restore(); mustBeClean('G3', r3);
  assert.equal(w.tr.attached, true); assert.equal(w.tr.nViolations, 0);
  return { assumedAfterRestart: w.tr.ledger.events.assumed, qtyBeforeOff: snapAtOff.qty.wh.map(x => +x.toFixed(2)) };
});

// ---- H: save → reload ------------------------------------------------------------------------------------------------------
check('H save → fresh modules → load → continue: composition and whole-number counts survive; the audits stay clean', () => {
  const w = world(SCEN.high, 'on');
  const r1 = play(w, 300); mustBeClean('H1', r1);
  const snap1 = w.tr.snapshot(), saved = JSON.stringify(w.S), before = JSON.parse(saved).eco;
  w.rnd.restore();
  // a new page: fresh module instances, the save loaded from JSON, S.eco initialised as the game does at worldReady
  const m2 = fresh(GAME), S2 = JSON.parse(saved);
  m2.G.S = S2; assert.equal(m2.A.install({ stat: m2.stat, Sim: m2.Sim, bus: m2.bus, G: m2.G }).ok, true);
  const rep = m2.initEco(S2);
  assert.equal(rep.status, 'ok', JSON.stringify(rep)); assert.deepEqual(rep.repairs, []); assert.deepEqual(S2.eco, before, 'S.eco changed by loading it');
  m2.A.ecoState.on = true;
  const rnd2 = seedRandom(777), sim2 = new m2.Sim(), tr2 = m2.A.ecoState.species;
  const w2 = { m: m2, S: S2, sim: sim2, tr: tr2, rnd: rnd2 };
  sim2.update(DT);                                   // first step: tracking attaches
  assert.equal(tr2.attached, true);
  let diversity = 0;
  for (const l of m2.LOCS) {
    const a = snap1.qty[l], b = Array.from(tr2.qty[l]), tolAbs = 1e-6;
    for (let i = 0; i < K; i++) assert.ok(Math.abs(a[i] - b[i]) <= tolAbs + 1e-9 * a[i] || (l === 'quay' || l === 'wh' || l === 'mRaw' || l === 'facOut' || l === 'mProd') && Math.abs(a[i] - b[i]) < 5, `${l}[${i}] ${a[i]} vs ${b[i]}`);
    if (S2.stock[l] > 5) { const mx = Math.max(...a) / S2.stock[l]; if (mx < 0.95) diversity++; }
  }
  assert.ok(diversity >= 3, 'the saved composition is not varied: tracking did not do anything');
  const r2 = play(w2, 300); rnd2.restore(); mustBeClean('H2', r2);
  assert.equal(tr2.nViolations, 0);
  return { placesWithMixedSpecies: diversity };
});

// ---- I: mutation -------------------------------------------------------------------------------------------------------------
for (const name of ['updBoat', 'updWorker', 'updFactory', 'updCustomers']) {
  check(`I mutation: with the ${name} observer removed the audits report errors`, () => {
    const w = world(SCEN.mid, 'on');
    w.m.Sim.prototype[name] = w.m.Sim.prototype[name].ecoOrig;           // the observer is gone
    const r = play(w, 120); w.rnd.restore();
    assert.ok(r.errors.length > 0 || w.tr.nViolations > 0, 'removing the observer was not noticed');
    return { firstError: (r.errors[0] || w.tr.violations[0] || '').slice(0, 140) };
  });
}

// ---- summary ------------------------------------------------------------------------------------------------------------------
const pass = results.every(r => r.pass);
const out = { test: 'species ledger against the real simulation', pass, passed: results.filter(r => r.pass).length, total: results.length, results };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify({ pass, passed: out.passed, total: out.total }));
process.exit(pass ? 0 : 1);
