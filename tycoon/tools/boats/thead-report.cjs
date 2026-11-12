// Study of "leave ahead, loop, come back ahead" berths at the outer jetties
// (development tool; the game does not use it).  Runs the search of thead.cjs,
// picks the layout with the least new deck, then checks and measures it:
//   • every boat's loop against land, piers, jetties, decks, decorative boats,
//     buoys, occupied slips, and against the other boats' water
//   • longer loops for lower levels (same berth), existing slip routes against
//     the new decks, the one move from each slip to its new berth
//   • times at ≤ 5 tiles/s and ≤ 90°/s against the simulation's trip per level
//   • pictures: top-down map and mock-ups in the game's own view
//   node tools/boats/thead-report.cjs  → test-results/thead/
const T = require('./thead.cjs');
const { P } = T;
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..'), OUT = path.join(root, 'test-results/thead');
const FILE = 'file://' + path.join(root, 'index.html');
const LEAD = 0.55, STAY = 3.7;
const COL = ['#ff9f1c', '#e84393', '#2ecc71', '#00b4d8'];

const { report, chosen } = T.search();
// boats 1 and 3 use the east jetty (index 0), boats 0 and 2 the west one; the inner boat gets the head arm
const pick = (j, fam) => { const p = Object.entries(chosen[j]).find(([k]) => k.startsWith('head+stem'))[1]; return p.A.fam === fam ? p.A : p.B; };
const base = [pick(1, 'head'), pick(0, 'head'), pick(1, 'stem'), pick(0, 'stem')];
const decks = base.filter(c => c.deck).map(c => c.deck);
const deckPolys = decks.map(r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
const berthHull = (c, grow = 0.1) => P.hullAt(c.x, c.y, c.a, grow);

// ---- ladders: longer loops from the same berth (head: further south; stem: further out from the jetty)
const variant = (c, n) => T.candidate(c.fam, c.jetty, c.x, c.y, c.a, c.sense, c.R, c.gap, c.sa, c.sb, n);
const SEA = [-16.5, 22, 45.5, 45];                       // loops stay inside the water the game already uses
const ladders = base.map(() => []);
for (let n = 0; n <= 12; n++) base.forEach((c, k) => {
  if (ladders[k].stop) return;
  const v = variant(c, n);
  const soft = v ? v.hits.filter(h => h !== 'decor boat') : ['land'];
  if (!v || soft.length) { ladders[k].stop = soft.join(',') || 'land'; return; }
  if (v.pth.pts.some(q => q.x < SEA[0] + 0.7 || q.x > SEA[2] - 0.7 || q.y > SEA[3] - 0.7)) { ladders[k].stop = 'edge of the sea in use'; return; }
  v.sw = T.sweep(v.pth);
  for (let j = 0; j < 4; j++) if (j !== k) {
    if (ladders[j].some(o => T.meets(v.sw, o.sw))) { ladders[k].stop = 'water of boat ' + j; return; }
    if (base[j].deck && T.meets(v.sw, T.rectCells(base[j].deck))) { ladders[k].stop = 'deck of boat ' + j; return; }
  }
  v.n = n; ladders[k].push(v);
});

// ---- helpers on game paths (boatpaths.js)
const ptsOf = (pth, dir = 1) => { const pts = []; for (let s = 0; s <= pth.len + 1e-9; s += 0.08) { const q = P.poseAt(pth, Math.min(s, pth.len)); pts.push({ x: q.x, y: q.y, a: dir > 0 ? q.a : q.a + Math.PI, k: Math.abs(P.curvAt(pth, s)), s }); } return { pts, len: pth.len }; };
const straightPts = (x, y, a, len) => T.build(x, y, a, [['S', len]]);
function timeAt(pth, acc, dec, vcap) {
  const n = pth.pts.length, v = new Float64Array(n), cap = i => Math.min(vcap, pth.pts[i].k > 1e-6 ? T.WMAX / pth.pts[i].k : Infinity);
  for (let i = 1; i < n; i++) v[i] = Math.min(cap(i), Math.sqrt(v[i - 1] ** 2 + 2 * acc * (pth.pts[i].s - pth.pts[i - 1].s)));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * (pth.pts[i + 1].s - pth.pts[i].s)));
  let t = 0; for (let i = 1; i < n; i++) t += 2 * (pth.pts[i].s - pth.pts[i - 1].s) / (v[i] + v[i - 1]);
  return t;
}

