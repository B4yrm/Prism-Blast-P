// Static ground layer: island, cliffs, shallow water, roads, pavements, piers.
// Drawn once into one big canvas, then sliced into GPU-friendly chunks.
import { BOUNDS, isLand, ROADS, PAVE, PIERS, BUILDINGS, hash, SEA_Z, iso } from '../config.js';
import { isRoad } from '../sim/path.js';
import { Painter, shade } from './paint.js';
import { A, drawFrame } from './atlas.js';
import { G } from '../core/economy.js';

const inR = (rs, i, j) => rs.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1);
const isPave = (i, j) => inR(PAVE, i, j);
const isPier = (i, j) => inR(PIERS, i, j);
const inBuilding = (i, j) => Object.values(BUILDINGS).some(b => i >= b.x && i < b.x + b.w && j >= b.y && j < b.y + b.d);

export function groundBounds() {
  const { x0, y0, x1, y1 } = BOUNDS;
  const a = iso(x0, y1), b = iso(x1, y0), c = iso(x0, y0), d = iso(x1, y1);
  return { left: a.x - 40, right: b.x + 40, top: c.y - 40, bottom: d.y + 60 };
}

// Paints the whole ground into ctx; (offX, offY) is the chunk's top-left in canvas px.
function paintGround(c, S, offX, offY) {
  const gb = groundBounds();
  const P = new Painter(c, -gb.left * S - offX, -gb.top * S - offY, S);
  const { x0, y0, x1, y1 } = BOUNDS;

  // 1. shallow-water halo around the coast (several soft rings)
  for (let ring = 3; ring >= 1; ring--) {
    c.fillStyle = `rgba(120,230,235,${0.10 + (3 - ring) * 0.07})`;
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
      if (isLand(i, j)) continue;
      let near = false;
      for (let a = -ring; a <= ring && !near; a++) for (let b = -ring; b <= ring; b++)
        if (Math.abs(a) + Math.abs(b) <= ring + 0.5 && isLand(i + a, j + b)) { near = true; break; }
      if (near) P.path([[i - 0.05, j - 0.05, SEA_Z], [i + 1.05, j - 0.05, SEA_Z], [i + 1.05, j + 1.05, SEA_Z], [i - 0.05, j + 1.05, SEA_Z]]), c.fill();
    }
  }

  // 2. piers: posts down to the water, then planks
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (!isPier(i, j)) continue;
    for (const [u, v] of [[0.1, 0.9], [0.9, 0.9]]) P.box(i + u - 0.06, j + v - 0.06, SEA_Z - 4, 0.12, 0.12, -SEA_Z + 2, '#6b4a2f', { edge: false });
  }
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (!isPier(i, j)) continue;
    const base = hash(i, j) > 0.5 ? '#c7925a' : '#bd8851';
    P.box(i, j, -6, 1, 1, 4, base, { edge: false, lf: 0.8, rf: 0.62 });
    c.strokeStyle = 'rgba(90,55,25,0.45)'; c.lineWidth = 1 * S;
    for (let k = 1; k < 4; k++) {
      const a = P.p(i + k / 4, j, -2), b = P.p(i + k / 4, j + 1, -2);
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
  }

  // 3. cliffs on the sea-facing edges (+x and +y), painted back-to-front
  const cells = [];
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) if (isLand(i, j)) cells.push([i, j]);
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  for (const [i, j] of cells) {
    const dy = !isLand(i, j + 1), dx = !isLand(i + 1, j);
    const rock = hash(i, j) > 0.5 ? '#8d8a80' : '#9b968b';
    if (dy) {
      P.poly([[i, j + 1, 0], [i + 1, j + 1, 0], [i + 1, j + 1, SEA_Z - 4], [i, j + 1, SEA_Z - 4]],
        P.vgrad(P.p(i, j + 1, 0), P.p(i, j + 1, SEA_Z), shade(rock, 1.05), shade(rock, 0.7)));
      rockLines(P, c, i, j + 1, 'y', S);
    }
    if (dx) {
      P.poly([[i + 1, j, 0], [i + 1, j + 1, 0], [i + 1, j + 1, SEA_Z - 4], [i + 1, j, SEA_Z - 4]],
        P.vgrad(P.p(i + 1, j, 0), P.p(i + 1, j, SEA_Z), shade(rock, 0.85), shade(rock, 0.55)));
      rockLines(P, c, i + 1, j, 'x', S);
    }
  }
  // foam line where cliffs meet the water
  c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 2.2 * S; c.lineCap = 'round';
  for (const [i, j] of cells) {
    if (!isLand(i, j + 1) && !isPier(i, j + 1)) { const a = P.p(i, j + 1.12, SEA_Z), b = P.p(i + 1, j + 1.12, SEA_Z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    if (!isLand(i + 1, j)) { const a = P.p(i + 1.12, j, SEA_Z), b = P.p(i + 1.12, j + 1, SEA_Z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }

  // 4. grass with gentle colour noise; darker forest belt in the north/west
  for (const [i, j] of cells) {
    const n = hash(i, j), forest = i < 2 || j < 2;
    const base = forest ? (n > 0.5 ? '#4f9e3c' : '#559f40') : (n > 0.66 ? '#79c552' : n > 0.33 ? '#73bf4d' : '#6fba4a');
    const edge = (!isLand(i, j + 1) || !isLand(i + 1, j)) ? 0.94 : 1;
    P.poly([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], shade(base, edge));
  }
  // grass tufts / flowers
  for (const [i, j] of cells) {
    if (isRoad(i, j) || isPave(i, j) || inBuilding(i, j)) continue;
    for (let k = 0; k < 3; k++) {
      const h = hash(i * 3 + k, j * 7 - k);
      const [sx, sy] = P.p(i + hash(i + k, j) , j + hash(i, j + k));
      if (h < 0.18) { c.fillStyle = ['#ffffff', '#ffd84a', '#ff8fb1'][k]; c.beginPath(); c.arc(sx, sy, 1.3 * S, 0, 7); c.fill(); }
      else if (h < 0.7) { c.strokeStyle = 'rgba(40,110,30,0.45)'; c.lineWidth = 1 * S; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx - 1.5 * S, sy - 4 * S); c.moveTo(sx, sy); c.lineTo(sx + 1.5 * S, sy - 3.5 * S); c.stroke(); }
    }
  }

  // 5. building pads (paved concrete with a curb)
  for (const b of Object.values(BUILDINGS)) {
    P.poly([[b.x - 0.3, b.y - 0.3], [b.x + b.w + 0.3, b.y - 0.3], [b.x + b.w + 0.3, b.y + b.d + 0.3], [b.x - 0.3, b.y + b.d + 0.3]], '#cfd3d6');
    P.poly([[b.x - 0.15, b.y - 0.15], [b.x + b.w + 0.15, b.y - 0.15], [b.x + b.w + 0.15, b.y + b.d + 0.15], [b.x - 0.15, b.y + b.d + 0.15]], '#dfe2e3');
  }

  // 6. pavements (light pavers)
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (!isPave(i, j) || isRoad(i, j)) continue;
    const quay = j === 28;
    P.poly([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], quay ? '#c9c2b4' : (hash(i, j) > 0.5 ? '#e4ddcf' : '#ded6c6'));
    c.strokeStyle = 'rgba(120,105,85,0.25)'; c.lineWidth = 0.8 * S;
    for (let k = 1; k < 2; k++) {
      let a = P.p(i + k / 2, j), b = P.p(i + k / 2, j + 1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      a = P.p(i, j + k / 2); b = P.p(i + 1, j + k / 2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    if (quay) { // yellow safety edge
      const a = P.p(i, j + 0.92), b = P.p(i + 1, j + 0.92);
      c.strokeStyle = '#f2c230'; c.lineWidth = 2 * S; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
  }

  // 7. roads: curb, asphalt, then lane markings
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (!isRoad(i, j) || !isLand(i, j)) continue;
    P.poly([[i - 0.04, j - 0.04], [i + 1.04, j - 0.04], [i + 1.04, j + 1.04], [i - 0.04, j + 1.04]], '#b9bcc0');
  }
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) {
    if (!isRoad(i, j) || !isLand(i, j)) continue;
    const ins = 0.08;
    const l = isRoad(i - 1, j) ? 0 : ins, r = isRoad(i + 1, j) ? 0 : ins, t = isRoad(i, j - 1) ? 0 : ins, bt = isRoad(i, j + 1) ? 0 : ins;
    P.poly([[i + l, j + t], [i + 1 - r, j + t], [i + 1 - r, j + 1 - bt], [i + l, j + 1 - bt]], hash(i, j) > 0.5 ? '#555b63' : '#585e66');
    // asphalt grain
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = P.p(i + hash(i + k, j * 2), j + hash(i * 2, j + k));
      c.fillStyle = k % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; c.fillRect(sx, sy, 1.5 * S, 1 * S);
    }
  }
  c.lineCap = 'butt';
  const vert = r => r[2] - r[0] < r[3] - r[1];
  for (const R of ROADS) {
    const [rx0, ry0, rx1, ry1] = R;
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1.6 * S;
    if (!vert(R)) {
      const y = ry0 + 1;
      for (let x = rx0; x < rx1; x++) {
        if (ROADS.some(r => vert(r) && x >= r[0] - 1 && x <= r[2] && y >= r[1] && y <= r[3] + 1)) continue;
        const a = P.p(x + 0.2, y), b = P.p(x + 0.7, y); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
    } else {
      const x = rx0 + 1;
      for (let y = ry0; y < ry1; y++) {
        if (ROADS.some(r => !vert(r) && y >= r[1] - 1 && y <= r[3] && x >= r[0] && x <= r[2] + 1)) continue;
        const a = P.p(x, y + 0.2), b = P.p(x, y + 0.7); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
    }
  }
  // zebra crossings in front of the market and warehouse
  for (const [zx, zy] of [[18, 26], [30, 26], [28, 13], [11, 13]]) {
    for (let k = 0; k < 5; k++) P.poly([[zx + k * 0.2 + 0.03, zy + 0.1], [zx + k * 0.2 + 0.13, zy + 0.1], [zx + k * 0.2 + 0.13, zy + 1.9], [zx + k * 0.2 + 0.03, zy + 1.9]], 'rgba(255,255,255,0.8)');
  }

  // 8. HQ plaza fountain basin & park paths are drawn as sprites; tunnel mouth in the west hill
  tunnel(P, c, S);
}

function rockLines(P, c, i, j, ax, S) {
  c.strokeStyle = 'rgba(60,55,50,0.35)'; c.lineWidth = 1 * S;
  for (let k = 0; k < 3; k++) {
    const u = hash(i * 5 + k, j * 3), v = -4 - hash(i, j * 5 + k) * 12;
    const a = ax === 'y' ? P.p(i + u, j, v) : P.p(i, j + u, v);
    const b = ax === 'y' ? P.p(i + u + 0.2, j, v - 3) : P.p(i, j + u + 0.2, v - 3);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
}

function tunnel(P, c, S) {
  // rocky hill face at x=1 with an arched opening over the avenue
  P.box(-3, 8, 0, 3, 5, 40, '#8f8a7f', { lf: 0.9, rf: 0.7, edge: false });
  P.box(-3, 8, 40, 3, 5, 7, '#5aa043', { edge: false });
  const f = P.fR(-3, 8, 0, 3, 5, 40);
  const u0 = 0.32, u1 = 0.68, pts = [P.p(...f(u0, 0))];
  for (let k = 0; k <= 16; k++) { const t = k / 16; pts.push(P.p(...f(u0 + (u1 - u0) * t, 0.4 + 0.32 * Math.sin(Math.PI * t)))); }
  pts.push(P.p(...f(u1, 0)));
  c.fillStyle = '#1d2127'; c.beginPath();
  pts.forEach((q, k) => k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
  c.closePath(); c.fill();
  c.strokeStyle = '#c9c4b8'; c.lineWidth = 3 * S; c.stroke();
}

// Ground is split into ≤2048 px chunks (mobile GPU texture limit).
export function addGround(scene, S, depth) {
  if (A.ready) return addGroundAtlas(scene, S, depth);
  const CH = 2048, gb = groundBounds();
  const W = Math.ceil((gb.right - gb.left) * S), H = Math.ceil((gb.bottom - gb.top) * S);
  const imgs = [];
  for (let y = 0; y < H; y += CH) for (let x = 0; x < W; x += CH) {
    const w = Math.min(CH, W - x), h = Math.min(CH, H - y);
    const key = `ground_${x}_${y}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, w, h);
    paintGround(t.getContext(), S, x, y);
    t.refresh();
    imgs.push(scene.add.image(gb.left + x / S, gb.top + y / S, key).setOrigin(0, 0).setScale(1 / S).setDepth(depth));
  }
  return imgs;
}

// ---- atlas ground: Kenney road/pavement tiles + baked grass, cliffs, piers ----
const inRect = (rs, i, j) => rs.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1);
// open sides per Kenney road model rotation (N = −y, E = +x, S = +y, W = −x)
const ROAD_TILES = [
  ['k/road-intersection/0', 'NESW'],
  ['k/road-split/0', 'NES'], ['k/road-split/1', 'ESW'], ['k/road-split/2', 'NSW'], ['k/road-split/3', 'NEW'],
  ['k/road-corner/0', 'NE'], ['k/road-corner/1', 'ES'], ['k/road-corner/2', 'SW'], ['k/road-corner/3', 'NW'],
  ['k/road-straight/0', 'NS'], ['k/road-straight/1', 'EW'],
];
function roadFrame(i, j) {
  let k = '';
  if (isRoad(i, j - 1)) k += 'N';
  if (isRoad(i + 1, j)) k += 'E';
  if (isRoad(i, j + 1)) k += 'S';
  if (isRoad(i - 1, j)) k += 'W';
  if (i === 0 && j === 10) k = 'E' + (k.includes('S') ? 'S' : '') + 'W';   // runs into the tunnel
  if (k.length <= 1) k = (k === 'N' || k === 'S') ? 'NS' : 'EW';
  if (k === 'NS' || k === 'EW') {
    const lamp = (k === 'EW' ? i : j) % 4 === 1;
    return lamp ? `k/road-straight-lightposts/${k === 'EW' ? 1 : 0}` : ROAD_TILES.find(r => r[1] === k)[0];
  }
  const hit = ROAD_TILES.find(r => r[1] === k);
  return hit ? hit[0] : 'k/road-intersection/0';
}

function paintGroundAtlas(c, S, offX, offY) {
  const gb = groundBounds();
  const P = new Painter(c, -gb.left * S - offX, -gb.top * S - offY, S);
  const at = (i, j) => P.p(i, j, 0);
  const { x0, y0, x1, y1 } = BOUNDS;
  // shallows are drawn by the sea itself (render/water.js)
  const cells = [];
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) if (isLand(i, j) || isPier(i, j)) cells.push([i, j]);
  cells.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
  // (cells are listed before the foam so it can be drawn underneath them)
  // static foam where land meets water (low preset; higher presets animate it)
  if (G.quality && G.quality.water === 'basic') {
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3 * S; c.lineCap = 'round';
  for (const [i, j] of cells) {
    if (!isLand(i, j)) continue;
    if (!isLand(i, j + 1) && !isPier(i, j + 1)) { const a = P.p(i, j + 1.28, SEA_Z), b = P.p(i + 1, j + 1.28, SEA_Z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    if (!isLand(i + 1, j)) { const a = P.p(i + 1.28, j, SEA_Z), b = P.p(i + 1.28, j + 1, SEA_Z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }
  }
  for (const [i, j] of cells) {
    const [dx, dy] = at(i, j);
    if (!isLand(i, j)) { drawFrame(c, 't/pier', dx, dy, S); continue; }
    if (!isLand(i, j + 1) && !isPier(i, j + 1)) drawFrame(c, 't/cliffY', dx, dy, S);
    if (!isLand(i + 1, j)) drawFrame(c, 't/cliffX', dx, dy, S);
    if (!isLand(i, j + 1) && isPier(i, j + 1)) drawFrame(c, 't/cliffY', dx, dy, S);
    if (isRoad(i, j)) { drawFrame(c, 't/pave', dx, dy, S); drawFrame(c, roadFrame(i, j), dx, dy, S); }
    else if (j === 22 && inRect(PAVE, i, j)) drawFrame(c, 't/quay', dx, dy, S);
    else if (inRect(PAVE, i, j) || inBuildingPad(i, j)) drawFrame(c, 't/pave', dx, dy, S);
    else drawFrame(c, 't/grass' + Math.floor(hash(i, j) * 3), dx, dy, S);
  }
  tunnel(P, c, S);
}
const inBuildingPad = (i, j) => Object.values(BUILDINGS).some(b => i >= b.x && i < b.x + b.w && j >= b.y && j < b.y + b.d);

function addGroundAtlas(scene, S, depth) {
  const CH = 2048, gb = groundBounds();
  const W = Math.ceil((gb.right - gb.left) * S), H = Math.ceil((gb.bottom - gb.top) * S);
  const imgs = [];
  for (let y = 0; y < H; y += CH) for (let x = 0; x < W; x += CH) {
    const w = Math.min(CH, W - x), h = Math.min(CH, H - y);
    const key = `ground_${x}_${y}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, w, h);
    paintGroundAtlas(t.getContext(), S, x, y);
    t.refresh();
    imgs.push(scene.add.image(gb.left + x / S, gb.top + y / S, key).setOrigin(0, 0).setScale(1 / S).setDepth(depth));
  }
  return imgs;
}
