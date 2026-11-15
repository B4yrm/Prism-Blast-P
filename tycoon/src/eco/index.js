// Eco layer entry. Imported by src/main-eco.js BEFORE src/main.js, so the
// adapter is in place before main.js loads the save and computes the offline
// earnings (at that moment every wrapper still passes values through).
//
// T1.2: S.eco is created / migrated / repaired once per session, lazily, when the world is ready. This
// listener is registered before main.js registers its own (this module is evaluated first), so it runs
// before the UI starts and before the first save.
// T1.3: when eco is switched on, the species ledger follows the fish through the simulation (see
// species.js and the observers in adapter.js).
// T1.4: when eco is switched on, the fresh-fish price follows the species on the shelf (price.js, rawPriceFactor in
// adapter.js). Eco is OFF by default; it is switched on only in a development build:
//   ?eco=1        tracking and prices        ?eco=species   tracking only (prices unchanged)
//   or __eco.setOn(true) / __eco.setSystems({ price: false }) in the console.
// Eco switches on at worldReady, after main.js has computed the offline earnings, so those are unchanged.

import { G, stat } from '../core/economy.js';
import { Sim } from '../sim/sim.js';
import { bus } from '../core/bus.js';
import { install, ecoState, checkContract, activate, rawPriceFactor } from './adapter.js';
import { priceFactor, speciesFactors, BASE_PRICE, PRICE_NORM, FACTOR_MIN, FACTOR_MAX } from './price.js';
import { initEco, ECO_SCHEMA } from './state-eco.js';

export const ECO_VERSION = 't1.4';

const result = install({ stat, Sim, bus, G });
if (!result.ok) console.log('ECOERR install: ' + result.reason);

// Last S.eco initialisation report; `blocked` is set when S.eco cannot be used
// (made by a newer build): the eco layer then stays off and S.eco is not touched.
const saveState = { report: null, blocked: false, inits: 0 };

function ensureEco() {
  if (!G.S) return null;
  saveState.inits++;
  const r = initEco(G.S);
  saveState.report = r;
  saveState.blocked = !r.usable;
  if (saveState.blocked) ecoState.on = false;
  const line = `ECO save status=${r.status} v=${r.v} repairs=${r.repairs.length}${r.reason ? ' reason=' + r.reason : ''}`;
  console.log(r.status === 'recovered' || r.status === 'future' ? 'ECOERR ' + line : line);
  if (r.repairs.length) console.log('ECO repairs ' + JSON.stringify(r.repairs.slice(0, 20)));
  // development switch: the page address ends with ?eco=1
  try {
    const p = r.usable && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('eco') : null;
    if (p === '1' || p === 'species') { ecoState.systems.species = true; ecoState.systems.price = p === '1'; ecoState.on = true; console.log('ECO on (?eco=' + p + ') systems=' + JSON.stringify(ecoState.systems)); }
  } catch (e) { /* no location */ }
  return r;
}
bus.on('worldReady', ensureEco);

// Read-only view for tests and the dev console (ECO builds only).
if (typeof window !== 'undefined') {
  const tr = ecoState.species;
  window.__eco = {
    version: ECO_VERSION,
    schema: ECO_SCHEMA,
    get installed() { return ecoState.installed; },
    get attempts() { return ecoState.attempts; },
    get installedBeforeLoad() { return ecoState.installedBeforeLoad; },
    get on() { return ecoState.on; },
    get clock() { return { acc: ecoState.clock.acc, hours: ecoState.clock.hours }; },
    get save() { return saveState.report && JSON.parse(JSON.stringify({ ...saveState.report, blocked: saveState.blocked, inits: saveState.inits })); },
    result,
    contract: () => checkContract({ stat, Sim, bus }),
    // dev/test only: switch the eco layer on or off; refused while S.eco is blocked. Switching off drops the
    // tracker's in-memory state (S.eco keeps the last composition written).
    setOn(v) { ecoState.on = !!v && !saveState.blocked; if (!ecoState.on) tr.detach(); return ecoState.on; },
    // dev/test only: which eco systems run while eco is on ({ species, price }; prices need species)
    get systems() { return { ...ecoState.systems }; },
    setSystems(o) { for (const k of ['species', 'price']) if (o && k in o) ecoState.systems[k] = !!o[k]; if (!ecoState.systems.species) tr.detach(); return { ...ecoState.systems }; },
    // species prices (T1.4), read-only
    price: {
      factorNow: () => rawPriceFactor(),                         // the factor stat.rawPrice() uses right now (outside a sale: expected mix)
      snapshot: () => ({ base: BASE_PRICE.slice(), norm: PRICE_NORM, limits: [FACTOR_MIN, FACTOR_MAX], perSpecies: speciesFactors(),
        expected: tr.attached ? priceFactor(tr.weights()) : 1, shelf: tr.attached ? priceFactor(tr.qty.mRaw) : 1, now: rawPriceFactor() }),
    },
    // dev/test only: try to install again (must report 'already installed')
    reinstall: () => install({ stat, Sim, bus, G }),
    // dev/test only: run the S.eco initialisation again (must change nothing)
    reinit: () => { const r = ensureEco(); return r && JSON.parse(JSON.stringify(r)); },
    // species ledger (T1.3), read-only except the dev helpers
    species: {
      get attached() { return tr.attached; },
      snapshot: () => tr.snapshot(),
      ensure: () => ecoState.on && activate(G.sim, G),          // start tracking now instead of at the next simulation step
      setWeights: w => tr.setWeights(w),                          // dev/test only: catch weights (null = by harbor tier)
      resetViolations: () => tr.resetViolations(),
    },
  };
}
