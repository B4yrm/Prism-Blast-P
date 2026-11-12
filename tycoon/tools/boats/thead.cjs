// Feasibility study (development tool, nothing in the game uses it): berths a
// boat can leave AHEAD and come back to AHEAD on one closed loop, searched on
// the real map with the real hull, piers, jetties, decorative boats and buoys.
//   family "head": alongside the sea face of a T / L head added to an outer jetty
//   family "stem": alongside a face of the existing jetty stem, bow to the sea
// A loop is a rounded rectangle: straight a, 90°, straight L, 90°, straight
// W = a + b, 90°, straight L, 90°, straight b — every turn the same way, radius R.
// Timing: speed ≤ 5 tiles/s, turn rate ≤ 90°/s, constant acceleration / braking.
//   node tools/boats/thead.cjs  → test-results/thead/search.json
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, '.preview', 'boatpaths.cjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.buildSync({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'cjs', outfile: out, logLevel: 'error' });
const P = require(out);

const VMAX = 5, WMAX = Math.PI / 2;
const DS = 0.08;
const DECK = { y0: 30.6, y1: 31.6 };                    // head deck across the jetty end (1 tile wide)
const JET = P.JETTIES;                                   // [x0, y0, x1, y1] east, west

// ---- paths
function build(x, y, a, segs) {
  const pts = [];
  let s = 0;
  const push = k => pts.push({ x, y, a, k, s });
  push(0);
  for (const [type, p1, p2] of segs) {
    if (type === 'S') { const n = Math.max(1, Math.round(p1 / DS)), d = p1 / n; if (p1 <= 0) continue; for (let i = 0; i < n; i++) { x += Math.cos(a) * d; y += Math.sin(a) * d; s += d; push(0); } }
    else { const R = p1, sw = p2, len = Math.abs(sw) * R, n = Math.max(1, Math.round(len / DS)), d = len / n, da = sw / n; for (let i = 0; i < n; i++) { const a2 = a + da; x += Math.cos(a + da / 2) * d; y += Math.sin(a + da / 2) * d; a = a2; s += d; push(1 / R); } }
  }
  return { pts, len: s };
}
const loopSegs = (R, sense, a, b, L) => [['S', a], ['A', R, sense * Math.PI / 2], ['S', L], ['A', R, sense * Math.PI / 2], ['S', a + b], ['A', R, sense * Math.PI / 2], ['S', L], ['A', R, sense * Math.PI / 2], ['S', b]];
// time along a path that starts and ends at rest
function timing(pth, acc, dec) {
  const n = pth.pts.length, v = new Float64Array(n);
  const cap = i => Math.min(VMAX, pth.pts[i].k > 0 ? WMAX / pth.pts[i].k : Infinity);
  v[0] = 0;
  for (let i = 1; i < n; i++) v[i] = Math.min(cap(i), Math.sqrt(v[i - 1] * v[i - 1] + 2 * acc * (pth.pts[i].s - pth.pts[i - 1].s)));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * dec * (pth.pts[i + 1].s - pth.pts[i].s)));
  let t = 0, vmax = 0, wmax = 0;
  for (let i = 1; i < n; i++) { const d = pth.pts[i].s - pth.pts[i - 1].s; t += 2 * d / (v[i] + v[i - 1]); vmax = Math.max(vmax, v[i]); wmax = Math.max(wmax, v[i] * pth.pts[i].k); }
  return { t, vmax, wmax: wmax * 180 / Math.PI };
}

