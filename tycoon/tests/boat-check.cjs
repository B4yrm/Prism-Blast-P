// Static checks of every visual boat manoeuvre (no browser needed):
//   • departures, arrivals (from every point of the towing path and from
//     anywhere on the way out a boat can be called home) and the towing paths
//     never touch land, piers, the quay, a boat moored in another slip or a
//     decorative boat
//   • no boat's way out, towing or way home crosses the water where a neighbour
//     lingers with its nets out (first LINGER tiles of its tow), and no boat runs
//     over a fishing-ground buoy
//   • for information: arrivals from the fishing spot in 16 headings
//   • turns at sea are never tighter than the sea radius
//   • decorative boats sit in open water
//   • loop berths at the outer jetties: every loop and the move from each slip
//     clear of land, rocks, piers, jetties, head arms, decorative boats and buoys
//     by a quarter of the beam, and no two boats' loops share water
//   node tests/boat-check.cjs  → prints a JSON report, exit code 1 on failure
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.preview', 'boatpaths.cjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.buildSync({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'cjs', outfile: out, logLevel: 'error' });
delete require.cache[out];
const P = require(out);

const report = { departures: [], arrivals: [], fishing: [], decor: [], fails: [] };
const fail = msg => report.fails.push(msg);
const nB = 4;
const decor = P.DECOR_BOATS.map(d => P.decorHull(d, 0.12));
const buoys = [0, 1, 2, 3].flatMap(j => P.buoysAt(j).map(b => P.buoyPoly(b)));
// where boat j lingers with its nets out
const linger = j => {
  const d = P.departurePlan(j), e = P.poseAt(d[1].path, d[1].path.len), f = P.fishingPlan(j, e)[0].path, o = [];
  for (let s = 0; s <= P.LINGER + 1e-6; s += 0.25) { const q = P.poseAt(f, s); o.push(P.hullAt(q.x, q.y, q.a, 0.15)); }
  return o;
};
const lingers = [0, 1, 2, 3].map(linger);
// the straight final approach of boat j (a boat gliding in cannot stop for anyone)
const lane = j => {
  const g = P.arrivalPlan(j, P.groundPose(j))[1].path, o = [];
  for (let s = 0; s <= g.len + 1e-6; s += 0.25) { const q = P.poseAt(g, s); o.push(P.hullAt(q.x, q.y, q.a, 0.25)); }
  return o;
};
const lanes = [0, 1, 2, 3].map(lane);
const othersFor = i => [...[0, 1, 2, 3].filter(j => j !== i).map(P.dockedHull), ...decor, ...buoys, ...[0, 1, 2, 3].filter(j => j !== i).flatMap(j => lingers[j])];
const legR = leg => P.minRadius(leg.path);

