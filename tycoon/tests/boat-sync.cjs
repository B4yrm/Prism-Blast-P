// Visual boats vs. simulation, over long play (render loop paused, seeded random,
// the game stepped at 30 fps exactly like real frames step it):
//   • no two boats ever overlap, no hull ever touches land / piers / the quay
//   • each boat is back in its slip / outer berth when the simulation starts
//     unloading (lag of the visual arrival) and leaves when the simulation leaves;
//     the one trip per boat from its slip to its new outer berth is listed apart
//   • every trip casts a net; fish jump next to the net
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
const bundle2 = (src, name) => { const o = path.join(root, '.preview', name); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: o, logLevel: 'error' }); return require(o); };
const CFG = bundle2('src/config.js', 'config.cjs'), ROCKS = bundle2('src/render/water.js', 'water.cjs').surfRocks().map(q => ({ x: q.x, y: q.y, r: 0.42 * q.s }));

const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const STRONG = { workers: 10, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, upAll: MAXUP };
const SCENARIOS = [
  // every scenario: no overlaps or contacts, never faster than 5 tiles/s or 90°/s, a net on every trip, one visual
  // trip per simulation trip, no unloading shown without the boat, the simulation unchanged.
  // Slip trips: in the slip before the simulation unloads. Loop trips: lateness reported; ready for the next trip.
  { name: 'start-fleet4', boats: 4, secs: 1800, up: {} },
  { name: 'start-fleet1', boats: 1, secs: 300, up: {} },
  { name: 'mid-fleet4 (engine 6, nets 3)', boats: 4, secs: 1800, up: { cap: 4, speed: 6, net: 3 } },
  { name: 'mid+-fleet4 (engine 10, nets 8): short curves to sea', boats: 4, secs: 1800, up: { cap: 6, speed: 10, net: 8 } },
  { name: 'mid++-fleet4 (engine 14, nets 12): just under the unlock', boats: 4, secs: 1800, up: { cap: 8, speed: 14, net: 12 } },
  { name: 'mid+ with sea charts 2 (engine 10, nets 8)', boats: 4, secs: 900, up: { cap: 6, speed: 10, net: 8 }, research: { nav: 2, nets: 1 } },
  { name: 'lopsided (engine 22, nets 12)', boats: 4, secs: 900, up: { cap: 6, speed: 22, net: 12 } },
  { name: 'unlock in play (engine 14, nets 17 → 18 bought at 5 s): jetties and head arms are built, the boats move one by one', boats: 4, secs: 1800, up: { cap: 0, speed: 14, net: 17 }, buy: { at: 5, up: { net: 18 } }, ...STRONG },
  { name: 'unlock in play, 2 boats (harbour tier 2)', boats: 2, secs: 600, up: { cap: 0, speed: 14, net: 17 }, buy: { at: 5, up: { net: 18 } }, ...STRONG, tier: { ...STRONG.tier, harbor: 2 } },
  { name: 'engine 20, nets 18, loop berths', boats: 4, secs: 1800, up: { cap: 0, speed: 20, net: 18 }, outer: 2, ...STRONG },
  { name: 'max 30/30 loaded from an old save (no jetties stored): loop berths in place at load', boats: 4, secs: 900, up: { cap: 0, speed: 30, net: 30 }, ...STRONG },
  { name: 'unlock in play far above the threshold (engine 30, nets 17 → 18 bought at 5 s): the move is late once', boats: 4, secs: 900, up: { cap: 0, speed: 30, net: 17 }, buy: { at: 5, up: { net: 18 } }, ...STRONG },
  { name: 'max 30/30, loop berths, strong economy (shortest stays)', boats: 4, secs: 1800, up: { cap: 0, speed: 30, net: 30 }, outer: 2, ...STRONG },
  { name: 'max 30/30, loop berths, hold 30 (long stays)', boats: 4, secs: 600, up: { cap: 30, speed: 30, net: 30 }, outer: 2 },
  { name: 'max 30/30, 1 boat, loop berths', boats: 1, secs: 300, up: { cap: 0, speed: 30, net: 30 }, outer: 2, ...STRONG },
  { name: 'max 30/30 + sea charts 3, loop berths, strong economy', boats: 4, secs: 1800, up: { cap: 0, speed: 30, net: 30 }, research: { nav: 3, nets: 3, ergo: 3 }, outer: 2, ...STRONG },
  { name: 'max 30/30 + sea charts 3, loop berths, hold 30', boats: 4, secs: 600, up: { cap: 30, speed: 30, net: 30 }, research: { nav: 3, nets: 3 }, outer: 2 },
];
const ONLY = process.env.SYNC_ONLY;

