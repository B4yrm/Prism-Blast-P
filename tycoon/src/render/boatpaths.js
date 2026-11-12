// Visual boat manoeuvres (render only).
//
// The simulation's boats keep their own straight routes and exact timings
// (sim/sim.js). These paths only decide how a boat *looks* on the way:
// backing out of its slip with the stern swinging, stopping and going ahead
// in open water, following smooth curves at sea, and gliding bow-first into
// the slip. Pure geometry: shared by the game and by the automatic clearance
// check (tests/boat-check.cjs).
import { BERTHS, PIERS, BOUNDS, isLand } from '../config.js';
import { OUTER_MOVES, ZONES } from './boatzones.js';
export { OUTER_MOVES, ZONES };

// Class-0 hull at the waterline (tiles): bow tip, stern, half beam.
export const HULL = { bow: 2.04, stern: 1.89, half: 0.61 };
const L = 1.885, W = 0.609;                       // hull shape parameters (see tools/bake/units.js)

// Where each boat lies when moored (the simulation's berth, nudged clear of the
// quay where the hull would touch it). Visual only.
export const VBERTH = [[9.6, 26.5], [16.6, 26.5], [4.3, 27.0], [22.6, 26.3]];

// Straight final approach into each slip starts at this y (bow just clear of the pier heads)
// + APPROACH tiles for the hull to line up.
export const MOUTH_Y = [32.4, 32.4, 32.4, 30.4];
export const APPROACH = 1.2;

// Departure manoeuvre per berth (found by tools/boats/search.mjs, checked by
// tests/boat-check.cjs): back straight out d0 tiles, then back along an arc of
// radius R through phi radians with the stern swinging to `side` (+1 east,
// −1 west), stop, and go ahead to the fishing ground.
export const BERTH_MOVES = [
  { side: 1, d0: 1.5, R: 2.5, phi: 1.222 },
  { side: -1, d0: 2.5, R: 2.5, phi: 0.873 },
  { side: 1, d0: 2, R: 2.5, phi: 0.873 },
  { side: -1, d0: 0.75, R: 2.5, phi: 0.873 },
];

// Decorative moored boats [x, y, class, heading index (8 directions), sprite scale],
// placed clear of every manoeuvre (checked by tests/boat-check.cjs).
export const DECOR_BOATS = [[24.6, 24.6, 1, 0, 0.55], [2.0, 25.6, 0, 1, 0.6], [34.0, 26.6, 1, 5, 0.7], [27.5, 23.6, 2, 2, 0.5]];
export const CLASS_S = [1.45, 1.7, 2.0];             // hull size factor of each baked boat class
export const decorHull = ([x, y, c, d, sc], grow = 0) => hullAt(x, y, d * Math.PI / 4, grow, CLASS_S[c] / CLASS_S[0] * sc);

// Mooring: bow line to a bollard on the quay, stern line to the neighbouring pier.
export const BOLLARDS = [
  [[10.6, 23.8], [7.8, 28.3]],
  [[17.6, 23.8], [14.8, 28.3]],
  [[4.9, 23.8], [6.2, 28.6]],
  [[22.75, 23.8], [20.8, 27.4]],
];

