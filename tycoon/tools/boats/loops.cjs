// Loop berths at the outer jetties (development tool; writes the data the game reads).
// A boat leaves its berth AHEAD, sails one closed loop with its net out and comes
// back AHEAD to the same berth. This tool searches, on the real map:
//   • four berths (alongside the sea face of a short head arm, or alongside a
//     jetty stem bow to the sea) whose loops share no water,
//   • longer loops from the same berths for lower levels,
//   • the one route of each boat from its slip to its new berth,
//   • where a decorative boat in the way can lie instead.
// Margins follow the hull: turning radius 0.7125 × length, clearance to everything
// 0.25 × beam while under way. `--scale=1.38` checks a bigger hull class (report only).
//   node tools/boats/loops.cjs            → src/render/boatloops.js, test-results/loops/search.json
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const bundle = (src, name) => { const out = path.join(root, '.preview', name); fs.mkdirSync(path.dirname(out), { recursive: true }); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: out, logLevel: 'error' }); delete require.cache[out]; return require(out); };
const P = bundle('src/render/boatpaths.js', 'boatpaths.cjs'), C = bundle('src/config.js', 'config.cjs'), W = bundle('src/render/water.js', 'water.cjs');
const arg = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const SC = +(arg('scale') || 1), WRITE = SC === 1 && !process.argv.includes('--dry');
const T0 = Date.now(), LIMIT_MS = 10 * 60 * 1000, MAXDECK = +(arg('maxdeck') || 99);

// ---- hull-dependent numbers
const LEN = (P.HULL.bow + P.HULL.stern) * SC, BEAM = 2 * P.HULL.half * SC, HALF = P.HULL.half * SC, STERN = P.HULL.stern * SC, BOW = P.HULL.bow * SC;
const R = +(0.7125 * LEN).toFixed(2);                                 // 2.8 tiles for today's hull
const MARGIN = +(0.25 * BEAM).toFixed(2);                             // clearance while under way
const SWING = Math.hypot(R, STERN) - R;                               // how far the stern swings out when the boat turns away
const OFF = +(SWING + MARGIN + 0.07).toFixed(2);                           // hull side to pier face while moving
const SNUG = +(0.33 * BEAM).toFixed(2);                               // hull side to pier face when made fast (hauled in by the lines)
const VMAX = 5, WMAX = Math.PI / 2, DS = 0.08;
const DECK = { y0: 30.6, y1: 31.6 }, JET = P.JETTIES;
const SEA = { x0: -8.9, x1: 45.5, y1: 45 };                           // west: rocks and shoal along x ≈ −9.5; elsewhere the water the game shows

// ---- paths
function build(x, y, a, segs) {
  const pts = []; let s = 0; const push = k => pts.push({ x, y, a, k, s }); push(0);
  for (const [type, p1, p2] of segs) {
    if (type === 'S') { if (p1 <= 0) continue; const n = Math.max(1, Math.round(p1 / DS)), d = p1 / n; for (let i = 0; i < n; i++) { x += Math.cos(a) * d; y += Math.sin(a) * d; s += d; push(0); } }
    else { const len = Math.abs(p2) * p1, n = Math.max(1, Math.round(len / DS)), d = len / n, da = p2 / n; for (let i = 0; i < n; i++) { x += Math.cos(a + da / 2) * d; y += Math.sin(a + da / 2) * d; a += da; s += d; push(1 / p1); } }
  }
  return { pts, len: s };
}
const loopSegs = (sense, a, b, L) => { const q = sense * Math.PI / 2; return [['S', a], ['A', R, q], ['S', L], ['A', R, q], ['S', a + b], ['A', R, q], ['S', L], ['A', R, q], ['S', b]]; };
function timing(pth, acc, dec, vcap = VMAX) {
  const n = pth.pts.length, v = new Float64Array(n), cap = i => Math.min(vcap, pth.pts[i].k > 1e-6 ? WMAX / pth.pts[i].k : Infinity);
  for (let i = 1; i < n; i++) v[i] = Math.min(cap(i), Math.sqrt(v[i - 1] ** 2 + 2 * acc * (pth.pts[i].s - pth.pts[i - 1].s)));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * (pth.pts[i + 1].s - pth.pts[i].s)));
  let t = 0, vm = 0; for (let i = 1; i < n; i++) { t += 2 * (pth.pts[i].s - pth.pts[i - 1].s) / (v[i] + v[i - 1]); vm = Math.max(vm, v[i]); }
  return { t, vmax: vm };
}

