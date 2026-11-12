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
//   • outer berths and every nearer / sector fishing zone: way out (also from
//     the slip for the first trip after the jetties are built), tow and way
//     home clear of everything and of the water where other boats fish
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
// outer berths and fishing-zone ladders (tools/boats/zones.mjs)
report.zones = [];
{
  const zonePose = z => ({ x: z.x, y: z.y, a: z.head * Math.PI / 16 });
  const lingerAtZ = (i, z) => { if (!z.R) return lingerAt(i, zonePose(z)); const f = P.fishTurnPlan(zonePose(z), z.R, z.sweep)[0].path, o = []; for (let s = 0; s <= f.len + 1e-6; s += 0.25) { const q = P.poseAt(f, s); o.push(P.hullAt(q.x, q.y, q.a, 0.15)); } return o; };
  const lingerAt = (i, g) => { const f = P.fishingPlan(i, g)[0].path, o = []; for (let s = 0; s <= P.LINGER + 1e-6; s += 0.25) { const q = P.poseAt(f, s); o.push(P.hullAt(q.x, q.y, q.a, 0.15)); } return o; };
  const allZones = i => [{ tier: 'slip', g: P.groundPose(i) }, ...P.ZONES[i].slip.map(z => ({ tier: 'slip', g: zonePose(z), z })), ...P.ZONES[i].outer.map(z => ({ tier: 'outer', g: zonePose(z), z }))];
  // the whole fleet works one step at a time: zones are checked against the same step of the other boats
  const lingersOf = [0, 1, 2, 3].map(j => ({ slip: P.ZONES[j].slip.flatMap(z => lingerAt(j, zonePose(z))), outer: P.ZONES[j].outer.flatMap(z => lingerAtZ(j, z)) }));
  for (let i = 0; i < nB; i++) {
    const obs = [...[0, 1, 2, 3, 4, 5, 6, 7].filter(s => s !== i && s !== 4 + i).map(s => P.siteHull(s, 0.05)), ...decor, ...buoys];
    for (const z of allZones(i).slice(1)) {
      const cross = [0, 1, 2, 3].filter(j => j !== i).flatMap(j => lingersOf[j][z.tier]);
      const site = z.tier === 'outer' ? 4 + i : i, routes = [P.siteDeparture(site, z.g), z.z && z.z.R ? P.fishTurnPlan(z.g, z.z.R, z.z.sweep) : P.fishingPlan(i, z.g)];
      if (z.tier === 'outer') routes.push(P.siteDeparture(i, z.g));          // the first trip after the jetties are built
      const t = routes[1][0].path;
      if (z.z && z.z.R) routes.push(P.siteArrival(site, P.poseAt(t, t.len)));        // the turn is always completed
      else for (let s = 0; s <= t.len + 1e-6; s += 0.5) routes.push(P.siteArrival(site, P.poseAt(t, s)));
      let hits = 0, minR = Infinity;
      for (const r of routes) {
        const h = P.planHits(r, [...obs, ...cross]);
        if (h.length) { hits++; fail(`${z.tier} zone of boat ${i} at (${z.g.x}, ${z.g.y}): touches something at ${JSON.stringify(h[0])}`); }
        for (const leg of r) if (leg.kind === 'sea') minR = Math.min(minR, P.minRadius(leg.path));
      }
      if (minR < P.SEA_R - 0.05) fail(`${z.tier} zone of boat ${i}: turn tighter than ${P.SEA_R} (${minR.toFixed(2)})`);
      report.zones.push({ boat: i, tier: z.tier, at: [z.g.x, z.g.y], routes: routes.length, hits, minRadius: +minR.toFixed(2) });
    }
  }
}
report.ok = report.fails.length === 0;
console.log(JSON.stringify(report, null, 1));
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results', 'boat-check.json'), JSON.stringify(report, null, 1));
process.exit(report.ok ? 0 : 1);
