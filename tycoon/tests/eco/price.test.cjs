// Species prices, unit level: base multipliers, normalisation, the limit, robustness.
//   node --test tests/eco/price.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { bundle, fresh } = require('./_load.cjs');
const P = fresh(bundle('price-unit', `
export * from './eco/price.js';
export { REF_MIX } from './eco/state-eco.js';
export { CATCH_WEIGHTS } from './eco/defs-eco.js';
`));
const close = (a, b, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('base multipliers are the GDD values; the normalisation is the value of the reference start mix (0.785)', () => {
  assert.deepEqual(P.BASE_PRICE, [0.6, 0.9, 1.4, 2.0, 3.5]);
  close(P.PRICE_NORM, 0.55 * 0.6 + 0.35 * 0.9 + 0.10 * 1.4, 1e-15);
  close(P.PRICE_NORM, 0.785, 1e-15);
  assert.equal(P.FACTOR_MIN, 0.4); assert.equal(P.FACTOR_MAX, 2.5);
});

test('the reference start mix has factor exactly 1 (as shares and as quantities)', () => {
  assert.equal(P.priceFactor(P.REF_MIX), 1);
  assert.equal(P.priceFactor(P.CATCH_WEIGHTS[1]), 1);
  for (const k of [1, 3, 40, 1234.5]) close(P.priceFactor(P.REF_MIX.map(x => x * k)), 1, 1e-15);
});

test('each species alone: base / 0.785, limited to [0.4, 2.5]', () => {
  const f = P.speciesFactors();
  const want = [0.6, 0.9, 1.4, 2.0, 3.5].map(b => b / 0.785);
  f.forEach((x, i) => close(x.raw, want[i], 1e-12));
  close(f[0].factor, 0.7643312101910829); close(f[1].factor, 1.1464968152866242); close(f[2].factor, 1.7834394904458597);
  assert.equal(f[3].factor, 2.5); assert.equal(f[4].factor, 2.5);                     // salmon 2.548 and tuna 4.459 are limited
  // the species keep their order
  for (let i = 1; i < 5; i++) assert.ok(f[i].raw > f[i - 1].raw);
});

test('below the limit the factor is linear in the shares: Σ share × base / 0.785', () => {
  let s = 99; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 5000; n++) {
    const m = [rnd(), rnd(), rnd(), rnd() * 0.3, rnd() * 0.2], t = m.reduce((a, b) => a + b, 0);
    const lin = m.reduce((a, x, i) => a + x / t * P.BASE_PRICE[i], 0) / 0.785;
    if (lin < 2.5 && lin > 0.4) close(P.priceFactor(m), lin, 1e-12);
  }
});

test('more of a dearer species raises the factor, more of a cheaper one lowers it', () => {
  const base = [0.55, 0.35, 0.10, 0, 0];
  assert.ok(P.priceFactor([0.55, 0.35, 0.10, 0, 0.05]) > P.priceFactor(base));
  assert.ok(P.priceFactor([0.55, 0.35, 0.10, 0.05, 0]) > P.priceFactor(base));
  assert.ok(P.priceFactor([0.65, 0.35, 0.10, 0, 0]) < P.priceFactor(base));
});

test('the tier mixes of the catch weights (placeholders for tiers 2 and 3)', () => {
  assert.equal(P.priceFactor(P.CATCH_WEIGHTS[1]), 1);
  close(P.priceFactor(P.CATCH_WEIGHTS[2]), (0.5 * 0.6 + 0.3 * 0.9 + 0.12 * 1.4 + 0.08 * 2.0) / 0.785);
  close(P.priceFactor(P.CATCH_WEIGHTS[3]), (0.45 * 0.6 + 0.27 * 0.9 + 0.12 * 1.4 + 0.10 * 2.0 + 0.06 * 3.5) / 0.785);
  assert.ok(Math.abs(P.priceFactor(P.CATCH_WEIGHTS[2]) - 1.1439) < 1e-4 && Math.abs(P.priceFactor(P.CATCH_WEIGHTS[3]) - 1.3898) < 1e-4);
});

test('never NaN, Infinity, zero or negative: 200,000 random inputs, bad input gives exactly 1', () => {
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const POOL = [NaN, Infinity, -Infinity, -1, -0, 0, 1e-300, 1e300, null, undefined, 'x', {}, [], 0.5, 3];
  for (let n = 0; n < 200000; n++) {
    let m;
    const k = n % 6;
    if (k === 0) m = Array.from({ length: 5 }, () => POOL[Math.floor(rnd() * POOL.length)]);
    else if (k === 1) m = Array.from({ length: Math.floor(rnd() * 8) }, () => rnd());
    else if (k === 2) m = new Float64Array(Array.from({ length: 5 }, () => rnd() * 100));
    else if (k === 3) m = [0, 0, 0, 0, 0];
    else if (k === 4) m = Array.from({ length: 5 }, () => (rnd() < 0.5 ? 0 : rnd() * 1e6));
    else m = [null, undefined, 'mix', 42, {}][Math.floor(rnd() * 5)];
    const f = P.priceFactor(m);
    assert.ok(Number.isFinite(f) && f >= 0.4 && f <= 2.5, `input ${JSON.stringify(m)} → ${f}`);
    const v = P.mixValue(m);
    if (!Number.isFinite(v) || !(v > 0)) assert.equal(f, 1, `unusable input must give 1: ${JSON.stringify(m)}`);
  }
});