// ---- obstacle grid (0.1-tile cells). Hard: land (also the unseen land west of the map), piers, jetty stems, surf rocks.
// Soft (a layout may ask for a change): buoys of fishing ground g, decorative boat d, the berth of slip i.
const GX0 = -24, GY0 = 16, GW = 760, GH = 400, CELL = 0.1;
const HARD = 1, BUOY = 2, DECO = 32, SLIP = 512;                      // BUOY << g, DECO << d, SLIP << i
const OBS = new Uint16Array(GW * GH);
const cellOf = (x, y) => { const cx = Math.floor((x - GX0) / CELL), cy = Math.floor((y - GY0) / CELL); return cx < 0 || cy < 0 || cx >= GW || cy >= GH ? -1 : cy * GW + cx; };
function paint(test, x0, y0, x1, y1, bit, G = OBS) { for (let cy = Math.max(0, Math.floor((y0 - GY0) / CELL)); cy <= Math.min(GH - 1, Math.ceil((y1 - GY0) / CELL)); cy++) for (let cx = Math.max(0, Math.floor((x0 - GX0) / CELL)); cx <= Math.min(GW - 1, Math.ceil((x1 - GX0) / CELL)); cx++) if (test(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL)) G[cy * GW + cx] |= bit; }
const paintPoly = (poly, bit, G) => { const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]); paint((x, y) => P.pointInPoly(x, y, poly), Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), bit, G); };
const inRects = (rs, x, y) => rs.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1);
paint((x, y) => C.isLand(Math.floor(x), Math.floor(y)) || inRects(C.PIERS, x, y) || JET.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1), GX0, GY0, GX0 + GW * CELL, GY0 + GH * CELL, HARD);
const ROCKS = W.surfRocks().map(r => ({ x: r.x, y: r.y, r: 0.42 * r.s }));
for (const r of ROCKS) paint((x, y) => Math.hypot(x - r.x, y - r.y) <= r.r, r.x - r.r, r.y - r.r, r.x + r.r, r.y + r.r, HARD);
[0, 1, 2, 3].forEach(g => P.buoysAt(g).forEach(([bx, by]) => paint((x, y) => Math.hypot(x - bx, y - by) <= 0.3, bx - 0.3, by - 0.3, bx + 0.3, by + 0.3, BUOY << g)));
P.DECOR_HOME.forEach((d, i) => paintPoly(P.decorHull(d), DECO << i));
[0, 1, 2, 3].forEach(i => paintPoly(P.dockedHull(i), SLIP << i));
const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
const hullPts = (q, grow) => P.hullPoints(q.x, q.y, q.a, grow / SC, SC);
// bits the hull (grown by `grow`) meets along a path; 0x8000 = a head deck in `decks`
function contacts(pth, decks, grow = MARGIN, step = 2) {
  let hit = 0;
  for (let i = 0; i < pth.pts.length; i += step) for (const [x, y] of hullPts(pth.pts[i], grow)) {
    const c = cellOf(x, y); if (c >= 0) hit |= OBS[c];
    if (hit & HARD) return hit;
    for (const r of decks) if (inRect(r, x, y)) return hit | 0x8000;
  }
  return hit;
}
const STAMP = new Uint8Array(GW * GH);
function sweep(pth, grow = MARGIN / 2) {         // cells the hull covers; two sweeps that do not meet are ≥ MARGIN apart
  const cells = [];
  for (let i = 0; i < pth.pts.length; i += 2) {
    const q = pth.pts[i], poly = P.hullAt(q.x, q.y, q.a, grow / SC, SC);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let cy = Math.floor((y0 - GY0) / CELL); cy <= Math.ceil((y1 - GY0) / CELL); cy++) for (let cx = Math.floor((x0 - GX0) / CELL); cx <= Math.ceil((x1 - GX0) / CELL); cx++) {
      const key = cy * GW + cx; if (key < 0 || key >= STAMP.length || STAMP[key]) continue;
      if (P.pointInPoly(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL, poly)) { STAMP[key] = 1; cells.push(key); }
    }
  }
  for (const k of cells) STAMP[k] = 0;
  return Int32Array.from(cells);
}
const rectCells = (r, grow = MARGIN / 2) => { const S = []; for (let cy = Math.floor((r[1] - grow - GY0) / CELL); cy <= Math.floor((r[3] + grow - GY0) / CELL); cy++) for (let cx = Math.floor((r[0] - grow - GX0) / CELL); cx <= Math.floor((r[2] + grow - GX0) / CELL); cx++) S.push(cy * GW + cx); return Int32Array.from(S); };
function meets(A, B) { for (const k of A) STAMP[k] = 1; let hit = false; for (const k of B) if (STAMP[k]) { hit = true; break; } for (const k of A) STAMP[k] = 0; return hit; }
const bbox = pth => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of pth.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } const g = BOW + 0.5; return [x0 - g, y0 - g, x1 + g, y1 + g]; };
const apart = (a, b) => a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];
const inSea = pth => pth.pts.every(q => q.x > SEA.x0 + HALF && q.x < SEA.x1 - HALF && q.y < SEA.y1 - HALF);

