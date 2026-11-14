// The only place where the eco layer meets the existing game
// (ECONOMY-ARCHITECTURE.md §2, variant A, approved as Q1).
//
// It wraps a fixed list of stat.* functions and Sim.prototype.update. The
// existing files (src/core/*, src/sim/*) are not edited: the wrappers are put
// in place from here, once, when the ECO entry (src/main-eco.js) loads.
//
// T1.1 state: every eco system is off. A wrapped stat function returns exactly
// what the original returns (same call, same `this`, same arguments, the value
// is passed through untouched), and the update wrapper only advances the eco
// clock when the eco layer is switched on (it is off by default).

import { advance, createClock } from './clock.js';

// stat functions the eco layer will modify in later tasks (architecture §2.1).
export const WRAPPED_STATS = ['rawPrice', 'prodPrice', 'custEvery', 'boatSpeed', 'fishTime', 'boatCap', 'workerSpeed'];

// What the adapter relies on. checkContract() reports anything missing, so a
// refactor of the simulation fails loudly here instead of breaking eco silently.
export const CONTRACT = {
  stat: [...WRAPPED_STATS, 'priceMul', 'quayCap', 'whCap', 'facOutCap', 'shelfCap', 'loadTime', 'offlineCapH'],
  simProto: ['update', 'updBoat', 'updWorker', 'pickJob', 'updFactory', 'updCustomers', 'serve', 'collect'],
  bus: ['on', 'emit'],
};

const MARK = Symbol.for('fishingTycoon.eco.installed');

// Shared adapter state. `mods` maps a stat name to a function (value → value);
// it is empty in T1.1, so nothing is ever modified.
export const ecoState = { on: false, clock: createClock(), mods: {}, installed: false, attempts: 0, installedBeforeLoad: null };

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

// Called after every simulation step with the same dt the simulation used.
export function tick(sim, dt, G) {
  if (!ecoState.on || !G || !G.S) return;
  advance(ecoState.clock, dt);
}

// Installs the wrappers once. Returns { ok, reason }. A second call (or a
// second copy of this module in the same page) changes nothing.
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

  Object.defineProperty(stat, MARK, { value: true });
  Object.defineProperty(proto, MARK, { value: true });
  ecoState.installed = true;
  return { ok: true, reason: '' };
}
