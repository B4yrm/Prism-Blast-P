// Species ledger, unit level (no simulation): hand-computed journeys, partial moves, clamps, rounding, persistence,
// assumed start-up, the audits themselves (they must catch tampering), and a model-based random test.
//   node --test tests/eco/species.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { bundle, fresh } = require('./_load.cjs');
const E = fresh(bundle('species-unit', `
export * from './eco/species.js';
export { roundCounts, sum } from './eco/mix.js';
export { drawCatch } from './eco/catch.js';
export { SPECIES_DEFS, CATCH_WEIGHTS, catchWeights } from './eco/defs-eco.js';
export { initEco, ecoFresh, SPECIES, REF_MIX, Q_EMPTY, MIX_LOCS, OMIX_LOCS, ECO_SCHEMA } from './eco/state-eco.js';
export { createStream, float, nextU32, STREAMS } from './eco/rng.js';
`));
const close = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const closeVec = (v, want, tol = 1e-9) => want.forEach((x, i) => close(v[i], x, tol));

// A tracker on a small fake save with the given stock (stock is whole numbers, as in the game).
function mk(stock = {}, tier = 1) {
  const S = { v: 1, stock: { quay: 0, wh: 0, facOut: 0, mRaw: 0, mProd: 0, ...stock }, tier: { harbor: tier }, created: 1700000000000 };
  E.initEco(S);
  const tr = new E.Tracker();
  assert.equal(tr.attach(S), true);
  return { S, tr };
}
// What the simulation does to the numbers, followed by the report the adapter makes.
const W = ({ S, tr }) => ({
  catchFish: (b, n) => { b.load = n; tr.onCatch(b, n); },
  unload: (b, k) => { const before = b.load; b.load -= k; S.stock.quay += k; tr.onUnload(b, before, k); },
  pick: (w, src, dst, take) => { const before = S.stock[src]; S.stock[src] -= take; w.carry = take; tr.onPick(w, src, dst, take, before); },
  drop: (w, src, dst, cap) => { const before = S.stock[dst], carry = w.carry; S.stock[dst] = Math.min(cap, before + carry); w.carry = 0; tr.onDrop(w, src, dst, carry, before, S.stock[dst]); },
  conveyor: (exits, entries) => { const wh0 = S.stock.wh; S.stock.wh -= entries; S.stock.facOut += exits; tr.onConveyor(exits, entries, wh0); },
  sale: (prod, raw) => { const m0 = S.stock.mProd, r0 = S.stock.mRaw; S.stock.mProd -= prod; S.stock.mRaw -= raw; tr.onSale(prod, m0, raw, r0); },
});
function assertSound(tr, S, where = '') {
  tr.checkStock(S.stock);
  assert.equal(tr.nViolations, 0, where + ' violations: ' + tr.violations.join(' | '));
  const r = tr.residual();
  for (let i = 0; i < 5; i++) close(r[i], 0, 1e-9);
  for (const l of E.LOCS) { close(E.sum(tr.qty[l]), S.stock[l], 1e-9); assert.ok(tr.qty[l].every(x => x >= 0), where + ' negative in ' + l); }
}

test('species table: ids match the save schema; tier 1 is the reference mix; rows sum to 1; unlocks match the weights', () => {
  assert.deepEqual(E.SPECIES_DEFS.map(s => s.id), E.SPECIES);
  assert.deepEqual(E.CATCH_WEIGHTS[1], E.REF_MIX);
  for (const [t, row] of Object.entries(E.CATCH_WEIGHTS)) {
    close(E.sum(row), 1, 1e-12);
    row.forEach((w, i) => assert.equal(w > 0, E.SPECIES_DEFS[i].unlockHarbor <= +t, `tier ${t} species ${i}`));
  }
  for (const odd of [0, -4, NaN, undefined, null, 1.7]) assert.equal(E.catchWeights(odd), E.CATCH_WEIGHTS[1]);
  assert.equal(E.catchWeights(2), E.CATCH_WEIGHTS[2]); assert.equal(E.catchWeights(9), E.CATCH_WEIGHTS[3]);
});