// ---- berths. (x, y, a) is where the loop starts and ends (hull side OFF from the pier face);
// made fast, the boat lies (OFF − SNUG) nearer the pier: unit vector (px, py) points to the pier.
const E = 0, S_ = Math.PI / 2, Wd = Math.PI;
function berth(fam, jetty, x, y, a, sense, px, py, L = 0, sb = 0.5) {
  const pth = build(x, y, a, loopSegs(sense, 0, sb, L)), haul = OFF - SNUG, mx = x + px * haul, my = y + py * haul;
  let deck = null;                                 // the pier covers the hull from the stern to a little ahead of midships
  if (fam === 'head') { const J = JET[jetty], dir = Math.cos(a), ends = [mx + dir * 0.3 * BOW, mx - dir * (STERN + 0.2)]; deck = [+Math.min(J[0], ...ends).toFixed(2), DECK.y0, +Math.max(J[2], ...ends).toFixed(2), DECK.y1]; }
  if (!inSea(pth)) return null;
  // a head arm never crosses the lane of a slip, and is no longer than --maxdeck
  if (deck && (P.VBERTH.some(([sx]) => deck[0] < sx + HALF + 0.1 && deck[2] > sx - HALF - 0.1) || deck[2] - deck[0] - 1 > MAXDECK)) return null;
  const hit = contacts(pth, deck ? [deck] : []);
  if (hit & (HARD | 0x8000)) return null;
  const brisk = timing(pth, 2.25, 1.5), calm = timing(pth, 1.5, 1.25);
  return { fam, jetty, x: +x.toFixed(2), y: +y.toFixed(2), a, sense, px, py, mx: +mx.toFixed(2), my: +my.toFixed(2), L, sb, len: +pth.len.toFixed(1), tBrisk: +brisk.t.toFixed(2), tCalm: +calm.t.toFixed(2), vmax: +brisk.vmax.toFixed(2), deck, soft: hit, pth };
}
function candidates() {
  const list = [];
  for (const jetty of [0, 1]) {
    const J = JET[jetty], yl = DECK.y1 + OFF + HALF;
    for (let x = J[0] - 12; x <= J[2] + 12; x += 0.1) for (const a of [E, Wd]) for (const sb of [0.5, 0.25, 0]) { const c = berth('head', jetty, x, yl, a, a === E ? 1 : -1, 0, -1, 0, sb); if (c) list.push(c); }
    for (const side of [1, -1]) { if (side === (jetty ? 1 : -1) && !process.argv.includes('--basin')) continue;   // no loops inside the harbour basin
      const xl = (side > 0 ? J[2] : J[0]) + side * (OFF + HALF); for (let y = J[1] + 2; y <= J[3] - 0.65 * BOW + 0.01; y += 0.25) { const c = berth('stem', jetty, xl, y, S_, side > 0 ? -1 : 1, -side, 0); if (c) { c.side = side; list.push(c); } } }
  }
  return list;
}
const softList = h => [...[0, 1, 2, 3].filter(g => h & (BUOY << g)).map(g => 'buoys of ground ' + (g + 1)), ...P.DECOR_HOME.map((_, d) => d).filter(d => h & (DECO << d)).map(d => 'decorative boat ' + d), ...[0, 1, 2, 3].filter(i => h & (SLIP << i)).map(i => 'slip ' + (i + 1) + ' empty')];
const bits = h => { let n = 0; for (let b = 1; b < 16; b++) if (h & (1 << b)) n++; return n; };

