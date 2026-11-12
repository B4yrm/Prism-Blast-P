// Outer berths and fishing-zone ladders (writes src/render/boatzones.js):
//   1. OUTER_MOVES: the quickest back-out from each outer berth that touches
//      nothing (land, piers, jetties, moored or decorative boats);
//   2. ZONES[i].slip: nearer fishing zones in front of boat i's slip, and
//      ZONES[i].outer: zones in boat i's own sector, from far to near, each one
//      clear for the way out (also straight from the slip, for the first trip
//      after the jetties are built), the tow and the way home, and clear of the
//      water where any other boat lingers with its nets in any of its zones.
//   node tools/boats/zones.mjs
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, '.preview', 'boatpaths.mjs');
await esbuild.build({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const P = await import(out + '?' + Date.now());
const NORTH = -Math.PI / 2;
const decor = P.DECOR_BOATS.map(d => P.decorHull(d, 0.12));
const sites = [0, 1, 2, 3, 4, 5, 6, 7];
const docked = s => P.siteHull(s, 0.05);
const buoys = [0, 1, 2, 3].flatMap(j => P.buoysAt(j).map(b => P.buoyPoly(b)));
const obstacles = i => [...sites.filter(s => s !== i && s !== 4 + i).map(docked), ...decor, ...buoys];

// boat i's sea sector at the outer berths (x0, y0, x1, y1)
const SECTOR = [[-2, 33, 7, 41], [22, 33, 30, 41], [-11, 32, -3, 41], [31, 31, 40, 40]];

// ---- 1. outer back-out moves
const moves = [];
for (let i = 0; i < 4; i++) {
  const s = 4 + i, obs = obstacles(i);
  let best = null;
  for (const side of [1, -1]) for (let d0 = 0; d0 <= 4.0001; d0 += 0.25) for (const R of [2.5, 3, 3.5]) for (let deg = 40; deg <= 110; deg += 10) {
    const mv = { side, d0: +d0.toFixed(2), R, phi: +(deg * Math.PI / 180).toFixed(3) };
    const C = SECTOR[i], dep = P.siteDeparture(s, { x: (C[0] + C[2]) / 2, y: (C[1] + C[3]) / 2, a: Math.PI / 2 }, mv), rev = dep[0];
    const score = rev.path.len / 0.55 + dep[1].path.len;      // backing out is slow: weigh it like the search for the slips
    if (P.planHits([rev], obs).length) continue;
    const seaClear = !P.planHits([dep[1]], obs).length;           // prefer moves whose way to the sector is clear too
    const sc = score + (seaClear ? 0 : 1000);
    if (best && sc >= best.score) continue;
    best = { mv, score: sc, seaClear };
  }
  moves.push(best.mv);
  console.log('outer berth', i, JSON.stringify(best));
}
// make the moves live for the rest of the search
P.OUTER_MOVES.splice(0, 4, ...moves);

// ---- 2. zone candidates
const tow = (i, g) => P.fishingPlan(i, g);
const lingerOf = (i, g) => { const f = tow(i, g)[0].path, o = []; for (let s = 0; s <= P.LINGER + 1e-6; s += 0.5) { const q = P.poseAt(f, s); o.push(P.hullAt(q.x, q.y, q.a, 0.15)); } return o; };
function evaluate(i, tier, g) {
  const site = tier === 'outer' ? 4 + i : i, obs = obstacles(i);
  const dep = P.siteDeparture(site, g);
  if (P.minRadius(dep[1].path) < P.SEA_R - 0.05 || P.planHits([dep[1]], obs).length) return null;
  if (tier === 'outer') { const tr = P.siteDeparture(i, g); if (P.planHits(tr, obs).length) return null; }
  const t = tow(i, g);
  if (P.planHits(t, obs).length) return null;
  let back = 0;
  const routes = [dep, t];
  for (const s of [0, P.LINGER]) {
    const q = P.poseAt(t[0].path, s), arr = P.siteArrival(site, q);
    if (P.planHits(arr, obs).length) return null;
    back += arr[0].path.len / 2; routes.push(arr);
  }
  if (tier === 'outer') routes.push(P.siteDeparture(i, g));
  return { g, S: dep[1].path.len + back, routes, linger: lingerOf(i, g) };
}
const clearOf = (A, B) => !A.routes.some(r => P.planHits(r, B.linger).length) && !B.routes.some(r => P.planHits(r, A.linger).length);
const chosen = [[], [], [], []];             // all zones of every boat (for cross checks)
// the full grounds are fixed
for (let i = 0; i < 4; i++) { const g = P.groundPose(i); const e = evaluate(i, 'slip', g); if (!e) { console.log('full ground of', i, 'not clear!'); process.exit(1); } chosen[i].push(e); }
const sFull = chosen.map(c => c[0].S);
const result = [0, 1, 2, 3].map(() => ({ slip: [], outer: [] }));
for (const tier of ['slip', 'outer']) for (let i = 0; i < 4; i++) {
  const site = P.siteOf(tier === 'outer' ? 4 + i : i);
  const box = tier === 'outer' ? SECTOR[i] : [site.x - 7, site.my + 2, site.x + 7, site.my + 9];
  const cands = [];
  for (let x = box[0]; x <= box[2]; x += 1) for (let y = box[1]; y <= box[3]; y += 1) for (let h = 0; h < 32; h += 2) {
    const e = evaluate(i, tier, { x, y, a: h * Math.PI / 16 });
    if (e) { e.head = h; cands.push(e); }
  }
  // ladder: each step at least 2 tiles shorter than the one before (the slip ladder
  // starts below the full grounds)
  const targets = tier === 'slip' ? [0.62 * sFull[i], 0.45 * sFull[i]] : [22, 15, 10];
  let ceiling = tier === 'slip' ? sFull[i] - 2 : Infinity;
  for (const T of targets) {
    cands.sort((a, b) => Math.abs(a.S - T) - Math.abs(b.S - T));
    const pick = cands.find(c => c.S <= ceiling && chosen.every((Z, j) => j === i || Z.every(z => clearOf(c, z))));
    if (pick) ceiling = pick.S - 2;
    if (!pick) { console.log('no clear zone', tier, i, 'for S', T.toFixed(1)); continue; }
    chosen[i].push(pick);
    result[i][tier].push({ x: pick.g.x, y: pick.g.y, head: pick.head, S: +pick.S.toFixed(1) });
    console.log(tier, 'boat', i, 'target', T.toFixed(1), '→', JSON.stringify(result[i][tier].at(-1)), 'of', cands.length);
  }
}
const src = `// Generated by tools/boats/zones.mjs — do not edit by hand.
// OUTER_MOVES: how boat i backs out of its outer berth (like BERTH_MOVES for the slips).
// ZONES[i].slip / ZONES[i].outer: fishing zones from far to near (x, y, heading in
// π/16 steps, S = way out + mean way home in tiles); the boat takes the farthest
// one its trip time allows (the slip ladder starts with the full fishing ground).
export const OUTER_MOVES = ${JSON.stringify(moves)};
export const ZONES = ${JSON.stringify(result)};
`;
fs.writeFileSync(path.join(root, 'src/render/boatzones.js'), src);
console.log('written src/render/boatzones.js');
