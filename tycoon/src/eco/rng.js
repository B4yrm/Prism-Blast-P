// Seeded random streams for the eco layer.
//
// The eco layer never uses the global random generator: rendering and the
// simulation share that one (see HANDOFF.md, risk 2), so any extra draw there
// would shift the economy's random path. Every eco domain gets its own sfc32
// stream instead. A stream is a plain array of four uint32 numbers, so it can
// be stored in the save as it is and continued exactly after a reload.
// Drawing from one stream never changes the sequence of another.

// Stream names, one per domain. Adding a name never changes existing streams
// (each stream is seeded from the game seed and its own name only).
export const STREAMS = ['catch', 'weather', 'market', 'contracts', 'events', 'damage'];

// 32-bit FNV-1a hash of a string.
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

// splitmix32: spreads one seed into well-mixed words for the stream state.
function splitmix(x) {
  x = (x + 0x9e3779b9) >>> 0;
  let z = x;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  return [x, (z ^ (z >>> 16)) >>> 0];
}

// New stream state for (seed, name).
export function createStream(seed, name) {
  let x = ((seed >>> 0) ^ hashStr(String(name))) >>> 0;
  const st = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) { const r = splitmix(x); x = r[0]; st[i] = r[1]; }
  if ((st[0] | st[1] | st[2] | st[3]) === 0) st[3] = 1;   // sfc32 must not start at all zeros
  for (let i = 0; i < 12; i++) nextU32(st);                // warm-up
  return st;
}

// One stream per name in STREAMS.
export function createStreams(seed) {
  const o = {};
  for (const n of STREAMS) o[n] = createStream(seed, n);
  return o;
}

// sfc32 step; mutates the state in place, returns a uint32.
export function nextU32(st) {
  let a = st[0], b = st[1], c = st[2], d = st[3];
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  st[0] = a >>> 0; st[1] = b; st[2] = c; st[3] = d;
  return t;
}

// Uniform float in [0, 1).
export function float(st) { return nextU32(st) / 4294967296; }

// Uniform integer in [0, n).
export function int(st, n) { return Math.floor(float(st) * n); }

// Standard normal (Box-Muller; uses two draws).
export function normal(st) {
  const u = 1 - float(st), v = float(st);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Copy of a stream state (for saving or comparing).
export function cloneStream(st) { return st.slice(0, 4); }