// ---- layout: four berths with separate water, as few changes to the scene as possible, then the least new deck
function layout(all) {
  const cost = c => 6 * bits(c.soft & ~(DECO * 15)) + 2 * bits(c.soft & (DECO * 15)) + (c.deck ? 0.25 * (c.deck[2] - c.deck[0] - 1) : 0) + (c.fam === 'stem' ? Math.abs(c.y - 27.5) * 0.05 + (c.side === (c.jetty ? 1 : -1) ? 20 : 0) : 0);   // a loop inside the harbour basin is the last choice
  // thin the pool: per jetty / family / direction the 40 cheapest, at least 0.5 tiles apart
  const groups = new Map();
  for (const c of all) { const k = [c.jetty, c.fam, c.a, c.side || 0, c.sb].join('/'); (groups.get(k) || groups.set(k, []).get(k)).push(c); }
  const pool = [];
  for (const g of groups.values()) { g.sort((p, q) => cost(p) - cost(q)); const keep = []; for (const c of g) { if (keep.length >= 80) break; if (keep.every(o => Math.hypot(o.x - c.x, o.y - c.y) >= 0.1)) keep.push(c); } pool.push(...keep); }
  for (const c of pool) { c.cost = cost(c); c.sw = sweep(c.pth); c.st = c.deck ? rectCells(c.deck) : new Int32Array(0); c.bb = bbox(c.pth); }
  pool.sort((p, q) => p.cost - q.cost);
  const ok = (A, B) => (apart(A.bb, B.bb) || !meets(A.sw, B.sw)) && !meets(A.sw, B.st) && !meets(B.sw, A.st) && !(A.deck && B.deck && A.jetty === B.jetty && Math.sign(Math.cos(A.a)) === Math.sign(Math.cos(B.a)) && false);
  // the jetties are far apart, so each gets its own best pair (checked against the other pair afterwards)
  let tries = 0; const best = []; best.soft = 0;
  for (const jetty of [0, 1]) {
    const pj = pool.filter(c => c.jetty === jetty); let bp = null, bc = Infinity;
    for (let i = 0; i < pj.length; i++) for (let j = i + 1; j < pj.length; j++) {
      const c = pj[i].cost + pj[j].cost; if (c >= bc) break;
      tries++;
      if (ok(pj[i], pj[j])) { bc = c; bp = [pj[i], pj[j]]; }
    }
    if (!bp) return { best: null, tries, pool: pool.length, failed: jetty ? 'west' : 'east' };
    best.push(...bp); best.soft |= bp[0].soft | bp[1].soft;
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (!ok(best[i], best[j])) return { best: null, tries, pool: pool.length, failed: 'the two jetties' };
  return { best, tries, pool: pool.length };
}

// ---- helpers on game paths
const ptsOf = (pth, dir = 1) => { const pts = []; for (let s = 0; s <= pth.len + 1e-9; s += DS) { const q = P.poseAt(pth, Math.min(s, pth.len)); pts.push({ x: q.x, y: q.y, a: dir > 0 ? q.a : q.a + Math.PI, k: Math.abs(P.curvAt(pth, s)), s }); } return { pts, len: pth.len }; };
const fromPoints = pl => { const pts = []; let s = 0; for (let i = 0; i < pl.length; i++) { if (i) s += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); const n = pl[Math.min(pl.length - 1, i + 1)], pv = pl[Math.max(0, i - 1)]; pts.push({ x: pl[i][0], y: pl[i][1], a: Math.atan2(n[1] - pv[1], n[0] - pv[0]), k: 0, s }); }
  for (let i = 1; i < pts.length - 1; i++) { let d = pts[i + 1].a - pts[i - 1].a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const ds = pts[i + 1].s - pts[i - 1].s; pts[i].k = ds > 1e-6 ? Math.min(1 / R, Math.abs(d) / ds) : 0; } return { pts, len: s }; };
const polyHit = (pth, polys, grow = MARGIN) => pth.pts.some((q, i) => i % 2 === 0 && hullPts(q, grow).some(([x, y]) => polys.some(o => P.pointInPoly(x, y, o))));
const join = parts => { const j = { pts: [], len: 0 }; for (const part of parts) { for (const q of (j.pts.length ? part.pts.slice(1) : part.pts)) j.pts.push({ ...q, s: q.s + j.len }); j.len += part.len; } return j; };

// ====================================================================== search
const all = candidates();
if (process.argv.includes('--list')) { for (const c of all) console.log(c.jetty ? 'west' : 'east', c.fam, c.side || '', 'x', c.x, 'y', c.y, 'a', Math.round(c.a * 180 / Math.PI), 'deck', c.deck && [c.deck[0], c.deck[2]].join('..'), softList(c.soft).join(',')); process.exit(0); }
if (process.argv.includes('--pairdbg')) {
  const Wc = all.filter(c => c.jetty === 1 && c.fam === 'head' && c.a === Wd), Ec = all.filter(c => c.jetty === 1 && c.fam === 'head' && c.a === E);
  console.log('W x', [...new Set(Wc.map(c => c.x + '/' + c.sb))].join(' '), '| E x', [...new Set(Ec.map(c => c.x + '/' + c.sb))].slice(-8).join(' '));
  const A = Wc.sort((p, q) => p.x - q.x || p.sb - q.sb)[0]; A.sw = sweep(A.pth);
  for (const B of Ec.filter(c => c.x >= 2)) { B.sw = sweep(B.pth); console.log('W', A.x, A.sb, 'E', B.x, B.sb, 'loops meet', meets(A.sw, B.sw), 'A/deckB', meets(A.sw, rectCells(B.deck)), 'B/deckA', meets(B.sw, rectCells(A.deck)), 'deckB', B.deck[2]); }
  process.exit(0);
}
const lay = layout(all);
if (!lay.best) { console.log('no layout of four berths found for hull scale', SC, `(${all.length} candidates, ${lay.tries} tries, failed at: ${lay.failed})`); process.exit(1); }
// boats: slip i lies at x = VBERTH[i][0]; give each berth to the nearest slip not yet placed (east to west)
const berths = lay.best.slice().sort((p, q) => p.mx - q.mx), slipsByX = [0, 1, 2, 3].sort((i, j) => P.VBERTH[i][0] - P.VBERTH[j][0]);
const base = []; berths.forEach((c, n) => { base[slipsByX[n]] = c; });
const decks = base.filter(c => c.deck).map(c => c.deck), deckPolys = decks.map(r => [[r[0], r[1]], [r[2], r[1]], [r[2], r[3]], [r[0], r[3]]]);
const softAll = base.reduce((h, c) => h | c.soft, 0);
const ALLBUOYS = BUOY * 15, softLadder = softAll | ALLBUOYS;       // longer loops are used once all boats have moved and every ground's buoys are in
console.log(`hull scale ${SC}: radius ${R}, margin ${MARGIN}, off the pier ${OFF} under way / ${SNUG} made fast; ${all.length} candidates, pool ${lay.pool}, ${lay.tries} tries, ${((Date.now() - T0) / 1000).toFixed(0)} s`);
base.forEach((c, k) => console.log(` boat ${k + 1}: ${c.fam} ${c.jetty ? 'west' : 'east'} at (${c.x}, ${c.y}) heading ${Math.round(c.a * 180 / Math.PI)}°, loop ${c.len} tiles ${c.tBrisk}–${c.tCalm} s, deck ${c.deck ? (c.deck[2] - c.deck[0] - 1).toFixed(1) + ' tiles' : 'none'}, needs: ${softList(c.soft).join(', ') || 'nothing'}`));

