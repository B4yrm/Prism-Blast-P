// Eco save subtree: ecoFresh, migrateEco, reconcile, initEco.
//   node --test tests/eco/state.test.mjs
// Loads src/eco/state-eco.js and src/core/state.js through the esbuild helper (tests/eco/_load.cjs),
// like the other eco tests. Nothing in src/ is modified by these tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { bundle, fresh } = require('./_load.cjs');
const E = fresh(bundle('state-eco', `
export * from './eco/state-eco.js';
export { createStream, STREAMS } from './eco/rng.js';
export { fresh as freshSave, SAVE_VERSION } from './core/state.js';
`));
const FIX = name => JSON.parse(require('fs').readFileSync(new URL(`../fixtures/save-${name}.json`, import.meta.url), 'utf8'));

const clone = o => JSON.parse(JSON.stringify(o));
const withoutEco = S => { const c = clone(S); delete c.eco; delete c.ecoBak; return c; };
const isU32 = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;

// Every invariant a usable S.eco must satisfy.
function assertValid(S, where = '') {
  const e = S.eco;
  assert.equal(e.v, E.ECO_SCHEMA, where + ' v');
  assert.ok(isU32(e.seed), where + ' seed');
  assert.ok(Number.isFinite(e.clock.acc) && e.clock.acc >= 0 && e.clock.acc < 60, where + ' clock.acc');
  assert.ok(Number.isInteger(e.clock.hours) && e.clock.hours >= 0, where + ' clock.hours');
  for (const n of E.STREAMS) { const st = e.rng[n]; assert.ok(Array.isArray(st) && st.length === 4 && st.every(isU32) && st.some(x => x), where + ' rng.' + n); }
  for (const [key, locs, len] of [['mix', E.MIX_LOCS, 5], ['pmix', E.PMIX_LOCS, 5]]) for (const l of locs) {
    const a = e[key][l];
    assert.ok(Array.isArray(a) && a.length === len, `${where} ${key}.${l} length`);
    assert.ok(a.every(x => Number.isFinite(x) && x >= 0), `${where} ${key}.${l} values ${JSON.stringify(a)}`);
    assert.ok(Math.abs(a.reduce((s, x) => s + x, 0) - 1) < 1e-9, `${where} ${key}.${l} sum`);
  }
  for (const l of E.Q_LOCS) assert.ok(Number.isFinite(e.q[l]) && e.q[l] >= 0 && e.q[l] <= 1, `${where} q.${l}`);
  for (const v of Object.values(e.flags)) assert.ok(v === 0 || v === 1, where + ' flags');
  // the result survives JSON (what the save stores) unchanged
  assert.deepEqual(clone(e), e, where + ' JSON-safe');
}

function save(name = 'mid') { const S = FIX(name); return S; }

test('main SAVE_VERSION is still 1; schema constants', () => {
  assert.equal(E.SAVE_VERSION, 1);
  assert.equal(E.ECO_SCHEMA, 1);
  assert.equal(E.SPECIES.length, 5); assert.equal(E.PRODUCTS.length, 5);
  assert.ok(Math.abs(E.REF_MIX.reduce((a, b) => a + b, 0) - 1) < 1e-12);
});

test('ecoFresh: deterministic per save, valid, streams seeded from the save', () => {
  const S = save('mid'), a = E.ecoFresh(S), b = E.ecoFresh(clone(S));
  assert.deepEqual(a, b);
  assert.equal(a.seed, E.seedFor(S));
  for (const n of E.STREAMS) assert.deepEqual(a.rng[n], E.createStream(a.seed, n));
  assert.notEqual(E.seedFor({ created: 1 }), E.seedFor({ created: 2 }));
  assert.equal(E.seedFor({ created: NaN }), E.seedFor({}));
  S.eco = a; E.reconcile(S); assertValid(S, 'fresh');
});

