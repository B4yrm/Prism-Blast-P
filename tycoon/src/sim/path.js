// Walkable grid (roads, pavements, quay) and cached A* paths between tiles.
import { ROADS, PAVE, BUILDINGS, POI } from '../config.js';

const walk = new Set();
const key = (i, j) => i * 1000 + j;
const rects = [...ROADS, ...PAVE];
for (const [x0, y0, x1, y1] of rects)
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) walk.add(key(i, j));
for (const b of Object.values(BUILDINGS)) walk.add(key(b.door[0], b.door[1]));
walk.add(key(POI.spawn[0], POI.spawn[1]));

export const isWalk = (i, j) => walk.has(key(i, j));
export const isRoad = (i, j) => ROADS.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1);

const cache = new Map();

// Returns tile-centre waypoints from a to b (inclusive), or null.
export function findPath(a, b) {
  const k = key(a[0], a[1]) * 100000 + key(b[0], b[1]);
  if (cache.has(k)) return cache.get(k);
  const start = key(a[0], a[1]), goal = key(b[0], b[1]);
  const open = [start], g = new Map([[start, 0]]), came = new Map();
  const h = n => Math.abs(Math.floor(n / 1000) - b[0]) + Math.abs((n % 1000) - b[1]);
  const f = new Map([[start, h(start)]]);
  let res = null;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === goal) {
      res = [];
      for (let n = cur; n !== undefined; n = came.get(n)) res.push([Math.floor(n / 1000) + 0.5, (n % 1000) + 0.5]);
      res.reverse();
      break;
    }
    const ci = Math.floor(cur / 1000), cj = cur % 1000;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di, nj = cj + dj, nk = key(ni, nj);
      if (!walk.has(nk)) continue;
      const ng = g.get(cur) + 1;
      if (ng < (g.has(nk) ? g.get(nk) : Infinity)) {
        came.set(nk, cur); g.set(nk, ng); f.set(nk, ng + h(nk));
        if (!open.includes(nk)) open.push(nk);
      }
    }
  }
  cache.set(k, res && simplify(res));
  return cache.get(k);
}

// Drop collinear points so walkers move in long straight legs.
function simplify(p) {
  if (p.length < 3) return p;
  const out = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = out[out.length - 1], b = p[i], c = p[i + 1];
    if (Math.sign(b[0] - a[0]) === Math.sign(c[0] - b[0]) && Math.sign(b[1] - a[1]) === Math.sign(c[1] - b[1])) continue;
    out.push(b);
  }
  out.push(p[p.length - 1]);
  return out;
}

export function pathLen(p) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]);
  return d;
}