// ---- longer loops from the same berths (head: further south; stem: further out), clear of everything and of each other
const ladders = base.map(c => [Object.assign(c, { n: 0 })]);
for (let n = 1; n <= 12; n++) base.forEach((c, k) => {
  if (ladders[k].stop) return;
  const v = berth(c.fam, c.jetty, c.x, c.y, c.a, c.sense, c.px, c.py, n, c.sb);
  if (!v) { ladders[k].stop = 'land, rocks or the edge of the sea'; return; }
  if (v.soft & ~softLadder) { ladders[k].stop = softList(v.soft & ~softLadder).join(', '); return; }
  v.sw = sweep(v.pth); v.n = n;
  for (let j = 0; j < 4; j++) if (j !== k) { if (ladders[j].some(o => meets(v.sw, o.sw)) || (base[j].deck && meets(v.sw, rectCells(base[j].deck)))) { ladders[k].stop = 'water or deck of boat ' + (j + 1); return; } }
  ladders[k].push(v);
});

// ---- decorative boats in the way: nearest place clear of every loop, move route (checked below) and slip route
const movedDecor = P.DECOR_HOME.map((_, d) => d).filter(d => softAll & (DECO << d));
const slipSweeps = [0, 1, 2, 3].flatMap(i => { const dep = P.departurePlan(i), end = P.poseAt(dep[1].path, dep[1].path.len), f = P.fishingPlan(i, end); return [...dep, ...f, ...P.arrivalPlan(i, P.poseAt(f[0].path, P.LINGER))].map(l => sweep(ptsOf(l.path, l.dir), 0.2)); });
const loopSweeps = ladders.flatMap(l => l.map(v => v.sw));
function placeDecor(d) {
  const [x0, y0, cls, dir, sc] = P.DECOR_HOME[d];
  let best = null;
  for (let x = x0 - 8; x <= x0 + 10; x += 0.5) for (let y = 23; y <= 31; y += 0.5) {
    const poly = P.decorHull([x, y, cls, dir, sc], 0.35), G = new Uint16Array(GW * GH); paintPoly(poly, 1, G);
    const cells = []; for (let i = 0; i < G.length; i++) if (G[i]) cells.push(i);
    if (cells.some(c => OBS[c])) continue;
    if (decks.some(r => poly.some(([px, py]) => inRect([r[0] - 0.3, r[1] - 0.3, r[2] + 0.3, r[3] + 0.3], px, py)))) continue;
    const cs = Int32Array.from(cells);
    if ([...loopSweeps, ...slipSweeps].some(s => meets(cs, s))) continue;
    if (base.some(c => P.pointInPoly(c.mx, c.my, poly))) continue;
    const dist = Math.hypot(x - x0, y - y0); if (!best || dist < best.dist) best = { x, y, dist, cells: cs };
  }
  return best;
}
const decorNew = {}; for (const d of movedDecor) { const b = placeDecor(d); decorNew[d] = b; if (b) paintPoly(P.decorHull([b.x, b.y, ...P.DECOR_HOME[d].slice(2)]), HARD); }

