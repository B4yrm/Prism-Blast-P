// Procedural textures for units, props and effects.
import { Painter, shade, fishGlyph } from './paint.js';

function canvasTex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, Math.ceil(w), Math.ceil(h));
  draw(t.getContext(), t);
  t.refresh();
  return t;
}

// ---- boats ---------------------------------------------------------------
// dir: 0:+x 1:+y 2:-x 3:-y (travel direction in grid space)
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const BOAT_LOOKS = [
  { hull: '#2f63c8', stripe: '#e6463c', cabin: '#ffffff', roof: '#2f63c8' },
  { hull: '#d8423a', stripe: '#ffffff', cabin: '#ffffff', roof: '#d8423a' },
  { hull: '#2a9a6a', stripe: '#f3c533', cabin: '#f5f5f5', roof: '#24734f' },
  { hull: '#f0a422', stripe: '#2f63c8', cabin: '#ffffff', roof: '#2f63c8' },
];

export function makeBoats(scene, S) {
  const W = 200, H = 150, ox = 100, oy = 100;
  BOAT_LOOKS.forEach((look, li) => {
    DIRS.forEach(([dx, dy], di) => {
      canvasTex(scene, `boat_${li}_${di}`, W * S, H * S, c => {
        const P = new Painter(c, ox * S, oy * S, S);
        drawBoat(P, dx, dy, look);
      });
    });
  });
  return { ox: ox / W, oy: oy / H };
}

