// Eco save subtree: S.eco (ECONOMY-ARCHITECTURE.md §7, decision Q3, conditional).
//
// The main save keeps SAVE_VERSION = 1 and is never touched here except for the
// S.eco key (and S.ecoBak, a backup of an unreadable S.eco). Older builds keep
// unknown keys (deepFill in core/state.js does not delete them and save() writes
// the whole state), so S.eco survives a round trip through an older build.
//
// S.eco has its own schema version (S.eco.v) and migration chain. Rules:
//   • missing or null S.eco             → a new one (ecoFresh)
//   • S.eco is not a plain object, or v is not a positive integer
//                                       → unreadable: the old value is kept in S.ecoBak, a new one is made
//   • v > ECO_SCHEMA (made by a newer build)
//                                       → left exactly as it is; the eco layer stays off for the session
//   • v < ECO_SCHEMA                    → migrated step by step (MIGRATIONS)
//   • v = ECO_SCHEMA                    → missing fields filled, bad values repaired (reconcile)
// New fields of a later task are added as defaults (fill) without a version bump;
// v is raised only when the meaning of stored data changes.
//
// Pure functions: no Phaser, no DOM, no game modules. T1.2: the data has no
// effect on the economy (no system reads it yet).

import { createStream, hashStr, STREAMS } from './rng.js';
import { HOUR_SEC } from './clock.js';

export const ECO_SCHEMA = 1;
export const SPECIES = ['sardine', 'mackerel', 'seabass', 'salmon', 'tuna'];
export const PRODUCTS = ['canned', 'fillet', 'smoked', 'steak', 'meal'];
export const MIX_LOCS = ['quay', 'wh', 'mRaw'];          // raw fish: species shares
export const PMIX_LOCS = ['facOut', 'mProd'];            // products: product shares (recipes, not active yet)
export const OMIX_LOCS = ['facOut', 'mProd'];            // processed units: species shares of the fish they were made from (T1.3)
export const Q_LOCS = ['quay', 'wh', 'facOut', 'mRaw', 'mProd'];
// Reference start mix (GDD §3.1, balance assumption): sardine 55 %, mackerel 35 %, sea bass 10 %.
export const REF_MIX = [0.55, 0.35, 0.10, 0, 0];
export const REF_PMIX = [1, 0, 0, 0, 0];                 // the factory starts with canned goods
export const Q_DEFAULT = 0.8;                            // quality given to stock that existed before eco
export const Q_EMPTY = 1;                                // quality of an empty place (the next fish in is fresh)
const BACKUP_MAX_CHARS = 20000;                          // larger unreadable values are not backed up
const SUM_EPS = 1e-9;

// Each migration upgrades S.eco from version k to k + 1. None yet (v1 is the first schema).
export const MIGRATIONS = {};

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isU32 = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
const finite = x => typeof x === 'number' && Number.isFinite(x);

// Game seed for the eco RNG streams: derived from the save's creation time, so the
// same save always gets the same seed.
export function seedFor(S) {
  const c = S && finite(S.created) ? Math.floor(S.created) : 0;
  return hashStr('fishingTycoon.eco:' + c);
}

export function ecoFresh(S) {
  const seed = seedFor(S), rng = {};
  for (const n of STREAMS) rng[n] = createStream(seed, n);
  const mix = {}, pmix = {}, omix = {}, q = {};
  for (const l of MIX_LOCS) mix[l] = REF_MIX.slice();
  for (const l of PMIX_LOCS) pmix[l] = REF_PMIX.slice();
  for (const l of OMIX_LOCS) omix[l] = REF_MIX.slice();
  for (const l of Q_LOCS) q[l] = Q_DEFAULT;
  return { v: ECO_SCHEMA, seed, clock: { acc: 0, hours: 0 }, rng, mix, pmix, omix, q, flags: {} };
}