// ---- obstacles: one occupancy grid (0.1-tile cells), painted once
const GX0 = -24, GY0 = 16, GW = 760, GH = 400, CELL = 0.1;
const LAND = 1, DECOR = 2, SLIP = 4, BUOY = 8;
const OBS = new Uint8Array(GW * GH);
const cellOf = (x, y) => { const cx = Math.floor((x - GX0) / CELL), cy = Math.floor((y - GY0) / CELL); return cx < 0 || cy < 0 || cx >= GW || cy >= GH ? -1 : cy * GW + cx; };
function paintPoly(poly, bit, G = OBS) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (let cy = Math.floor((y0 - GY0) / CELL); cy <= Math.ceil((y1 - GY0) / CELL); cy++) for (let cx = Math.floor((x0 - GX0) / CELL); cx <= Math.ceil((x1 - GX0) / CELL); cx++) {
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) continue;
    if (P.pointInPoly(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL, poly)) G[cy * GW + cx] |= bit;
  }
}
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (P.solidAt(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL)) OBS[cy * GW + cx] |= LAND;
P.DECOR_BOATS.forEach(d => paintPoly(P.decorHull(d, 0.1), DECOR));
[0, 1, 2, 3].forEach(i => paintPoly(P.hullAt(P.VBERTH[i][0], P.VBERTH[i][1], -Math.PI / 2, 0.1), SLIP));
[0, 1, 2, 3].flatMap(j => P.buoysAt(j)).forEach(b => paintPoly(P.buoyPoly(b, 0.6), BUOY));
const inRect = (r, x, y) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
// what the hull touches along a path: LAND (land, piers, jetty stems), 16 = its own head deck, DECOR, SLIP (an occupied slip), BUOY
function contacts(pth, decks, grow = 0.08) {
  let hit = 0;
  for (let i = 0; i < pth.pts.length; i += 2) {
    const q = pth.pts[i];
    for (const [x, y] of P.hullPoints(q.x, q.y, q.a, grow)) {
      const c = cellOf(x, y); if (c >= 0) hit |= OBS[c];
      if (hit & LAND) return hit;
      for (const r of decks) if (inRect(r, x, y)) return hit | 16;
    }
  }
  return hit;
}
// ---- the water a loop sweeps (cells, hull grown by 0.15)
const STAMP = new Uint8Array(GW * GH);
function sweep(pth, grow = 0.15) {
  const cells = [];
  for (let i = 0; i < pth.pts.length; i += 2) {
    const q = pth.pts[i], poly = P.hullAt(q.x, q.y, q.a, grow);
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
const rectCells = r => { const S = []; for (let cy = Math.floor((r[1] - GY0) / CELL); cy <= Math.floor((r[3] - GY0) / CELL); cy++) for (let cx = Math.floor((r[0] - GX0) / CELL); cx <= Math.floor((r[2] - GX0) / CELL); cx++) S.push(cy * GW + cx); return Int32Array.from(S); };
function meets(A, B) { for (const k of A) STAMP[k] = 1; let hit = false; for (const k of B) if (STAMP[k]) { hit = true; break; } for (const k of A) STAMP[k] = 0; return hit; }
const bbox = pth => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of pth.pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); } return [x0 - 2.4, y0 - 2.4, x1 + 2.4, y1 + 2.4]; };
const apart = (a, b) => a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];

// ---- candidates
const E = 0, S_ = Math.PI / 2, W = Math.PI;
function candidate(fam, jetty, x, y, a, sense, R, gap, sa, sb, L) {
  const pth = build(x, y, a, loopSegs(R, sense, sa, sb, L));
  // the deck this berth needs: from the jetty stem to the far end of the hull's flat side (1.3 tiles ahead of the centre, the whole stern)
  let deck = null;
  if (fam === 'head') {
    const J = JET[jetty], dir = Math.cos(a), ends = [x + dir * 1.3, x - dir * (P.HULL.stern + 0.2)];
    deck = [Math.min(J[0], ...ends), DECK.y0, Math.max(J[2], ...ends), DECK.y1];
  }
  const hit = contacts(pth, deck ? [deck] : []);
  if (hit & (LAND | 16)) return null;
  const fast = timing(pth, 2.25, 1.5), calm = timing(pth, 1.5, 1.25);
  return { fam, jetty, x, y, a, sense, R, gap, sa, sb, L, len: +pth.len.toFixed(1), tFast: +fast.t.toFixed(2), tCalm: +calm.t.toFixed(2), vmax: +fast.vmax.toFixed(2), wmax: +fast.wmax.toFixed(1), deck, hits: [hit & DECOR ? 'decor boat' : '', hit & SLIP ? 'occupied slip' : '', hit & BUOY ? 'buoy' : ''].filter(Boolean), pth };
}
function candidates(jetty, L = 0) {
  const J = JET[jetty], list = [];
  for (const R of [2.8, 3.2]) for (const gap of [0.3, 0.45, 0.6, 0.75]) for (const sa of [0, 2, 4]) for (const sb of [0.5, 2]) {
    // head: south face of the deck, heading east or west, loop to the south
    const yl = DECK.y1 + gap + P.HULL.half;
    for (let x = J[0] - 14; x <= J[2] + 14; x += 0.5) for (const a of [E, W]) { const c = candidate('head', jetty, x, yl, a, a === E ? 1 : -1, R, gap, sa, sb, L); if (c) list.push(c); }
    // stem: east or west face, bow to the sea, loop away from the jetty
    for (const side of [1, -1]) { const xl = (side > 0 ? J[2] : J[0]) + side * (gap + P.HULL.half); for (let y = J[1] + 2.2; y <= J[3] + 1; y += 0.5) { const c = candidate('stem', jetty, xl, y, S_, side > 0 ? -1 : 1, R, gap, sa, sb, L); if (c) { c.side = side; list.push(c); } } }
  }
  return list;
}