// ---- dense polylines -----------------------------------------------------------
export const STEP = 0.08;
function finish(P) {
  const n = P.length, x = new Float32Array(n), y = new Float32Array(n), s = new Float32Array(n), a = new Float32Array(n);
  for (let i = 0; i < n; i++) { x[i] = P[i][0]; y[i] = P[i][1]; s[i] = i ? s[i - 1] + Math.hypot(x[i] - x[i - 1], y[i] - y[i - 1]) : 0; }
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    a[i] = Math.atan2(y[i1] - y[i0], x[i1] - x[i0]);
  }
  // curvature (1 / turning radius), smoothed over about a tile
  const k = new Float32Array(n), w = 6;
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - w), i1 = Math.min(n - 1, i + w);
    let d = a[i1] - a[i0]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    k[i] = i1 > i0 ? Math.abs(d) / Math.max(1e-6, s[i1] - s[i0]) : 0;
  }
  return { x, y, s, a, k, len: s[n - 1], n };
}
// Curvature at distance s along a path (paths are evenly resampled).
export const curvAt = (path, s) => path.k[Math.max(0, Math.min(path.n - 1, Math.round(s / STEP)))];
function resample(P) {                              // even spacing by arc length
  const out = [P[0]];
  let carry = 0;
  for (let i = 1; i < P.length; i++) {
    const [x0, y0] = P[i - 1], [x1, y1] = P[i], d = Math.hypot(x1 - x0, y1 - y0);
    let t = STEP - carry;
    while (t <= d) { out.push([x0 + (x1 - x0) * t / d, y0 + (y1 - y0) * t / d]); t += STEP; }
    carry = d - (t - STEP);
  }
  const last = P[P.length - 1], end = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 1e-3) out.push(last);
  return out;
}
export function straight(x, y, ang, len) {
  const P = [], n = Math.max(1, Math.ceil(len / STEP));
  for (let i = 0; i <= n; i++) P.push([x + Math.cos(ang) * len * i / n, y + Math.sin(ang) * len * i / n]);
  return P;
}
// Arc starting at (x, y) travelling at angle `ang`; sweep > 0 turns towards larger angles.
export function arc(x, y, ang, R, sweep) {
  const P = [], k = Math.sign(sweep) / R, n = Math.max(2, Math.ceil(Math.abs(sweep) * R / STEP));
  for (let i = 0; i <= n; i++) {
    const a = ang + sweep * i / n;
    P.push([x + (Math.sin(a) - Math.sin(ang)) / k, y - (Math.cos(a) - Math.cos(ang)) / k]);
  }
  return P;
}
// Cubic Hermite chain through points with given start/end tangent directions.
function spline(pts, a0, a1) {
  const n = pts.length, T = [];
  for (let i = 0; i < n; i++) {
    const p = pts[Math.max(0, i - 1)], q = pts[Math.min(n - 1, i + 1)];
    T.push([(q[0] - p[0]) * 0.5, (q[1] - p[1]) * 0.5]);
  }
  const d01 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), dn = Math.hypot(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
  T[0] = [Math.cos(a0) * d01 * 0.9, Math.sin(a0) * d01 * 0.9];
  if (a1 !== undefined) T[n - 1] = [Math.cos(a1) * dn * 0.9, Math.sin(a1) * dn * 0.9];
  const P = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], [tx0, ty0] = T[i], [tx1, ty1] = T[i + 1];
    const m = Math.max(8, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / STEP * 2));
    for (let j = i ? 1 : 0; j <= m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      P.push([h00 * x0 + h10 * tx0 + h01 * x1 + h11 * tx1, h00 * y0 + h10 * ty0 + h01 * y1 + h11 * ty1]);
    }
  }
  return P;
}
// ---- Dubins paths: shortest route between two poses for a boat that cannot
// turn tighter than R (arcs and straights; every word is checked by integration).
const TAU = Math.PI * 2, md = a => ((a % TAU) + TAU) % TAU;
function dubinsWords(al, be, d) {
  const sa = Math.sin(al), sb = Math.sin(be), ca = Math.cos(al), cb = Math.cos(be), cab = Math.cos(al - be), W = [];
  let p2 = 2 + d * d - 2 * cab + 2 * d * (sa - sb);
  if (p2 >= 0) { const tmp = Math.atan2(cb - ca, d + sa - sb); W.push(['LSL', md(-al + tmp), Math.sqrt(p2), md(be - tmp)]); }
  p2 = 2 + d * d - 2 * cab + 2 * d * (sb - sa);
  if (p2 >= 0) { const tmp = Math.atan2(ca - cb, d - sa + sb); W.push(['RSR', md(al - tmp), Math.sqrt(p2), md(-be + tmp)]); }
  p2 = -2 + d * d + 2 * cab + 2 * d * (sa + sb);
  if (p2 >= 0) { const p = Math.sqrt(p2), tmp = Math.atan2(-ca - cb, d + sa + sb) - Math.atan2(-2, p); W.push(['LSR', md(-al + tmp), p, md(-md(be) + tmp)]); }
  p2 = -2 + d * d + 2 * cab - 2 * d * (sa + sb);
  if (p2 >= 0) { const p = Math.sqrt(p2), tmp = Math.atan2(ca + cb, d - sa - sb) - Math.atan2(2, p); W.push(['RSL', md(al - tmp), p, md(be - tmp)]); }
  let tmp = (6 - d * d + 2 * cab + 2 * d * (sa - sb)) / 8;
  if (Math.abs(tmp) <= 1) { const p = md(TAU - Math.acos(tmp)), t = md(al - Math.atan2(ca - cb, d - sa + sb) + p / 2); W.push(['RLR', t, p, md(al - be - t + p)]); }
  tmp = (6 - d * d + 2 * cab + 2 * d * (sb - sa)) / 8;
  if (Math.abs(tmp) <= 1) { const p = md(TAU - Math.acos(tmp)), t = md(-al - Math.atan2(ca - cb, d + sa - sb) + p / 2); W.push(['LRL', t, p, md(md(be) - al - t + p)]); }
  return W;
}
function dubinsTrace(x, y, a, R, word, t, p, q) {
  let P = [[x, y]];
  const seg = (ch, v) => {
    const [px, py] = P[P.length - 1];
    let part;
    if (ch === 'S') { part = straight(px, py, a, v * R); }
    else { const sw = ch === 'L' ? v : -v; part = arc(px, py, a, R, sw); a += sw; }
    P = P.concat(part.slice(1));
  };
  seg(word[0], t); seg(word[1], p); seg(word[2], q);
  return { P, a };
}
export function dubins(q0, q1, R) {
  const dx = q1[0] - q0[0], dy = q1[1] - q0[1], D = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
  const al = md(q0[2] - th), be = md(q1[2] - th);
  let best = null;
  for (const [w, t, p, q] of dubinsWords(al, be, D / R)) {
    if (![t, p, q].every(Number.isFinite)) continue;
    const len = (t + p + q) * R;
    if (best && len >= best.len) continue;
    const tr = dubinsTrace(q0[0], q0[1], q0[2], R, w, t, p, q), e = tr.P[tr.P.length - 1];
    let da = md(tr.a - q1[2]); if (da > Math.PI) da -= TAU;
    if (Math.hypot(e[0] - q1[0], e[1] - q1[1]) < 0.02 && Math.abs(da) < 0.02) best = { len, P: tr.P, w };
  }
  return best ? best.P : spline([[q0[0], q0[1]], [q1[0], q1[1]]], q0[2], q1[2]);
}
export const SEA_R = 2.8;                            // turning radius at sea (tiles)
// A boat called home while still on its way out first runs this far along the
// way out (tiles), so that turning round never crosses a neighbour's final
// approach (checked by tests/boat-check.cjs).
export const RETURN_FROM = [11, 10.25, 5.25, 10];

