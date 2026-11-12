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
const SECTOR = [[-3, 33, 8, 42], [20, 33, 30, 42], [-13, 31, -3, 42], [30, 30, 42, 41]];

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

// ---- 2. zone candidates (fast: obstacles rasterised once on a 0.1-tile grid)
const T0 = Date.now(), LIMIT_MS = 15 * 60 * 1000;         // never search longer than this
const GX0 = -16, GY0 = 16, GW = 600, GH = 330, RES = 10;   // x −16…44, y 16…49
const grid = () => new Uint8Array(GW * GH);
const cellOf = (x, y) => { const i = Math.floor((x - GX0) * RES), j = Math.floor((y - GY0) * RES); return i < 0 || j < 0 || i >= GW || j >= GH ? -1 : j * GW + i; };
function paintPoly(G, poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  for (let y = y0; y <= y1; y += 0.1) for (let x = x0; x <= x1; x += 0.1) if (P.pointInPoly(x, y, poly)) { const c = cellOf(x, y); if (c >= 0) G[c] = 1; }
}
const STATIC = grid();
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) if (P.solidAt(GX0 + (i + 0.5) / RES, GY0 + (j + 0.5) / RES)) STATIC[j * GW + i] = 1;
for (const d of decor) paintPoly(STATIC, d);
for (const b of buoys) paintPoly(STATIC, b);
const SITEG = sites.map(s => { const G = grid(); paintPoly(G, docked(s)); return G; });
const obsGrid = i => { const G = STATIC.slice(); sites.forEach(s => { if (s !== i && s !== 4 + i) for (let c = 0; c < G.length; c++) if (SITEG[s][c]) G[c] = 1; }); return G; };
// hull outline points of every pose along a plan (every 0.25 tiles)
function samples(plan) {
  const out = [];
  for (const leg of plan) for (let s = 0; s <= leg.path.len + 1e-6; s += 0.12) {
    const q = P.poseAt(leg.path, s), h = leg.dir > 0 ? q.a : q.a + Math.PI;
    for (const [x, y] of P.hullPoints(q.x, q.y, h, 0.06)) out.push(cellOf(x, y));
  }
  return out;
}
const hits = (cells, G) => cells.some(c => c < 0 ? false : G[c]);
const tow = (i, g) => P.fishingPlan(i, g);
const lingerOf = (i, g) => { const f = (g.R ? P.fishTurnPlan(g, g.R, g.sweep) : tow(i, g))[0].path, G = grid(); for (let s = 0; s <= (g.R ? f.len : P.LINGER) + 1e-6; s += 0.25) { const q = P.poseAt(f, s); paintPoly(G, P.hullAt(q.x, q.y, q.a, 0.15)); } return G; };
function evaluate(i, tier, g, OG) {
  const site = tier === 'outer' ? 4 + i : i;
  const dep = P.siteDeparture(site, g);
  if (P.minRadius(dep[1].path) < P.SEA_R - 0.05) return null;
  const cells = [], push = plan => { const c = samples(plan); if (hits(c, OG)) return false; cells.push(...c); return true; };
  if (!push([dep[1]])) return null;
  if (tier === 'outer' && !push(P.siteDeparture(i, g))) return null;     // first trip after the jetties are built
  if (tier === 'outer') {                     // net towed through the turn for home
    const t = P.fishTurnPlan(g, g.R, g.sweep);
    if (!push(t)) return null;
    const arr = P.siteArrival(site, P.poseAt(t[0].path, t[0].path.len));
    if (P.minRadius(arr[0].path) < P.SEA_R - 0.05 || !push(arr)) return null;
    return { g, S: dep[1].path.len + t[0].path.len + arr[0].path.len, cells, turn: t };
  }
  const t = tow(i, g);
  if (!push(t)) return null;
  let back = 0;
  for (const s of [0, P.LINGER]) {
    const arr = P.siteArrival(site, P.poseAt(t[0].path, s));
    if (P.minRadius(arr[0].path) < P.SEA_R - 0.05 || !push(arr)) return null;
    back += arr[0].path.len / 2;
  }
  return { g, S: dep[1].path.len + back, cells };
}
// The whole fleet uses the same ladder step at a time (the slowest boat decides),
// so zones only have to be clear of the zones of the same step.
const clearOf = (A, B) => !hits(A.cells, B.linger) && !hits(B.cells, A.linger);
const full = [];
for (let i = 0; i < 4; i++) {                 // step 0: the full fishing grounds (fixed)
  // (checked against everything by tests/boat-check.cjs; here only its traffic is needed)
  const e = evaluate(i, 'slip', P.groundPose(i), grid());
  full.push(e);
}
const sFull = full.map(e => e.S);
const result = [0, 1, 2, 3].map(() => ({ slip: [], outer: [] }));
const cands = { slip: [], outer: [] };
for (const tier of ['slip', 'outer']) for (let i = 0; i < 4; i++) {
  const OG = obsGrid(i), box = SECTOR[i], list = [];
  const turns = tier === 'outer' ? [[3, 1], [3, -1], [4, 1], [4, -1], [5, 1], [5, -1]] : [[0, 0]];
  for (let x = box[0]; x <= box[2]; x += 1) for (let y = box[1]; y <= box[3]; y += 1) for (let h = 0; h < 32; h += 2) for (const [R, sweep] of turns) {
    if (Date.now() - T0 > LIMIT_MS) break;
    const e = evaluate(i, tier, { x, y, a: h * Math.PI / 16, R, sweep }, OG);
    if (e) { e.head = h; list.push(e); }
  }
  cands[tier][i] = list;
  console.log(tier, 'boat', i, list.length, 'clear candidates, S', list.length ? Math.min(...list.map(e => e.S)).toFixed(1) + '–' + Math.max(...list.map(e => e.S)).toFixed(1) : '-');
}
// steps: share of the full trip (slip) / absolute way out + home (outer)
// slips: nearer zones barely shorten a trip (turning for home costs most), so the
// outer sectors only need their shortest clear zone per boat
const STEPS = [['slip', i => 0.8 * sFull[i]], ['outer', () => 0]];
const last = { slip: sFull.map(s => s), outer: [Infinity, Infinity, Infinity, Infinity] };
for (const [tier, target] of STEPS) {
  // pick boat by boat (fewest candidates first), each clear of the picks already
  // made for this step; back-track a little if a later boat finds nothing
  const order = [0, 1, 2, 3].sort((a, b) => cands[tier][a].length - cands[tier][b].length);
  const lists = order.map(i => cands[tier][i].filter(c => c.S <= last[tier][i] - 2).sort((a, b) => Math.abs(a.S - target(i)) - Math.abs(b.S - target(i))).slice(0, 400));
  for (const L of lists) for (const c of L) c.linger = c.linger || lingerOf(order[lists.indexOf(L)], c.g);
  const picks = [], tries = { n: 0 };
  const place = d => {
    if (d === 4) return true;
    for (const c of lists[d]) {
      if (++tries.n > 200000) return false;
      if (picks.every(p => p && clearOf(c, p))) { picks[d] = c; if (place(d + 1)) return true; picks[d] = undefined; }
    }
    return false;
  };
  const ok = place(0);
  if (!ok) console.log('step', tier, ': no clear set of zones (', tries.n, 'tries)');
  else { const byBoat = []; order.forEach((i, d) => { byBoat[i] = picks[d]; }); picks.length = 0; picks.push(...byBoat); }
  if (!ok) continue;
  picks.forEach((p, i) => { last[tier][i] = p.S; result[i][tier].push({ x: p.g.x, y: p.g.y, head: p.head, ...(p.g.R ? { R: p.g.R, sweep: p.g.sweep } : {}), S: +p.S.toFixed(1) }); });
  console.log('step', tier, 'S', picks.map(p => p.S.toFixed(1)).join(' / '), `(${((Date.now() - T0) / 1000).toFixed(0)} s)`);
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
