// Species ledger (T1.3): which species the fish in every place are, tracked beside the simulation.
//
// The simulation counts fish as whole numbers per place (S.stock.*), a boat's load, a hauler's carry and the
// conveyor's queue. It never says which species they are. This module keeps the species of every one of
// those fish in its own vectors of 5 quantities, and moves them in step with the simulation's own moves:
//   catch → boat cargo → (unload) quay → (hauler) warehouse → (conveyor) factory output → (hauler) shelf → sale
// The adapter reports each move with the amounts it read from the simulation (before / after each call).
//
// Model rules
//  • Quantities are fractional (not rounded): a pool of 40 fish that is 55 % sardine holds 22 sardines; removing
//    5 fish from it removes 2.75 sardines. Whole numbers are only shown, with roundCounts() (largest remainder),
//    which always sums to the simulation's stock exactly. So nothing is created or lost by rounding.
//  • Taking fish out of a pool (quay, warehouse, shelves, conveyor entry) removes them in proportion to the
//    pool's composition: the simulation has no individual fish, so this is an AVERAGE-MIX move.
//  • A batch that already has a composition (a boat's cargo, what a hauler carries, a unit on the conveyor)
//    is delivered with that composition: that part is EXACT.
//  • The species of a catch is decided here, from the eco 'catch' stream (never the global random generator).
//  • Nothing is made up: a move that cannot be matched with a record is a violation (counted and reported),
//    not silently repaired. Only the start-up of tracking in the middle of a session assumes anything
//    (counted in ledger.assumed).
//
// What is written to the save: the composition of every place, as shares, in S.eco.mix (quay, wh, mRaw) and
// S.eco.omix (facOut, mProd: the species the processed units were made from), and the 'catch' stream state.
// Nothing here changes S.stock, money or any simulation value.

import { SPECIES, REF_MIX, Q_EMPTY, ECO_SCHEMA } from './state-eco.js';
import { catchWeights } from './defs-eco.js';
import { drawCatch } from './catch.js';
import { sum, roundCounts } from './mix.js';

export const LOCS = ['quay', 'wh', 'mRaw', 'facOut', 'mProd'];
const FIELD = { quay: 'mix', wh: 'mix', mRaw: 'mix', facOut: 'omix', mProd: 'omix' };
export const TOL = 1e-6;                       // allowed float drift between the ledger and the simulation's whole numbers
const K = SPECIES.length;
const zeros = () => new Float64Array(K);
const addTo = (dst, src) => { for (let i = 0; i < K; i++) dst[i] += src[i]; };

function newLedger() {
  return {
    init: zeros(),      // species in the pools when tracking started
    caught: zeros(),    // species of every catch
    assumed: zeros(),   // species assumed when tracking started mid-session (boats / haulers / conveyor already loaded)
    sold: zeros(),      // species of everything sold (shelves → customers)
    lost: zeros(),      // species of fish the simulation itself dropped (a full warehouse cuts a delivery short)
    events: { catch: 0, unload: 0, pick: 0, drop: 0, entry: 0, exit: 0, sale: 0, assumed: 0, clamped: 0 },
  };
}

export class Tracker {
  constructor() { this.violations = []; this.nViolations = 0; this.reported = false; this.weightsOverride = null; this.checks = 0; this.clear(); }

  clear() {
    this.attached = false; this.S = null; this.eco = null; this.rng = null;
    this.qty = {}; for (const l of LOCS) this.qty[l] = zeros();
    this.cargo = new Map();      // boat → species quantities aboard
    this.transit = new Map();    // hauler → { src, dst, vec }
    this.conv = [];              // one vector per unit on the conveyor, oldest first
    this.ledger = newLedger();
  }

  violation(msg) { this.nViolations++; if (this.violations.length < 20) this.violations.push(msg); }
  resetViolations() { this.violations = []; this.nViolations = 0; this.reported = false; }