for (const name of ['new', 'mid', 'max']) {
  test(`fixture ${name}: no S.eco → fresh; nothing outside S.eco changes; empty places get the reference mix`, () => {
    const S = save(name), before = clone(S);
    const r = E.initEco(S);
    assert.equal(r.status, 'fresh'); assert.equal(r.usable, true);
    assertValid(S, name);
    assert.deepEqual(withoutEco(S), before);
    assert.equal(S.ecoBak, undefined);
    for (const l of E.MIX_LOCS) if (!S.stock[l]) assert.deepEqual(S.eco.mix[l], E.REF_MIX);
    for (const l of E.Q_LOCS) assert.equal(S.eco.q[l], S.stock[l] > 0 ? E.Q_DEFAULT : E.Q_EMPTY, 'q.' + l);
  });
}

test('S.eco = null → fresh (reason recorded), no backup', () => {
  const S = save(); S.eco = null; const before = withoutEco(S);
  const r = E.initEco(S);
  assert.equal(r.status, 'fresh'); assert.match(r.reason, /null/); assertValid(S); assert.deepEqual(withoutEco(S), before); assert.equal(S.ecoBak, undefined);
});

test('initialisation is idempotent: second and later calls change nothing', () => {
  for (const name of ['new', 'mid', 'max']) {
    const S = save(name); E.initEco(S); const once = clone(S);
    for (let i = 0; i < 5; i++) { const r = E.initEco(S); assert.equal(r.status, 'ok'); assert.deepEqual(r.repairs, []); }
    assert.deepEqual(clone(S), once);
  }
});

test('old build round trip (JSON, unknown keys kept) → status ok, S.eco unchanged', () => {
  const S = save(); E.initEco(S);
  S.eco.mix.wh = [0.2, 0.3, 0.1, 0.25, 0.15]; S.eco.q.wh = 0.42; S.eco.clock = { acc: 12.5, hours: 77 }; S.eco.flags = { species: 1 };
  E.reconcile(S); const eco = clone(S.eco);
  const back = JSON.parse(JSON.stringify(S));       // what an older build writes back
  const r = E.initEco(back);
  assert.equal(r.status, 'ok'); assert.deepEqual(back.eco, eco);
});

test('partial S.eco ({ v: 1 }) is filled, not reset; extra keys of the same schema are kept', () => {
  const S = save(); S.eco = { v: 1, seed: 12345, futureField: { keep: [1, 2] } }; const before = withoutEco(S);
  const r = E.initEco(S);
  assert.equal(r.status, 'repaired'); assert.ok(r.repairs.length >= 5);
  assertValid(S); assert.equal(S.eco.seed, 12345); assert.deepEqual(S.eco.futureField, { keep: [1, 2] });
  for (const n of E.STREAMS) assert.deepEqual(S.eco.rng[n], E.createStream(12345, n));
  assert.deepEqual(withoutEco(S), before);
});

test('bad numbers are repaired field by field (NaN, Infinity, negative, null from JSON, wrong lengths)', () => {
  const S = save('mid'); E.initEco(S);
  const e = S.eco;
  e.mix.quay = [NaN, 0.5, 0.5, 0, 0];          // NaN → reference
  e.mix.wh = [2, 2, 0, 0, 0];                   // sum 4 → normalized, proportions kept
  e.mix.mRaw = [0.5, 0.5, 0];                   // wrong length → reference
  e.pmix.facOut = [Infinity, 0, 0, 0, 0];
  e.pmix.mProd = [-1, 1, 1, 0, 0];              // negative → reference
  e.q.quay = 1.7; e.q.wh = -0.2; e.q.facOut = NaN; e.q.mRaw = null; e.q.mProd = 'x';
  e.clock = { acc: 75, hours: 3.7 };
  e.rng.weather = [0, 0, 0, 0]; e.rng.market = [1, 2, 3]; e.rng.events = [1, 2, 3, -4]; e.rng.damage = [1, 2, 3, 2 ** 32];
  e.seed = -1; e.flags = { species: 2, market: 1 };
  const before = withoutEco(S), r = E.initEco(S);
  assert.equal(r.status, 'repaired');
  assertValid(S);
  assert.deepEqual(S.eco.mix.quay, E.REF_MIX); assert.deepEqual(S.eco.mix.wh, [0.5, 0.5, 0, 0, 0]); assert.deepEqual(S.eco.mix.mRaw, E.REF_MIX);
  assert.deepEqual(S.eco.pmix.facOut, E.REF_PMIX); assert.deepEqual(S.eco.pmix.mProd, E.REF_PMIX);
  assert.equal(S.eco.q.quay, 1); assert.equal(S.eco.q.wh, 0); assert.equal(S.eco.q.facOut, E.Q_DEFAULT); assert.equal(S.eco.q.mRaw, E.Q_DEFAULT); assert.equal(S.eco.q.mProd, E.Q_DEFAULT);
  assert.deepEqual(S.eco.clock, { acc: 0, hours: 3 });
  assert.equal(S.eco.seed, E.seedFor(S)); assert.deepEqual(S.eco.flags, { species: 0, market: 1 });
  assert.deepEqual(withoutEco(S), before);
  assert.deepEqual(E.reconcile(S), []);
});