// Upgrades an older S.eco. Returns { eco, from, steps } or null when a step is missing.
export function migrateEco(eco) {
  const from = eco.v;
  let steps = 0;
  while (eco.v < ECO_SCHEMA) {
    const m = MIGRATIONS[eco.v];
    if (!m) return null;
    eco = m(eco); steps++;
  }
  return { eco, from, steps };
}

// Repairs one share vector in place. Returns a repair note or ''.
function fixShares(arr, ref, len, empty) {
  if (empty) {
    if (!sameArr(arr, ref)) { setArr(arr, ref); return 'empty place: reference mix'; }
    return '';
  }
  let sum = 0, bad = false;
  for (let i = 0; i < len; i++) { const x = arr[i]; if (!finite(x) || x < 0) { bad = true; break; } sum += x; }
  if (bad || !(sum > 0)) { setArr(arr, ref); return 'invalid values: reference mix'; }
  if (Math.abs(sum - 1) > SUM_EPS) { for (let i = 0; i < len; i++) arr[i] /= sum; return 'normalized'; }
  return '';
}
const sameArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
function setArr(a, b) { a.length = 0; for (const x of b) a.push(x); }
const stockOf = (S, loc) => (S && isObj(S.stock) && finite(S.stock[loc]) ? S.stock[loc] : 0);

// Brings S.eco (schema v = ECO_SCHEMA) into a valid state, in place. Never touches
// anything outside S.eco. Running it again on its own output changes nothing.
// Returns the list of repairs made (empty when nothing had to change).
export function reconcile(S) {
  const eco = S.eco, fx = [], fresh = ecoFresh(S);
  const note = (path, what) => fx.push(path + ': ' + what);

  if (!isU32(eco.seed)) { eco.seed = fresh.seed; note('seed', 'reset from the save'); }

  if (!isObj(eco.clock)) { eco.clock = { acc: 0, hours: 0 }; note('clock', 'missing'); }
  else {
    const c = eco.clock;
    if (!finite(c.acc) || c.acc < 0 || c.acc >= HOUR_SEC) { c.acc = 0; note('clock.acc', 'out of range'); }
    if (!finite(c.hours) || c.hours < 0) { c.hours = 0; note('clock.hours', 'out of range'); }
    else if (!Number.isInteger(c.hours)) { c.hours = Math.floor(c.hours); note('clock.hours', 'not whole'); }
  }

  if (!isObj(eco.rng)) { eco.rng = {}; note('rng', 'missing'); }
  for (const n of STREAMS) {
    const st = eco.rng[n];
    if (!Array.isArray(st) || st.length !== 4 || !st.every(isU32) || st.every(x => x === 0)) {
      eco.rng[n] = createStream(eco.seed, n); note('rng.' + n, st === undefined ? 'missing' : 'invalid');
    }
  }

  for (const [key, locs, ref, len] of [['mix', MIX_LOCS, REF_MIX, SPECIES.length], ['pmix', PMIX_LOCS, REF_PMIX, PRODUCTS.length], ['omix', OMIX_LOCS, REF_MIX, SPECIES.length]]) {
    if (!isObj(eco[key])) { eco[key] = {}; note(key, 'missing'); }
    for (const l of locs) {
      const a = eco[key][l];
      if (!Array.isArray(a) || a.length !== len) { eco[key][l] = ref.slice(); note(`${key}.${l}`, a === undefined ? 'missing' : 'wrong length: reference mix'); continue; }
      const r = fixShares(a, ref, len, stockOf(S, l) <= 0);
      if (r) note(`${key}.${l}`, r);
    }
  }

  if (!isObj(eco.q)) { eco.q = {}; note('q', 'missing'); }
  for (const l of Q_LOCS) {
    const x = eco.q[l], empty = stockOf(S, l) <= 0;
    if (empty) { if (x !== Q_EMPTY) { eco.q[l] = Q_EMPTY; note('q.' + l, 'empty place'); } continue; }
    if (!finite(x)) { eco.q[l] = Q_DEFAULT; note('q.' + l, x === undefined ? 'missing' : 'invalid'); }
    else if (x < 0 || x > 1) { eco.q[l] = Math.min(1, Math.max(0, x)); note('q.' + l, 'clamped'); }
  }

  if (!isObj(eco.flags)) { eco.flags = {}; note('flags', 'invalid'); }
  for (const k of Object.keys(eco.flags)) if (eco.flags[k] !== 0 && eco.flags[k] !== 1) { eco.flags[k] = 0; note('flags.' + k, 'invalid: off'); }

  // -0 passes every check above but the save writes it as 0, so the value would not survive
  // a save / load unchanged. Store a plain 0 instead (found by the fuzz test).
  let negZero = 0;
  const z = (o, k) => { if (Object.is(o[k], -0)) { o[k] = 0; negZero++; } };
  z(eco, 'seed'); z(eco.clock, 'acc'); z(eco.clock, 'hours');
  for (const n of STREAMS) for (let i = 0; i < 4; i++) z(eco.rng[n], i);
  for (const l of MIX_LOCS) for (let i = 0; i < SPECIES.length; i++) z(eco.mix[l], i);
  for (const l of PMIX_LOCS) for (let i = 0; i < PRODUCTS.length; i++) z(eco.pmix[l], i);
  for (const l of OMIX_LOCS) for (let i = 0; i < SPECIES.length; i++) z(eco.omix[l], i);
  for (const l of Q_LOCS) z(eco.q, l);
  for (const k of Object.keys(eco.flags)) z(eco.flags, k);
  if (negZero) note('numbers', negZero + ' × -0 stored as 0');

  return fx;
}