  setWeights(w) {
    if (w === null) { this.weightsOverride = null; return; }
    if (!Array.isArray(w) || w.length !== K || w.some(x => !(x >= 0)) || Math.abs(sum(w) - 1) > 1e-9) throw new Error('weights: 5 shares, sum 1');
    this.weightsOverride = w.slice();
  }
  weights() { return this.weightsOverride || catchWeights(this.S && this.S.tier && this.S.tier.harbor); }
  shares(loc) { const f = this.eco && this.eco[FIELD[loc]], a = f && f[loc]; return Array.isArray(a) && a.length === K ? a : REF_MIX; }

  // Starts tracking from the save: every place gets its stored composition × the simulation's stock.
  // Returns false (and does nothing) when S.eco is not a usable v1 subtree.
  attach(S) {
    if (this.attached) return true;
    const eco = S && S.eco;
    if (!eco || eco.v !== ECO_SCHEMA || !S.stock || !eco.rng || !Array.isArray(eco.rng.catch) || !eco.mix || !eco.omix || !eco.q) return false;
    this.clear(); this.S = S; this.eco = eco; this.rng = eco.rng.catch;
    for (const l of LOCS) {
      const sh = this.shares(l), stock = S.stock[l] > 0 ? S.stock[l] : 0;
      for (let i = 0; i < K; i++) this.qty[l][i] = sh[i] * stock;
      addTo(this.ledger.init, this.qty[l]);
    }
    this.attached = true;
    return true;
  }
  detach() { this.clear(); }

  // ---- start-up in the middle of a session (assumed compositions, counted) --------------------------------
  assumeCargo(boat, load) {
    const w = this.weights(), c = zeros();
    for (let i = 0; i < K; i++) c[i] = w[i] * load;
    this.cargo.set(boat, c); addTo(this.ledger.assumed, c); this.ledger.events.assumed++;
    return c;
  }
  assumeTransit(worker, src, dst, carry) {
    const sh = this.shares(src), vec = zeros();
    for (let i = 0; i < K; i++) vec[i] = sh[i] * carry;
    const t = { src, dst, vec }; this.transit.set(worker, t); addTo(this.ledger.assumed, vec); this.ledger.events.assumed++;
    return t;
  }
  assumeConveyor(n) {
    for (let u = 0; u < n; u++) { const v = Float64Array.from(this.shares('wh')); this.conv.push(v); addTo(this.ledger.assumed, v); this.ledger.events.assumed++; }
  }

  // ---- pool helpers --------------------------------------------------------------------------------------
  // Removes n of `before` fish from a pool, in proportion; returns the removed species vector.
  removePool(loc, n, before) {
    const q = this.qty[loc], vec = zeros();
    if (n >= before) { vec.set(q); q.fill(0); }
    else { const f = n / before; for (let i = 0; i < K; i++) { vec[i] = q[i] * f; q[i] -= vec[i]; } }
    return vec;
  }
  // Writes the pool's composition into S.eco as shares. An empty place gets the reference mix and quality 1,
  // exactly the rule of the save's reconciliation (so a saved game never needs a repair for it).
  syncShares(loc) {
    const q = this.qty[loc], arr = this.eco[FIELD[loc]][loc], stock = this.S.stock[loc];
    if (!(stock > 0)) { for (let i = 0; i < K; i++) arr[i] = REF_MIX[i]; this.eco.q[loc] = Q_EMPTY; return; }
    const t = sum(q);
    if (!(t > 0)) { for (let i = 0; i < K; i++) arr[i] = REF_MIX[i]; return; }   // out of step: check() reports it
    for (let i = 0; i < K; i++) arr[i] = q[i] / t;
  }

  // ---- moves, in the order the simulation makes them ------------------------------------------------------
  // A boat finished fishing with `n` fish aboard.
  onCatch(boat, n) {
    if (!Number.isInteger(n) || n < 0) { this.violation('catch: load is not a whole number: ' + n); n = Math.max(0, Math.round(n) || 0); }
    const old = this.cargo.get(boat);
    if (old) { const r = sum(old); if (r > TOL) { this.violation('catch: the boat still held ' + r + ' fish'); addTo(this.ledger.lost, old); } }
    const c = drawCatch(this.rng, n, this.weights());
    this.cargo.set(boat, c); addTo(this.ledger.caught, c); this.ledger.events.catch++;
  }