const cat = (...parts) => parts.reduce((acc, p) => acc.concat(acc.length ? p.slice(1) : p), []);

export function poseAt(path, s, out) {
  const { x, y, a, n } = path, o = out || {};
  if (s <= 0) { o.x = x[0]; o.y = y[0]; o.a = a[0]; return o; }
  if (s >= path.len) { o.x = x[n - 1]; o.y = y[n - 1]; o.a = a[n - 1]; return o; }
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.s[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - path.s[lo]) / Math.max(1e-6, path.s[hi] - path.s[lo]);
  let da = a[hi] - a[lo]; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  o.x = x[lo] + (x[hi] - x[lo]) * t; o.y = y[lo] + (y[hi] - y[lo]) * t; o.a = a[lo] + da * t;
  return o;
}

// ---- manoeuvres -----------------------------------------------------------------
// Each plan is a list of legs { path, dir (+1 ahead, −1 astern), kind, stop }.
// kind: 'reverse' | 'sea' | 'glide' (final approach) — the controller picks speeds.
const NORTH = -Math.PI / 2, SOUTH = Math.PI / 2;

// Where each boat tows its nets: offset (tiles) from the simulation's fishing
// spot (still among its buoys) and heading in π/16 steps. Chosen by
// tools/boats/grounds.mjs so that way out + way back are short and no boat's
// route crosses the water where a neighbour lingers with its nets out.
export const GROUND = [{ dx: 2, dy: 1, head: 2 }, { dx: -2, dy: -1, head: 16 }, { dx: 1, dy: -2, head: 8 }, { dx: -2, dy: -1, head: 6 }];
export const LINGER = 2.0;                           // tiles of towing (then the boat lies still with its nets out)
export const groundPose = (i, g = GROUND[i]) => {
  const R = BERTHS[i].route, G = R[R.length - 1];
  return { x: G[0] + g.dx, y: G[1] + g.dy, a: g.head * Math.PI / 16 };
};

// Buoys mark each fishing spot, along the towing lane on the side away from the
// harbour, where no boat ever passes (u ahead, v to the side, in tiles).
const BUOY_UV = [[0, 2.1], [1.6, 2.5], [3.2, 2.1]];
export const buoysAt = i => {
  const g = groundPose(i), c = Math.cos(g.a), s = Math.sin(g.a);
  const home = (VBERTH[i][0] - g.x) * -s + (MOUTH_Y[i] - g.y) * c > 0 ? 1 : -1;   // harbour on the +v side?
  return BUOY_UV.map(([u, v]) => [g.x + u * c + v * home * s, g.y + u * s - v * home * c]);
};
export const buoyPoly = ([x, y], r = 0.3) => Array.from({ length: 8 }, (_, k) => [x + r * Math.cos(k * Math.PI / 4), y + r * Math.sin(k * Math.PI / 4)]);

