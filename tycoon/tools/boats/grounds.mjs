// Chooses where each boat tows its nets (GROUND in src/render/boatpaths.js):
// an offset from the simulation's fishing spot (within 2 tiles, among its
// buoys) and a heading, such that
//   • way out, towing and way home never touch land, piers, moored or
//     decorative boats (as tests/boat-check.cjs checks), and
//   • no boat's way out or home passes the water where a neighbouring boat
//     lingers with its nets out (the first LINGER tiles of its tow),
// with way out + way home as short as possible.
//   node tools/boats/grounds.mjs
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, '.preview', 'boatpaths.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
await esbuild.build({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const P = await import(out + '?' + Date.now());
const decor = P.DECOR_BOATS.map(d => P.decorHull(d, 0.12));
const obstacles = i => [...[0, 1, 2, 3].filter(j => j !== i).map(P.dockedHull), ...decor];

// hull capsules (stern → stem, half-beam radius) for the cross-berth test
const cap = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a), r = P.HULL.half; return [x + c * (P.HULL.bow - r), y + s * (P.HULL.bow - r), x - c * (P.HULL.stern - r), y - s * (P.HULL.stern - r), r]; };
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {
  const ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy, wx = ax - cx, wy = ay - cy;
  const a = ux * ux + uy * uy, b = ux * vx + uy * vy, c = vx * vx + vy * vy, d = ux * wx + uy * wy, e = vx * wx + vy * wy, D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c; } else { sN = b * e - c * d; tN = a * e - b * d; if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; } }
  if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
  else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
  const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
  return Math.hypot(wx + sc * ux - tc * vx, wy + sc * uy - tc * vy);
}
const gap = (A, B) => segDist(A[0], A[1], A[2], A[3], B[0], B[1], B[2], B[3]) - A[4] - B[4];
const legCaps = (leg, step = 0.25) => { const o = []; for (let s = 0; s <= leg.path.len + 1e-6; s += step) { const q = P.poseAt(leg.path, s); o.push(cap(q.x, q.y, leg.dir > 0 ? q.a : q.a + Math.PI)); } return o; };

const cands = [];
for (let i = 0; i < 4; i++) {
  const list = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let head = 0; head < 32; head++) {
    const g = { dx, dy, head }, dep = P.departurePlan(i, P.BERTH_MOVES[i], P.SEA_R, g);
    const sea = dep[1];
    if (P.planHits([sea], obstacles(i)).length) continue;
    const e = P.poseAt(sea.path, sea.path.len), tow = P.fishingPlan(i, e);
    if (P.planHits(tow, obstacles(i)).length) continue;
    let ok = true, arrLen = 0, n = 0;
    const arrivals = [];
    for (let s = 0; s <= P.LINGER + 1e-6 && ok; s += 0.5) {
      const q = P.poseAt(tow[0].path, s), arr = P.arrivalPlan(i, q);
      if (P.planHits(arr, obstacles(i)).length) ok = false;
      arrLen += arr[0].path.len + arr[1].path.len; n++; arrivals.push(arr);
    }
    if (!ok) continue;
    const linger = []; for (let s = 0; s <= P.LINGER + 1e-6; s += 0.5) { const q = P.poseAt(tow[0].path, s); linger.push(cap(q.x, q.y, q.a)); }
    const traffic = [...legCaps(sea), ...arrivals.flatMap(a => [...legCaps(a[0]), ...legCaps(a[1])])];
    list.push({ g, cost: sea.path.len + arrLen / n, linger, traffic });
  }
  list.sort((a, b) => a.cost - b.cost);
  cands.push(list.slice(0, 80));
  console.log('berth', i, list.length, 'clear options; best', JSON.stringify(list[0] && { g: list[0].g, cost: +list[0].cost.toFixed(2) }));
}
// pairs of neighbours share water: west (0, 2) and east (1, 3)
const clear = (A, B) => A.traffic.every(t => B.linger.every(l => gap(t, l) > 0.3)) && B.traffic.every(t => A.linger.every(l => gap(t, l) > 0.3)) && A.linger.every(a => B.linger.every(b => gap(a, b) > 0.3));
const pick = [null, null, null, null];
for (const [i, j] of [[0, 2], [1, 3]]) {
  let best = null;
  for (const A of cands[i]) for (const B of cands[j]) {
    const c = A.cost + B.cost;
    if (best && c >= best.c) continue;
    if (clear(A, B)) best = { c, A, B };
  }
  if (!best) { console.log('no clear pair for', i, j); continue; }
  pick[i] = best.A; pick[j] = best.B;
  console.log('pair', i, j, 'cost', best.c.toFixed(2), JSON.stringify(best.A.g), JSON.stringify(best.B.g));
}
// the inner and outer pairs never meet, but check all pairs anyway
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (pick[i] && pick[j] && !clear(pick[i], pick[j])) console.log('WARNING: berths', i, j, 'not clear');
console.log('GROUND =', JSON.stringify(pick.map(p => p && p.g)));
