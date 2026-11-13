// Study (development tool, nothing in the game uses it): a shorter trip to sea from each SLIP for the levels
// before the outer jetties open, sailed within the limits (5 tiles/s, 90°/s). The boat backs out as today,
// then sails one curve round a way point at sea with its net out and comes straight back into its slip —
// no stop at sea. For every slip the quickest clear curve is searched and timed.
//   node tools/boats/nearloops.cjs  → test-results/loops/nearloops.json
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const bundle = (src, name) => { const out = path.join(root, '.preview', name); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: out, logLevel: 'error' }); delete require.cache[out]; return require(out); };
const P = bundle('src/render/boatpaths.js', 'boatpaths.cjs'), C = bundle('src/config.js', 'config.cjs'), W = bundle('src/render/water.js', 'water.cjs');
const R = P.LOOP_R, MARGIN = 0.3, VMAX = 5, WMAX = 0.96 * Math.PI / 2;
const rocks = W.surfRocks().map(r => ({ x: r.x, y: r.y, r: 0.42 * r.s }));
const inRects = (rs, x, y) => rs.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1);
const hardAt = (x, y) => C.isLand(Math.floor(x), Math.floor(y)) || inRects(C.PIERS, x, y) || rocks.some(r => Math.hypot(x - r.x, y - r.y) <= r.r);
const decor = P.DECOR_BOATS.map(d => P.decorHull(d));
function touch(pth, grow, polys, s0 = 0) {
  for (let s = s0; s <= pth.len + 1e-6; s += 0.16) { const q = P.poseAt(pth, Math.min(s, pth.len)); for (const [x, y] of P.hullPoints(q.x, q.y, q.a, grow)) if (hardAt(x, y) || decor.some(o => P.pointInPoly(x, y, o)) || polys.some(o => P.pointInPoly(x, y, o))) return true; }
  return false;
}
function timeOf(pth, acc, dec, capOf) {      // from rest to rest; capOf(s) = speed limit at s
  const n = pth.n, v = new Float64Array(n);
  const kl = i => { let m = 0; for (let j = Math.max(1, i - 6); j <= Math.min(n - 2, i + 6); j++) { let d = pth.a[j + 1] - pth.a[j - 1]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m = Math.max(m, Math.abs(d) / (pth.s[j + 1] - pth.s[j - 1])); } return m; };
  const cap = i => { const k = kl(i); return Math.min(capOf(pth.s[i]), k > 1e-3 ? WMAX / k : Infinity); };
  for (let i = 1; i < n; i++) v[i] = Math.min(cap(i), Math.sqrt(v[i - 1] ** 2 + 2 * acc * (pth.s[i] - pth.s[i - 1])));
  v[n - 1] = 0;
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * dec * (pth.s[i + 1] - pth.s[i])));
  let t = 0, vm = 0; for (let i = 1; i < n; i++) { t += 2 * (pth.s[i] - pth.s[i - 1]) / (v[i] + v[i - 1]); vm = Math.max(vm, v[i]); }
  return { t, vm };
}
const cat = (...parts) => parts.reduce((acc, p) => acc.concat(acc.length ? p.slice(1) : p), []);
const endOf = pl => { const n = pl.length, c = pl[n - 1], b = pl[n - 2], a = pl[n - 3], a1 = Math.atan2(c[1] - b[1], c[0] - b[0]), a0 = Math.atan2(b[1] - a[1], b[0] - a[0]); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return [c[0], c[1], a1 + d / 2]; };
const out = { limits: { speed: VMAX, turnDegPerS: 90 }, boats: [] };
const T0 = Date.now();
for (let k = 0; k < 4; k++) {
  const S = P.siteOf(k), mv = S.mv, rev = P.pathOf(cat(mv.d0 > 0 ? P.straight(S.x, S.y, Math.PI / 2, mv.d0) : [[S.x, S.y]], P.arc(S.x, S.y + mv.d0, Math.PI / 2, mv.R, -mv.side * mv.phi)));
  const e = P.poseAt(rev, rev.len), head = e.a + Math.PI, mouth = [S.x, S.my, -Math.PI / 2], glide = S.my - S.y;
  const others = [0, 1, 2, 3].filter(j => j !== k).map(j => P.hullAt(P.VBERTH[j][0], P.VBERTH[j][1], -Math.PI / 2, 0.05));
  const tRev = timeOf(rev, 2.25, 2.0, () => 0.55 * VMAX).t + 0.55;
  let best = null, tried = 0, clear = 0;
  for (let x = S.x - 9; x <= S.x + 9; x += 1) for (let y = 34; y <= 41; y += 1) for (let h = 0; h < 16; h++) {
    tried++;
    const via = [x, y, h * Math.PI / 8], d1 = P.dubins([e.x, e.y, head], via, R), d2 = P.dubins(endOf(d1), mouth, R);
    const pts = cat(cat(d1, d2), P.straight(S.x, S.my, -Math.PI / 2, glide)), sea = P.pathOf(pts);
    if (best && sea.len >= best.sea.len) continue;
    if (P.minRadius(sea) < R - 0.08) continue;
    // out of / into the slip as today's routes (small clearance between the piers), at sea the full margin
    if (touch(sea, 0.06, others) || touch({ ...sea, len: sea.len - glide - 2 }, MARGIN, others, 3)) continue;
    clear++;
    const tm = timeOf(sea, 2.25, 1.5, s => s > sea.len - glide ? 0.75 * VMAX : VMAX);
    best = { via: [x, y, Math.round(h * 22.5)], sea, tiles: +(rev.len + sea.len).toFixed(1), seconds: +(tRev + tm.t).toFixed(2), topSpeed: +tm.vm.toFixed(2), farthestY: +Math.max(...Array.from(sea.y)).toFixed(1) };
  }
  const full = P.departurePlan(k), fe = P.poseAt(full[1].path, full[1].path.len), fa = P.arrivalPlan(k, P.poseAt(P.fishingPlan(k, fe)[0].path, P.LINGER * 0.5));
  out.boats.push({ boat: k + 1, quickestCurve: best ? { via: best.via, tiles: best.tiles, seconds: best.seconds, topSpeed: best.topSpeed, farthestFromShoreY: best.farthestY, beyondSlipMouthTiles: +(best.farthestY - S.my).toFixed(1), points: Array.from(best.sea.x).filter((_, i) => i % 3 === 0).map((x, i) => [+x.toFixed(2), +best.sea.y[i * 3].toFixed(2)]) } : null, fullRouteTiles: +(full[0].path.len + full[1].path.len + P.LINGER + fa[0].path.len + fa[1].path.len).toFixed(1), tried, clear });
  console.log(`boat ${k + 1}: ${best ? `${best.tiles} tiles, ${best.seconds} s, reaches ${(best.farthestY - S.my).toFixed(1)} tiles beyond the slip mouth, way point ${best.via}` : 'no clear curve'} (full route ${out.boats[k].fullRouteTiles} tiles)`);
}
out.searchSeconds = Math.round((Date.now() - T0) / 1000);
fs.writeFileSync(path.join(root, 'test-results/loops/nearloops.json'), JSON.stringify(out, null, 1));