// Lazy, idempotent entry: makes S.eco usable or leaves it alone. Never touches
// anything outside S.eco and S.ecoBak. Returns a report:
//   { status: 'fresh' | 'ok' | 'repaired' | 'migrated' | 'recovered' | 'future' | 'no-save', usable, v, repairs, reason }
export function initEco(S) {
  if (!isObj(S)) return { status: 'no-save', usable: false, repairs: [], reason: 'no save' };
  const e = S.eco;

  if (e === undefined || e === null) {
    S.eco = ecoFresh(S); reconcile(S);
    return { status: 'fresh', usable: true, v: ECO_SCHEMA, repairs: [], reason: e === null ? 'S.eco was null' : 'no S.eco' };
  }

  if (!isObj(e) || !Number.isInteger(e.v) || e.v < 1) {
    let bak, reason = !isObj(e) ? 'S.eco is not an object (' + (Array.isArray(e) ? 'array' : typeof e) + ')' : 'S.eco.v is not a positive integer';
    try { bak = JSON.stringify(e); } catch (err) { bak = undefined; }
    if (bak !== undefined && bak.length <= BACKUP_MAX_CHARS) S.ecoBak = { at: S.lastSeen || 0, reason, value: JSON.parse(bak) };
    else reason += ' (too large or not serializable: not backed up)';
    S.eco = ecoFresh(S); reconcile(S);
    return { status: 'recovered', usable: true, v: ECO_SCHEMA, repairs: [], reason };
  }

  if (e.v > ECO_SCHEMA) {
    return { status: 'future', usable: false, v: e.v, repairs: [], reason: `S.eco schema v${e.v} is newer than this build (v${ECO_SCHEMA}); kept unchanged, eco stays off` };
  }

  let status = 'ok', reason = '';
  if (e.v < ECO_SCHEMA) {
    const m = migrateEco(e);
    if (!m) return { status: 'future', usable: false, v: e.v, repairs: [], reason: `no migration from S.eco v${e.v}; kept unchanged, eco stays off` };
    S.eco = m.eco; status = 'migrated'; reason = `v${m.from} → v${ECO_SCHEMA}`;
  }
  const repairs = reconcile(S);
  if (status === 'ok' && repairs.length) status = 'repaired';
  return { status, usable: true, v: ECO_SCHEMA, repairs, reason };
}
