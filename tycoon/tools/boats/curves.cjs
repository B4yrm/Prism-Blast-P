// Short fishing curves from the existing slips for the middle levels (development tool; writes the data the game reads).
// Each boat backs out of its slip as always, sails ONE curve round a way point at sea with its net out (no stop at sea)
// and runs straight back into its slip. For every slip the clear curves are searched on the real map (land, piers, rocks,
// jetty stems, decorative boats, buoys, the other slips' boats),
// then the four curves are chosen so that they share as little water as possible (what remains is handled by giving way
// in the game) and are short.
//   node tools/boats/curves.cjs  → src/render/boatcurves.js, test-results/loops/curves.json
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const bundle = (src, name) => { const out = path.join(root, '.preview', name); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: out, logLevel: 'error' }); delete require.cache[out]; return require(out); };
// start from a neutral curve file so that boatpaths.js can be bundled before it exists
if (!fs.existsSync(path.join(root, 'src/render/boatcurves.js'))) fs.writeFileSync(path.join(root, 'src/render/boatcurves.js'), 'export const CURVES = [0, 1, 2, 3].map(() => ({ via: [0, 0, 0], net: [0, 0] }));\n');
const P = bundle('src/render/boatpaths.js', 'boatpaths.cjs'), C = bundle('src/config.js', 'config.cjs'), W = bundle('src/render/water.js', 'water.cjs');
const R = P.LOOP_R, MARGIN = +(0.25 * 2 * P.HULL.half).toFixed(2), VMAX = 5, WMAX = 0.96 * Math.PI / 2;
const T0 = Date.now();
// ---- obstacle grid (0.1-tile cells)
const GX0 = -24, GY0 = 16, GW = 760, GH = 400, CELL = 0.1, OBS = new Uint8Array(GW * GH);
const cellOf = (x, y) => { const cx = Math.floor((x - GX0) / CELL), cy = Math.floor((y - GY0) / CELL); return cx < 0 || cy < 0 || cx >= GW || cy >= GH ? -1 : cy * GW + cx; };
const paint = (test, x0, y0, x1, y1, G = OBS, bit = 1) => { for (let cy = Math.max(0, Math.floor((y0 - GY0) / CELL)); cy <= Math.min(GH - 1, Math.ceil((y1 - GY0) / CELL)); cy++) for (let cx = Math.max(0, Math.floor((x0 - GX0) / CELL)); cx <= Math.min(GW - 1, Math.ceil((x1 - GX0) / CELL)); cx++) if (test(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL)) G[cy * GW + cx] |= bit; };
const paintPoly = poly => { const xs = poly.map(q => q[0]), ys = poly.map(q => q[1]); paint((x, y) => P.pointInPoly(x, y, poly), Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)); };
const inRects = (rs, x, y) => rs.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1);
paint((x, y) => C.isLand(Math.floor(x), Math.floor(y)) || inRects(C.PIERS, x, y) || P.JETTIES.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1), GX0, GY0, GX0 + GW * CELL, GY0 + GH * CELL);
for (const r of W.surfRocks()) { const rr = 0.42 * r.s; paint((x, y) => Math.hypot(x - r.x, y - r.y) <= rr, r.x - rr, r.y - rr, r.x + rr, r.y + rr); }
// (head arms and dolphins are not obstacles: the game builds them only when no boat is out on a slip trip, and from
//  then on slip boats make no curves; the jetty stems are in the grid because they appear while a boat may be out)
[0, 1, 2, 3].forEach(g => P.buoysAt(g).forEach(([bx, by]) => paint((x, y) => Math.hypot(x - bx, y - by) <= 0.3, bx - 0.3, by - 0.3, bx + 0.3, by + 0.3)));
P.DECOR_BOATS.forEach(d => paintPoly(P.decorHull(d)));
// (the boats at the loop berths are not obstacles: the curves are sailed only before the jetties are built; afterwards
//  a boat waiting for its turn to move makes the harbour trip)
const slipHull = j => P.hullAt(P.VBERTH[j][0], P.VBERTH[j][1], -Math.PI / 2, 0.05);
const hits = (pth, grow, from = 0, polys = []) => {
  for (let s = from; s <= pth.len + 1e-6; s += 0.16) { const q = P.poseAt(pth, Math.min(s, pth.len)); for (const [x, y] of P.hullPoints(q.x, q.y, q.a, grow)) { const c = cellOf(x, y); if (c >= 0 && OBS[c]) return true; if (polys.some(o => P.pointInPoly(x, y, o))) return true; } }
  return false;
};
const STAMP = new Uint8Array(GW * GH);
function sweep(pth, grow = MARGIN / 2) {
  const cells = [];
  for (let s = 0; s <= pth.len; s += 0.16) {
    const q = P.poseAt(pth, s), poly = P.hullAt(q.x, q.y, q.a, grow), xs = poly.map(v => v[0]), ys = poly.map(v => v[1]);
    for (let cy = Math.floor((Math.min(...ys) - GY0) / CELL); cy <= Math.ceil((Math.max(...ys) - GY0) / CELL); cy++) for (let cx = Math.floor((Math.min(...xs) - GX0) / CELL); cx <= Math.ceil((Math.max(...xs) - GX0) / CELL); cx++) { const key = cy * GW + cx; if (key >= 0 && key < STAMP.length && !STAMP[key] && P.pointInPoly(GX0 + (cx + 0.5) * CELL, GY0 + (cy + 0.5) * CELL, poly)) { STAMP[key] = 1; cells.push(key); } }
  }
  for (const k of cells) STAMP[k] = 0;
  return Int32Array.from(cells);
}
const overlap = (A, B) => { for (const k of A) STAMP[k] = 1; let n = 0; for (const k of B) if (STAMP[k]) n++; for (const k of A) STAMP[k] = 0; return n / 100; };   // tiles²
function seconds(pth, acc, dec, capOf) {
  const n = pth.n, v = new Float64Array(n);
  const kl = i => { let m = 0; for (let j = Math.max(1, i - 6); j <= Math.min(n - 2, i + 6); j++) { let d = pth.a[j + 1] - pth.a[j - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m = Math.max(m, Math.abs(d) / (pth.s[j + 1] - pth.s[j - 1])); } return m; };
  const cap = i => { const k = kl(i); return Math.min(capOf(pth.s[i]), k > 1e-3 ? WMAX / k : Infinity); };
  for (let i = 1; i < n; i++) v[i] = Math.min(cap(i), Math.sqrt(v[i - 1] ** 2 + 2 * acc * (pth.s[i] - pth.s[i - 1])));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * (pth.s[i + 1] - pth.s[i])));
  let t = 0, vm = 0; for (let i = 1; i < n; i++) { t += 2 * (pth.s[i] - pth.s[i - 1]) / (v[i] + v[i - 1]); vm = Math.max(vm, v[i]); }
  return { t, vm };
}
// ---- candidates per slip
const cands = [[], [], [], []];
for (let k = 0; k < 4; k++) {
  const why = {}; const S = P.siteOf(k), others = [0, 1, 2, 3].filter(j => j !== k).map(slipHull), netY = S.my + 1.0;
  for (let x = S.x - 9; x <= S.x + 9.01; x += 1) for (let y = 34; y <= 41.01; y += 1) for (let h = 0; h < 16; h++) {
    const via = [x, y, h * Math.PI / 8];
    let cp; try { cp = P.curvePlan(k, via, [0, 0]); } catch (e) { continue; }
    const [rev, sea, glide] = cp.plan;
    why.n = (why.n || 0) + 1; if (P.minRadius(sea.path) < R - 0.08) { why.radius = (why.radius || 0) + 1; continue; }
    // out of / into the slip as today's routes (small clearance between the piers), at sea the full margin
    const hr = hits(rev.path, 0.06, 0, others), hs = hits(sea.path, MARGIN, 3.5, others), hg = hits(glide.path, 0.06, 0, others);
    if (hr || hs || hg) { why[(hr ? 'rev ' : '') + (hs ? 'sea ' : '') + (hg ? 'glide' : '')] = (why[(hr ? 'rev ' : '') + (hs ? 'sea ' : '') + (hg ? 'glide' : '')] || 0) + 1; continue; }
    // where the net is out: while the boat's centre is more than a tile beyond the slip mouth
    let s0 = -1, s1 = -1; for (let s = 0; s <= sea.path.len; s += 0.1) { if (P.poseAt(sea.path, s).y >= netY) { if (s0 < 0) s0 = s; s1 = s; } }
    if (s0 < 0 || s1 - s0 < 8) continue;
    cp.net.s0 = s0 + 0.5; cp.net.s1 = s1 - 0.5;
    const tm = seconds(sea.path, 2.25, 1.5, s => (s > sea.path.len - 3 ? 0.75 : 1) * VMAX);
    cands[k].push({ via: [+x.toFixed(2), +y.toFixed(2), +via[2].toFixed(4)], len: rev.path.len + sea.path.len + glide.path.len, seaLen: sea.path.len, net: [+cp.net.s0.toFixed(1), +cp.net.s1.toFixed(1)], secs: tm.t, sea: sea.path, rev: rev.path });
  }
  console.log('slip', k + 1, JSON.stringify(why));
  cands[k].sort((a, b) => a.len - b.len); cands[k] = cands[k].filter(c => c.len <= cands[k][0].len + 6).slice(0, 50);      // at most 6 tiles longer than the shortest
  for (const c of cands[k]) c.sw = sweep(c.sea);
  console.log(`slip ${k + 1}: ${cands[k].length} clear curves kept, shortest ${cands[k][0] ? cands[k][0].len.toFixed(1) : '-'} tiles (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
  if (!cands[k].length) { console.log('no clear curve for slip', k + 1); process.exit(1); }
}
// ---- choose four that share little water (coordinate descent from the shortest)
const pick = [0, 0, 0, 0], ov = (i, a, j, b) => overlap(cands[i][a].sw, cands[j][b].sw);
const cost = pk => { let c = 0; for (let i = 0; i < 4; i++) { c += cands[i][pk[i]].len; for (let j = i + 1; j < 4; j++) c += 2 * ov(i, pk[i], j, pk[j]); } return c; };
let best = cost(pick);
for (let round = 0; round < 6; round++) { let moved = false; for (let i = 0; i < 4; i++) for (let a = 0; a < cands[i].length; a++) { const t = pick.slice(); t[i] = a; const c = cost(t); if (c < best - 1e-6) { best = c; pick[i] = a; moved = true; } } if (!moved) break; }
const out = { limits: { speed: VMAX, turnDegPerS: 90 }, curves: [], sharedWaterTiles2: {} };
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) out.sharedWaterTiles2[`${i + 1}-${j + 1}`] = +ov(i, pick[i], j, pick[j]).toFixed(1);
pick.forEach((a, k) => { const c = cands[k][a], full = P.departurePlan(k); out.curves.push({ boat: k + 1, via: c.via, tiles: +c.len.toFixed(1), netTiles: +(c.net[1] - c.net[0]).toFixed(1), seaSeconds: +c.secs.toFixed(1), points: Array.from({ length: Math.floor(c.sea.n / 3) }, (_, i) => [+c.sea.x[i * 3].toFixed(2), +c.sea.y[i * 3].toFixed(2)]) }); console.log(` boat ${k + 1}: ${c.len.toFixed(1)} tiles, via ${c.via}, net out ${(c.net[1] - c.net[0]).toFixed(1)} tiles; shortest alone ${cands[k][0].len.toFixed(1)}`); });
console.log('shared water (tiles²):', JSON.stringify(out.sharedWaterTiles2), `(${((Date.now() - T0) / 1000).toFixed(0)} s)`);
fs.mkdirSync(path.join(root, 'test-results/loops'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/loops/curves.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(root, 'src/render/boatcurves.js'), `// Generated by tools/boats/curves.cjs — do not edit by hand.
// CURVES[k]: the short trip to sea of slip k for the middle levels: back out, one curve round the way point \`via\`
// (x, y, heading) with the net out between tiles net[0] and net[1] of the sea leg, straight back into the slip.
export const CURVES = ${JSON.stringify(pick.map((a, k) => ({ via: cands[k][a].via, net: cands[k][a].net })))};
`);
console.log('written src/render/boatcurves.js');
