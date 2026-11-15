// Shared scenarios and helpers for the Node tests that drive the real Sim (same scenarios as tests/workers-regress.cjs).
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const STRONG = { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 };
const T1 = { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 };
const MID = { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 };

const SCEN = {
  start: { name: 'start: 1 boat, 1 hauler, no factory', boats: 1, workers: 1, tier: T1, up: {}, secs: 600 },
  mid: { name: 'mid: 4 boats, 6 haulers, factory', boats: 4, workers: 6, tier: MID, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 600 },
  high: { name: 'high warehouse level, 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } }, secs: 600 },
  max: { name: 'max 30/30, loop berths, 10 haulers', boats: 4, workers: 10, tier: STRONG, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } }, outer: 2, secs: 600 },
  // no haulers: the quay fills up, boats unload only what fits and wait with the rest aboard
  nohaul: { name: 'no haulers: full quay, partial unloads', boats: 4, workers: 0, tier: { ...MID, factory: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, secs: 400 },
};

// A save for a scenario. The save's creation time is fixed so that S.eco's seed (and every eco random stream) is the same on every run.
function buildSave(freshSave, cfg) {
  const S = freshSave();
  Object.assign(S, { money: 500, boats: cfg.boats, workers: cfg.workers, level: 12, harborOuter: cfg.outer || 0, created: 1700000000000, lastSeen: 1700000000000 });
  S.tier = { ...cfg.tier };
  for (const b of Object.keys(cfg.up || {})) S.up[b] = { ...S.up[b], ...cfg.up[b] };
  S.stats.caught = 5; S.stats.sold = 5;
  return S;
}

// Seeded replacement for the global random generator (as in the other tests); returns { restore, calls }.
function seedRandom(seed = 4242) {
  const real = Math.random, st = { calls: 0 };
  let s = seed;
  Math.random = () => { st.calls++; return (s = (s * 16807) % 2147483647) / 2147483647; };
  st.restore = () => { Math.random = real; };
  return st;
}

// The simulation's complete visible state, for exact comparisons between runs.
function simState(sim) {
  const S = sim.S;
  return JSON.stringify([S.money, S.register, S.stock, S.stats, S.xp, S.level,
    sim.workers.map(w => [w.state, w.m.x, w.m.y, w.t, w.carry, w.kind, w.job && [w.job.src, w.job.dst, w.job.n]]),
    sim.boats.map(b => [b.state, b.load, b.m.x, b.m.y, b.t, b.cap, b.blocked]),
    sim.customers.length, sim.convey.length, sim.res, sim.inc]);
}

module.exports = { SCEN, MAXUP, STRONG, MID, T1, buildSave, seedRandom, simState };
