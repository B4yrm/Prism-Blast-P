// Visual boats vs. simulation, over long play (render loop paused, seeded random,
// the game stepped at 30 fps exactly like real frames step it):
//   • no two boats ever overlap, no hull ever touches land / piers / the quay
//   • each boat is back in its slip when the simulation starts unloading
//     (lag of the visual arrival) and leaves when the simulation leaves
//   • no jumps: largest move, turn rate and speed per frame
//   • the simulation itself is unchanged: every boat's out / fishing / back legs last
//     exactly as long as in a run without visual boats (catch and money are shown
//     for information: they vary a little from run to run even without visuals,
//     because the start-up frames run in real time)
//   node tests/boat-sync.cjs [path/to/index.html]   → test-results/boat-sync.json
const { chromium } = require('playwright');
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..');
const FILE = path.resolve(process.argv[2] || path.join(root, 'index.html'));
const bundled = path.join(root, '.preview', 'boatpaths.cjs');
fs.mkdirSync(path.dirname(bundled), { recursive: true });
esbuild.buildSync({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'cjs', outfile: bundled, logLevel: 'error' });
const P = require(bundled);

const SCENARIOS = [
  // maxLag: how late (s) the visual boat may reach its slip after the simulation docked
  { name: 'fleet4', boats: 4, secs: 900, up: {}, maxLag: 1 },
  { name: 'fleet4-upgraded', boats: 4, secs: 600, up: { cap: 6, speed: 10, net: 8 }, maxLag: 1 },
  { name: 'fleet1', boats: 1, secs: 300, up: {}, maxLag: 1 },
  // every harbour upgrade at its maximum (level 30): a trip lasts 6 s in the
  // simulation, faster than a boat can visibly manoeuvre — the visual boat may
  // reach its slip a few seconds after unloading has started
  { name: 'fleet4-maxed', boats: 4, secs: 400, up: { cap: 30, speed: 30, net: 30 }, maxLag: 4.5 },
];

async function run(b, sc, withFleet) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.boats === 4 ? 6 : 2, level: 9, settings: { quality: 'medium' },
      tier: { harbor: sc.boats === 4 ? 3 : 1, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, up: { harbor: { cap: 0, speed: 0, net: 0, ...sc.up } },
      stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
  }, sc);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(([secs, withFleet]) => {
    __game.loop.sleep();
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, dt = 1 / 30;
    // the simulation draws from Math.random; the visuals get their own stream so
    // that both runs (with and without visuals) feed the simulation the same numbers
    const simRandom = rnd;
    let seed2 = 99; const visRandom = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647;
    // splashes are drawn round the visual boat, so they draw from the visual stream too
    const splash = w.splash.bind(w);
    w.splash = b => { const keep = Math.random; Math.random = visRandom; splash(b); Math.random = keep; };
    const traj = [], ev = [];
    const lastS = sim.boats.map(b => b.state), lastV = [];
    let t = 0, holdFrames = 0, cs = [];
    for (let k = 0; k < Math.round(secs / dt); k++) {
      Math.random = simRandom; sim.update(dt);
      Math.random = visRandom; if (withFleet) F.update(t, dt);
      t += dt;
      sim.boats.forEach((b, i) => { if (b.state !== lastS[i]) { ev.push([+t.toFixed(3), i, 's', b.state]); lastS[i] = b.state; } });
      if (withFleet) {
        F.boats.forEach((v, i) => {
          if (v.phase !== lastV[i]) { ev.push([+t.toFixed(3), i, 'v', v.phase]); lastV[i] = v.phase; }
          if (v.hold && !v.__h) ev.push([+t.toFixed(3), i, 'h', v.phase + '/' + (v.plan ? v.plan[Math.min(v.st.leg, v.plan.length - 1)].kind : '')]);
          v.__h = v.hold;
          if (v.hold) holdFrames++;
          if ((v.phase === 'depart' || v.phase === 'return') && k % 15 === 0) cs.push(+v.c.toFixed(2));
        });
        traj.push(F.boats.map(v => [+v.x.toFixed(4), +v.y.toFixed(4), +v.h.toFixed(4), v.phase === 'docked' || v.phase === 'castoff' || v.phase === 'settle' ? 1 : 0]));
      }
      if (k % 200 === 0) { Math.random = simRandom; sim.collect(true); }
    }
    return { traj, ev, holdSecs: +(holdFrames * dt).toFixed(1), cs, caught: sim.S.stats.caught, money: Math.floor(sim.S.money), dt };
  }, [sc.secs, withFleet]);
  r.errs = errs;
  await ctx.close();
  return r;
}