async function run(b, sc, withFleet) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, harborOuter: sc.outer || 0, boats: sc.boats, workers: sc.workers || (sc.boats === 4 ? 6 : 2), level: 12, settings: { quality: 'medium' },
      tier: sc.tier || { harbor: sc.boats === 4 ? 3 : 1, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, up: { ...(sc.upAll || {}), harbor: { cap: 0, speed: 0, net: 0, ...sc.up } }, research: { lv: sc.research || {}, active: null },
      stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
  }, sc);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + FILE);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(([secs, withFleet, buy]) => {
    __game.loop.sleep();
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, dt = 1 / 30;
    // the simulation draws from Math.random; the visuals get their own stream so
    // that both runs (with and without visuals) feed the simulation the same numbers
    const simRandom = rnd;
    let seed2 = 99; const visRandom = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647;
    // every fish jump: how far from the net of a boat that is fishing (tiles)
    const jumps = [], jump = w.fishJump.bind(w);
    w.fishJump = (x, y) => {
      let d = Infinity;
      for (const v of F.boats) if (v.phase === 'fishing') { const q = F.netEnd(v); d = Math.min(d, Math.hypot(q.x - x, q.y - y)); }
      jumps.push(+d.toFixed(2)); jump(x, y);
    };
    const traj = [], ev = [];
    // unloading shown (crane or jetty cart) while the boat is not made fast
    let unloadShownAway = 0, unloadsShown = 0, armsAt = null, stemAt = null, allMovedAt = null;
    if (withFleet) {
      const moored = b => { const v = F.view(b); return v && (v.phase === 'docked' || v.phase === 'settle' || v.phase === 'castoff'); };
      const ju = F.jetties.unloading.bind(F.jetties); F.jetties.unloading = i => { unloadsShown++; if (!moored(sim.boats[i])) unloadShownAway++; ju(i); };
      const cw = w.craneWork.bind(w);
      w.craneWork = b => { const before = w.cranes.map(c => c.t); cw(b); if (w.cranes.some((c, n) => c.t !== before[n] && c.t > 1)) { unloadsShown++; if (!moored(b)) unloadShownAway++; } };
    }
    const lastS = sim.boats.map(b => b.state), lastV = [];
    let t = 0, holdFrames = 0, cs = [];
    let bought = false;
    for (let k = 0; k < Math.round(secs / dt); k++) {
      if (buy && !bought && t >= buy.at) { Object.assign(sim.S.up.harbor, buy.up); bought = true; }      // an upgrade bought during play (both runs)
      Math.random = simRandom; sim.update(dt);
      Math.random = visRandom; if (withFleet) F.update(t, dt);
      t += dt;
      sim.boats.forEach((b, i) => { if (b.state !== lastS[i]) { ev.push([+t.toFixed(3), i, 's', b.state]); lastS[i] = b.state; } });
      if (withFleet) {
        F.boats.forEach((v, i) => {
          if (v.phase !== lastV[i]) { ev.push([+t.toFixed(3), i, 'v', v.phase, v.phase === 'depart' ? (v.site < 4 && v.target >= 4 ? 'move' : v.mode === 'loop' && v.site < 4 ? 'curve' : v.mode) : '']); lastV[i] = v.phase; }
          if (v.hold && !v.__h) ev.push([+t.toFixed(3), i, 'h', v.phase + '/' + (v.plan ? v.plan[Math.min(v.st.leg, v.plan.length - 1)].kind : '')]);
          v.__h = v.hold;
          if (v.hold) holdFrames++;
          if ((v.phase === 'depart' || v.phase === 'return') && k % 15 === 0) cs.push(+v.c.toFixed(2));
        });
        traj.push(F.boats.map(v => [+v.x.toFixed(4), +v.y.toFixed(4), +v.h.toFixed(4), v.phase === 'docked' || v.phase === 'castoff' || v.phase === 'settle' ? 1 : 0]));
        if (F.jetties.built && stemAt === null) stemAt = t;
        if (F.jetties.arms && armsAt === null) armsAt = t;
        if (allMovedAt === null && F.boats.length === sim.boats.length && F.boats.every(v => v.site >= 4)) allMovedAt = t;
      }
      if (k % 200 === 0) { Math.random = simRandom; sim.collect(true); }
    }
    return { unloadShownAway, unloadsShown, armsAt, stemAt, allMovedAt, sites: F.boats.map(v => v.site), flag: sim.S.harborOuter, v0: F.V0, trips: F.stats.trips, built: F.jetties.built, jumps, nets: F.stats.nets, netMin: F.stats.netMin, traj, ev, holdSecs: +(holdFrames * dt).toFixed(1), cs, caught: sim.S.stats.caught, money: Math.floor(sim.S.money), dt };
  }, [sc.secs, withFleet, sc.buy || null]);
  r.errs = errs;
  await ctx.close();
  return r;
}

