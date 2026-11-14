// Development entry with the eco layer (build with ECO=1, see build.mjs).
// ES modules evaluate their imports in order, depth first: the eco layer (and
// the economy and simulation modules it wraps) is fully evaluated before
// main.js starts, so main.js runs unchanged on top of the installed adapter.
import './eco/index.js';
import './main.js';
