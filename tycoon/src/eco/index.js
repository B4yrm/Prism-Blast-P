// Eco layer entry. Imported by src/main-eco.js BEFORE src/main.js, so the
// adapter is in place before main.js loads the save and computes the offline
// earnings (at that moment every wrapper still passes values through).
//
// T1.1: skeleton only. Every eco system is off; nothing in the economy, the
// save, the boats, the workers or the offline earnings changes.

import { G, stat } from '../core/economy.js';
import { Sim } from '../sim/sim.js';
import { bus } from '../core/bus.js';
import { install, ecoState, checkContract } from './adapter.js';

export const ECO_VERSION = 't1.1';

const result = install({ stat, Sim, bus, G });
if (!result.ok) console.log('ECOERR install: ' + result.reason);

// Read-only view for tests and the dev console (ECO builds only).
if (typeof window !== 'undefined') {
  window.__eco = {
    version: ECO_VERSION,
    get installed() { return ecoState.installed; },
    get attempts() { return ecoState.attempts; },
    get installedBeforeLoad() { return ecoState.installedBeforeLoad; },
    get on() { return ecoState.on; },
    get clock() { return { acc: ecoState.clock.acc, hours: ecoState.clock.hours }; },
    result,
    contract: () => checkContract({ stat, Sim, bus }),
    // dev/test only: switch the eco layer on (in T1.1 that runs the clock and nothing else)
    setOn(v) { ecoState.on = !!v; },
    // dev/test only: try to install again (must report 'already installed')
    reinstall: () => install({ stat, Sim, bus, G }),
  };
}