// ---- the one move from slip k to its new berth: back out, a way point at sea, in on the last quarter of the loop's line
const mooredHull = (c, grow = 0.1) => P.hullAt(c.mx, c.my, c.a, grow / SC, SC);
// Order: the boat for the jetty stem first (no head arm is built yet), then the boats whose new berth would shut
// another slip in. A boat's own fishing-ground buoys are taken in when it leaves its slip for good.
const ORDER = [0, 1, 2, 3].sort((p, q) => (base[p].fam === 'stem' ? 0 : 1) - (base[q].fam === 'stem' ? 0 : 1) || base[p].deck[2] - base[p].deck[0] - (base[q].deck[2] - base[q].deck[0]));
const moves = base.map((c, k) => {
  let best = null; const why = {};
  const rank = ORDER.indexOf(k), before = ORDER.slice(0, rank), after = ORDER.slice(rank + 1), armsBuilt = before.some(j => base[j].fam === 'stem') || c.fam !== 'stem' || true;
  const stageDecks = c.fam === 'stem' && rank === 0 ? [] : decks, stageDeckPolys = stageDecks.length ? deckPolys : [];
  const gone = [k, ...before].reduce((h, j) => h | (BUOY << j), 0);
  const others = [...stageDeckPolys, ...before.map(j => mooredHull(base[j])), ...after.map(j => P.dockedHull(j))];
  // backing out of the slip: today's manoeuvre first; if no route works with it, further straight back and other arcs
  const mvs = [null]; for (const d0 of [2.5, 3.5, 4.5]) for (const side of [1, -1]) for (const phi of [0.5, 0.9, 1.3]) mvs.push({ side, d0: P.BERTH_MOVES[k].d0 + d0, R: 2.5, phi });
  for (const mv of mvs) { if (best) break;
  for (const run of c.fam === 'stem' ? [0.6, 1.2, 1.8] : [1.5, 2.5]) {
    const pre = { x: c.x - Math.cos(c.a) * run, y: c.y - Math.sin(c.a) * run, a: c.a }, tail = build(pre.x, pre.y, pre.a, [['S', run]]);
    if (contacts(tail, stageDecks) & ~softAll & ~gone & ~(SLIP * 15) || polyHit(tail, others)) { why.tail = (why.tail || 0) + 1; continue; }
    const tryVia = via => {
      let dep; try { dep = mv ? P.siteDeparture(k, via, mv) : P.siteDeparture(k, via); } catch (e) { why.err = (why.err || 0) + 1; return; }
      if (P.minRadius(dep[1].path) < R - 0.05) { why.radius = (why.radius || 0) + 1; return; }
      const sea1 = ptsOf(dep[1].path), sea2 = fromPoints(P.dubins([via.x, via.y, via.a], [pre.x, pre.y, pre.a], R));
      const tiles = dep[0].path.len + sea1.len + sea2.len + run;
      if (best && best.tiles <= tiles) return;
      const hard = ~softAll & ~gone & ~(SLIP * 15) & 0xffff;       // slips: the hulls still in them are in `others`
      if (P.planHits([dep[0]], others).length) { why.reverse = (why.reverse || 0) + 1; return; }
      // out of the slip the boat keeps the clearance of today's slip routes; at sea and at the new berth the full margin
      if (P.planHits([dep[1]], others).length) { why.sea1solid = (why.sea1solid || 0) + 1; return; }      // land and piers exactly as the slip routes are checked
      const h1 = contacts(sea1, [], 0.08) & hard & ~HARD, h2 = contacts(sea2, stageDecks, MARGIN) & hard;
      if (h1) { why['sea1:' + h1] = (why['sea1:' + h1] || 0) + 1; return; } if (h2) { why['sea2:' + h2] = (why['sea2:' + h2] || 0) + 1; return; }
      if (sea1.pts.some(q => ROCKS.some(r => Math.hypot(q.x - r.x, q.y - r.y) < r.r + BOW))) { why.rocks = (why.rocks || 0) + 1; return; }
      if (polyHit(sea1, others, 0.08)) { why.poly1 = (why.poly1 || 0) + 1; return; } if (polyHit(sea2, others)) { why.poly2 = (why.poly2 || 0) + 1; return; }
      const whole = join([sea1, sea2, tail]);
      if (!inSea(whole)) { why.sea = (why.sea || 0) + 1; return; }
      const t = (acc, dec) => timing(ptsOf(dep[0].path, -1), acc, dec, 0.55 * VMAX).t + 0.55 + timing(whole, acc, dec).t;
      best = { order: rank + 1, mv, tiles, via: [+via.x.toFixed(2), +via.y.toFixed(2), +via.a.toFixed(4)], run, briskS: +t(2.25, 1.5).toFixed(1), calmS: +t(1.5, 1.25).toFixed(1), net: [+(sea1.len * 0.35).toFixed(1), +(sea1.len + sea2.len * 0.7).toFixed(1)], sw: sweep(join([ptsOf(dep[0].path, -1), whole])) };
    };
    if (c.fam === 'stem') { for (let d = R + 1.2; d <= R + 5.2; d += 0.5) for (let y = 24.5; y <= 34; y += 0.5) for (const h of [-Math.PI / 2, -Math.PI / 2 + c.side * 0.4, -Math.PI / 2 - c.side * 0.4]) tryVia({ x: c.x + c.side * d, y, a: h }); }
    else for (let x = c.x - 12; x <= c.x + 12; x += 2) for (let y = 33; y <= 39; y += 2) for (let h = 0; h < 8; h++) tryVia({ x, y, a: h * Math.PI / 4 });
  }
  }
  if (!best) console.log(' no move route for boat', k + 1, JSON.stringify(why));
  return best;
});