test('the same corruptions after a JSON round trip (NaN / Infinity become null in the save)', () => {
  const S = save('mid'); E.initEco(S);
  Object.assign(S.eco.q, { quay: NaN, wh: Infinity, facOut: -Infinity }); S.eco.mix.wh = [NaN, 1, 0, 0, 0]; S.eco.clock.acc = Infinity;
  const J = JSON.parse(JSON.stringify(S));       // nulls now
  assert.equal(J.eco.q.quay, null);
  const r = E.initEco(J);
  assert.equal(r.status, 'repaired'); assertValid(J); assert.deepEqual(withoutEco(J), withoutEco(S));
});

test('empty places: reference mix and Q_EMPTY; places with stock keep their own mix', () => {
  const S = save('mid'); E.initEco(S);
  S.eco.mix.wh = [0.1, 0.2, 0.3, 0.2, 0.2]; S.eco.mix.quay = [0.1, 0.2, 0.3, 0.2, 0.2]; S.eco.q.quay = 0.3;
  S.stock.quay = 0;                              // e.g. emptied while an older build was played
  const r = E.reconcile(S);
  assert.deepEqual(S.eco.mix.quay, E.REF_MIX); assert.equal(S.eco.q.quay, E.Q_EMPTY);
  assert.deepEqual(S.eco.mix.wh, [0.1, 0.2, 0.3, 0.2, 0.2]);
  assert.ok(r.some(x => x.startsWith('mix.quay')));
  assert.deepEqual(E.reconcile(S), []);
});

test('unreadable S.eco → backup in S.ecoBak (value preserved), new S.eco, progress untouched', () => {
  const cases = ['garbage', 42, true, [], [1, 2], { v: '1' }, { v: 0 }, { v: -3 }, { v: 1.5 }, { v: null, mix: 1 }, { mix: {} }];
  for (const bad of cases) {
    const S = save('max'); S.eco = clone(bad); const before = withoutEco(S);
    const r = E.initEco(S);
    assert.equal(r.status, 'recovered', JSON.stringify(bad)); assert.equal(r.usable, true);
    assertValid(S, JSON.stringify(bad));
    assert.deepEqual(S.ecoBak.value, bad); assert.ok(S.ecoBak.reason.length > 0);
    assert.deepEqual(withoutEco(S), before);
    assert.equal(E.initEco(S).status, 'ok');     // and stable afterwards
  }
});

test('a very large unreadable value is not backed up, and the reason says so', () => {
  const S = save(); S.eco = 'x'.repeat(30000);
  const r = E.initEco(S);
  assert.equal(r.status, 'recovered'); assert.match(r.reason, /not backed up/); assert.equal(S.ecoBak, undefined); assertValid(S);
});

test('S.eco from a newer build (v > schema) is left exactly as it is; eco not usable', () => {
  for (const v of [2, 7, 999]) {
    const future = { v, mix: 'new format', q: { quay: NaN }, rng: [1], whatever: { deep: [1, { x: 2 }] } };
    const S = save(); S.eco = future; const ref = S.eco, before = withoutEco(S), snap = JSON.stringify(future);
    for (let i = 0; i < 3; i++) {
      const r = E.initEco(S);
      assert.equal(r.status, 'future'); assert.equal(r.usable, false); assert.equal(r.v, v); assert.match(r.reason, /newer/);
    }
    assert.equal(S.eco, ref); assert.equal(JSON.stringify(S.eco), snap); assert.ok(Number.isNaN(S.eco.q.quay));
    assert.equal(S.ecoBak, undefined); assert.deepEqual(withoutEco(S), before);
  }
});