  // A boat in its berth unloaded k of its `before` fish onto the quay.
  onUnload(boat, before, k) {
    let c = this.cargo.get(boat);
    if (!c) { this.violation('unload: no cargo record for the boat (assumed)'); c = this.assumeCargo(boat, before); }
    else { const t = sum(c); if (Math.abs(t - before) > TOL) { this.violation('unload: cargo ' + t + ' vs load ' + before); if (t > 0) { const f = before / t; for (let i = 0; i < K; i++) c[i] *= f; } } }
    const vec = zeros();
    if (k >= before) { vec.set(c); c.fill(0); }
    else { const f = k / before; for (let i = 0; i < K; i++) { vec[i] = c[i] * f; c[i] -= vec[i]; } }
    addTo(this.qty.quay, vec);
    if (before - k <= 0) this.cargo.delete(boat);
    this.ledger.events.unload++;
    this.syncShares('quay');
  }

  // A hauler took `take` of the `before` fish in `src` and now carries them towards `dst`.
  onPick(worker, src, dst, take, before) {
    const vec = this.removePool(src, take, before);
    const prev = this.transit.get(worker);
    if (prev) { this.violation('pick: the hauler still carried a batch'); addTo(this.ledger.lost, prev.vec); }
    this.transit.set(worker, { src, dst, vec });
    this.ledger.events.pick++;
    this.syncShares(src);
  }

  // A hauler set down `carry` fish at `dst`; the simulation's stock there went from `before` to `after`.
  // Normally after = before + carry. If the place was too full the simulation cuts the delivery short:
  // only after - before arrive, the rest is lost (and, if the capacity was lowered below the stock, the
  // simulation also cuts the stock itself: that is removed from the pool too).
  onDrop(worker, src, dst, carry, before, after) {
    let t = this.transit.get(worker);
    if (!t) { this.violation('drop: no carry record for the hauler (assumed)'); t = this.assumeTransit(worker, src, dst, carry); }
    else { const s = sum(t.vec); if (Math.abs(s - carry) > TOL) { this.violation('drop: carried ' + s + ' vs carry ' + carry); if (s > 0) { const f = carry / s; for (let i = 0; i < K; i++) t.vec[i] *= f; } } }
    this.transit.delete(worker);
    const added = Math.min(carry, Math.max(0, after - before)), removed = Math.max(0, before - after);
    const share = carry > 0 ? added / carry : 0, q = this.qty[dst];
    for (let i = 0; i < K; i++) { const a = t.vec[i] * share; q[i] += a; this.ledger.lost[i] += t.vec[i] - a; }
    if (share < 1) this.ledger.events.clamped++;
    if (removed > 0) { addTo(this.ledger.lost, this.removePool(dst, removed, before)); this.ledger.events.clamped++; }
    this.ledger.events.drop++;
    this.syncShares(dst);
  }

  // One factory step: `exits` units left the conveyor (into facOut), `entries` units went onto it from the
  // warehouse, which held `whBefore` fish before the step. Exits come first, as in the simulation.
  onConveyor(exits, entries, whBefore) {
    for (let e = 0; e < exits; e++) {
      let rec = this.conv.shift();
      if (!rec) { this.violation('conveyor exit without a record (assumed)'); rec = Float64Array.from(this.shares('wh')); addTo(this.ledger.assumed, rec); }
      addTo(this.qty.facOut, rec); this.ledger.events.exit++;
    }
    for (let u = 0; u < entries; u++) {
      this.conv.push(this.removePool('wh', 1, whBefore - u)); this.ledger.events.entry++;
    }
    if (exits) this.syncShares('facOut');
    if (entries) this.syncShares('wh');
  }