// ---- mooring sites -------------------------------------------------------------
// Sites 0–3 are the slips. Sites 4–7 are the outer berths along the two outer
// jetties (built at high upgrade levels): boat i's outer site is 4 + i. Every
// boat lies bow north; it leaves by backing out with the stern swinging (moves
// found by tools/boats/search.mjs and tools/boats/zones.mjs) and comes in by a
// straight glide from its site's mouth.
export const JETTIES = [[30, 22, 31, 30.6], [-4, 22, -3, 30.6]];       // x0, y0, x1, y1 (east, west)
export const OUTER_Y = 29.0;                                          // boat centre at an outer berth
export const OUTER_X = [-2.24, 29.24, -4.76, 31.76];                  // boat i's outer berth
export const OUTER_JETTY = [1, 0, 1, 0];
export const OUTER_MOUTH = JETTIES[0][3] + HULL.bow + 0.6;            // glide starts here (bow clear of the jetty end)
export const siteOf = s => s < 4
  ? { x: VBERTH[s][0], y: VBERTH[s][1], my: MOUTH_Y[s] + APPROACH, mv: BERTH_MOVES[s] }
  : { x: OUTER_X[s - 4], y: OUTER_Y, my: OUTER_MOUTH, mv: OUTER_MOVES[s - 4] };
export const siteHull = (s, grow = 0) => hullAt(siteOf(s).x, siteOf(s).y, -Math.PI / 2, grow);
// bow line and stern line bollards of an outer berth, on its jetty
export const outerBollards = i => {
  const J = JETTIES[OUTER_JETTY[i]], x = OUTER_X[i] < J[0] ? J[0] + 0.2 : J[2] - 0.2;
  return [[x, OUTER_Y - 1.6], [x, OUTER_Y + 1.3]];
};

// From site s: back out, stop, then the shortest smooth way to the pose `to`.
export function siteDeparture(s, to, mv = siteOf(s).mv, R = SEA_R) {
  const { x: bx, y: by } = siteOf(s);
  const back = cat(mv.d0 > 0 ? straight(bx, by, SOUTH, mv.d0) : [[bx, by]], arc(bx, by + mv.d0, SOUTH, mv.R, -mv.side * mv.phi));
  const rev = finish(resample(back));
  const end = poseAt(rev, rev.len), head = end.a + Math.PI;     // heading at the stop (bow)
  const sea = finish(resample(dubins([end.x, end.y, head], [to.x, to.y, to.a], R)));
  return [
    { path: rev, dir: -1, kind: 'reverse', stop: true },
    { path: sea, dir: 1, kind: 'sea', stop: false },
  ];
}
// Into site s from any pose at sea: smooth way to the site's mouth, bow north, then a straight glide.
export function siteArrival(s, from, R = SEA_R) {
  const { x: bx, y: by, my } = siteOf(s);
  const sea = finish(resample(dubins([from.x, from.y, from.a], [bx, my, NORTH], R)));
  const glide = finish(resample(straight(bx, my, NORTH, my - by)));
  return [
    { path: sea, dir: 1, kind: 'sea', stop: false },
    { path: glide, dir: 1, kind: 'glide', stop: true },
  ];
}

export function departurePlan(i, mv = BERTH_MOVES[i], R = SEA_R, gr = GROUND[i]) {
  return siteDeparture(i, groundPose(i, gr), mv, R);
}

// From any pose at sea back into slip i: the shortest smooth route (never
// tighter than SEA_R) to a point in line with the slip, bow north, then a
// straight glide into the berth.
export function arrivalPlan(i, from, R = SEA_R) { return siteArrival(i, from, R); }

// Harbour trip, for heavily upgraded boats whose whole simulated trip is
// shorter than a calm run to the fishing grounds: the boat backs straight out
// along its own slip until its bow is just clear of the pier heads, casts and
// hauls its net astern, then goes straight back in. It never leaves its own
// lane, so it never turns and never crosses another boat's way.
export const SHORT_OUT = 0.4;                        // tiles beyond the slip mouth
export const shortSpot = i => ({ x: VBERTH[i][0], y: MOUTH_Y[i] + SHORT_OUT, a: NORTH });
export function shortDeparture(i) {
  const [bx, by] = VBERTH[i], e = shortSpot(i);
  return [{ path: finish(resample(straight(bx, by, SOUTH, e.y - by))), dir: -1, kind: 'reverse', stop: true }];
}
export function shortArrival(i, from) {
  const by = VBERTH[i][1];
  return [{ path: finish(resample(straight(from.x, from.y, NORTH, Math.max(0.05, from.y - by)))), dir: 1, kind: 'glide', stop: true }];
}
export function shortFishing(i, from) {                // the net goes out astern; the boat barely moves
  return [{ path: finish(resample(straight(from.x, from.y, from.a, 0.3))), dir: 1, kind: 'fish', stop: true }];
}

