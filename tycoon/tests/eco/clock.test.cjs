// Eco clock: whole game hours depend on simulation time only, not on the frame rate.
//   node --test tests/eco/clock.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const { bundle, fresh } = require('./_load.cjs');
const C = fresh(bundle('clock', "export * from './eco/clock.js';"));

test('one simulated hour at 15, 30, 60 FPS and with irregular steps gives 60 game hours', () => {
  const secs = 3600;
  for (const steps of [15, 30, 60]) {
    const c = C.createClock(); let calls = 0;
    for (let i = 0; i < secs * steps; i++) C.advance(c, 1 / steps, () => calls++);
    assert.equal(c.hours, 60, steps + ' fps'); assert.equal(calls, 60);
    assert.ok(c.acc < 1e-6 || Math.abs(c.acc - C.HOUR_SEC) < 1e-6, 'acc ' + c.acc);
  }
  const c = C.createClock(); let t = 0, k = 0;
  while (t < secs - 1e-9) { const dt = Math.min([0.016, 0.1, 0.033, 0.05, 0.0083][k++ % 5], secs - t); C.advance(c, dt); t += dt; }
  assert.equal(c.hours, 60, 'irregular steps, acc ' + c.acc);
});

test('onHour receives consecutive hour numbers; one big step completes several hours', () => {
  const c = C.createClock(), got = [];
  assert.equal(C.advance(c, 150, h => got.push(h)), 2);
  assert.deepEqual(got, [1, 2]); assert.equal(c.acc, 30);
});

test('dt that is not a finite positive number is ignored', () => {
  const c = C.createClock();
  for (const dt of [0, -1, NaN, Infinity, -Infinity, undefined, null]) assert.equal(C.advance(c, dt), 0);
  assert.deepEqual(c, { acc: 0, hours: 0 });
});

test('day, hour of day, season and year', () => {
  assert.equal(C.dayOf(23), 0); assert.equal(C.dayOf(24), 1); assert.equal(C.hourOfDay(25), 1);
  assert.equal(C.seasonOf(0), 'spring'); assert.equal(C.seasonOf(7 * 24), 'summer');
  assert.equal(C.seasonOf(27 * 24 + 23), 'winter'); assert.equal(C.seasonOf(28 * 24), 'spring'); assert.equal(C.yearOf(28 * 24), 1);
});