  // Customers bought: `dProd` of the `mBefore` products and `dRaw` of the `rBefore` raw fish on the shelves.
  onSale(dProd, mBefore, dRaw, rBefore) {
    if (dProd > 0) { addTo(this.ledger.sold, this.removePool('mProd', dProd, mBefore)); this.ledger.events.sale++; this.syncShares('mProd'); }
    if (dRaw > 0) { addTo(this.ledger.sold, this.removePool('mRaw', dRaw, rBefore)); this.ledger.events.sale++; this.syncShares('mRaw'); }
  }

  // ---- audits (read-only; they only record violations) -----------------------------------------------------
  checkStock(stock) {
    this.checks++;
    for (const l of LOCS) {
      const q = this.qty[l], s = stock[l], t = sum(q);
      if (!(Math.abs(t - s) <= TOL)) this.violation(l + ': tracked ' + t + ' vs simulation ' + s);
      for (let i = 0; i < K; i++) if (!(q[i] >= -TOL)) { this.violation(l + '[' + i + '] is negative or not a number: ' + q[i]); break; }
    }
  }
  auditBoat(boat, idx, expected) {
    const c = this.cargo.get(boat), t = c ? sum(c) : 0;
    if (!(Math.abs(t - expected) <= TOL)) this.violation('boat ' + idx + ': cargo ' + t + ' vs load ' + expected);
  }
  auditWorker(worker, idx, carry) {
    const t = this.transit.get(worker), s = t ? sum(t.vec) : 0;
    if (!(Math.abs(s - carry) <= TOL)) this.violation('hauler ' + idx + ': carried ' + s + ' vs carry ' + carry);
  }
  auditConveyor(len) { if (this.conv.length !== len) this.violation('conveyor: ' + this.conv.length + ' tracked vs ' + len + ' in the simulation'); }

  // Per species: everything that ever entered (initial + caught + assumed) minus everything that is somewhere
  // (pools, boats, haulers, conveyor) or gone (sold, lost). Zero when no fish was created, lost or counted twice.
  residual() {
    const r = zeros();
    for (let i = 0; i < K; i++) r[i] = this.ledger.init[i] + this.ledger.caught[i] + this.ledger.assumed[i] - this.ledger.sold[i] - this.ledger.lost[i];
    for (const l of LOCS) for (let i = 0; i < K; i++) r[i] -= this.qty[l][i];
    for (const c of this.cargo.values()) for (let i = 0; i < K; i++) r[i] -= c[i];
    for (const t of this.transit.values()) for (let i = 0; i < K; i++) r[i] -= t.vec[i];
    for (const c of this.conv) for (let i = 0; i < K; i++) r[i] -= c[i];
    return r;
  }
  auditLedger() {
    const r = this.residual();
    for (let i = 0; i < K; i++) if (!(Math.abs(r[i]) <= TOL)) { this.violation('species ' + SPECIES[i] + ': ledger is off by ' + r[i]); break; }
  }

  // Plain, JSON-safe view for tests and the dev console.
  snapshot() {
    const arr = v => Array.from(v), stock = this.S ? this.S.stock : null;
    const aboard = zeros(), carried = zeros(), onConv = zeros();
    for (const c of this.cargo.values()) addTo(aboard, c);
    for (const t of this.transit.values()) addTo(carried, t.vec);
    for (const c of this.conv) addTo(onConv, c);
    const qty = {}, counts = {};
    for (const l of LOCS) { qty[l] = arr(this.qty[l]); counts[l] = stock ? roundCounts(this.qty[l], stock[l] > 0 ? stock[l] : 0) : null; }
    const L = this.ledger;
    return {
      attached: this.attached, qty, counts,
      aboard: arr(aboard), carried: arr(carried), conveyor: arr(onConv), conveyorUnits: this.conv.length, boatsWithCargo: this.cargo.size, haulersCarrying: this.transit.size,
      ledger: { init: arr(L.init), caught: arr(L.caught), assumed: arr(L.assumed), sold: arr(L.sold), lost: arr(L.lost), events: { ...L.events } },
      residual: arr(this.residual()), violations: { n: this.nViolations, first: this.violations.slice() },
    };
  }
}
