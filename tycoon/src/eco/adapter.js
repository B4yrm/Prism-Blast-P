// The only place where the eco layer meets the existing game
// (ECONOMY-ARCHITECTURE.md §2, variant A, approved as Q1).
//
// It wraps a fixed list of stat.* functions and a fixed list of Sim.prototype methods. The existing files
// (src/core/*, src/sim/*) are not edited: the wrappers are put in place from here, once, when the ECO entry
// (src/main-eco.js) loads.
//
// Eco off (the default): every wrapper calls the original with the same `this` and arguments and returns its
// value untouched. A stat wrapper applies a modifier only when eco is on AND a modifier is registered
// (none is, yet).
//
// Eco on (T1.3): the four Sim methods that write S.stock (updBoat, updWorker, updFactory, updCustomers) are
// OBSERVED: the wrapper reads the few simulation values it needs before the call and again after it and tells
// the species tracker what moved. It only reads. It never writes to the simulation, never draws from the global random generator,
// and never changes what the original returns. Why per-method and not the bus events: the events do not carry
// the amounts (`unload` has no k, there is no event for a pick or for a conveyor entry, and `drop` reports
// the carry before the stock was capped). Every write to S.stock lives inside exactly one of the four methods
// (checked by tests/eco/stock-writers.cjs), and within one call each method makes one kind of write, so the
// before/after difference of that call is exactly what the method did.

import { advance, createClock } from './clock.js';
import { Tracker } from './species.js';

// stat functions the eco layer will modify in later tasks (architecture §2.1).
export const WRAPPED_STATS = ['rawPrice', 'prodPrice', 'custEvery', 'boatSpeed', 'fishTime', 'boatCap', 'workerSpeed'];
// Sim methods that write S.stock; observed read-only when eco is on.
export const OBSERVED = ['updBoat', 'updWorker', 'updFactory', 'updCustomers'];

// What the adapter relies on. checkContract() reports anything missing, so a refactor of the simulation
// fails loudly here instead of breaking eco silently.
export const CONTRACT = {
  stat: [...WRAPPED_STATS, 'priceMul', 'quayCap', 'whCap', 'facOutCap', 'shelfCap', 'loadTime', 'offlineCapH'],
  simProto: ['update', ...OBSERVED, 'pickJob', 'serve', 'collect'],
  bus: ['on', 'emit'],
};

const MARK = Symbol.for('fishingTycoon.eco.installed');

// Shared adapter state. `mods` maps a stat name to a function (value → value); it is empty, so nothing is
// ever modified. `species` is the T1.3 species tracker.
export const ecoState = { on: false, clock: createClock(), mods: {}, installed: false, attempts: 0, installedBeforeLoad: null, species: new Tracker() };

export function checkContract({ stat, Sim, bus }) {
  const missing = [];
  for (const k of CONTRACT.stat) if (!stat || typeof stat[k] !== 'function') missing.push('stat.' + k);
  const proto = Sim && Sim.prototype;
  for (const k of CONTRACT.simProto) if (!proto || typeof proto[k] !== 'function') missing.push('Sim.prototype.' + k);
  for (const k of CONTRACT.bus) if (!bus || typeof bus[k] !== 'function') missing.push('bus.' + k);
  return missing;
}

function wrapStat(stat, key) {
  const orig = stat[key];
  const wrapped = function () {
    const v = orig.apply(this, arguments);
    const m = ecoState.on ? ecoState.mods[key] : undefined;
    return m ? m(v) : v;
  };
  wrapped.ecoOrig = orig;
  stat[key] = wrapped;
}

// ---- species tracking: start-up -----------------------------------------------------------------------------
// Starts tracking if eco is on and S.eco is usable. Tracking that starts in the middle of a session finds boats,
// haulers and conveyor units that are already loaded; their species cannot be known, so they get an assumed
// composition and are counted in ledger.assumed (boats: the current catch weights; haulers and conveyor
// units: the composition of the place they came from).
export function activate(sim, G) {
  const tr = ecoState.species;
  if (tr.attached) return true;
  const S = sim ? sim.S : (G && G.S);
  if (!S || !tr.attach(S)) return false;
  if (sim) {
    for (const b of sim.boats) if ((b.state === 'back' || b.state === 'dock') && b.load > 0) tr.assumeCargo(b, b.load);
    for (const w of sim.workers) if (w.carry > 0 && w.job) tr.assumeTransit(w, w.job.src, w.job.dst, w.carry);
    tr.assumeConveyor(sim.convey.length);
  }
  return true;
}

// The tracker to report to, or null (eco off, no usable S.eco, or no save yet). Switching eco off drops the
// tracker's in-memory state; S.eco keeps the last written composition.
function trackerFor(sim) {
  const tr = ecoState.species;
  if (!ecoState.on) { if (tr.attached) tr.detach(); return null; }
  if (tr.attached) return tr;
  return activate(sim, null) ? tr : null;
}