function drawBoat(P, dx, dy, L) {
  const px = -dy, py = dx;                 // perpendicular
  const g = (u, v) => [u * dx + v * px, u * dy + v * py];
  const deck = [[-1.25, -0.42], [0.75, -0.46], [1.35, 0], [0.75, 0.46], [-1.25, 0.42]];
  const top = deck.map(([u, v]) => [...g(u, v), 12]);
  const bot = deck.map(([u, v]) => [...g(u * 0.9, v * 0.75), -2]);
  // water shadow
  P.poly(deck.map(([u, v]) => [...g(u * 1.08 + 0.1, v * 1.25 + 0.1), -3]), 'rgba(10,50,90,0.28)');
  // hull side faces, back to front
  const faces = [];
  for (let k = 0; k < deck.length; k++) {
    const k2 = (k + 1) % deck.length;
    const a = top[k], b = top[k2];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    let nx = ey, ny = -ex;                           // outward for CW in grid
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
    if (nx * cx + ny * cy < 0) { nx = -nx; ny = -ny; }
    if (nx + ny <= 0.001) continue;
    faces.push({ pts: [bot[k], bot[k2], b, a], d: cx + cy, lit: (ny * 0.6 - nx * 0.3) / Math.hypot(nx, ny) });
  }
  faces.sort((p, q) => p.d - q.d);
  for (const f of faces) {
    const s = 0.82 + 0.25 * f.lit;
    P.poly(f.pts, shade(L.hull, s));
    // waterline stripe
    const [b0, b1, t1, t0] = f.pts;
    const mix = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    P.poly([b0, b1, mix(b1, t1, 0.28), mix(b0, t0, 0.28)], shade(L.stripe, s));
    P.poly([mix(b0, t0, 0.85), mix(b1, t1, 0.85), t1, t0], shade('#ffffff', s * 0.98));
  }
  P.poly(top, '#e9e2d4', 'rgba(0,0,0,0.25)');
  // deck planks
  const c = P.c; c.strokeStyle = 'rgba(120,100,70,0.25)'; c.lineWidth = 0.8 * P.S;
  for (let k = -3; k <= 3; k++) {
    const a = P.p(...g(-1.2, k * 0.12), 12), b = P.p(...g(0.8, k * 0.12), 12);
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  // parts as boxes in grid space, drawn back to front
  const boxAt = (u0, u1, v0, v1) => {
    const A = g(u0, v0), B = g(u1, v1);
    return [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.abs(B[0] - A[0]), Math.abs(B[1] - A[1])];
  };
  const parts = [
    { b: boxAt(-1.05, -0.35, -0.3, 0.3), z: 12, h: 18, col: L.cabin, cabin: true },
    { b: boxAt(-0.95, -0.45, -0.24, 0.24), z: 30, h: 9, col: L.cabin, bridge: true },
    { b: boxAt(0.2, 0.62, -0.25, 0.25), z: 12, h: 5, col: '#3f8f4a', net: true },
    { b: boxAt(0.05, 0.12, -0.04, 0.03), z: 12, h: 38, col: '#f2f2f2', mast: true },
  ];
  parts.sort((p, q) => (p.b[0] + p.b[2] / 2 + p.b[1] + p.b[3] / 2) - (q.b[0] + q.b[2] / 2 + q.b[1] + q.b[3] / 2));
  for (const pt of parts) {
    const [x, y, w, d] = pt.b;
    P.box(x, y, pt.z, w, d, pt.h, pt.col, { lf: 0.95, rf: 0.78 });
    if (pt.cabin) {
      const fl = P.fL(x, y, pt.z, w, d, pt.h), fr = P.fR(x, y, pt.z, w, d, pt.h);
      P.windows(fl, Math.max(1, Math.round(w * 4)), 1, { mv: 0.45, gv: 0.2, gu: 0.3, frame: null });
      P.windows(fr, Math.max(1, Math.round(d * 4)), 1, { mv: 0.45, gv: 0.2, gu: 0.3, frame: null });
    }
    if (pt.bridge) {
      P.box(x - 0.04, y - 0.04, pt.z + pt.h, w + 0.08, d + 0.08, 2, L.roof);
      P.windows(P.fL(x, y, pt.z, w, d, pt.h), 2, 1, { mv: 0.2, gv: 0.1, frame: null, c1: '#cbe9ff', c2: '#3a74b8' });
      P.windows(P.fR(x, y, pt.z, w, d, pt.h), 2, 1, { mv: 0.2, gv: 0.1, frame: null, c1: '#cbe9ff', c2: '#3a74b8' });
    }
    if (pt.net) {
      const cx = P.c; cx.strokeStyle = 'rgba(20,60,20,0.5)'; cx.lineWidth = 0.6 * P.S;
      for (let k = 1; k < 5; k++) { const a = P.p(x + w * k / 5, y, pt.z + pt.h), b = P.p(x + w * k / 5, y + d, pt.z + pt.h); cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke(); }
    }
    if (pt.mast) {
      // boom & rigging
      const top = P.p(x, y, pt.z + pt.h), bow = P.p(...g(1.3, 0), 14), st = P.p(...g(-1.2, 0), 30);
      c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 0.7 * P.S;
      c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(bow[0], bow[1]); c.moveTo(top[0], top[1]); c.lineTo(st[0], st[1]); c.stroke();
      c.fillStyle = L.stripe; c.beginPath(); c.moveTo(top[0], top[1]); c.lineTo(top[0] + 9 * P.S, top[1] + 3 * P.S); c.lineTo(top[0], top[1] + 6 * P.S); c.fill();
    }
  }
  // fish crates on deck
  for (let k = 0; k < 2; k++) {
    const [x, y] = g(-0.15 + k * 0.28, 0.18);
    P.box(x - 0.1, y - 0.1, 12, 0.2, 0.2, 5, '#4aa3df', { edge: false });
  }
}

// ---- people --------------------------------------------------------------
export const FW = 22, FH = 36;      // frame size at 1×
export const PEOPLE = {
  worker: { shirt: '#2f6fd6', pants: '#33415c', skin: '#f2c49b', hair: '#4a3020', hat: '#f6c531', vest: '#ff8a1f' },
  c0: { shirt: '#e45757', pants: '#2c3e50', skin: '#f6d0ae', hair: '#2b1d14' },
  c1: { shirt: '#4caf50', pants: '#3b3b58', skin: '#c99872', hair: '#1c1c1c' },
  c2: { shirt: '#9c5bd6', pants: '#455a64', skin: '#f2c49b', hair: '#c9922f', long: true },
  c3: { shirt: '#f2b134', pants: '#37474f', skin: '#8d5a3b', hair: '#111' },
  c4: { shirt: '#26a6c9', pants: '#4e342e', skin: '#f6d0ae', hair: '#6d4c2f', long: true },
  c5: { shirt: '#ffffff', pants: '#283593', skin: '#e0ac85', hair: '#3a2a1a', cap: '#e53935' },
};
// frames: [carry variant][facing 0=front,1=back][step 0..3]
export const CARRY = ['none', 'raw', 'prod', 'bag'];
export function makePeople(scene, S) {
  for (const [name, L] of Object.entries(PEOPLE)) {
    const variants = name === 'worker' ? [0, 1, 2] : [0, 3];
    const t = canvasTex(scene, `p_${name}`, FW * S * 8, FH * S * variants.length, c => {
      variants.forEach((cv, row) => {
        for (let f = 0; f < 2; f++) for (let k = 0; k < 4; k++) {
          c.save(); c.translate((f * 4 + k) * FW * S, row * FH * S); c.scale(S, S);
          drawPerson(c, L, f, k, CARRY[cv]);
          c.restore();
        }
      });
    });
    variants.forEach((cv, row) => {
      for (let f = 0; f < 2; f++) for (let k = 0; k < 4; k++)
        t.add(`${CARRY[cv]}_${f}_${k}`, 0, (f * 4 + k) * FW * S, row * FH * S, FW * S, FH * S);
    });
  }
}

function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function drawPerson(c, L, back, step, carry) {
  const cx = FW / 2, ground = FH - 3;
  const ph = step / 4 * Math.PI * 2, sw = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 0.8;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx, ground, 5.5, 2.2, 0, 0, 7); c.fill();
  // legs
  const legY = ground - 10 - bob;
  for (const s of [-1, 1]) {
    const off = s * sw * 2.2;
    c.fillStyle = shade(L.pants, s > 0 ? 0.85 : 1);
    rr(c, cx + s * 1.8 - 1.4 + off * 0.5, legY, 2.8, 9.5 - Math.max(0, -s * sw) * 1.2, 1); c.fill();
    c.fillStyle = '#2b2b2b';
    rr(c, cx + s * 1.8 - 1.6 + off * 0.5, ground - 2 - Math.max(0, -s * sw) * 1.2 - bob * 0.3, 3.4, 2, 1); c.fill();
  }
  // torso
  const ty = ground - 21 - bob;
  c.fillStyle = L.shirt; rr(c, cx - 4.5, ty, 9, 11.5, 3); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; rr(c, cx + 1.5, ty + 1, 3, 10.5, 2); c.fill();
  if (L.vest) {
    c.fillStyle = L.vest; rr(c, cx - 4.5, ty + 1, 9, 9.5, 2.5); c.fill();
    c.fillStyle = '#f5f7a8'; c.fillRect(cx - 4.5, ty + 6, 9, 1.4);
    if (!back) { c.fillStyle = L.shirt; c.fillRect(cx - 1, ty, 2, 4); }
  }
  // arms
  const armCol = L.vest ? L.shirt : L.shirt;
  const holding = carry !== 'none' && carry !== 'bag';
  for (const s of [-1, 1]) {
    c.fillStyle = shade(armCol, s > 0 ? 0.88 : 1);
    if (holding) { rr(c, cx + s * 4.2 - 1.3, ty + 1.5, 2.6, 7, 1.2); c.fill(); }
    else {
      c.save(); c.translate(cx + s * 4.6, ty + 2); c.rotate(-s * sw * 0.35 * (back ? -1 : 1));
      rr(c, -1.3, 0, 2.6, 8.5, 1.2); c.fill();
      c.fillStyle = L.skin; c.beginPath(); c.arc(0, 9, 1.4, 0, 7); c.fill();
      if (carry === 'bag' && s > 0) { c.fillStyle = '#fafafa'; rr(c, -2.5, 9, 5, 5.5, 1); c.fill(); c.strokeStyle = '#bbb'; c.lineWidth = 0.5; c.stroke(); }
      c.restore();
    }
  }
  // head
  const hy = ty - 4.2;
  c.fillStyle = L.skin; c.beginPath(); c.arc(cx, hy, 4.3, 0, 7); c.fill();
  c.fillStyle = L.hair;
  if (back) { c.beginPath(); c.arc(cx, hy - 0.3, 4.4, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(cx + 4.4, hy + 2.5); c.lineTo(cx - 4.4, hy + 2.5); c.fill(); }
  else {
    c.beginPath(); c.arc(cx, hy - 0.8, 4.4, Math.PI, 0); c.fill();
    c.fillStyle = '#2a1c14'; c.fillRect(cx + 0.4, hy - 0.2, 1.1, 1.3); c.fillRect(cx + 2.6, hy - 0.2, 1.1, 1.3);
    c.fillStyle = 'rgba(220,100,90,0.5)'; c.beginPath(); c.arc(cx + 3.2, hy + 1.8, 0.9, 0, 7); c.fill();
  }
  if (L.long) { c.fillStyle = L.hair; rr(c, cx - 4.6, hy - 1, 2, 7, 1); c.fill(); rr(c, cx + 2.6, hy - 1, 2, back ? 7 : 3, 1); c.fill(); }
  if (L.hat) {
    c.fillStyle = L.hat; c.beginPath(); c.arc(cx, hy - 1.2, 4.8, Math.PI, 0); c.fill();
    c.fillRect(cx - 5.6, hy - 1.6, 11.2, 1.6);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(cx - 2, hy - 5.4, 1.4, 3);
  }
  if (L.cap) { c.fillStyle = L.cap; c.beginPath(); c.arc(cx, hy - 1.2, 4.6, Math.PI, 0); c.fill(); if (!back) c.fillRect(cx, hy - 1.8, 6, 1.6); }
  // carried crate in front (front view) / mostly hidden (back view)
  if (holding) {
    const by = ty + (back ? -1 : 2);
    if (carry === 'raw') {
      c.fillStyle = back ? '#2f7fbf' : '#3b95d9'; rr(c, cx - 6, by, 12, 7, 1.2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(cx - 5, by + 1, 10, 1);
      if (!back) { fishGlyph(c, cx - 2, by + 0.5, 0.22, '#c9d6df'); fishGlyph(c, cx + 2, by + 0.2, 0.2, '#e3a07a'); }
    } else {
      c.fillStyle = back ? '#b98546' : '#d39b57'; rr(c, cx - 6, by, 12, 7.5, 0.8); c.fill();
      c.fillStyle = '#e9c48b'; c.fillRect(cx - 1, by, 2, 7.5);
    }
    if (!back) { c.fillStyle = L.skin; c.beginPath(); c.arc(cx - 5.5, by + 4, 1.4, 0, 7); c.arc(cx + 5.5, by + 4, 1.4, 0, 7); c.fill(); }
  }
}

// ---- nature & props ------------------------------------------------------
export function makeProps(scene, S) {
  const pine = (key, h, col) => canvasTex(scene, key, 44 * S, (h + 14) * S, c => {
    c.scale(S, S);
    c.fillStyle = 'rgba(20,50,20,0.25)'; c.beginPath(); c.ellipse(22, h + 8, 13, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#6b4a2f'; c.fillRect(20.5, h - 2, 3, 10);
    for (let k = 0; k < 4; k++) {
      const y0 = h + 1 - k * h * 0.24, wdt = 17 - k * 3.5;
      const g = c.createLinearGradient(22 - wdt, 0, 22 + wdt, 0);
      g.addColorStop(0, shade(col, 1.2)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, 0.7));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(22, y0 - h * 0.42); c.lineTo(22 + wdt, y0); c.quadraticCurveTo(22, y0 + 4, 22 - wdt, y0); c.closePath(); c.fill();
    }
  });
  pine('pine0', 46, '#2f8a3e'); pine('pine1', 38, '#2a7d39'); pine('pine2', 54, '#348f44');
  const round = (key, r, col) => canvasTex(scene, key, (r * 2 + 10) * S, (r * 2 + 26) * S, c => {
    c.scale(S, S);
    const cx = r + 5, cy = r + 6;
    c.fillStyle = 'rgba(20,50,20,0.25)'; c.beginPath(); c.ellipse(cx, r * 2 + 19, r * 0.8, r * 0.32, 0, 0, 7); c.fill();
    c.fillStyle = '#7a5434'; c.fillRect(cx - 1.8, cy + r * 0.5, 3.6, r + 4);
    for (const [dx, dy, rr2, f] of [[-r * 0.45, r * 0.15, r * 0.62, 0.8], [r * 0.45, r * 0.2, r * 0.6, 0.72], [0, -r * 0.1, r * 0.75, 1], [-r * 0.15, -r * 0.4, r * 0.45, 1.15]]) {
      const g = c.createRadialGradient(cx + dx - rr2 * 0.3, cy + dy - rr2 * 0.4, 1, cx + dx, cy + dy, rr2);
      g.addColorStop(0, shade(col, 1.25 * f)); g.addColorStop(1, shade(col, 0.75 * f));
      c.fillStyle = g; c.beginPath(); c.arc(cx + dx, cy + dy, rr2, 0, 7); c.fill();
    }
  });
  round('tree0', 14, '#4fa83a'); round('tree1', 12, '#5cb544'); round('tree2', 16, '#3f9a36');
  round('bush', 7, '#4aa23a');

  canvasTex(scene, 'lamp', 14 * S, 50 * S, c => {
    c.scale(S, S);
    c.fillStyle = 'rgba(0,0,0,0.2)'; c.beginPath(); c.ellipse(7, 47, 4, 1.6, 0, 0, 7); c.fill();
    c.fillStyle = '#3d4650'; c.fillRect(6, 10, 2, 37); c.fillRect(4.5, 44, 5, 3);
    c.fillStyle = '#2d343c'; rr(c, 2.5, 6, 9, 5, 2); c.fill();
    c.fillStyle = '#ffe9a0'; c.fillRect(4, 10, 6, 2);
  });
  canvasTex(scene, 'bench', 30 * S, 18 * S, c => {
    const P = new Painter(c, 15 * S, 12 * S, S);
    P.box(-0.35, -0.08, 5, 0.7, 0.16, 1.5, '#b9773f', { edge: false });
    P.box(-0.35, -0.12, 6.5, 0.7, 0.05, 5, '#a8692f', { edge: false });
    P.box(-0.3, -0.05, 0, 0.05, 0.1, 5, '#555', { edge: false }); P.box(0.25, -0.05, 0, 0.05, 0.1, 5, '#555', { edge: false });
  });
  // crates for stock piles
  const crate = (key, col, top, fish) => canvasTex(scene, key, 30 * S, 30 * S, c => {
    const P = new Painter(c, 15 * S, 16 * S, S);
    P.box(-0.22, -0.22, 0, 0.44, 0.44, 9, col, { lf: 0.9, rf: 0.7 });
    if (fish) { const [sx, sy] = P.p(0, 0, 9); fishGlyph(c, sx, sy, 0.3 * S, '#d6e4ee'); }
    else { P.poly([[-0.04, -0.22, 9.05], [0.04, -0.22, 9.05], [0.04, 0.22, 9.05], [-0.04, 0.22, 9.05]], top); }
  });
  crate('crate_raw', '#3b95d9', '#2a6fa8', true);
  crate('crate_prod', '#d39b57', '#f1d39f', false);
  // conveyor box
  canvasTex(scene, 'cbox', 20 * S, 20 * S, c => {
    const P = new Painter(c, 10 * S, 12 * S, S);
    P.box(-0.14, -0.14, 0, 0.28, 0.28, 6, '#d39b57', { lf: 0.9, rf: 0.7 });
  });
  // crane (static body) facing the water
  canvasTex(scene, 'crane', 120 * S, 150 * S, c => {
    const P = new Painter(c, 60 * S, 130 * S, S);
    P.box(-0.4, -0.4, 0, 0.8, 0.8, 8, '#e0b320');
    P.box(-0.15, -0.15, 8, 0.3, 0.3, 78, '#f6c531', { lf: 1, rf: 0.8 });
    const cc = P.c; cc.strokeStyle = 'rgba(120,80,0,0.6)'; cc.lineWidth = 0.8 * S;
    for (let z = 10; z < 84; z += 8) { const a = P.p(-0.15, 0.15, z), b = P.p(0.15, 0.15, z + 8); cc.beginPath(); cc.moveTo(a[0], a[1]); cc.lineTo(b[0], b[1]); cc.stroke(); }
    P.box(-0.3, -0.3, 82, 0.6, 0.6, 12, '#f6c531');
    P.windows(P.fL(-0.3, -0.3, 82, 0.6, 0.6, 12), 1, 1, { mv: 0.25, gv: 0.1, frame: null });
    // jib out over the water (+y)
    P.box(-0.08, 0.3, 90, 0.16, 2.6, 4, '#f6c531', { lf: 1, rf: 0.8 });
    P.box(-0.1, -1.1, 90, 0.2, 1.4, 4, '#e0b320');
    P.box(-0.2, -1.2, 80, 0.4, 0.4, 10, '#8a8f96');
  });
  canvasTex(scene, 'hook', 12 * S, 12 * S, c => { c.scale(S, S); c.fillStyle = '#555'; rr(c, 2, 2, 8, 8, 2); c.fill(); c.fillStyle = '#e0b320'; c.fillRect(3, 3, 6, 2); });
  // lighthouse
  canvasTex(scene, 'lighthouse', 90 * S, 190 * S, c => {
    const P = new Painter(c, 45 * S, 175 * S, S);
    P.cyl(0, 0, 0, 0.9, 10, '#b9b2a6', { top: '#cfc8bb' });
    for (let k = 0; k < 6; k++) P.cyl(0, 0, 10 + k * 18, 0.55 - k * 0.035, 18, k % 2 ? '#e2453c' : '#ffffff', { noTop: true });
    P.cyl(0, 0, 118, 0.62, 3, '#3a3f45', { top: '#4c535b' });
    P.cyl(0, 0, 121, 0.36, 16, '#fff2a6', { top: '#ffe066' });
    P.cyl(0, 0, 137, 0.44, 3, '#e2453c', { top: '#c7372f' });
    const [sx, sy] = P.p(0, 0, 140); c.fillStyle = '#c7372f';
    c.beginPath(); c.moveTo(sx - 19 * S, sy); c.lineTo(sx, sy - 18 * S); c.lineTo(sx + 19 * S, sy); c.closePath(); c.fill();
  });
  // buoy
  canvasTex(scene, 'buoy', 16 * S, 22 * S, c => {
    c.scale(S, S);
    c.fillStyle = '#e53935'; c.beginPath(); c.arc(8, 13, 6, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.fillRect(2, 11, 12, 3);
    c.fillStyle = '#333'; c.fillRect(7.3, 2, 1.4, 6);
  });
  // fountain basin
  canvasTex(scene, 'fountain', 110 * S, 70 * S, c => {
    const P = new Painter(c, 55 * S, 45 * S, S);
    P.cyl(0, 0, 0, 1.05, 6, '#cfd5da', { top: '#e3e7ea' });
    P.ellipse(0, 0, 6.2, 0.92, '#5fc3ea');
    P.ellipse(0, 0, 6.3, 0.6, 'rgba(255,255,255,0.25)');
    P.cyl(0, 0, 6, 0.18, 14, '#cfd5da', { top: '#e3e7ea' });
    P.cyl(0, 0, 18, 0.42, 3, '#cfd5da', { top: '#7fd3f2' });
  });
  // parked cars (2 orientations × 3 colours)
  ['#e53935', '#1e88e5', '#fdd835', '#ffffff'].forEach((col, i) => {
    for (const ax of [0, 1]) canvasTex(scene, `car_${i}_${ax}`, 70 * S, 52 * S, c => {
      const P = new Painter(c, 35 * S, 32 * S, S);
      const [w, d] = ax ? [0.5, 1.0] : [1.0, 0.5];
      P.shadow(-w / 2, -d / 2, w, d, 0.25);
      P.box(-w / 2, -d / 2, 2, w, d, 7, col);
      const cw = ax ? w * 0.9 : w * 0.55, cd = ax ? d * 0.55 : d * 0.9;
      P.box(-cw / 2, -cd / 2, 9, cw, cd, 6, '#a9d4f5', { lf: 0.9, rf: 0.7 });
      P.box(-cw / 2 + 0.02, -cd / 2 + 0.02, 15, cw - 0.04, cd - 0.04, 1, col);
    });
  });
}

// ---- effects -------------------------------------------------------------
export function makeFx(scene) {
  canvasTex(scene, 'puff', 64, 64, c => {
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(240,240,240,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  canvasTex(scene, 'dot', 16, 16, c => { c.fillStyle = '#fff'; c.beginPath(); c.arc(8, 8, 6, 0, 7); c.fill(); });
  canvasTex(scene, 'drop', 12, 12, c => { c.fillStyle = '#bfefff'; c.beginPath(); c.arc(6, 6, 4, 0, 7); c.fill(); });
  canvasTex(scene, 'spark', 32, 32, c => {
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(16, 0); c.lineTo(19, 13); c.lineTo(32, 16); c.lineTo(19, 19); c.lineTo(16, 32); c.lineTo(13, 19); c.lineTo(0, 16); c.lineTo(13, 13); c.closePath(); c.fill();
  });
  canvasTex(scene, 'coin', 40, 40, c => {
    const g = c.createRadialGradient(15, 13, 2, 20, 20, 18);
    g.addColorStop(0, '#fff6b0'); g.addColorStop(0.5, '#ffcf2e'); g.addColorStop(1, '#d68a00');
    c.fillStyle = g; c.beginPath(); c.arc(20, 20, 17, 0, 7); c.fill();
    c.strokeStyle = '#b86f00'; c.lineWidth = 2.5; c.stroke();
    c.fillStyle = '#b86f00'; c.font = '900 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', 20, 21);
  });
  canvasTex(scene, 'gull', 64, 20, c => {
    for (let f = 0; f < 2; f++) {
      c.save(); c.translate(f * 32, 0);
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath();
      if (f === 0) { c.moveTo(3, 6); c.quadraticCurveTo(10, 2, 16, 10); c.quadraticCurveTo(22, 2, 29, 6); }
      else { c.moveTo(3, 13); c.quadraticCurveTo(10, 12, 16, 10); c.quadraticCurveTo(22, 12, 29, 13); }
      c.stroke();
      c.fillStyle = '#f2a33a'; c.fillRect(15, 10, 2, 2);
      c.restore();
    }
  });
  const t = scene.textures.get('gull'); t.add('g0', 0, 0, 0, 32, 20); t.add('g1', 0, 32, 0, 32, 20);
  canvasTex(scene, 'fishjump', 24, 14, c => fishGlyph(c, 13, 7, 0.65, '#cfe3f2', '#fff'));
  // seamless water ripple tile
  canvasTex(scene, 'waves', 256, 128, c => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.lineCap = 'round';
    for (let k = 0; k < 46; k++) {
      const x = rnd() * 256, y = rnd() * 128, L = 8 + rnd() * 18, a = 0.08 + rnd() * 0.16;
      c.strokeStyle = `rgba(255,255,255,${a})`; c.lineWidth = 1.2 + rnd() * 1.4;
      for (const ox of [-256, 0, 256]) for (const oy of [-128, 0, 128]) {
        c.beginPath(); c.moveTo(x + ox - L, y + oy); c.quadraticCurveTo(x + ox, y + oy - 3, x + ox + L, y + oy); c.stroke();
      }
    }
  });
}
