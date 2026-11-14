// Static check: quay props against the people's walking lines and against each other.
//   • every hauler route between the simulation's places (A* from src/sim/path.js, as walked) and every customer
//     route, widened by the hauler lane offset (±0.25), the visual push-apart (0.21) and a body (0.15)
//   • props against other props, the cranes, the bollards, the boats lying at their berths, the cart routes,
//     and that each stands on land or a pier
// The props are read from the source (WorldScene.js), so the check follows the game.
//   node tests/decor-check.cjs  → test-results/workers/decor-check.json (exit 1 if a moved prop collides)
const esbuild = require('esbuild'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..');
const bundle = (src, name) => { const o = path.join(root, '.preview', name); esbuild.buildSync({ entryPoints: [path.join(root, src)], bundle: true, format: 'cjs', outfile: o, logLevel: 'error' }); delete require.cache[o]; return require(o); };
const C = bundle('src/config.js', 'config.cjs'), PA = bundle('src/sim/path.js', 'path.cjs'), BP = bundle('src/render/boatpaths.js', 'boatpaths.cjs');
const src = fs.readFileSync(path.join(root, 'src/scenes/WorldScene.js'), 'utf8');
const block = src.slice(src.indexOf("for (const [x, y, n] of [[3.6"), src.indexOf("]) prop('prop/' + n, x, y);"));
const props = [...block.matchAll(/\[(-?[\d.]+), (-?[\d.]+), '([a-z_]+)'\]/g)].map(m => ({ x: +m[1], y: +m[2], name: m[3] }));
const MOVED = ['fishbox_stack@15.3', 'forklift_parked@18.4', 'barrels@19.4'];
const R = { fishbox_stack: 0.35, forklift_parked: 0.4, barrels: 0.3, pallet_raw: 0.35, pallet_prod: 0.35, cones: 0.25, netpile: 0.35, container_yard: 0.8 };
const door = b => C.BUILDINGS[b].door, PL = { quay: C.POI.quay, wh: door('warehouse'), fac: door('factory'), mkt: door('market'), rest: C.POI.rest };
const routes = [];
for (const a of Object.keys(PL)) for (const b of Object.keys(PL)) if (a !== b) { const p = PA.findPath(PL[a], PL[b]); if (p) routes.push({ who: 'hauler', name: a + '→' + b, p }); }
for (const s of C.POI.queue) { routes.push({ who: 'customer', name: 'spawn→queue', p: PA.findPath(C.POI.spawn, s) }); routes.push({ who: 'customer', name: 'queue→spawn', p: PA.findPath(s, C.POI.spawn) }); }
const segDist = (px, py, [x0, y0], [x1, y1]) => { const vx = x1 - x0, vy = y1 - y0, L = vx * vx + vy * vy, t = L ? Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / L)) : 0; return Math.hypot(px - x0 - vx * t, py - y0 - vy * t); };
const BAND = 0.21 + 0.15;                              // visual push-apart + body (the ±0.25 lane offset is applied to the route itself below)
// the lane offset is added to both coordinates of every waypoint (Mover.go): check both extremes and the middle
const routeDist = (x, y, r) => { let d = Infinity; for (const off of [-0.25, 0, 0.25]) for (let i = 1; i < r.p.length; i++) d = Math.min(d, segDist(x, y, [r.p[i - 1][0] + off, r.p[i - 1][1] + off], [r.p[i][0] + off, r.p[i][1] + off])); return d; };
const cranes = C.CRANES.map(([x, y]) => [x + 0.5, y + 0.5]), bollards = BP.BOLLARDS.flat();
const hulls = [...[0, 1, 2, 3].map(k => BP.dockedHull(k)), ...[4, 5, 6, 7].map(s => BP.siteHull(s))];
const cartRoutes = [[[30.5, 28.2], [30.5, 20.7], [24.2, 20.7], [22.4, 22.55], [13.2, 22.55]], [[-3.5, 28.2], [-3.5, 21.7], [1.4, 21.7], [2.6, 22.55], [10.8, 22.55]], [[4.3, 22.85], [4.3, 23.75]], [[22.6, 22.85], [22.6, 23.75]]];
const cartName = ['east jetty cart', 'west jetty cart', 'slip 3 cart', 'slip 4 cart'];
const onSurface = (x, y) => C.isLand(Math.floor(x), Math.floor(y)) || C.PIERS.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 + 1 && y >= y0 && y < y1 + 1);
const rep = { props: [], fails: [] };
for (const pr of props) {
  let clear = 9; const r = R[pr.name] || 0.35, id = `${pr.name}@${pr.x}`, moved = MOVED.includes(id), issues = [];
  for (const rt of routes) { const d = routeDist(pr.x, pr.y, rt) - BAND - r; if (d < 0) issues.push(`${rt.who} route ${rt.name} (${d.toFixed(2)})`); else clear = Math.min(clear, d); }
  for (const o of props) if (o !== pr && Math.hypot(o.x - pr.x, o.y - pr.y) < r + (R[o.name] || 0.35)) issues.push(`prop ${o.name}@${o.x}`);
  for (const [cx, cy] of cranes) if (Math.hypot(cx - pr.x, cy - pr.y) < 0.6 + r) issues.push('crane');
  for (const [bx, by] of bollards) if (Math.hypot(bx - pr.x, by - pr.y) < 0.15 + r) issues.push('bollard');
  for (const h of hulls) if (BP.pointInPoly(pr.x, pr.y, h) || h.some(([hx, hy]) => Math.hypot(hx - pr.x, hy - pr.y) < r)) issues.push('a boat at its berth');
  cartRoutes.forEach((cr, n) => { let d = Infinity; for (let i = 1; i < cr.length; i++) d = Math.min(d, segDist(pr.x, pr.y, cr[i - 1], cr[i])); if (d < r + 0.3) issues.push(cartName[n]); });
  if (!onSurface(pr.x, pr.y)) issues.push('not on land or a pier');
  const uniq = [...new Set(issues.map(s => s.replace(/ \(.*\)/, '')))];
  rep.props.push({ prop: id, at: [pr.x, pr.y], moved, issues: uniq, routeClearance: +clear.toFixed(2) });
  if (moved && uniq.length) rep.fails.push(`${id}: ${uniq.join(', ')}`);
}
rep.ok = !rep.fails.length;
fs.mkdirSync(path.join(root, 'test-results/workers'), { recursive: true });
fs.writeFileSync(path.join(root, 'test-results/workers/decor-check.json'), JSON.stringify(rep, null, 1));
console.log(JSON.stringify(rep, null, 1));
process.exit(rep.ok ? 0 : 1);