test('roundCounts: always sums to the total exactly, never creates a fish for a zero species, within 1 of the exact share (20,000 random cases)', () => {
  let s = 1234567; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 20000; n++) {
    const vec = Array.from({ length: 5 }, () => (rnd() < 0.3 ? 0 : rnd() * (rnd() < 0.5 ? 1 : 1e3)));
    const total = Math.floor(rnd() * (n % 7 === 0 ? 1e6 : 400));
    const out = E.roundCounts(vec, total), sv = E.sum(vec);
    if (!(sv > 0) || total === 0) { assert.deepEqual(out, [0, 0, 0, 0, 0]); continue; }
    assert.equal(out.reduce((a, b) => a + b, 0), total, JSON.stringify({ vec, total, out }));
    out.forEach((c, i) => { assert.ok(Number.isInteger(c) && c >= 0); if (vec[i] === 0) assert.equal(c, 0); assert.ok(Math.abs(c - vec[i] * total / sv) < 1 + 1e-9); });
  }
  assert.deepEqual(E.roundCounts([1, 1, 1, 0, 0], 10), [4, 3, 3, 0, 0]);   // ties go to the lower index
  assert.deepEqual(E.roundCounts([0.55, 0.35, 0.10, 0, 0], 7), [4, 2, 1, 0, 0]);
});

