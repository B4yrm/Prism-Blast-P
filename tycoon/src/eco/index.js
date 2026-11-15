// Eco layer entry. Imported by src/main-eco.js BEFORE src/main.js, so the
// adapter is in place before main.js loads the save and computes the offline
// earnings (at that moment every wrapper still passes values through).
//
// T1.2: S.eco is created / migrated / repaired once per session, lazily, when the
// world is ready. This listener is registered before main.js registers its own
// (this module is evaluated first), so it runs before the UI starts and before
// the first save. Every eco system is still off: the data has no effect on the
// economy, the save's other fields, the boats, the workers or the offline earnings.

import { G, stat } from '../core/economy.js';
import { Sim } from '../sim/sim.js';
import { bus } from '../core/bus.js';
import { install, ecoState, checkContract } from './adapter.js';
import { initEco, ECO_SCHEMA } from './state-eco.js';

export const ECO_VERSION = 't1.2';

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
  return r;
}
bus.on('worldReady', ensureEco);

// Read-only view for tests and the dev console (ECO builds only).
if (typeof window !== 'undefined') {
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
    // dev/test only: switch the eco layer on (in T1.2 that runs the in-memory clock and nothing else); refused while S.eco is blocked
    setOn(v) { ecoState.on = !!v && !saveState.blocked; return ecoState.on; },
    // dev/test only: try to install again (must report 'already installed')
    reinstall: () => install({ stat, Sim, bus, G }),
    // dev/test only: run the S.eco initialisation again (must change nothing)
    reinit: () => { const r = ensureEco(); return r && JSON.parse(JSON.stringify(r)); },
  };
}