// ---- report + data
const clearance = () => base.map((c, k) => {      // smallest distance of the hull, anywhere on the loop, to anything hard / a deck / another loop
  const H = []; for (let i = 0; i < c.pth.pts.length; i += 3) H.push(...hullPts(c.pth.pts[i], 0));
  let obs = Infinity; const RR = 16;
  for (const [x, y] of H) { const cx = Math.floor((x - GX0) / CELL), cy = Math.floor((y - GY0) / CELL); for (let dy = -RR; dy <= RR; dy++) for (let dx = -RR; dx <= RR; dx++) { const q = (cy + dy) * GW + cx + dx; if (q >= 0 && q < OBS.length && (OBS[q] & (HARD | (~softAll & 0x7ffe)))) obs = Math.min(obs, Math.max(0, Math.hypot(dx, dy) - 0.7) * CELL); }
    for (const r of decks) obs = Math.min(obs, Math.hypot(Math.max(r[0] - x, 0, x - r[2]), Math.max(r[1] - y, 0, y - r[3]))); }
  let other = Infinity;
  for (let j = 0; j < 4; j++) if (j !== k) for (let i = 0; i < base[j].pth.pts.length; i += 4) for (const [x2, y2] of hullPts(base[j].pth.pts[i], 0)) for (let n = 0; n < H.length; n += 3) other = Math.min(other, Math.hypot(H[n][0] - x2, H[n][1] - y2));
  return { toObstacles: +obs.toFixed(2), toOtherLoops: +other.toFixed(2) };
});
const cl = clearance();
const result = { hullScale: SC, hull: { length: +LEN.toFixed(2), beam: +BEAM.toFixed(2) }, radius: R, marginUnderWay: MARGIN, offPierUnderWay: OFF, offPierMadeFast: SNUG, sternSwing: +SWING.toFixed(2), searchSeconds: Math.round((Date.now() - T0) / 1000), candidates: all.length,
  sceneChanges: { ...Object.fromEntries(movedDecor.map(d => ['decorative boat ' + d, decorNew[d] ? `moved from (${P.DECOR_HOME[d][0]}, ${P.DECOR_HOME[d][1]}) to (${decorNew[d].x}, ${decorNew[d].y})` : 'no clear place found'])), other: softList(softAll & ~(DECO * 15)) },
  boats: base.map((c, k) => ({ boat: k + 1, jetty: c.jetty ? 'west' : 'east', berth: c.fam === 'head' ? 'head arm, sea face' : 'jetty stem, outer face', start: [c.x, c.y], madeFast: [c.mx, c.my], headingDeg: Math.round(c.a * 180 / Math.PI), newDeckTiles: c.deck ? +(c.deck[2] - c.deck[0] - 1).toFixed(1) : 0, loops: ladders[k].map(v => ({ n: v.n, tiles: v.len, briskS: v.tBrisk, calmS: v.tCalm })), longerLoopsStopAt: ladders[k].stop || 'limit (12)', clearance: cl[k], move: moves[k] ? { order: moves[k].order, tiles: +moves[k].tiles.toFixed(1), briskS: moves[k].briskS, calmS: moves[k].calmS } : null })) };
