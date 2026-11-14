// Eco RNG: determinism, stream independence, save round trip, distribution.
//   node --test tests/eco/rng.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { bundle, fresh } = require('./_load.cjs');
const R = fresh(bundle('rng', "export * from './eco/rng.js';"));

const draw = (st, n) => Array.from({ length: n }, () => R.nextU32(st));

// Independent reference: a line-by-line port of the original sfc32 from PractRand (C):
//   tmp = a + b + counter++; a = b ^ (b >> 9); b = c + (c << 3); c = ((c << 21) | (c >> 11)) + tmp; return tmp;
// (counter++ adds the counter's value BEFORE the increment; some JS ports add it after, which is a different generator.)
function sfc32ref(a, b, c, counter) {
  const u = x => x >>> 0;
  return () => {
    const tmp = u(u(a + b) + counter); counter = u(counter + 1);
    a = u(b ^ (b >>> 9)); b = u(c + u(c << 3)); c = u(u((c << 21) | (c >>> 11)) + tmp);
    return tmp;
  };
}

test('sfc32 step matches the reference implementation', () => {
  for (const st0 of [[1, 2, 3, 4], [0xdeadbeef, 0x12345678, 0x9abcdef0, 7], R.createStream(99, 'catch')]) {
    const st = st0.slice(), ref = sfc32ref(...st0);
    for (let i = 0; i < 1000; i++) assert.equal(R.nextU32(st), ref());
  }
});

test('fixed vector: seeding scheme is stable (saves will depend on it)', () => {
  assert.deepEqual(draw(R.createStream(1, 'market'), 5), [2970592857, 2103420834, 3462020065, 3080704565, 3722175461]);
});

test('same seed gives the same sequence in every stream', () => {
  const a = R.createStreams(42), b = R.createStreams(42);
  for (const n of R.STREAMS) assert.deepEqual(draw(a[n], 10000), draw(b[n], 10000), n);
});

test('different seeds give different sequences', () => {
  for (const n of R.STREAMS) assert.notDeepEqual(draw(R.createStream(1, n), 50), draw(R.createStream(2, n), 50));
});

test('streams differ from each other and share no values in their first 1000 draws', () => {
  const s = R.createStreams(7), seen = new Map();
  for (const n of R.STREAMS) for (const v of draw(s[n], 1000)) {
    if (seen.has(v) && seen.get(v) !== n) assert.fail(`value ${v} in ${n} and ${seen.get(v)}`);
    seen.set(v, n);
  }
});

test('drawing from one stream never changes another (any interleaving)', () => {
  const ref = draw(R.createStreams(5).weather, 500);
  const s = R.createStreams(5), got = [];
  for (let i = 0; i < 500; i++) {
    for (let k = 0; k < (i % 7); k++) R.nextU32(s.market);   // irregular extra draws elsewhere
    if (i % 3 === 0) R.normal(s.events);
    got.push(R.nextU32(s.weather));
  }
  assert.deepEqual(got, ref);
});

test('a stream created alone equals the same stream in the set (adding names is safe)', () => {
  for (const n of R.STREAMS) assert.deepEqual(R.createStream(123, n), R.createStreams(123)[n]);
});

test('state survives a JSON round trip mid-sequence', () => {
  const a = R.createStream(9, 'contracts'); draw(a, 777);
  const b = JSON.parse(JSON.stringify(R.cloneStream(a)));
  assert.deepEqual(draw(a, 1000), draw(b, 1000));
});

test('state is never all zeros and stays uint32', () => {
  for (let seed = 0; seed < 200; seed++) for (const n of R.STREAMS) {
    const st = R.createStream(seed, n);
    assert.ok(st.some(x => x !== 0));
    for (const x of st) assert.ok(Number.isInteger(x) && x >= 0 && x < 2 ** 32);
  }
});

test('float is uniform in [0,1): mean and 10-bucket chi-square', () => {
  const st = R.createStream(2024, 'damage'), N = 100000, buckets = new Array(10).fill(0);
  let sum = 0;
  for (let i = 0; i < N; i++) { const f = R.float(st); assert.ok(f >= 0 && f < 1); sum += f; buckets[Math.floor(f * 10)]++; }
  assert.ok(Math.abs(sum / N - 0.5) < 0.005, 'mean ' + sum / N);
  const chi = buckets.reduce((a, o) => a + (o - N / 10) ** 2 / (N / 10), 0);
  assert.ok(chi < 30, 'chi2 ' + chi);   // df 9: p ≈ 0.0004
});

test('int covers [0,n) only; normal has mean ≈ 0 and variance ≈ 1', () => {
  const st = R.createStream(3, 'events'), seen = new Set();
  for (let i = 0; i < 5000; i++) { const k = R.int(st, 6); assert.ok(k >= 0 && k < 6 && Number.isInteger(k)); seen.add(k); }
  assert.equal(seen.size, 6);
  let s = 0, s2 = 0; const N = 50000;
  for (let i = 0; i < N; i++) { const z = R.normal(st); assert.ok(Number.isFinite(z)); s += z; s2 += z * z; }
  assert.ok(Math.abs(s / N) < 0.02 && Math.abs(s2 / N - 1) < 0.03, `mean ${s / N} var ${s2 / N}`);
});