function wrapObserved(proto, name) {
  const orig = proto[name];
  let w;
  switch (name) {
    case 'updBoat':
      w = function (b, dt) {
        const tr = trackerFor(this);
        if (!tr) return orig.call(this, b, dt);
        const state0 = b.state, load0 = b.load;
        const r = orig.call(this, b, dt);
        if (state0 === 'fish' && b.state === 'back') tr.onCatch(b, b.load);                 // the catch is aboard
        else if (state0 === 'dock' && load0 > 0 && b.load < load0) tr.onUnload(b, load0, load0 - b.load);
        return r;
      };
      break;
    case 'updWorker':
      w = function (wk, dt) {
        const tr = trackerFor(this);
        if (!tr) return orig.call(this, wk, dt);
        const state0 = wk.state, job = wk.job, stock = this.S.stock;
        if (state0 === 'pick') {
          const before = stock[job.src];
          const r = orig.call(this, wk, dt);
          if (wk.state !== 'pick') { const take = before - stock[job.src]; if (take > 0) tr.onPick(wk, job.src, job.dst, take, before); }
          return r;
        }
        if (state0 === 'drop') {
          const carry = wk.carry, before = stock[job.dst];
          const r = orig.call(this, wk, dt);
          if (wk.state !== 'drop') tr.onDrop(wk, job.src, job.dst, carry, before, stock[job.dst]);
          return r;
        }
        return orig.call(this, wk, dt);
      };
      break;
    case 'updFactory':
      w = function (dt) {
        const tr = trackerFor(this);
        if (!tr) return orig.call(this, dt);
        const st = this.S.stock, fac0 = st.facOut, wh0 = st.wh;
        const r = orig.call(this, dt);
        const exits = st.facOut - fac0, entries = wh0 - st.wh;
        if (exits > 0 || entries > 0) tr.onConveyor(Math.max(0, exits), Math.max(0, entries), wh0);
        return r;
      };
      break;
    case 'updCustomers':
      w = function (dt) {
        const tr = trackerFor(this);
        if (!tr) return orig.call(this, dt);
        const st = this.S.stock, prod0 = st.mProd, raw0 = st.mRaw;
        const r = orig.call(this, dt);
        const dProd = prod0 - st.mProd, dRaw = raw0 - st.mRaw;
        if (dProd > 0 || dRaw > 0) tr.onSale(Math.max(0, dProd), prod0, Math.max(0, dRaw), raw0);
        return r;
      };
      break;
    default: throw new Error('eco adapter: no observer for ' + name);
  }
  w.ecoOrig = orig;
  proto[name] = w;
}

// Read-only audit of the tracker against the simulation, after every simulation step.
function auditSim(sim, tr) {
  tr.checkStock(sim.S.stock);
  const boats = sim.boats, workers = sim.workers;
  for (let i = 0; i < boats.length; i++) { const b = boats[i]; tr.auditBoat(b, i, (b.state === 'back' || b.state === 'dock') ? b.load : 0); }
  for (let i = 0; i < workers.length; i++) tr.auditWorker(workers[i], i, workers[i].carry);
  tr.auditConveyor(sim.convey.length);
  if ((tr.checks & 31) === 0) tr.auditLedger();
  if (tr.nViolations && !tr.reported) { tr.reported = true; console.log('ECOERR species ' + tr.violations[0]); }
}

// Called after every simulation step with the same dt the simulation used.
export function tick(sim, dt, G) {
  if (!ecoState.on || !G || !G.S) return;
  advance(ecoState.clock, dt);
  const tr = ecoState.species;
  if (tr.attached && sim && sim.boats) auditSim(sim, tr);
}

// Installs the wrappers once. Returns { ok, reason }. A second call (or a second copy of this module in the
// same page) changes nothing.
export function install({ stat, Sim, bus, G }) {
  ecoState.attempts++;
  if (ecoState.installed || (stat && stat[MARK]) || (Sim && Sim.prototype && Sim.prototype[MARK])) return { ok: false, reason: 'already installed' };
  const missing = checkContract({ stat, Sim, bus });
  if (missing.length) return { ok: false, reason: 'contract: ' + missing.join(', ') };

  ecoState.installedBeforeLoad = !(G && G.S);   // true when the save was not loaded yet (eco ran before main.js)
  for (const k of WRAPPED_STATS) wrapStat(stat, k);

  const proto = Sim.prototype, origUpdate = proto.update;
  proto.update = function (dt) {
    const r = origUpdate.call(this, dt);
    tick(this, dt, G);
    return r;
  };
  proto.update.ecoOrig = origUpdate;
  for (const name of OBSERVED) wrapObserved(proto, name);

  Object.defineProperty(stat, MARK, { value: true });
  Object.defineProperty(proto, MARK, { value: true });
  ecoState.installed = true;
  return { ok: true, reason: '' };
}