console.log(JSON.stringify(result.sceneChanges)); result.boats.forEach(b => console.log(` boat ${b.boat}: loops ${b.loops.map(l => l.tiles).join('/')} (stop: ${b.longerLoopsStopAt}); clearance ${JSON.stringify(b.clearance)}; move ${JSON.stringify(b.move)}`));
fs.mkdirSync(path.join(root, 'test-results/loops'), { recursive: true });
fs.writeFileSync(path.join(root, `test-results/loops/search${SC === 1 ? '' : '-scale-' + SC}.json`), JSON.stringify(result, null, 1));
if (WRITE) {
  if (moves.some(m => !m) || movedDecor.some(d => !decorNew[d])) { console.log('NOT written: a move route or a place for a decorative boat is missing'); process.exit(1); }
  const r2 = v => +v.toFixed(3);
  // ---- compact arms: an arm longer than ARM_MAX is cut short at its free end; the bow line goes to a mooring dolphin
  // (three piles, no deck) standing where the deck used to end. Berths, loops and moves stay exactly as searched.
  const ARM_MAX = +(arg('armmax') || 4.5), dolphins = [], armsOut = decks.map(d => d.slice()), mooring = base.map(c => c.fam === 'head' ? [[r2(c.mx + Math.cos(c.a) * 1.3), DECK.y1 - 0.18], [r2(c.mx - Math.cos(c.a) * 1.5), DECK.y1 - 0.18]] : null);
  base.forEach((c, k) => {
    if (c.fam !== 'head' || c.deck[2] - c.deck[0] - 1 <= ARM_MAX) return;
    const A = armsOut[decks.indexOf(c.deck)], east = Math.cos(c.a) > 0, J = JET[c.jetty];
    if (east) A[2] = +(A[0] + 1 + ARM_MAX).toFixed(2); else A[0] = +(A[2] - 1 - ARM_MAX).toFixed(2);
    // the dolphin as far towards the bow as the lane of the neighbouring slip allows (offsets from the boat's centre)
    const y0 = (DECK.y0 + DECK.y1) / 2, stern = c.mx - Math.cos(c.a) * 1.5, edge = east ? A[2] - 0.35 : A[0] + 0.35;
    let chosen = null;
    for (const off of [1.2, 0.9, 0.6, 0.3, 0, -0.15, -0.3, -0.5, -0.8]) {
      const dx = c.mx + Math.cos(c.a) * off, piles = [[r2(dx - 0.18), r2(y0 - 0.18)], [r2(dx + 0.2), r2(y0 - 0.12)], [r2(dx + 0.02), r2(y0 + 0.22)]];
      const G = new Uint8Array(GW * GH);
      for (const [px, py] of piles) paint((x, y) => Math.hypot(x - px, y - py) <= 0.2 + MARGIN, px - 0.6, py - 0.6, px + 0.6, py + 0.6, 1, G);
      const hit = sw => { for (const q of sw) if (G[q]) return true; return false; };
      const bad = [...ladders.flatMap((l, j) => l.map((v, n) => hit(v.sw) ? `loop of boat ${j + 1} (+${n})` : null)), ...moves.map((m, j) => hit(m.sw) ? `move of boat ${j + 1}` : null)].filter(Boolean);
      const hulls = base.map(o => P.hullAt(o.mx, o.my, o.a, 0.05 / SC, SC)), inHull = hulls.some(h => piles.some(([px, py]) => P.pointInPoly(px, py, h) || h.some(([hx, hy]) => Math.hypot(hx - px, hy - py) < 0.2)));
      if (!bad.length && !inHull) { chosen = { dx, piles, off }; break; }
    }
    if (!chosen) { console.log('compact arm NOT possible for boat', k + 1); process.exit(1); }
    dolphins.push({ boat: k, piles: chosen.piles });
    mooring[k] = [[r2(chosen.dx + 0.02), r2(y0 + 0.04)], [r2(east ? Math.min(stern, edge) : Math.max(stern, edge)), DECK.y1 - 0.18]];
    console.log(` compact arm for boat ${k + 1}: deck ${(decks[decks.indexOf(c.deck)][2] - decks[decks.indexOf(c.deck)][0] - 1).toFixed(1)} → ${ARM_MAX} tiles, dolphin at (${r2(chosen.dx)}, ${r2(y0)}) = ${chosen.off} tiles ahead of the boat's centre, clear of every loop and move`);
  });
  const data = base.map((c, k) => ({ x: c.x, y: c.y, a: r2(c.a), sense: c.sense, sb: c.sb, px: c.px, py: c.py, haul: r2(OFF - SNUG), fam: c.fam, jetty: c.jetty, loops: ladders[k].map(v => v.n),
    bollards: c.fam === 'head' ? mooring[k] : [[r2(c.mx + c.px * (SNUG + HALF + 0.18)), r2(c.my + 1.3)], [r2(c.mx + c.px * (SNUG + HALF + 0.18)), r2(c.my - 1.5)]],
    move: { via: moves[k].via, run: moves[k].run, net: moves[k].net, mv: moves[k].mv } }));
  const src = `// Generated by tools/boats/loops.cjs — do not edit by hand.
// LOOP_R: turning radius of the loops (0.7125 × hull length). HEAD_ARMS: new deck at the jetty heads [x0, y0, x1, y1].
// LOOP_BERTHS[k]: where boat k's loop starts and ends (x, y, heading a; every turn \`sense\`, straight run-in sb);
// made fast it lies \`haul\` tiles nearer the pier, along (px, py). loops: checked extra lengths (tiles added to each
// long side). move: the one trip from slip k — way point at sea, straight run-in, where the net is out (tiles along the sea leg).
// MOVE_ORDER: the order in which the boats leave their slips. DECOR_MOVES: decorative boats that lie elsewhere so the loops are clear.
export const LOOP_R = ${R};
export const HEAD_ARMS = ${JSON.stringify(armsOut)};
// DOLPHINS: where an arm was cut short, three piles standing in the water that carry the bow line
export const DOLPHINS = ${JSON.stringify(dolphins)};
export const LOOP_BERTHS = ${JSON.stringify(data)};
export const MOVE_ORDER = ${JSON.stringify(ORDER)};
export const DECOR_MOVES = ${JSON.stringify(Object.fromEntries(movedDecor.map(d => [d, [decorNew[d].x, decorNew[d].y]])))};
`;
  fs.writeFileSync(path.join(root, 'src/render/boatloops.js'), src);
  console.log('written src/render/boatloops.js');
}