// ---- 1. each loop: contacts, clearance to the others
const decorHit = c => P.DECOR_BOATS.map((d, i) => ({ i, poly: P.decorHull(d, 0.1) })).filter(d => c.pth.pts.some(q => P.hullPoints(q.x, q.y, q.a, 0.08).some(([x, y]) => P.pointInPoly(x, y, d.poly)))).map(d => d.i);
const hullPtsAlong = (pth, step = 3) => { const o = []; for (let i = 0; i < pth.pts.length; i += step) { const q = pth.pts[i]; o.push(...P.hullPoints(q.x, q.y, q.a, 0)); } return o; };
const HP = base.map(c => hullPtsAlong(c.pth));
const gapBetween = (A, B) => { let m = Infinity; for (let i = 0; i < A.length; i += 2) { const [ax, ay] = A[i]; for (let j = 0; j < B.length; j += 2) { const d = (ax - B[j][0]) ** 2 + (ay - B[j][1]) ** 2; if (d < m) m = d; } } return Math.sqrt(m); };
const obstacleGap = k => {   // nearest land / pier / jetty / deck / buoy / occupied slip to the hull anywhere on the loop
  const keep = P.DECOR_BOATS.map((d, i) => i).filter(i => !base.some(c => decorHit(c).includes(i))).map(i => P.decorHull(P.DECOR_BOATS[i]));
  let m = Infinity; const R = 14;
  for (const [x, y] of HP[k]) {
    const cx = Math.floor((x - T.GX0) / T.CELL), cy = Math.floor((y - T.GY0) / T.CELL);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const c = (cy + dy) * T.GW + cx + dx; if (c >= 0 && c < T.OBS.length && (T.OBS[c] & ~2)) { const d = Math.hypot(dx, dy) * T.CELL; if (d < m) m = d; } }
    for (const r of decks) { const ddx = Math.max(r[0] - x, 0, x - r[2]), ddy = Math.max(r[1] - y, 0, y - r[3]); m = Math.min(m, Math.hypot(ddx, ddy)); }
    for (const poly of keep) for (const [qx, qy] of poly) m = Math.min(m, Math.hypot(qx - x, qy - y));
  }
  return m;
};
const boats = base.map((c, k) => {
  const others = [0, 1, 2, 3].filter(j => j !== k);
  return { boat: k, jetty: c.jetty ? 'west' : 'east', berth: c.fam === 'head' ? 'head arm, sea face' : 'jetty stem, outer face', x: c.x, y: +c.y.toFixed(2), headingDeg: Math.round(c.a * 180 / Math.PI), gapToPier: c.gap, radius: c.R,
    loopTiles: c.len, timeBriskS: c.tFast, timeCalmS: c.tCalm, topSpeed: c.vmax, topTurnDegPerS: c.wmax, newDeck: c.deck, decorBoatsToMove: decorHit(c),
    clearanceToOtherLoops: +Math.min(...others.map(j => gapBetween(HP[k], HP[j]))).toFixed(2), clearanceToObstacles: +obstacleGap(k).toFixed(2),
    longerLoops: ladders[k].map(v => ({ n: v.n, tiles: v.len, briskS: v.tFast, calmS: v.tCalm })), longerLoopsStopAt: ladders[k].stop || 'limit of the study (12 tiles)' };
});