function search() {
  const T0 = Date.now(), LIMIT_MS = 8 * 60 * 1000;
  const report = { limits: { speed: VMAX, turnDegPerS: 90 }, hull: P.HULL, jetties: [] }, chosen = [];
  const clean = c => c.hits.length === 0;
  for (const jetty of [0, 1]) {
    const all = candidates(jetty);
    const byFam = f => all.filter(c => c.fam === f);
    const info = { jetty: jetty ? 'west' : 'east', candidates: { head: byFam('head').length, stem: byFam('stem').length, headClean: byFam('head').filter(clean).length, stemClean: byFam('stem').filter(clean).length } };
    for (const f of ['head', 'stem']) { const g = byFam(f).filter(clean).map(c => c.gap); info['minGap_' + f] = g.length ? Math.min(...g) : null; }
    for (const f of ['head', 'stem']) { const c = byFam(f).filter(clean).sort((p, q) => p.tCalm - q.tCalm)[0]; info['fastest_' + f] = c ? pub(c) : null; }
    // pairs: two berths on this jetty with separate water; per kind the pair with the
    // shortest slower loop, then the smallest new deck and gap. "soft": a decorative boat may be moved.
    const cost = c => c.tCalm + 0.6 * c.gap + 0.03 * (c.deck ? c.deck[2] - c.deck[0] : 0);
    const ok = c => c.hits.every(h => h === 'decor boat');
    const top = (f, n) => byFam(f).filter(ok).sort((p, q) => cost(p) - cost(q)).slice(0, n);
    const pool = [...top('head', 420), ...top('stem', 200)];
    for (const c of pool) { c.sw = sweep(c.pth); c.st = c.deck ? rectCells(c.deck) : new Int32Array(0); c.bb = bbox(c.pth); }
    const pairs = {};
    const deckLen = (A, B) => { const d = [A.deck, B.deck].filter(Boolean); return d.length ? Math.max(...d.map(r => r[2])) - Math.min(...d.map(r => r[0])) - (JET[jetty][2] - JET[jetty][0]) : 0; };
    for (let j = 1; j < pool.length && Date.now() - T0 < LIMIT_MS; j++) for (let i = 0; i < j; i++) {
      const A = pool[i], B = pool[j], soft = A.hits.length || B.hits.length;
      if (A.fam === 'stem' && B.fam === 'stem' && A.side === B.side) continue;
      const kind = [A.fam, B.fam].sort().join('+') + (soft ? ' (a decorative boat moved)' : '');
      const c = Math.round(Math.max(A.tCalm, B.tCalm) * 10) + 0.05 * deckLen(A, B) + 0.3 * (A.gap + B.gap);
      if (pairs[kind] && pairs[kind].c <= c) continue;
      if (!apart(A.bb, B.bb) && meets(A.sw, B.sw)) continue;
      if (meets(A.sw, B.st) || meets(B.sw, A.st)) continue;
      pairs[kind] = { c, A, B, newDeckTiles: +deckLen(A, B).toFixed(1) };
    }
    info.pairs = Object.fromEntries(Object.entries(pairs).map(([k, p]) => [k, { slowerLoopS: { brisk: Math.max(p.A.tFast, p.B.tFast), calm: Math.max(p.A.tCalm, p.B.tCalm) }, newDeckTiles: p.newDeckTiles, A: pub(p.A), B: pub(p.B) }]));
    report.jetties.push(info);
    chosen.push(pairs);
    console.error(info.jetty, JSON.stringify(info.candidates), 'min gap head', info.minGap_head, 'stem', info.minGap_stem, Object.entries(info.pairs).map(([k, p]) => `${k}: ${p.slowerLoopS.brisk} / ${p.slowerLoopS.calm} s, deck ${p.newDeckTiles}`).join('; '), `(${((Date.now() - T0) / 1000).toFixed(0)} s)`);
  }
  report.searchSeconds = Math.round((Date.now() - T0) / 1000);
  fs.mkdirSync(path.join(root, 'test-results/thead'), { recursive: true });
  fs.writeFileSync(path.join(root, 'test-results/thead/search.json'), JSON.stringify(report, null, 1));
  return { report, chosen };
}
const pub = c => { const { pth, sw, st, bb, ...r } = c; return { ...r, a: +(c.a * 180 / Math.PI).toFixed(0) }; };
module.exports = { P, build, loopSegs, timing, contacts, sweep, rectCells, meets, candidate, candidates, search, pub, OBS, GX0, GY0, GW, GH, CELL, DECK, JET, VMAX, WMAX };
if (require.main === module) search();