function analyse(sc, r, plain) {
  const out = { scenario: sc.name, seconds: sc.secs, boats: sc.boats, pageErrors: r.errs.slice(0, 3) };
  // 1. simulation untouched: per boat, the set of out / fish / back leg durations
  const legs = run => {
    const L = {};
    for (let i = 0; i < sc.boats; i++) {
      const E = run.ev.filter(e => e[1] === i && e[2] === 's');
      for (let k = 1; k + 1 < E.length; k++) if (E[k][3] !== 'dock') (L[`${i}/${E[k][3]}`] = L[`${i}/${E[k][3]}`] || new Set()).add((E[k + 1][0] - E[k][0]).toFixed(2));
    }
    return Object.fromEntries(Object.entries(L).map(([k, v]) => [k, [...v].sort().join(',')]));
  };
  const lv = legs(r), lp = legs(plain);
  out.simulation = { legDurationsWithVisuals: lv, identicalToRunWithout: JSON.stringify(lv) === JSON.stringify(lp),
    caught: { withVisuals: r.caught, without: plain.caught }, money: { withVisuals: r.money, without: plain.money } };
  // 2. hulls: boat–boat overlap and boat–land contact, every 3rd frame
  const docked = [0, 1, 2, 3].map(P.dockedHull), decor = P.DECOR_BOATS.map(d => P.decorHull(d));
  let overlaps = 0, landHits = 0, decorHits = 0, minGap = Infinity, firstOverlap = null;
  const n = r.traj[0] ? r.traj[0].length : 0;
  for (let f = 0; f < r.traj.length; f += 3) {
    const row = r.traj[f], polys = row.map(([x, y, h]) => P.hullAt(x, y, h));
    for (let i = 0; i < n; i++) {
      const [x, y, h, moored] = row[i];
      if (!moored) {
        const pts = P.hullPoints(x, y, h, 0);
        if (pts.some(([px, py]) => P.solidAt(px, py))) landHits++;
        if (pts.some(([px, py]) => decor.some(d => P.pointInPoly(px, py, d)))) decorHits++;
      }
      for (let j = i + 1; j < n; j++) {
        const [x2, y2] = row[j];
        if (Math.hypot(x - x2, y - y2) > 6) continue;
        const A = P.hullPoints(x, y, h, 0), B = P.hullPoints(...row[j].slice(0, 3), 0);
        const hit = A.some(([px, py]) => P.pointInPoly(px, py, polys[j])) || B.some(([px, py]) => P.pointInPoly(px, py, polys[i]));
        if (hit) { overlaps++; if (!firstOverlap) firstOverlap = { t: +(f * r.dt).toFixed(2), i, j, a: row[i], b: row[j] }; }
        let g = Infinity;
        for (const [ax, ay] of A) for (const [bx, by] of B) g = Math.min(g, Math.hypot(ax - bx, ay - by));
        minGap = Math.min(minGap, hit ? 0 : g);
      }
    }
  }
  out.hulls = { overlapSamples: overlaps, firstOverlap, minGapTiles: +minGap.toFixed(3), landContactSamples: landHits, decorContactSamples: decorHits };
  // 3. smoothness: largest jump, turn rate and speed between frames
  let maxStep = 0, maxYaw = 0;
  for (let f = 1; f < r.traj.length; f++) for (let i = 0; i < n; i++) {
    const [x0, y0, h0] = r.traj[f - 1][i], [x1, y1, h1] = r.traj[f][i];
    maxStep = Math.max(maxStep, Math.hypot(x1 - x0, y1 - y0) / r.dt);
    let d = h1 - h0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    maxYaw = Math.max(maxYaw, Math.abs(d) / r.dt);
  }
  out.motion = { maxSpeedTilesPerS: +maxStep.toFixed(2), maxTurnRateDegPerS: +(maxYaw * 180 / Math.PI).toFixed(1), holdSeconds: r.holdSecs };
  const cs = r.cs.slice().sort((a, b) => a - b), q = k => cs.length ? cs[Math.min(cs.length - 1, Math.floor(cs.length * k))] : null;
  out.cruiseShare = { p10: q(0.1), median: q(0.5), p90: q(0.9), max: cs[cs.length - 1] };
  // 4. sync with the simulation
  const arr = [], dep = [], fishing = [];
  for (let i = 0; i < n; i++) {
    const E = r.ev.filter(e => e[1] === i);
    for (const e of E) {
      if (e[2] === 's' && e[3] === 'dock' && e[0] > 1) {          // simulation arrives → visual 'settle' (in the slip)
        const v = E.filter(x => x[2] === 'v' && x[3] === 'settle').map(x => x[0]);
        const near = v.reduce((best, x) => Math.abs(x - e[0]) < Math.abs(best - e[0]) ? x : best, Infinity);
        if (near !== Infinity && Math.abs(near - e[0]) < 15) arr.push(+(near - e[0]).toFixed(2));
      }
      if (e[2] === 's' && e[3] === 'out') {
        const v = E.filter(x => x[2] === 'v' && x[3] === 'depart').map(x => x[0]);
        const near = v.reduce((best, x) => Math.abs(x - e[0]) < Math.abs(best - e[0]) ? x : best, Infinity);
        if (near !== Infinity && Math.abs(near - e[0]) < 15) dep.push(+(near - e[0]).toFixed(2));
      }
      if (e[2] === 'v' && e[3] === 'fishing') { const nx = E.find(x => x[2] === 'v' && x[0] > e[0] && x[3] !== 'fishing'); if (nx) fishing.push(+(nx[0] - e[0]).toFixed(2)); }
    }
  }
  const stats = a => { const s = a.slice().sort((x, y) => x - y); return { n: s.length, min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1], mean: +(s.reduce((x, y) => x + y, 0) / Math.max(1, s.length)).toFixed(2) }; };
  out.sync = {
    arrivalLagS: stats(arr),          // visual in the slip minus simulation docking (negative = early)
    departureLagS: stats(dep),        // visual starts backing out minus simulation leaving
    towingS: stats(fishing),
    tripsWithoutTowing: r.ev.filter(e => e[2] === 's' && e[3] === 'dock').length - fishing.length,
  };
  // context of arrivals more than 1 s late, for diagnosis
  const late = [];
  for (let i = 0; i < n; i++) {
    const E = r.ev.filter(e => e[1] === i), settles = E.filter(x => x[2] === 'v' && x[3] === 'settle').map(x => x[0]);
    for (const e of E) {
      if (e[2] !== 's' || e[3] !== 'dock' || e[0] <= 1) continue;
      const near = settles.reduce((b, x) => Math.abs(x - e[0]) < Math.abs(b - e[0]) ? x : b, Infinity);
      if (near - e[0] > 1 && near - e[0] < 15) late.push({ boat: i, simDock: e[0], visualIn: near, events: r.ev.filter(x => x[0] > e[0] - 20 && x[0] <= near && (x[1] === i || x[2] === 'h')).map(x => x.join(' ')) });
    }
  }
  out.lateArrivals = late.slice(0, 2);
  out.ok = out.simulation.identicalToRunWithout && overlaps === 0 && landHits === 0 && decorHits === 0 && !r.errs.length && (arr.length ? Math.max(...arr) <= sc.maxLag : true);
  return out;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const sc of SCENARIOS) {
    const t0 = Date.now();
    const plain = await run(b, sc, false), r = await run(b, sc, true);
    const a = analyse(sc, r, plain);
    a.wallSeconds = Math.round((Date.now() - t0) / 1000);
    report.push(a);
    console.error(JSON.stringify(a));
  }
  await b.close();
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results', 'boat-sync.json'), JSON.stringify(report, null, 1));
  process.exit(report.every(x => x.ok) ? 0 : 1);
})();