test('drawCatch: whole numbers summing to n, zero-weight species never drawn, one draw per fish, deterministic, matches the weights', () => {
  const wt = E.CATCH_WEIGHTS[3];
  const a = E.createStream(5, 'catch'), b = E.createStream(5, 'catch'), c = E.createStream(5, 'catch');
  const x = E.drawCatch(a, 100, wt), y = E.drawCatch(b, 100, wt);
  assert.deepEqual(Array.from(x), Array.from(y)); assert.equal(E.sum(x), 100); assert.ok(Array.from(x).every(Number.isInteger));
  for (let i = 0; i < 100; i++) E.nextU32(c);
  assert.deepEqual(a, c);                                                    // exactly 100 draws were taken from the stream
  const z = E.drawCatch(E.createStream(9, 'catch'), 50000, E.CATCH_WEIGHTS[1]);
  assert.equal(z[3], 0); assert.equal(z[4], 0); assert.equal(E.sum(z), 50000);
  const big = E.drawCatch(E.createStream(11, 'catch'), 200000, wt);
  let chi = 0; wt.forEach((w, i) => { const e = 200000 * w; chi += (big[i] - e) ** 2 / e; });
  assert.ok(chi < 18.5, 'chi2 ' + chi);                                      // df 4: p ≈ 0.001
  assert.deepEqual(Array.from(E.drawCatch(E.createStream(1, 'catch'), 0, wt)), [0, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(E.drawCatch(E.createStream(1, 'catch'), 30, [0, 0, 0, 0, 1])), [0, 0, 0, 0, 30]);
});

test('attach: composition × stock; refuses an unusable S.eco; second attach changes nothing', () => {
  const S = { v: 1, stock: { quay: 10, wh: 40, facOut: 4, mRaw: 0, mProd: 8 }, tier: { harbor: 1 }, created: 1 };
  E.initEco(S); S.eco.mix.wh = [0.25, 0.25, 0.25, 0.25, 0]; S.eco.omix.mProd = [0, 0, 0, 0.5, 0.5];
  const tr = new E.Tracker();
  assert.equal(tr.attach(S), true);
  closeVec(tr.qty.wh, [10, 10, 10, 10, 0]); closeVec(tr.qty.mProd, [0, 0, 0, 4, 4]); closeVec(tr.qty.quay, [5.5, 3.5, 1, 0, 0]); closeVec(tr.qty.mRaw, [0, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(tr.snapshot().counts.wh), [10, 10, 10, 10, 0]);
  for (let i = 0; i < 5; i++) close(tr.ledger.init[i], E.LOCS.reduce((a, l) => a + tr.qty[l][i], 0), 1e-12);
  const before = JSON.stringify(tr.snapshot()); assert.equal(tr.attach(S), true); assert.equal(JSON.stringify(tr.snapshot()), before);
  for (const bad of [undefined, null, 'x', { v: 2 }, { v: 1 }]) { const t = new E.Tracker(); assert.equal(t.attach({ stock: S.stock, eco: bad }), false); assert.equal(t.attached, false); }
  assert.equal(new E.Tracker().attach(null), false);
});

test('hand-computed journey: catch → partial unload → pick → drop → conveyor → pick → drop → sale, all exact', () => {
  const x = mk({}), w = W(x), { S, tr } = x;
  const boatA = { i: 0 }, boatB = { i: 1 }, hauler = { i: 0 }, hauler2 = { i: 1 };
  tr.setWeights([0, 0, 0, 0, 1]); w.catchFish(boatA, 30);           // 30 tuna
  closeVec(tr.cargo.get(boatA), [0, 0, 0, 0, 30]);
  w.unload(boatA, 12);                                              // partial: 12 off, 18 still aboard
  closeVec(tr.qty.quay, [0, 0, 0, 0, 12]); closeVec(tr.cargo.get(boatA), [0, 0, 0, 0, 18]); assertSound(tr, S, 'after partial unload');
  tr.setWeights([1, 0, 0, 0, 0]); w.catchFish(boatB, 20); w.unload(boatB, 20);   // 20 sardines, all at once
  assert.equal(tr.cargo.has(boatB), false);
  closeVec(tr.qty.quay, [20, 0, 0, 0, 12]); assertSound(tr, S, 'quay 32');
  w.unload(boatA, 18);                                              // the rest of boat A
  closeVec(tr.qty.quay, [20, 0, 0, 0, 30]); assert.equal(tr.cargo.has(boatA), false); assertSound(tr, S, 'quay 50');
  w.pick(hauler, 'quay', 'wh', 10);                                 // average-mix move: 10 of 50 = 4 sardines + 6 tuna
  closeVec(tr.transit.get(hauler).vec, [4, 0, 0, 0, 6]); closeVec(tr.qty.quay, [16, 0, 0, 0, 24]); assertSound(tr, S, 'carrying');
  w.drop(hauler, 'quay', 'wh', 100);
  closeVec(tr.qty.wh, [4, 0, 0, 0, 6]); assert.equal(tr.transit.size, 0); assertSound(tr, S, 'in warehouse');
  w.conveyor(0, 5);                                                 // 5 units go onto the conveyor, each 0.4 sardine + 0.6 tuna
  closeVec(tr.qty.wh, [2, 0, 0, 0, 3]); assert.equal(tr.conv.length, 5); tr.conv.forEach(u => closeVec(u, [0.4, 0, 0, 0, 0.6])); assertSound(tr, S, 'on the conveyor');
  w.conveyor(3, 0);                                                 // 3 units come out
  closeVec(tr.qty.facOut, [1.2, 0, 0, 0, 1.8]); assert.equal(tr.conv.length, 2); assertSound(tr, S, 'factory output');
  w.pick(hauler2, 'facOut', 'mProd', 3); w.drop(hauler2, 'facOut', 'mProd', 100);
  closeVec(tr.qty.mProd, [1.2, 0, 0, 0, 1.8]); closeVec(tr.qty.facOut, [0, 0, 0, 0, 0]); assertSound(tr, S, 'on the shelf');
  w.sale(2, 0);                                                     // 2 of 3 products sold: 0.8 sardine + 1.2 tuna
  closeVec(tr.ledger.sold, [0.8, 0, 0, 0, 1.2]); closeVec(tr.qty.mProd, [0.4, 0, 0, 0, 0.6]); assertSound(tr, S, 'after a sale');
  closeVec(tr.ledger.caught, [20, 0, 0, 0, 30]);
  assert.deepEqual(Array.from(E.roundCounts(tr.qty.mProd, S.stock.mProd)), [0, 0, 0, 0, 1]);     // 1 unit left: rounded to the larger share
  assert.equal(tr.ledger.events.assumed, 0);
});

test('a full place cuts a delivery short: the lost fish are counted with their species, nothing is created', () => {
  const x = mk({ wh: 36 }), w = W(x), { S, tr } = x;
  const hauler = { i: 0 }, boat = { i: 0 };
  tr.setWeights([0, 0, 0, 1, 0]); w.catchFish(boat, 8); w.unload(boat, 8);          // 8 salmon on the quay; the warehouse holds 36 of the reference mix
  w.pick(hauler, 'quay', 'wh', 8);
  w.drop(hauler, 'quay', 'wh', 40);                                                // room for 4 only
  assert.equal(S.stock.wh, 40); assertSound(tr, S, 'clamped');
  close(tr.qty.wh[3], 4); close(tr.ledger.lost[3], 4); assert.equal(tr.ledger.events.clamped, 1);
  closeVec(tr.qty.wh, [36 * 0.55, 36 * 0.35, 36 * 0.10, 4, 0]);
  // capacity lowered below the stock: the simulation cuts the stock itself and loses the whole delivery
  const y = mk({ wh: 50 }), v = W(y), h2 = { i: 0 };
  y.tr.setWeights([0, 0, 0, 0, 1]); const b2 = { i: 0 }; v.catchFish(b2, 5); v.unload(b2, 5); v.pick(h2, 'quay', 'wh', 5);
  v.drop(h2, 'quay', 'wh', 40);
  assert.equal(y.S.stock.wh, 40); assertSound(y.tr, y.S, 'cut');
  close(y.tr.ledger.lost[4], 5); close(E.sum(y.tr.ledger.lost), 15);               // 5 delivered tuna + 10 of the 50 in the pool
  closeVec(y.tr.qty.wh, [40 * 0.55, 40 * 0.35, 40 * 0.10, 0, 0], 1e-9);
});

test('rounding never creates or removes a fish: 40,000 random moves, whole-number counts always sum to the stock', () => {
  for (const seed of [1, 2, 3, 4]) {
    let s = seed * 7919; const rnd = n => { s = (s * 16807) % 2147483647; return s % n; };
    const x = mk({ quay: rnd(60), wh: rnd(60), mRaw: rnd(30), facOut: rnd(30), mProd: rnd(30) }, 3), w = W(x), { S, tr } = x;
    const boats = [{ i: 0 }, { i: 1 }, { i: 2 }], haulers = [{ i: 0 }, { i: 1 }, { i: 2 }, { i: 3 }];
    for (const b of boats) b.load = 0;
    for (const h of haulers) h.carry = 0;
    const CAP = { quay: 90, wh: 140, mRaw: 60, facOut: 60, mProd: 60 }, JOBS = [['quay', 'wh'], ['wh', 'mRaw'], ['facOut', 'mProd']];
    for (let n = 0; n < 10000; n++) {
      const op = rnd(10);
      if (op < 2) { const b = boats[rnd(3)]; if (b.load === 0) w.catchFish(b, 5 + rnd(40)); else { const k = Math.min(b.load, 1 + rnd(b.load), CAP.quay - S.stock.quay); if (k > 0) w.unload(b, k); } }
      else if (op < 5) {
        const h = haulers[rnd(4)];
        if (h.carry > 0) { h.job = h.job || JOBS[0]; w.drop(h, h.job[0], h.job[1], rnd(8) === 0 ? S.stock[h.job[1]] + rnd(6) : CAP[h.job[1]]); h.job = null; }
        else { const j = JOBS[rnd(3)]; if (S.stock[j[0]] > 0) { h.job = j; w.pick(h, j[0], j[1], 1 + rnd(Math.min(6, S.stock[j[0]]))); } }
      } else if (op < 7) { const entries = Math.min(S.stock.wh, rnd(3)), exits = Math.min(tr.conv.length, rnd(3)); if (entries || exits) w.conveyor(exits, entries); }
      else if (op < 9) { const p = Math.min(S.stock.mProd, rnd(3)), r = Math.min(S.stock.mRaw, rnd(3)); if (p || r) w.sale(p, r); }
      boats.forEach((b, i) => tr.auditBoat(b, i, b.load)); haulers.forEach((h, i) => tr.auditWorker(h, i, h.carry)); tr.auditConveyor(tr.conv.length);
      tr.checkStock(S.stock);
      if (n % 25 === 0) {
        tr.auditLedger();
        for (const l of E.LOCS) { const c = E.roundCounts(tr.qty[l], S.stock[l]); assert.equal(c.reduce((a, b) => a + b, 0), S.stock[l], l); }
      }
      if (tr.nViolations) assert.fail(`seed ${seed} step ${n}: ${tr.violations.join(' | ')}`);
    }
    assertSound(tr, S, 'end of seed ' + seed);
    assert.ok(tr.ledger.events.unload > 500 && tr.ledger.events.pick > 500 && tr.ledger.events.entry > 100 && tr.ledger.events.sale > 100 && tr.ledger.events.clamped > 0, JSON.stringify(tr.ledger.events));
  }
});

test('composition is written to S.eco: shares sum to 1, empty places get the reference mix and quality 1, and the save needs no repair', () => {
  const x = mk({}, 3), w = W(x), { S, tr } = x, boat = { i: 0 }, h = { i: 0 };
  tr.setWeights([0.5, 0, 0.25, 0.25, 0]); w.catchFish(boat, 40); w.unload(boat, 40);
  closeVec(S.eco.mix.quay, E.sum(tr.qty.quay) > 0 ? Array.from(tr.qty.quay, v => v / 40) : []);
  close(E.sum(S.eco.mix.quay), 1, 1e-12);
  w.pick(h, 'quay', 'wh', 40); w.drop(h, 'quay', 'wh', 100);
  assert.deepEqual(S.eco.mix.quay, E.REF_MIX); assert.equal(S.eco.q.quay, E.Q_EMPTY);       // the quay is empty again
  w.conveyor(0, 10); w.conveyor(10, 0);
  assert.equal(S.stock.facOut, 10); close(E.sum(S.eco.omix.facOut), 1, 1e-12);
  const copy = JSON.parse(JSON.stringify(S)), r = E.initEco(copy);
  assert.equal(r.status, 'ok'); assert.deepEqual(r.repairs, []); assert.deepEqual(copy.eco, JSON.parse(JSON.stringify(S.eco)));
  // after a reload the ledger starts from the stored composition
  const t2 = new E.Tracker(); assert.equal(t2.attach(copy), true);
  for (const l of E.LOCS) closeVec(t2.qty[l], Array.from(tr.qty[l]), 1e-9 * Math.max(1, S.stock[l]));
  for (const l of E.LOCS) assert.deepEqual(E.roundCounts(t2.qty[l], S.stock[l]), E.roundCounts(tr.qty[l], S.stock[l]));
});

test('catch stream: saved with S.eco, continues exactly after a reload', () => {
  const x = mk({}, 2), w = W(x), { S, tr } = x, b = { i: 0 };
  w.catchFish(b, 37); const first = Array.from(tr.cargo.get(b));
  const mid = JSON.parse(JSON.stringify(S));
  b.load = 0; tr.cargo.delete(b); w.catchFish(b, 37); const second = Array.from(tr.cargo.get(b));
  const t2 = new E.Tracker(); E.initEco(mid); assert.equal(t2.attach(mid), true);
  t2.onCatch(b, 37); assert.deepEqual(Array.from(t2.cargo.get(b)), second);
  assert.notDeepEqual(first, second);
});

test('starting in the middle of a session: boats, haulers and conveyor units that are already loaded get an assumed composition, counted', () => {
  // when tracking starts, the 6 fish a hauler carries and the 3 on the conveyor are already out of the warehouse stock (21 left)
  const x = mk({ quay: 20, wh: 21 }, 3), w = W(x), { S, tr } = x;
  const boat = { i: 0, load: 25 }, h = { i: 0, carry: 6 };      // as the simulation's own boat and hauler objects are
  tr.assumeCargo(boat, 25); tr.assumeTransit(h, 'wh', 'mRaw', 6); tr.assumeConveyor(3);
  assert.equal(tr.ledger.events.assumed, 5); close(E.sum(tr.ledger.assumed), 25 + 6 + 3);
  tr.auditBoat(boat, 0, 25); tr.auditWorker(h, 0, 6); tr.auditConveyor(3);
  assertSound(tr, S, 'assumed');
  w.unload(boat, 25); w.drop(h, 'wh', 'mRaw', 100); w.conveyor(3, 0);
  assertSound(tr, S, 'after the assumed fish moved on'); assert.equal(tr.cargo.size, 0); assert.equal(tr.transit.size, 0); assert.equal(tr.conv.length, 0);
});

test('the audits catch errors (a test of the tests): every kind of tampering is reported', () => {
  const cases = {
    'a stock change that was not reported': ({ S, tr }) => { S.stock.wh += 1; tr.checkStock(S.stock); },
    'unload without a cargo record': ({ S, tr }) => { S.stock.quay += 3; tr.onUnload({ i: 9 }, 10, 3); },
    'drop without a carry record': ({ S, tr }) => { S.stock.wh += 2; tr.onDrop({ i: 9 }, 'quay', 'wh', 2, 0, 2); },
    'a boat whose cargo does not match its load': ({ tr }) => { const b = { i: 0 }; tr.onCatch(b, 10); tr.auditBoat(b, 0, 11); },
    'a hauler whose batch does not match its carry': ({ S, tr }) => { S.stock.quay = 5; tr.qty.quay[0] = 5; const h = { i: 0 }; tr.onPick(h, 'quay', 'wh', 2, 5); tr.auditWorker(h, 0, 3); },
    'a conveyor of the wrong length': ({ tr }) => { tr.auditConveyor(2); },
    'a fish counted twice (ledger off)': ({ tr }) => { tr.qty.quay[1] += 0.5; tr.auditLedger(); },
    'a negative quantity': ({ S, tr }) => { tr.qty.wh[2] = -0.5; tr.checkStock(S.stock); },
    'a catch that is not a whole number': ({ tr }) => { tr.onCatch({ i: 0 }, 2.5); },
    'a second catch before the boat was unloaded': ({ tr }) => { const b = { i: 0 }; tr.onCatch(b, 5); tr.onCatch(b, 5); },
    'a conveyor exit without a record': ({ S, tr }) => { S.stock.facOut += 1; tr.onConveyor(1, 0, 0); },
  };
  for (const [name, f] of Object.entries(cases)) { const x = mk({}); f(x); assert.ok(x.tr.nViolations > 0, 'not caught: ' + name); }
  const clean = mk({}); clean.tr.checkStock(clean.S.stock); clean.tr.auditLedger(); assert.equal(clean.tr.nViolations, 0);
});

test('weights: validation and the by-tier default', () => {
  const { tr } = mk({}, 3);
  assert.deepEqual(tr.weights(), E.CATCH_WEIGHTS[3]);
  for (const bad of [[1, 0], [0.5, 0.5, 0.5, 0, 0], [-1, 2, 0, 0, 0], 'x', [NaN, 0, 0, 0, 1]]) assert.throws(() => tr.setWeights(bad));
  tr.setWeights([0, 1, 0, 0, 0]); assert.deepEqual(tr.weights(), [0, 1, 0, 0, 0]); tr.setWeights(null); assert.deepEqual(tr.weights(), E.CATCH_WEIGHTS[3]);
  tr.S.tier.harbor = 1; assert.deepEqual(tr.weights(), E.CATCH_WEIGHTS[1]);
});