// ---- 2. existing slip routes against the new decks and the boats moored at the new berths
const newHulls = base.map(c => berthHull(c));
const slipRoutes = i => {
  const dep = P.departurePlan(i), end = P.poseAt(dep[1].path, dep[1].path.len), fish = P.fishingPlan(i, end), plans = [['way out', dep], ['towing', fish]];
  const f = fish[0].path; for (let s = 0; s < f.len; s += f.len / 8) plans.push(['way home', P.arrivalPlan(i, P.poseAt(f, s))]);
  for (let s = P.RETURN_FROM[i]; s < dep[1].path.len; s += 1) plans.push(['way home (called back)', P.arrivalPlan(i, P.poseAt(dep[1].path, s))]);
  plans.push(['harbour trip', [...P.shortDeparture(i), ...P.shortArrival(i, P.shortSpot(i))]]);
  return plans;
};
const existing = [0, 1, 2, 3].map(i => {
  const r = { slip: i, routes: 0, hitDeck: [], hitNewBerth: [], crossesLoopOfBoat: [] };
  const sw = [];
  for (const [name, plan] of slipRoutes(i)) {
    r.routes++;
    if (P.planHits(plan, deckPolys).length) r.hitDeck.push(name);
    if (P.planHits(plan, newHulls).length) r.hitNewBerth.push(name);
    for (const leg of plan) sw.push(T.sweep(ptsOf(leg.path, leg.dir)));
  }
  for (let k = 0; k < 4; k++) if (sw.some(s => T.meets(s, ladders[k][0].sw))) r.crossesLoopOfBoat.push(k);
  r.hitDeck = [...new Set(r.hitDeck)]; r.hitNewBerth = [...new Set(r.hitNewBerth)];
  return r;
});

// ---- 3. the one move from slip k to the new berth: back out of the slip, a way point at sea, run in straight.
// Order: the outer boats (2, 3) go first, to the jetty stems; the head arms are built when slips 2 and 3
// are empty; then the inner boats (0, 1) go. Obstacles are those of the boat's own stage.
const fromPoints = pl => { const pts = []; let s = 0; for (let i = 0; i < pl.length; i++) { if (i) s += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); const n = pl[Math.min(pl.length - 1, i + 1)], pv = pl[Math.max(0, i - 1)]; pts.push({ x: pl[i][0], y: pl[i][1], a: Math.atan2(n[1] - pv[1], n[0] - pv[0]), k: 0, s }); }
  for (let i = 1; i < pts.length - 1; i++) { let d = pts[i + 1].a - pts[i - 1].a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const ds = pts[i + 1].s - pts[i - 1].s; pts[i].k = ds > 1e-6 ? Math.min(1 / 2.8, Math.abs(d) / ds) : 0; }
  return { pts, len: s }; };