test('migrateEco: chain mechanics (temporary test migration), missing step → null', () => {
  assert.deepEqual(E.migrateEco({ v: 1, a: 1 }), { eco: { v: 1, a: 1 }, from: 1, steps: 0 });
  E.MIGRATIONS[0] = e => ({ ...e, v: 1, added: true });
  try { assert.deepEqual(E.migrateEco({ v: 0, a: 1 }), { eco: { v: 1, a: 1, added: true }, from: 0, steps: 1 }); }
  finally { delete E.MIGRATIONS[0]; }
  assert.equal(E.migrateEco({ v: 0 }), null);
  assert.deepEqual(Object.keys(E.MIGRATIONS), []);
});

test('initEco without a save object does nothing', () => {
  for (const x of [null, undefined, 3, 'S']) assert.equal(E.initEco(x).status, 'no-save');
});

test('fuzz: 3000 random corruptions → valid, idempotent, nothing outside S.eco changes', () => {
  let seed = 20261115; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
  const POOL = [NaN, Infinity, -Infinity, -1, 0, 1, 0.5, 2, 1e308, -0, null, undefined, 'x', '', [], {}, [1, 2, 3], [0, 0, 0, 0, 0], [1, 1, 1, 1, 1], true, 2 ** 32, 3.5];
  const PATHS = [['seed'], ['clock'], ['clock', 'acc'], ['clock', 'hours'], ['rng'], ['flags'], ['flags', 'x'], ['mix'], ['pmix'], ['q'],
    ...E.STREAMS.map(n => ['rng', n]), ...E.STREAMS.map(n => ['rng', n, 2]),
    ...E.MIX_LOCS.map(l => ['mix', l]), ...E.MIX_LOCS.map(l => ['mix', l, 1]), ...E.PMIX_LOCS.map(l => ['pmix', l]), ...E.PMIX_LOCS.map(l => ['pmix', l, 0]), ...E.Q_LOCS.map(l => ['q', l])];
  const names = ['new', 'mid', 'max'];
  for (let i = 0; i < 3000; i++) {
    const S = save(names[i % 3]); E.initEco(S);
    for (let k = 0, n = 1 + rnd(4); k < n; k++) {
      const p = PATHS[rnd(PATHS.length)]; let o = S.eco;
      for (let j = 0; j < p.length - 1 && o && typeof o === 'object'; j++) o = o[p[j]];
      // a fresh copy every time (a shared pool object would carry mutations from case to case); NaN, ±Infinity,
      // -0 and undefined do not survive clone(), so those are assigned as they are (they are primitives)
      if (o && typeof o === 'object') { const v = POOL[rnd(POOL.length)]; o[p[p.length - 1]] = v !== null && typeof v === 'object' ? clone(v) : v; }
    }
    if (i % 2) { const J = JSON.parse(JSON.stringify(S)); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, J); }
    const before = withoutEco(S), r = E.initEco(S);
    assert.ok(r.usable, 'case ' + i);
    assertValid(S, 'case ' + i);
    assert.deepEqual(withoutEco(S), before, 'case ' + i);
    const once = clone(S.eco);
    assert.deepEqual(E.reconcile(S), [], 'case ' + i + ' idempotent');
    assert.deepEqual(S.eco, once);
  }
});

test('fixture files are unchanged by the tests', () => {
  const crypto = require('crypto'), fs = require('fs');
  const sums = fs.readFileSync(new URL('../fixtures/fixtures.sha256', import.meta.url), 'utf8').trim().split('\n').map(l => l.split(/\s+/));
  for (const [h, f] of sums) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../fixtures/' + f, import.meta.url))).digest('hex'), h, f);
});