function analyse(sc, r, plain) {
  const out = { scenario: sc.name, seconds: sc.secs, boats: sc.boats, pageErrors: r.errs.slice(0, 3) };
  // 1. simulation untouched: per boat, the set of out / fish / back leg durations
  //    (a leg that only one run reached inside the time window is not compared)
  const legs = run => {
    const L = {};
    for (let i = 0; i < sc.boats; i++) {
      const E = run.ev.filter(e => e[1] === i && e[2] === 's');
      for (let k = 1; k + 1 < E.length; k++) if (E[k][3] !== 'dock' && !(sc.buy && E[k][0] < sc.buy.at + 30))  /* legs under way when an upgrade is bought differ with the start-up frames */ (L[`${i}/${E[k][3]}`] = L[`${i}/${E[k][3]}`] || new Set()).add((E[k + 1][0] - E[k][0]).toFixed(2));
    }
    return Object.fromEntries(Object.entries(L).map(([k, v]) => [k, [...v].sort().join(',')]));
  };
  const lv = legs(r), lp = legs(plain);
  out.simulation = { legDurationsWithVisuals: lv, legDurationsWithout: lp, identicalToRunWithout: Object.keys(lv).filter(k => k in lp).every(k => lv[k] === lp[k]) && Object.keys(lv).filter(k => k in lp).length >= Object.keys(lv).length - 1,
    caught: { withVisuals: r.caught, without: plain.caught }, money: { withVisuals: r.money, without: plain.money } };
  // 2. hulls: boat–boat overlap and boat–land contact, every 3rd frame
  const docked = [0, 1, 2, 3].map(P.dockedHull), decor = P.DECOR_BOATS.map(d => P.decorHull(d));
  const armsFrom = r.armsAt === null ? Infinity : r.armsAt / r.dt;
  const hard = (x, y, f) => P.solidAt(x, y) || CFG.isLand(Math.floor(x), Math.floor(y)) || ROCKS.some(q => Math.hypot(x - q.x, y - q.y) <= q.r) || (f >= armsFrom && P.HEAD_ARMS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1));
  let overlaps = 0, landHits = 0, decorHits = 0, minGap = Infinity, firstOverlap = null, firstLand = null;
  const n = r.traj[0] ? r.traj[0].length : 0;
  for (let f = 0; f < r.traj.length; f += 3) {
    const row = r.traj[f], polys = row.map(([x, y, h]) => P.hullAt(x, y, h));
    for (let i = 0; i < n; i++) {
      const [x, y, h, moored] = row[i];
      if (!moored) {
        const pts = P.hullPoints(x, y, h, 0);
        if (pts.some(([px, py]) => hard(px, py, f))) { landHits++; if (!firstLand) firstLand = { t: +(f * r.dt).toFixed(2), boat: i, at: [x, y] }; }
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
  out.hulls = { overlapSamples: overlaps, firstOverlap, minGapTiles: +minGap.toFixed(3), landContactSamples: landHits, firstLandContact: firstLand, decorContactSamples: decorHits };
  // 3. smoothness: largest jump, turn rate and speed between frames
  let maxStep = 0, maxYaw = 0, maxHaul = 0, haulAt = null, maxKink = 0; const bSpeed = [], bTurn = [];
  for (let f = 1; f < r.traj.length; f++) for (let i = 0; i < n; i++) {
    const [x0, y0, h0, m0] = r.traj[f - 1][i], [x1, y1, h1, m1] = r.traj[f][i];
    if (!(m0 || m1)) { bSpeed[i] = Math.max(bSpeed[i] || 0, Math.hypot(x1 - x0, y1 - y0) / r.dt); if (f >= 3 && !r.traj[f - 3][i][3]) { let d = h1 - r.traj[f - 3][i][2]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; bTurn[i] = Math.max(bTurn[i] || 0, Math.abs(d) / (3 * r.dt) * 180 / Math.PI); } }
    if (m0 || m1) { const hv = Math.hypot(x1 - x0, y1 - y0) / r.dt; if (hv > maxHaul) { maxHaul = hv; haulAt = [+(f * r.dt).toFixed(2), i, m0, m1, +x0.toFixed(2), +y0.toFixed(2), +x1.toFixed(2), +y1.toFixed(2)]; } continue; }      // made fast: only the lines move it
    maxStep = Math.max(maxStep, Math.hypot(x1 - x0, y1 - y0) / r.dt);
    // turn rate over 0.1 s (three frames), so a kink of a degree where two curves join does not count as a turn
    if (f >= 3 && !r.traj[f - 3][i][3]) { let d = h1 - r.traj[f - 3][i][2]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; maxYaw = Math.max(maxYaw, Math.abs(d) / (3 * r.dt)); }
    { let d = h1 - h0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; maxKink = Math.max(maxKink, Math.abs(d)); }
  }
  out.motion = { trips: r.trips, jettiesBuilt: r.built, simCruiseTilesPerS: +r.v0.toFixed(2), maxSpeedVsSimCruise: +(maxStep / r.v0).toFixed(2), maxSpeedTilesPerS: +maxStep.toFixed(2), maxTurnRateDegPerS: +(maxYaw * 180 / Math.PI).toFixed(1), largestHeadingStepPerFrameDeg: +(maxKink * 180 / Math.PI).toFixed(2), haulingInTilesPerS: +maxHaul.toFixed(2), haulingFastestAt: haulAt, holdSeconds: r.holdSecs, jetties: { stemsAt: r.stemAt, headArmsAt: r.armsAt, saved: r.flag, sites: r.sites } };
  const cs = r.cs.slice().sort((a, b) => a - b), q = k => cs.length ? cs[Math.min(cs.length - 1, Math.floor(cs.length * k))] : null;
  out.cruiseShare = { p10: q(0.1), median: q(0.5), p90: q(0.9), max: cs[cs.length - 1] };
  // 4. sync with the simulation: the j-th trip of the simulation is the j-th visual trip of that boat
  // the change-over (jetties appear → every boat at its loop berth → back on the simulation's clock) is reported on its own
  const changing = t => r.stemAt !== null && r.stemAt > 1 && t >= r.stemAt - 1 && (r.allMovedAt === null || t <= r.allMovedAt + 90);
  const groups = { slip: [], curve: [], loop: [], move: [], slipChanging: [], curveChanging: [], loopChanging: [] }, depLag = { slip: [], loop: [], afterMove: [], changing: [] }, mooredS = [], fishing = [], perBoat = [];
  let lastLate = null;
  let skipped = 0;
  for (let i = 0; i < n; i++) {
    const E = r.ev.filter(e => e[1] === i), simOut = E.filter(e => e[2] === 's' && e[3] === 'out').map(e => e[0]);
    const simDock = E.filter(e => e[2] === 's' && e[3] === 'dock' && simOut.length && e[0] > simOut[0]).map(e => e[0]);
    const visDep = E.filter(e => e[2] === 'v' && e[3] === 'depart'), V = E.filter(e => e[2] === 'v');
    const visIn = V.filter((e, q) => e[3] === 'settle' && q > 0 && V[q - 1][3] === 'return').map(e => e[0]);     // made fast after a trip (not: lines put back while waiting)
    const kind = j => visDep[j][4] === 'loop' ? 'loop' : visDep[j][4] === 'move' ? 'move' : visDep[j][4] === 'curve' ? 'curve' : 'slip';
    const loopDur = []; for (let j = 0; j < Math.min(visDep.length, visIn.length); j++) if (visDep[j][4] === 'loop') loopDur.push(visIn[j] - visDep[j][0]);
    const pb = { boat: i + 1, topSpeedTilesPerS: +(bSpeed[i] || 0).toFixed(2), topTurnDegPerS: +(bTurn[i] || 0).toFixed(1), loopTripS: loopDur.length ? +(loopDur.reduce((a, c) => a + c, 0) / loopDur.length).toFixed(2) : null, simTrips: simDock.length, visualTrips: visIn.length, loop: { n: 0, lateMax: -Infinity, lateSum: 0, mooredMin: Infinity } };
    for (let j = 0; j < Math.min(simDock.length, visIn.length); j++) {
      const lag = +(visIn[j] - simDock[j]).toFixed(2), ch = kind(j) !== 'move' && changing(visDep[j][0]); groups[kind(j) + (ch ? 'Changing' : '')].push(lag);
      if (ch && lag > 0) lastLate = Math.max(lastLate || 0, visIn[j]);
      if (kind(j) === 'loop') { pb.loop.n++; pb.loop.lateMax = Math.max(pb.loop.lateMax, lag); pb.loop.lateSum += lag; }
    }
    for (let j = 0; j < Math.min(simOut.length, visDep.length); j++) {
      const d = +(visDep[j][0] - simOut[j]).toFixed(2);
      (j > 0 && kind(j - 1) === 'move' ? depLag.afterMove : changing(visDep[j][0]) ? depLag.changing : depLag[kind(j) === 'loop' ? 'loop' : 'slip']).push(d);
      if (j > 0 && visIn[j - 1] !== undefined && kind(j) === 'loop' && kind(j - 1) === 'loop') { const m = +(visDep[j][0] - visIn[j - 1]).toFixed(2); mooredS.push(m); pb.loop.mooredMin = Math.min(pb.loop.mooredMin, m); }
    }
    skipped += Math.max(0, simDock.length - visIn.length - 1);
    for (const e of E) if (e[2] === 'v' && e[3] === 'fishing') { const nx = E.find(x => x[2] === 'v' && x[0] > e[0] && x[3] !== 'fishing'); if (nx) fishing.push(+(nx[0] - e[0]).toFixed(2)); }
    pb.loop = pb.loop.n ? { trips: pb.loop.n, lateMaxS: pb.loop.lateMax, lateMeanS: +(pb.loop.lateSum / pb.loop.n).toFixed(2), mooredMinS: pb.loop.mooredMin === Infinity ? null : pb.loop.mooredMin } : null;
    perBoat.push(pb);
  }
  const stats = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? { n: s.length, min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1], mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2) } : { n: 0 }; };
  out.sync = {
    // made fast minus the simulation docking (negative = early)
    slipTripsLate: groups.slip.filter(x => x > 0).length, slipTripArrivalS: stats(groups.slip), curveTripsLate: groups.curve.filter(x => x > 0).length, curveTripArrivalS: stats(groups.curve), loopTripArrivalS: stats(groups.loop), moveToLoopBerthArrivalS: stats(groups.move),
    duringTheChangeOver: { slipTripArrivalS: stats(groups.slipChanging), loopTripArrivalS: stats(groups.loopChanging), departureS: stats(depLag.changing), everyBoatMovedAt: r.allMovedAt, lastLateArrivalSecondsAfterTheLastMove: lastLate && r.allMovedAt ? +(lastLate - r.allMovedAt).toFixed(1) : null },
    // starts to move minus the simulation leaving (about −0.55 = ready and leaving with it)
    slipTripDepartureS: stats(depLag.slip), loopTripDepartureS: stats(depLag.loop), firstTripAfterTheMoveDepartureS: stats(depLag.afterMove),
    madeFastBetweenLoopTripsS: stats(mooredS),
    tripsSkipped: skipped, perBoat,
    unloadingShown: r.unloadsShown, unloadingShownWithoutTheBoat: r.unloadShownAway,
    netS: stats(fishing),
    tripsWithoutNets: (() => { let c = 0; for (let i = 0; i < sc.boats; i++) { const V = r.ev.filter(e => e[1] === i && e[2] === 'v'); V.forEach((e, k) => { if (e[3] === 'return' && k > 0 && V[k - 1][3] !== 'fishing') c++; }); } return c; })(),
    netsShortestS: r.nets ? +r.netMin.toFixed(2) : null,
    fishJumps: r.jumps.length, fishJumpFarthestFromNetTiles: r.jumps.length ? Math.max(...r.jumps) : null,
  };
  const mx = a => a.length ? Math.max(...a) : -Infinity, capped = (sc.up.speed || 0) > 0 || !!(sc.research && sc.research.nav);   // the limits start with the first engine upgrade
  out.checks = {
    simulationUnchanged: out.simulation.identicalToRunWithout, noOverlap: overlaps === 0, hullsAQuarterBeamApart: !(minGap < 0.3), noContact: landHits === 0 && decorHits === 0, noPageError: !r.errs.length,
    speedWithin5: maxStep <= (capped ? 5.05 : 5.8), turnWithin90: maxYaw * 180 / Math.PI <= (capped ? 90.5 : 110),
    // a boat that gave way to another may not be able to catch up (it is never made faster than the limits):
    // at most 1.5 s late, and at most one slip trip in twenty; the crane waits for it
    slipTripsInBeforeUnloading: mx(groups.slip) <= 1.5 && groups.slip.filter(x => x > 0).length <= Math.max(1, groups.slip.length / 20),
    curveTripsInTime: mx(groups.curve) <= 1.5 && groups.curve.filter(x => x > 0).length <= Math.max(1, groups.curve.length / 8), loopBoatsReadyForTheNextTrip: mx(depLag.loop) <= 0.05, noTripSkipped: skipped === 0,
    noUnloadingShownWithoutTheBoat: r.unloadShownAway === 0, netOnEveryTrip: out.sync.tripsWithoutNets === 0, fishJumpAtTheNet: (out.sync.fishJumpFarthestFromNetTiles || 0) <= 1,
  };
  out.ok = Object.values(out.checks).every(Boolean);
  return out;
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const sc of SCENARIOS) {
    if (ONLY && !sc.name.includes(ONLY)) continue;
    const t0 = Date.now();
    const plain = await run(b, sc, false), r = await run(b, sc, true);
    const a = analyse(sc, r, plain);
    a.wallSeconds = Math.round((Date.now() - t0) / 1000);
    report.push(a);
    console.error(JSON.stringify(a));
  }
  await b.close();
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  if (!ONLY) fs.writeFileSync(path.join(root, 'test-results', 'boat-sync.json'), JSON.stringify(report, null, 1));
  process.exit(report.every(x => x.ok) ? 0 : 1);
})();