// Outer sectors: the net is towed while the boat makes its turn for home — an arc
// of radius R through 180° (sweep +1 towards larger angles, −1 the other way).
export function fishTurnPlan(from, R, sweep) {
  return [{ path: finish(resample(arc(from.x, from.y, from.a, R, sweep * Math.PI))), dir: 1, kind: 'fishturn', stop: false }];
}

// Towing the nets: slowly straight on for LINGER tiles, then lying still until called home.
export function fishingPlan(i, from) {
  return [{ path: finish(resample(straight(from.x, from.y, from.a, LINGER))), dir: 1, kind: 'fish', stop: true }];
}

// ---- hull outline & clearance -----------------------------------------------------
const OUTLINE = (() => {
  const P = [[-L, -W], [0.55 * L, -W]];
  const q = (p0, c, p1) => { for (let k = 1; k <= 5; k++) { const t = k / 5; P.push([(1 - t) * (1 - t) * p0[0] + 2 * t * (1 - t) * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * t * (1 - t) * c[1] + t * t * p1[1]]); } };
  q([0.55 * L, -W], [0.95 * L, -0.8 * W], [1.08 * L, 0]);
  q([1.08 * L, 0], [0.95 * L, 0.8 * W], [0.55 * L, W]);
  P.push([-L, W]);
  return P;
})();
// Hull outline in boat coordinates (u towards the bow, v to the side), grown by `grow` tiles (cached).
const LOCAL = new Map();
export function hullLocal(grow = 0) {
  let P = LOCAL.get(grow);
  if (!P) LOCAL.set(grow, P = OUTLINE.map(([u, v]) => [u + Math.sign(u) * grow, v + Math.sign(v) * grow]));
  return P;
}
// Hull outline in grid coordinates for a boat at (x, y) with bow heading h; grow = margin in tiles.
export function hullAt(x, y, h, grow = 0, scale = 1) {
  const c = Math.cos(h), s = Math.sin(h);
  return OUTLINE.map(([u, v]) => {
    const uu = (u + Math.sign(u) * grow) * scale, vv = (v + Math.sign(v) * grow) * scale;
    return [x + uu * c - vv * s, y + uu * s + vv * c];
  });
}
const inRect = (rs, px, py) => rs.some(([x0, y0, x1, y1]) => px >= x0 && px < x1 + 1 && py >= y0 && py < y1 + 1);
export function solidAt(px, py) {
  if (px < BOUNDS.x0 || py < BOUNDS.y0 || px > BOUNDS.x1 || py > BOUNDS.y1) return false;   // open sea round the map
  return isLand(Math.floor(px), Math.floor(py)) || inRect(PIERS, px, py)
    || JETTIES.some(([x0, y0, x1, y1]) => px >= x0 && px <= x1 && py >= y0 && py <= y1);
}
// Dense points along a hull outline (for clearance tests).
export function hullPoints(x, y, h, grow = 0.06, scale = 1) {
  const P = hullAt(x, y, h, grow, scale), out = [];
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.12));
    for (let k = 0; k < n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}
export function pointInPoly(px, py, P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// Walk a plan and report every pose where the hull touches piers / land / other hulls.
export function planHits(plan, others = []) {
  const hits = [];
  for (const leg of plan) {
    for (let s = 0; s <= leg.path.len + 1e-6; s += 0.1) {
      const p = poseAt(leg.path, s), h = leg.dir > 0 ? p.a : p.a + Math.PI;
      for (const [qx, qy] of hullPoints(p.x, p.y, h)) {
        if (solidAt(qx, qy) || others.some(o => pointInPoly(qx, qy, o))) { hits.push([+p.x.toFixed(2), +p.y.toFixed(2), leg.kind]); break; }
      }
    }
  }
  return hits;
}
// Tightest turn along a leg (tiles), measured over 0.5-tile windows.
export function minRadius(path, where) {
  let r = Infinity, at = null;
  for (let s = 0.5; s <= path.len - 0.5; s += 0.25) {
    const a = poseAt(path, s - 0.5).a, b = poseAt(path, s + 0.5).a;
    let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > 1e-4 && 1 / Math.abs(d) < r) { r = 1 / Math.abs(d); at = s; }
  }
  if (where) where.s = at;
  return r;
}
export const dockedHull = i => hullAt(VBERTH[i][0], VBERTH[i][1], NORTH);