for (let i = 0; i < nB; i++) {
  const others = othersFor(i);
  // departure
  const dep = P.departurePlan(i);
  const hits = P.planHits(dep, others), rSea = legR(dep[1]);
  report.departures.push({ berth: i, reverse: +dep[0].path.len.toFixed(2), sea: +dep[1].path.len.toFixed(2), reverseRadius: P.BERTH_MOVES[i].R, minSeaRadius: +rSea.toFixed(2), hits: hits.length });
  if (hits.length) fail(`departure ${i} touches something at ${JSON.stringify(hits[0])}`);
  if (rSea < P.SEA_R - 0.05) fail(`departure ${i} turns tighter than ${P.SEA_R}: ${rSea.toFixed(2)}`);
  // towing the nets from the end of the way out
  const end = P.poseAt(dep[1].path, dep[1].path.len);
  const fish = P.fishingPlan(i, end), fh = P.planHits(fish, others);
  report.fishing.push({ berth: i, len: +fish[0].path.len.toFixed(2), hits: fh.length });
  if (fh.length) fail(`fishing path ${i} touches something at ${JSON.stringify(fh[0])}`);
  // arrivals
  const starts = [];
  let anyHeading = 0;
  for (let k = 0; k < 16; k++) if (!P.planHits(P.arrivalPlan(i, { x: end.x, y: end.y, a: k * Math.PI / 8 }), others).length) anyHeading++;
  { const f = fish[0].path; for (let s = 0; s < f.len; s += f.len / 24) { const q = P.poseAt(f, s); starts.push({ ...q, from: `fishing/${s.toFixed(1)}` }); } }
  // called home while still on the way out: the boat first runs RETURN_FROM tiles out
  for (let s = P.RETURN_FROM[i]; s < dep[1].path.len; s += 0.25) { const q = P.poseAt(dep[1].path, s); starts.push({ ...q, from: `outbound/${s}` }); }
  let worst = Infinity, nHits = 0, maxLen = 0, sumLen = 0, nGround = 0;
  const othersAndLanes = [...others, ...[0, 1, 2, 3].filter(j => j !== i).flatMap(j => lanes[j])];
  for (const q of starts) {
    const plan = P.arrivalPlan(i, q), h = P.planHits(plan, othersAndLanes), r = legR(plan[0]);
    const len = plan[0].path.len + plan[1].path.len;
    worst = Math.min(worst, r); maxLen = Math.max(maxLen, len);
    if (q.from.startsWith('fishing/')) { sumLen += len; nGround++; }
    if (h.length) { nHits++; fail(`arrival ${i} from ${q.from} touches something at ${JSON.stringify(h[0])}`); }
    if (r < P.SEA_R - 0.05) fail(`arrival ${i} from ${q.from} turns tighter than ${P.SEA_R}: ${r.toFixed(2)}`);
  }
  report.arrivals.push({ berth: i, starts: starts.length, withHits: nHits, clearFromAnyOf16Headings: anyHeading, minRadius: +worst.toFixed(2), longest: +maxLen.toFixed(2), meanFromFishing: +(sumLen / nGround).toFixed(2) });
}
// harbour trips (heavily upgraded boats): straight out of the own slip and back
report.harbourTrips = [];
for (let i = 0; i < nB; i++) {
  const others = othersFor(i), dep = P.shortDeparture(i), e = P.shortSpot(i);
  const plan = [...dep, ...P.shortFishing(i, e), ...P.shortArrival(i, P.poseAt(P.shortFishing(i, e)[0].path, 0.3))];
  const h = P.planHits(plan, others);
  report.harbourTrips.push({ berth: i, out: +dep[0].path.len.toFixed(2), hits: h.length });
  if (h.length) fail(`harbour trip ${i} touches something at ${JSON.stringify(h[0])}`);
}
// decorative boats: in open water, clear of moored boats and of each other
P.DECOR_BOATS.forEach((d, k) => {
  const pts = P.hullPoints(d[0], d[1], d[3] * Math.PI / 4, 0.06, P.CLASS_S[d[2]] / P.CLASS_S[0] * d[4]);
  const onSolid = pts.filter(([x, y]) => P.solidAt(x, y)).length;
  const onBoat = pts.filter(([x, y]) => [0, 1, 2, 3].some(j => P.pointInPoly(x, y, P.dockedHull(j))) || decor.some((o, m) => m !== k && P.pointInPoly(x, y, o))).length;
  report.decor.push({ k, at: d.slice(0, 2), onSolid, onBoat });
  if (onSolid || onBoat) fail(`decor boat ${k} overlaps ${onSolid ? 'land/pier' : 'a boat'}`);
});
// ---- loop berths at the outer jetties (tools/boats/loops.cjs)
// Everything a loop or a move passes is checked with the hull grown by MARGIN (a quarter of the beam):
// land (also the unseen land west of the map), piers, jetties, head arms, surf rocks, decorative boats,
// buoys still out, and the water of the other boats' loops.
{
  const bundle = (src, name) => { const o = path.join(root, '.preview', name); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: o, logLevel: 'error' }); delete require.cache[o]; return require(o); };
  const C = bundle('src/config.js', 'config.cjs'), W = bundle('src/render/water.js', 'water.cjs');
  const MARGIN = +(0.25 * 2 * P.HULL.half).toFixed(2);
  const rocks = W.surfRocks().map(r => ({ x: r.x, y: r.y, r: 0.42 * r.s }));
  const inRects = (rs, x, y) => rs.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1);
  const hardAt = (x, y) => C.isLand(Math.floor(x), Math.floor(y)) || inRects(C.PIERS, x, y) || P.JETTIES.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1) || rocks.some(r => Math.hypot(x - r.x, y - r.y) <= r.r);
  const armAt = (x, y) => P.HEAD_ARMS.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const decorPolys = P.DECOR_BOATS.map(d => P.decorHull(d));
  const moored = k => P.siteHull(4 + k, 0.05);
  // first thing the hull (grown) touches along a leg between s0 and s1
  const touch = (leg, grow, opt, s0 = 0, s1 = leg.path.len) => {
    for (let s = s0; s <= s1 + 1e-6; s += 0.16) {
      const q = P.poseAt(leg.path, Math.min(s, leg.path.len)), h = leg.dir > 0 ? q.a : q.a + Math.PI;
      for (const [x, y] of P.hullPoints(q.x, q.y, h, grow)) {
        if (hardAt(x, y)) return ['land, pier, jetty or rock', +q.x.toFixed(2), +q.y.toFixed(2)];
        if (opt.arms && armAt(x, y)) return ['head arm', +q.x.toFixed(2), +q.y.toFixed(2)];
        if (decorPolys.some(o => P.pointInPoly(x, y, o))) return ['decorative boat', +q.x.toFixed(2), +q.y.toFixed(2)];
        if ((opt.polys || []).some(o => P.pointInPoly(x, y, o))) return ['boat', +q.x.toFixed(2), +q.y.toFixed(2)];
      }
      const big = P.hullAt(q.x, q.y, h, grow + 0.2);              // a buoy is 0.2 tiles across
      for (const g of opt.buoys || []) for (const [bx, by] of P.buoysAt(g)) if (P.pointInPoly(bx, by, big)) return ['buoy of ground ' + (g + 1), +q.x.toFixed(2), +q.y.toFixed(2)];
    }
    return null;
  };
  // water swept by a leg (0.1-tile cells, hull grown by MARGIN / 2): two sweeps that share no cell are ≥ MARGIN apart
  const GX0 = -24, GY0 = 16, GW = 760;
  const sweep = leg => { const S = new Set(); for (let s = 0; s <= leg.path.len + 1e-6; s += 0.16) { const q = P.poseAt(leg.path, Math.min(s, leg.path.len)), poly = P.hullAt(q.x, q.y, leg.dir > 0 ? q.a : q.a + Math.PI, MARGIN / 2); const xs = poly.map(v => v[0]), ys = poly.map(v => v[1]);
    for (let cy = Math.floor((Math.min(...ys) - GY0) * 10); cy <= Math.ceil((Math.max(...ys) - GY0) * 10); cy++) for (let cx = Math.floor((Math.min(...xs) - GX0) * 10); cx <= Math.ceil((Math.max(...xs) - GX0) * 10); cx++) { const key = cy * GW + cx; if (!S.has(key) && P.pointInPoly(GX0 + (cx + 0.5) / 10, GY0 + (cy + 0.5) / 10, poly)) S.add(key); } } return S; };
  const meets = (A, B) => { const [a, b] = A.size < B.size ? [A, B] : [B, A]; for (const k of a) if (b.has(k)) return true; return false; };
  report.loops = []; report.moves = []; report.slipRoutesAcrossHeadArms = [];
  const sweeps = [0, 1, 2, 3].map(k => P.LOOP_BERTHS[k].loops.map(n => sweep(P.loopPlan(k, n).plan[0])));
  for (let k = 0; k < nB; k++) {
    const B = P.LOOP_BERTHS[k];
    for (const [m, n] of B.loops.entries()) {
      const L = P.loopPlan(k, n), leg = L.plan[0];
      // the shortest loop is sailed while other grounds' buoys are still out; the longer ones once all are in
      const t = touch(leg, MARGIN, { arms: true, buoys: n ? [] : P.MOVE_ORDER.slice(P.MOVE_ORDER.indexOf(k) + 1) });   // boats that moved earlier have taken their buoys in
      const others = [0, 1, 2, 3].filter(j => j !== k && sweeps[j].some(sw => meets(sweeps[k][m], sw)));
      const end = P.poseAt(leg.path, leg.path.len), closed = Math.hypot(end.x - B.x, end.y - B.y) < 0.05, rMin = P.minRadius(leg.path);
      report.loops.push({ boat: k, extra: n, tiles: +leg.path.len.toFixed(1), touches: t, sharesWaterWithBoat: others, closed, minRadius: +rMin.toFixed(2) });
      if (t) fail(`loop of boat ${k} (+${n}) comes within ${MARGIN} tiles of ${t[0]} at (${t[1]}, ${t[2]})`);
      if (others.length) fail(`loop of boat ${k} (+${n}) shares water with boat ${others}`);
      if (!closed) fail(`loop of boat ${k} (+${n}) does not come back to its berth`);
      if (rMin < P.LOOP_R - 0.06) fail(`loop of boat ${k} (+${n}) turns tighter than ${P.LOOP_R}: ${rMin.toFixed(2)}`);
    }
    // made fast: the hull is clear of the pier and of everything else, and still off the pier while it is hauled in
    const S = P.siteOf(4 + k), mt = touch({ path: P.loopPlan(k, 0).plan[0].path, dir: 1 }, 0.05, { arms: true }, 0, 0);
    const fast = P.hullPoints(S.x, S.y, S.a, 0.05).some(([x, y]) => hardAt(x, y) || armAt(x, y) || decorPolys.some(o => P.pointInPoly(x, y, o)));
    if (mt || fast) fail(`boat ${k} touches something at its loop berth`);
    // the one move from the slip: boats earlier in MOVE_ORDER lie at their loop berths, later ones in their slips;
    // the head arms are there unless this is the stem boat going first; its own buoys and those of earlier boats are in
    const rank = P.MOVE_ORDER.indexOf(k), before = P.MOVE_ORDER.slice(0, rank), after = P.MOVE_ORDER.slice(rank + 1);
    const M = P.movePlan(k), arms = !(B.fam === 'stem' && rank === 0), polys = [...before.map(moored), ...after.map(j => P.dockedHull(j))], buoysOut = after;
    const sea = M.plan[1], t0 = touch(M.plan[0], 0.06, { arms, polys }), t1 = touch(sea, 0.06, { arms, polys, buoys: buoysOut }), t2 = touch(sea, MARGIN, { arms, polys, buoys: buoysOut }, sea.path.len * 0.6);
    const endM = P.poseAt(sea.path, sea.path.len), rM = P.minRadius(sea.path);
    report.moves.push({ boat: k, order: rank + 1, tiles: +(M.plan[0].path.len + sea.path.len).toFixed(1), touches: t0 || t1, lastPartWithinMargin: t2, endsAtBerth: Math.hypot(endM.x - B.x, endM.y - B.y) < 0.05, minRadius: +rM.toFixed(2) });
    if (t0 || t1) fail(`move of boat ${k} touches ${(t0 || t1)[0]} at (${(t0 || t1)[1]}, ${(t0 || t1)[2]})`);
    if (t2) fail(`move of boat ${k} comes within ${MARGIN} tiles of ${t2[0]} near its new berth`);
    if (Math.hypot(endM.x - B.x, endM.y - B.y) >= 0.05) fail(`move of boat ${k} does not end at its berth`);
    if (rM < P.LOOP_R - 0.06) fail(`move of boat ${k} turns tighter than ${P.LOOP_R}`);
  }
  // which slip routes run where the head arms will be (for information: the game builds the arms only when no
  // boat is out on a slip trip, and from then on slip boats make harbour trips until they move)
  const armPolys = P.HEAD_ARMS.map(([x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  for (let i = 0; i < nB; i++) {
    const dep = P.departurePlan(i), end = P.poseAt(dep[1].path, dep[1].path.len), f = P.fishingPlan(i, end);
    const grounds = P.planHits([...dep, ...f, ...P.arrivalPlan(i, P.poseAt(f[0].path, P.LINGER))], armPolys).length > 0;
    const sh = P.shortSpot(i), harbour = P.planHits([...P.shortDeparture(i), ...P.shortFishing(i, sh), ...P.shortArrival(i, sh)], [...armPolys, ...P.MOVE_ORDER.slice(0, P.MOVE_ORDER.indexOf(i)).map(moored)]).length > 0;   // boats that move before this one
    report.slipRoutesAcrossHeadArms.push({ slip: i, tripToTheGrounds: grounds, harbourTrip: harbour });
    if (harbour) fail(`harbour trip of slip ${i} touches a head arm or a boat at a loop berth`);
  }
}
report.ok = report.fails.length === 0;
console.log(JSON.stringify(report, null, 1));
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results', 'boat-check.json'), JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