const polyHit = (pth, polys, grow = 0.08) => pth.pts.some((q, i) => i % 2 === 0 && P.hullPoints(q.x, q.y, q.a, grow).some(([x, y]) => polys.some(o => P.pointInPoly(x, y, o))));
const movedDecor = [...new Set(base.flatMap(decorHit))];
const moves = base.map((c, k) => {
  const outer = k >= 2;
  let best = null;
  for (const run of outer ? [0.6, 1.2, 1.8] : [2.5]) {
  const pre = { x: c.x - Math.cos(c.a) * run, y: c.y - Math.sin(c.a) * run, a: c.a };
  const stageDecks = outer ? [] : decks, stagePolys = [...(outer ? [] : deckPolys), ...newHulls.filter((_, j) => j !== k && (outer ? j >= 2 : true)), ...P.DECOR_BOATS.map((d, i) => movedDecor.includes(i) ? null : P.decorHull(d, 0.1)).filter(Boolean),
    ...[0, 1, 2, 3].filter(j => j !== k && (outer || j < 2)).map(j => P.dockedHull(j))];
  const tail = straightPts(pre.x, pre.y, pre.a, run);
  if (T.contacts(tail, stageDecks) & 17 || polyHit(tail, stagePolys)) continue;
  const tryPlan = (via) => {
    let dep, seaB = null;
    try { dep = P.siteDeparture(k, via || pre); } catch (e) { return; }
    if (P.minRadius(dep[1].path) < 2.75 || P.planHits(dep, stagePolys).length) return;
    if (!outer && T.contacts(ptsOf(dep[1].path), stageDecks) & 16) return;
    if (via) {
      seaB = fromPoints(P.dubins([via.x, via.y, via.a], [pre.x, pre.y, pre.a], 2.8));
      const h = T.contacts(seaB, stageDecks, 0.08);
      if (h & (1 | 16 | 8) || polyHit(seaB, stagePolys)) return;
    }
    const sea = ptsOf(dep[1].path), parts = [sea, ...(seaB ? [seaB] : []), tail], joined = { pts: [], len: 0 };
    for (const part of parts) { for (const q of (joined.pts.length ? part.pts.slice(1) : part.pts)) joined.pts.push({ ...q, s: q.s + joined.len }); joined.len += part.len; }
    const tiles = dep[0].path.len + joined.len;
    if (best && best.tiles <= tiles) return;
    const t = (acc, dec) => timeAt(ptsOf(dep[0].path, -1), acc, dec, 0.55 * T.VMAX) + 0.55 + timeAt(joined, acc, dec, T.VMAX);
    best = { tiles, via: via ? [via.x, via.y, Math.round(via.a * 180 / Math.PI)] : null, briskS: +t(2.25, 1.5).toFixed(1), calmS: +t(1.5, 1.25).toFixed(1), pts: [...ptsOf(dep[0].path, -1).pts, ...joined.pts].filter((_, i) => i % 3 === 0).map(q => [q.x, q.y]) };
  };
  tryPlan(null);
  if (outer) {            // round the jetty head, north along the outer side, turn towards the stem, run in bow to the sea
    const side = c.side;
    for (let d = 4.5; d <= 8; d += 0.5) for (let y = 24.5; y <= 34; y += 0.5) for (const h of [-Math.PI / 2, -Math.PI / 2 + side * 0.4, -Math.PI / 2 - side * 0.4]) tryPlan({ x: c.x + side * d, y, a: h });
  } else for (let x = c.x - 10; x <= c.x + 10; x += 2) for (let y = 31; y <= 37; y += 2) for (let h = 0; h < 8; h++) tryPlan({ x, y, a: h * Math.PI / 4 });
  }
  return best ? { boat: k, stage: outer ? '1: to the jetty stem (head arms not built yet)' : '2: to the head arm (slips 2 and 3 empty)', tiles: +best.tiles.toFixed(1), briskS: best.briskS, calmS: best.calmS, via: best.via, hits: 0, pts: best.pts } : { boat: k, error: 'no clear route found' };
});

// ---- 4. loop time by radius (one circle + 0.5 tile run-in), for the choice of radius
const radii = [2.4, 2.8, 3.2, 4].map(R => { const p = T.build(0, 0, 0, T.loopSegs(R, 1, 0, 0.5, 0)), a = T.timing(p, 2.25, 1.5), b = T.timing(p, 1.5, 1.25); return { R, tiles: +p.len.toFixed(1), briskS: +a.t.toFixed(2), calmS: +b.t.toFixed(2), topSpeed: +a.vmax.toFixed(2), turnDegPerS: +a.wmax.toFixed(0) }; });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  // ---- 5. the simulation's trip per level (read from the game, nothing stepped)
  const ctx = await b.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1.5 });
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, harborOuter: 1, boats: 4, workers: 6, level: 12, settings: { quality: 'high' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, up: { harbor: { cap: 10, speed: 30, net: 30 } }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
  });
  const p = await ctx.newPage();
  await p.goto(FILE);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const levels = await p.evaluate(() => {
    __game.loop.sleep();
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    const w = __game.scene.getScene('world'), F = w.fleet, S = w.sim.S, out = [];
    for (const nav of [0, 3]) for (const net of [0, 5, 10, 14, 18, 22, 26, 30]) for (const sp of [0, 5, 10, 14, 18, 22, 26, 30]) {
      S.up.harbor.net = net; S.up.harbor.speed = sp; S.research.lv.nav = nav;
      const built = net >= 18 && sp >= 14; F.jetties.built = built; F.levelKey = null;
      const lv = F.levels()[0], V0 = (F.fleetLevel(), F.V0), row = { nav, net, sp, built, V0: +V0.toFixed(2), sim: [], grounds5: [], grounds44: [] };
      for (let k = 0; k < 4; k++) {
        row.sim.push(+(F.toDock({ state: 'dock', t: 0.55, load: 0, berth: w.sim.boats[k].berth }) - 0.55).toFixed(2));
        const o = F.tripOption(k, k, lv.z(k), 'grounds');
        row.grounds5.push(+F.tripTime(o, Math.min(1.6, 5 / V0)).toFixed(2)); row.grounds44.push(+F.tripTime(o, Math.min(1.6, 4.4 / V0)).toFixed(2));
      }
      out.push(row);
    }
    S.up.harbor.net = 30; S.up.harbor.speed = 30; S.research.lv.nav = 0; F.jetties.built = true; F.levelKey = null;
    return out;
  });
  // loop levels: the longest loop that still comes home with ≥ 1 s moored (calm) / on time (brisk)
  const fit = (k, sim, key) => { let best = null; for (const v of boats[k].longerLoops) if (v[key] - LEAD - sim <= 0) best = v; return best; };
  const table = levels.map(r => {
    if (!r.built) {
      const late = r.sim.map((s, k) => [+(r.grounds5[k] - LEAD - s).toFixed(2), +(r.grounds44[k] - LEAD - s).toFixed(2)]);
      const worst = Math.max(...late.map(l => l[1]));
      return { ...r, mode: 'slips', lateS: [Math.max(0, Math.min(...late.map(l => l[0]))), Math.max(0, worst)], verdict: worst <= 0 ? 'full route, on time' : worst <= STAY - LEAD - 1 ? 'full route, in ≤ ' + worst.toFixed(1) + ' s late (≥ 1 s moored)' : 'full route does not fit: harbour trip' };
    }
    const per = boats.map((bt, k) => { const late = [bt.timeBriskS - LEAD - r.sim[k], bt.timeCalmS - LEAD - r.sim[k]], f = fit(k, r.sim[k], 'calmS'); return { lateBrisk: +Math.max(0, late[0]).toFixed(2), lateCalm: +Math.max(0, late[1]).toFixed(2), mooredCalm: +(STAY - Math.max(0, late[1]) - LEAD).toFixed(2), longest: f ? f.tiles : null }; });
    const lc = Math.max(...per.map(q => q.lateCalm)), lb = Math.max(...per.map(q => q.lateBrisk));
    return { ...r, mode: 'loops', per, lateS: [lb, lc], mooredS: [+(STAY - lc - LEAD).toFixed(2), +(STAY - lb - LEAD).toFixed(2)], verdict: lc <= 0 ? 'loop on time (longer loop: ' + per.map(q => q.longest).join(' / ') + ' tiles)' : STAY - lc - LEAD >= 1 ? 'shortest loop, ' + lb.toFixed(1) + '–' + lc.toFixed(1) + ' s late, ≥ ' + (STAY - lc - LEAD).toFixed(1) + ' s moored' : 'does not fit' };
  });

  // ---- 6. mock-ups in the game's own view
  const mock = { decks, boats: base.map((c, k) => ({ x: c.x, y: c.y, a: c.a, pts: c.pth.pts.filter((_, i) => i % 3 === 0).map(q => [q.x, q.y]), long: ladders[k].length > 1 ? ladders[k][Math.min(ladders[k].length - 1, 4)].pth.pts.filter((_, i) => i % 3 === 0).map(q => [q.x, q.y]) : null })), col: COL.map(c => parseInt(c.slice(1), 16)), hideDecor: [...new Set(boats.flatMap(bt => bt.decorBoatsToMove))] };
  await p.addStyleTag({ content: '#ui { display: none !important; }' });
  const shot = async (name, opt) => {
    await p.evaluate(([m, opt]) => {
      const w = __game.scene.getScene('world'), F = w.fleet, iso = (x, y, z = 0) => ({ x: (x - y) * 32, y: (x + y) * 16 - z }), SEA_Z = -18;
      if (!window.__mock) {
        window.__mock = { g: [], routes: w.add.graphics().setDepth(4) };
        F.update = () => {};                                   // this page only: boats stay where the mock-up puts them
        // head decks, drawn like the jetties (planks, sides, piles)
        for (const [x0, y0, x1, y1] of m.decks) for (let x = x0; x < x1 - 1e-6; x += 1) {
          const xa = x, xb = Math.min(x1, x + 1), g = w.add.graphics().setDepth((xb + y1) * 16 - 2); window.__mock.g.push(g);
          for (const px of [xa + 0.15, xb - 0.15]) for (const py of [y0 + 0.15, y1 - 0.15]) { const a = iso(px, py, SEA_Z + 12), bb = iso(px, py, SEA_Z - 6); g.fillStyle(0x4a2f1c, 1).fillRect(a.x - 2.5, a.y, 5, bb.y - a.y); }
          const P4 = pts => pts.map(q => new Phaser.Math.Vector2(q.x, q.y));
          g.fillStyle(0x9c6a3e, 1).fillPoints(P4([iso(xb, y0), iso(xb, y1), iso(xb, y1, -6), iso(xb, y0, -6)]), true);
          g.fillStyle(0x8a5a33, 1).fillPoints(P4([iso(xa, y1), iso(xb, y1), iso(xb, y1, -6), iso(xa, y1, -6)]), true);
          g.fillStyle(0xc68a52, 1).fillPoints(P4([iso(xa, y0), iso(xb, y0), iso(xb, y1), iso(xa, y1)]), true);
          g.lineStyle(1, 0x8f5d33, 0.8); for (let q = xa + 0.25; q < xb - 0.01; q += 0.25) { const a = iso(q, y0), bb = iso(q, y1); g.lineBetween(a.x, a.y, bb.x, bb.y); }
        }
        // bollards on the sea side of each head deck and along the stem berths
        for (const bt of m.boats) for (const d of [-1.4, 1.2]) { const q = iso(bt.x + Math.cos(bt.a) * d - Math.sin(bt.a) * -1 * 0, bt.y + Math.sin(bt.a) * d, 0); void q; }
        (F.decor || []).forEach((d, i) => { if (m.hideDecor.includes(i)) for (const k of ['hull', 'refl', 'over']) d[k] && d[k].setVisible(false); });
      }
      const cam = w.cameras.main, c0 = iso(opt.at[0], opt.at[1]); w.lim = null; cam.setZoom(opt.zoom * __quality.dpr); cam.centerOn(c0.x, c0.y); cam.preRender && cam.preRender();
      F.under.clear();
      F.boats.forEach((vb, k) => { const bt = m.boats[k]; vb.x = bt.x; vb.y = bt.y; vb.h = bt.a; vb.v = 0; vb.accel = 0; vb.rope = 0; vb.phase = 'docked'; vb.over && vb.over.clear(); F.drawBoat(vb, 0, 0, F.under); });
      const R = window.__mock.routes; R.clear();
      if (opt.routes) m.boats.forEach((bt, k) => {
        if (opt.long && bt.long) { R.lineStyle(3, m.col[k], 0.45); R.strokePoints(bt.long.map(([x, y]) => new Phaser.Math.Vector2(iso(x, y, SEA_Z).x, iso(x, y, SEA_Z).y)), true); }
        R.lineStyle(5, 0x06263f, 0.35); R.strokePoints(bt.pts.map(([x, y]) => new Phaser.Math.Vector2(iso(x, y, SEA_Z).x, iso(x, y, SEA_Z).y + 2)), true);
        R.lineStyle(4, m.col[k], 0.95); R.strokePoints(bt.pts.map(([x, y]) => new Phaser.Math.Vector2(iso(x, y, SEA_Z).x, iso(x, y, SEA_Z).y)), true);
        // arrow heads along the loop
        for (const f of [0.2, 0.5, 0.8]) { const i = Math.floor(bt.pts.length * f), a = iso(...bt.pts[i], SEA_Z), c = iso(...bt.pts[i + 1], SEA_Z), ang = Math.atan2(c.y - a.y, c.x - a.x); R.fillStyle(m.col[k], 1).fillTriangle(a.x + Math.cos(ang) * 12, a.y + Math.sin(ang) * 12, a.x + Math.cos(ang + 2.5) * 9, a.y + Math.sin(ang + 2.5) * 9, a.x + Math.cos(ang - 2.5) * 9, a.y + Math.sin(ang - 2.5) * 9); }
      });
      __game.step(performance.now(), 16);
    }, [mock, opt]);
    await p.screenshot({ path: path.join(OUT, name) });
  };
  await shot('mockup-east.png', { at: [31.5, 30.5], zoom: 1.0, routes: false });
  await shot('mockup-west.png', { at: [-3.5, 30.5], zoom: 1.0, routes: false });
  await shot('mockup-overview.png', { at: [13.5, 31], zoom: 0.36, routes: false });
  await shot('routes-east.png', { at: [32, 31.5], zoom: 0.8, routes: true });
  await shot('routes-west.png', { at: [-3.5, 31.5], zoom: 0.8, routes: true });
  await shot('routes-overview.png', { at: [13.5, 32.5], zoom: 0.34, routes: true, long: true });
  await ctx.close();

  // ---- 7. top-down map
  const land = []; for (let cy = 0; cy < T.GH; cy += 2) for (let cx = 0; cx < T.GW; cx += 2) { const v = T.OBS[cy * T.GW + cx]; if (v) land.push([cx, cy, v]); }
  const slipsDraw = [0, 1, 2, 3].map(i => { const dep = P.departurePlan(i), end = P.poseAt(dep[1].path, dep[1].path.len); const pts = l => ptsOf(l.path, 1).pts.filter((_, n) => n % 4 === 0).map(q => [q.x, q.y]); return { hull: P.dockedHull(i), out: [...pts(dep[0]), ...pts(dep[1])], home: P.arrivalPlan(i, P.poseAt(P.fishingPlan(i, end)[0].path, P.LINGER)).flatMap(pts) }; });
  const map = { GX0: T.GX0, GY0: T.GY0, CELL: T.CELL, land, decks, jetties: P.JETTIES, col: COL, slips: slipsDraw, buoys: [0, 1, 2, 3].flatMap(j => P.buoysAt(j)), decor: P.DECOR_BOATS.map((d, i) => ({ poly: P.decorHull(d), moved: mock.hideDecor.includes(i) })),
    boats: base.map((c, k) => ({ hull: P.hullAt(c.x, c.y, c.a), pts: c.pth.pts.filter((_, i) => i % 2 === 0).map(q => [q.x, q.y]), sweep: [...ladders[k][0].sw].filter((_, i) => i % 1 === 0), long: ladders[k].length > 1 ? ladders[k][ladders[k].length - 1].pth.pts.filter((_, i) => i % 2 === 0).map(q => [q.x, q.y]) : null, label: `boat ${k + 1}: ${c.len} tiles, ${c.tFast}–${c.tCalm} s`, move: moves[k].pts || null })),
    GW: T.GW };
  const mp = await b.newPage({ viewport: { width: 1500, height: 720 }, deviceScaleFactor: 1.5 });
  await mp.setContent('<canvas id="c" width="1500" height="720" style="display:block"></canvas>');
  await mp.evaluate(m => {
    const c = document.getElementById('c'), g = c.getContext('2d'), S = 24, X0 = -17, Y0 = 20;
    const X = x => (x - X0) * S, Y = y => (y - Y0) * S;
    g.fillStyle = '#1273c4'; g.fillRect(0, 0, c.width, c.height);
    // grid
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let x = -17; x <= 46; x++) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), c.height); g.stroke(); } for (let y = 20; y <= 50; y++) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(c.width, Y(y)); g.stroke(); }
    for (const [cx, cy, v] of m.land) { if (!(v & 1)) continue; g.fillStyle = '#7fb069'; g.fillRect(X(m.GX0 + cx * m.CELL), Y(m.GY0 + cy * m.CELL), S * m.CELL * 2 + 0.6, S * m.CELL * 2 + 0.6); }
    const poly = (P, fill, stroke, lw = 1.5) => { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
    const line = (P, col, lw, dash = []) => { g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))); g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash); g.stroke(); g.setLineDash([]); };
    for (const [x0, y0, x1, y1] of m.jetties) poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#b9834f', '#6e4526');
    for (const [x0, y0, x1, y1] of m.decks) poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], '#e2a868', '#6e4526', 2);
    // existing slips and their routes (faint)
    for (const s of m.slips) { line(s.out, 'rgba(255,255,255,.28)', 1.5, [5, 5]); line(s.home, 'rgba(255,255,255,.28)', 1.5, [2, 5]); poly(s.hull, 'rgba(255,255,255,.25)', 'rgba(255,255,255,.6)', 1); }
    for (const d of m.decor) poly(d.poly, d.moved ? 'rgba(255,80,80,.25)' : 'rgba(40,40,60,.55)', d.moved ? '#ff5050' : '#223', 1.2);
    for (const [x, y] of m.buoys) { g.beginPath(); g.arc(X(x), Y(y), 4, 0, 7); g.fillStyle = '#e63946'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); }
    m.boats.forEach((bt, k) => {
      const col = m.col[k];
      g.fillStyle = col + '38'; for (const key of bt.sweep) { const cx = key % m.GW, cy = Math.floor(key / m.GW); g.fillRect(X(m.GX0 + cx * m.CELL), Y(m.GY0 + cy * m.CELL), S * m.CELL + 0.5, S * m.CELL + 0.5); }
      if (bt.long) line(bt.long, col, 1.6, [7, 6]);
      if (m.showMoves && bt.move) line(bt.move, col, 2, [2, 4]);
      line([...bt.pts, bt.pts[0]], col, 3.2);
      for (const f of [0.15, 0.4, 0.65, 0.88]) { const i = Math.floor(bt.pts.length * f), [x, y] = bt.pts[i], [x2, y2] = bt.pts[i + 1], a = Math.atan2(y2 - y, x2 - x); g.save(); g.translate(X(x), Y(y)); g.rotate(a); g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, 6); g.lineTo(-6, -6); g.closePath(); g.fillStyle = col; g.fill(); g.restore(); }
      poly(bt.hull, '#fff', col, 2.5);
    });
    g.font = 'bold 15px sans-serif'; g.textBaseline = 'top';
    const lab = (t, x, y, col = '#fff') => { g.fillStyle = 'rgba(4,30,60,.72)'; const wd = g.measureText(t).width; g.fillRect(x - 5, y - 4, wd + 10, 24); g.fillStyle = col; g.fillText(t, x, y); };
    m.boats.forEach((bt, k) => { const xs = bt.pts.map(q => q[0]), ys = bt.pts.map(q => q[1]); lab(bt.label, X((Math.min(...xs) + Math.max(...xs)) / 2) - 110, Y(Math.max(...ys)) + 22, m.col[k]); });
    lab('land, piers', 16, 12, '#b8e0a4'); lab('existing jetties', 130, 12, '#e0b080'); lab('new head arms', 270, 12, '#ffd9a0'); lab('white dashed: existing slip routes', 400, 12); lab('coloured dashed: longest checked loop', 690, 12); lab('red dots: buoys', 1000, 12, '#ff9aa2'); lab('red outline: decorative boat to move', 1140, 12, '#ff9aa2');
    lab('1 square = 1 tile', 16, c.height - 34);
  }, map);
  await mp.screenshot({ path: path.join(OUT, 'map.png') });
  await b.close();

  const result = { limits: report.limits, searchSeconds: report.searchSeconds, layoutsFound: report.jetties.map(j => ({ jetty: j.jetty, candidates: j.candidates, minGapHead: j.minGap_head, minGapStem: j.minGap_stem, pairs: Object.fromEntries(Object.entries(j.pairs).map(([k, q]) => [k, { slowerLoopS: q.slowerLoopS, newDeckTiles: q.newDeckTiles }])) })),
    boats, existingSlipRoutes: existing, moveFromSlip: moves.map(({ pts, ...m }) => m), loopTimeByRadius: radii, levels: table };
  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(result, null, 1));
  console.log(JSON.stringify({ boats: boats.map(b => ({ ...b, longerLoops: b.longerLoops.length })), existing, moves: moves.map(({ pts, ...m }) => m) }, null, 0));
})();
