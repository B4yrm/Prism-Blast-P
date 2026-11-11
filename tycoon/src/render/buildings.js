// Procedural building art. Each building has 3 tiers that grow visually.
import { Painter, shade, fishGlyph } from './paint.js';

const WALL = '#f2f5f8', BLUE = '#2f6fd6', BLUE2 = '#3d86ea', RED = '#e2443b', YEL = '#f6c531';
const HMAX = 170, M = 6;

export function buildingTexture(scene, type, tier, def, S) {
  const key = `b_${type}_${tier}`;
  const W = Math.ceil((def.w + def.d) * 32 * S + 2 * M * S), H = Math.ceil(((def.w + def.d) * 16 + HMAX) * S + 2 * M * S);
  const ox = def.d * 32 * S + M * S, oy = HMAX * S + M * S;
  if (!scene.textures.exists(key)) {
    const t = scene.textures.createCanvas(key, W, H);
    const P = new Painter(t.getContext(), ox, oy, S);
    P.shadow(0, 0, def.w, def.d, 0.18);
    ART[type](P, tier, def);
    t.refresh();
  }
  return { key, ox: ox / W, oy: oy / H, S };
}

// small helpers ---------------------------------------------------------
function door(P, f, u0, u1, h, col = '#5d6b7a') {
  P.quad(f, u0, 0, u1, h, P.vgrad(P.p(...f(u0, h)), P.p(...f(u0, 0)), shade(col, 1.2), shade(col, 0.75)), 'rgba(255,255,255,0.6)');
  const c = P.c; c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 0.8 * P.S;
  for (let k = 1; k < 6; k++) { const v = h * k / 6; const a = P.p(...f(u0, v)), b = P.p(...f(u1, v)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
}
function band(P, f, v0, v1, col) { P.quad(f, 0, v0, 1, v1, col); }
function sign(P, f, u0, u1, v0, v1, text, bg = BLUE, fg = '#fff') {
  P.quad(f, u0, v0, u1, v1, bg, 'rgba(255,255,255,0.8)');
  const mid = f((u0 + u1) / 2, (v0 + v1) / 2);
  const [sx, sy] = P.p(...mid);
  const c = P.c; c.save();
  const a = P.p(...f(u0, v0)), b = P.p(...f(u1, v0));
  c.translate(sx, sy); c.transform(1, (b[1] - a[1]) / (b[0] - a[0] || 1), 0, 1, 0, 0);
  c.font = `900 ${9 * P.S}px "Lilita One","Arial Black",system-ui,sans-serif`;
  c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 0, 0.5 * P.S);
  c.restore();
}
function awning(P, x0, x1, y, z, depth, colA, colB = '#ffffff', n = 8) {
  // striped awning sloping out from the +y wall
  for (let k = 0; k < n; k++) {
    const a = x0 + (x1 - x0) * k / n, b = x0 + (x1 - x0) * (k + 1) / n;
    P.poly([[a, y, z], [b, y, z], [b, y + depth, z - 9], [a, y + depth, z - 9]], k % 2 ? colB : colA);
  }
  // scalloped edge
  const c = P.c;
  for (let k = 0; k < n; k++) {
    const a = x0 + (x1 - x0) * (k + 0.5) / n;
    const [sx, sy] = P.p(a, y + depth, z - 9);
    c.fillStyle = k % 2 ? colB : colA; c.beginPath(); c.arc(sx, sy, 3.2 * P.S, 0, Math.PI); c.fill();
  }
}
function stall(P, x, y, fish = ['#7fb6e8', '#e98a6b', '#c6d4dd']) {
  P.box(x, y, 0, 0.9, 0.55, 9, '#a8743f', { lf: 0.9 });
  P.box(x + 0.05, y + 0.05, 9, 0.8, 0.45, 1.5, '#e8f4ff', { edge: false });
  const c = P.c;
  for (let k = 0; k < 7; k++) {
    const [sx, sy] = P.p(x + 0.15 + (k % 4) * 0.2, y + 0.12 + Math.floor(k / 4) * 0.22, 11.5);
    fishGlyph(c, sx, sy, 0.22 * P.S, fish[k % fish.length]);
  }
}
function umbrella(P, x, y, col) {
  P.box(x - 0.03, y - 0.03, 0, 0.06, 0.06, 26, '#ddd', { edge: false });
  const c = P.c, [sx, sy] = P.p(x, y, 26);
  for (let k = 0; k < 8; k++) {
    c.fillStyle = k % 2 ? '#ffffff' : col;
    c.beginPath(); c.moveTo(sx, sy - 6 * P.S);
    c.ellipse(sx, sy + 2 * P.S, 22 * P.S, 10 * P.S, 0, k * Math.PI / 4, (k + 1) * Math.PI / 4);
    c.closePath(); c.fill();
  }
}
function acUnit(P, x, y, z) {
  P.box(x, y, z, 0.6, 0.45, 6, '#c9d0d6');
  const [sx, sy] = P.p(x + 0.3, y + 0.22, z + 6);
  P.c.fillStyle = '#7d8790'; P.c.beginPath(); P.c.ellipse(sx, sy, 6 * P.S, 3 * P.S, 0, 0, 7); P.c.fill();
}
function flag(P, x, y, h, col) {
  P.box(x, y, 0, 0.05, 0.05, h, '#e7e7e7', { edge: false });
  const [sx, sy] = P.p(x, y, h);
  const c = P.c; c.fillStyle = col;
  c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + 10 * P.S, sy - 3 * P.S, sx + 20 * P.S, sy + 1 * P.S);
  c.lineTo(sx + 20 * P.S, sy + 11 * P.S); c.quadraticCurveTo(sx + 10 * P.S, sy + 7 * P.S, sx, sy + 10 * P.S); c.fill();
  fishGlyph(c, sx + 10 * P.S, sy + 5 * P.S, 0.35 * P.S, '#fff', '#fff');
}
function roofSign(P, x, y, z, text) {
  // billboard on posts facing +y
  P.box(x + 0.2, y, z, 0.08, 0.08, 10, '#888', { edge: false });
  P.box(x + 3.2, y, z, 0.08, 0.08, 10, '#888', { edge: false });
  const f = P.fL(x, y, z + 10, 3.5, 0, 22);
  P.quad(f, 0, 0, 1, 1, P.vgrad(P.p(...f(0, 1)), P.p(...f(0, 0)), '#3f8df0', '#1f5cc2'), '#fff');
  sign(P, f, 0.05, 0.95, 0.15, 0.85, text, 'rgba(0,0,0,0)', '#ffe34d');
}

// ----------------------------------------------------------------------------
const ART = {
  hq(P, t) {
    // east wing (tier 2+)
    if (t >= 2) {
      P.box(5.5, 1.2, 0, 2.3, 4.8, 34, WALL);
      P.windows(P.fL(5.5, 1.2, 0, 2.3, 4.8, 34), 2, 2);
      P.windows(P.fR(5.5, 1.2, 0, 2.3, 4.8, 34), 4, 2);
      P.box(5.4, 1.1, 34, 2.5, 5, 3, BLUE);
      acUnit(P, 6.2, 2, 37); acUnit(P, 6.2, 3.5, 37);
    }
    // main block
    const h = t >= 3 ? 44 : 40;
    P.box(0.8, 1, 0, 5, 5, h, WALL);
    const fl = P.fL(0.8, 1, 0, 5, 5, h), fr = P.fR(0.8, 1, 0, 5, 5, h);
    P.windows(fl, 5, 2, { mv: 0.12 }); P.windows(fr, 5, 2, { mv: 0.12 });
    band(P, fl, 0.86, 1, BLUE2); band(P, fr, 0.86, 1, shade(BLUE2, 0.85));
    P.box(0.7, 0.9, h, 5.2, 5.2, 3, BLUE);
    // entrance
    P.box(2.6, 6, 0, 1.6, 0.5, 18, '#dfe7ef');
    door(P, P.fL(2.6, 6, 0, 1.6, 0.5, 18), 0.15, 0.85, 0.75, '#4b84c9');
    P.box(2.3, 5.9, 18, 2.2, 0.9, 2, BLUE);
    flag(P, 0.4, 6.6, 46, BLUE2);
    if (t >= 3) {
      // glass tower
      P.box(1.5, 1.6, h + 3, 3.4, 3.4, 62, '#d7e6f5');
      const gl = P.fL(1.5, 1.6, h + 3, 3.4, 3.4, 62), gr = P.fR(1.5, 1.6, h + 3, 3.4, 3.4, 62);
      P.windows(gl, 5, 5, { mu: 0.04, mv: 0.04, gu: 0.15, gv: 0.2, c1: '#d6f0ff', c2: '#3a7fd0' });
      P.windows(gr, 5, 5, { mu: 0.04, mv: 0.04, gu: 0.15, gv: 0.2, c1: '#b7dcf7', c2: '#2c66b0' });
      P.box(1.4, 1.5, h + 65, 3.6, 3.6, 3, BLUE);
      roofSign(P, 1.2, 4.2, h + 68, 'FISHING TYCOON');
    } else {
      sign(P, fl, 0.25, 0.75, 0.9, 0.99, 'BAŞ OFİS', BLUE2);
      acUnit(P, 1.5, 1.8, h + 3); acUnit(P, 3, 1.8, h + 3);
      if (t >= 2) roofSign(P, 1.2, 4.5, h + 3, 'FISHING CO.');
    }
  },

  factory(P, t) {
    if (t === 0) { site(P, 9, 8, 'ZAVOD'); return; }
    // back tanks / second hall
    if (t >= 3) {
      P.box(0.4, 0.2, 0, 5, 2.2, 54, '#e4e9ee');
      P.windows(P.fR(0.4, 0.2, 0, 5, 2.2, 54), 2, 3, { c1: '#cfe8ff', c2: '#6a9bd1' });
      P.box(0.3, 0.1, 54, 5.2, 2.4, 3, BLUE);
    }
    if (t >= 2) {
      P.cyl(8.1, 1.4, 0, 0.62, 58, '#dfe6ec', { top: '#c6d0d8', bands: [[0.9, 0.96, '#9fb0bf']] });
      P.cyl(8.1, 3.1, 0, 0.62, 58, '#dfe6ec', { top: '#c6d0d8', bands: [[0.9, 0.96, '#9fb0bf']] });
      // pipe bridge to hall
      P.box(7.1, 1.3, 40, 1, 0.15, 3, '#9aa6b1', { edge: false });
      P.box(7.1, 3, 40, 1, 0.15, 3, '#9aa6b1', { edge: false });
    }
    // chimneys
    const chim = (x, y, h) => P.cyl(x, y, 0, 0.32, h, '#f3f3f3', { top: '#555', bands: [[0.2, 0.35, RED], [0.5, 0.65, RED], [0.8, 0.95, RED]] });
    chim(1.2, 1.6, 104);
    if (t >= 2) chim(2.4, 1.6, 92);
    // main hall
    const hx = 0.5, hy = 2.6, hw = 6.8, hd = 4.9, hh = 38;
    P.box(hx, hy, 0, hw, hd, hh, WALL);
    const fl = P.fL(hx, hy, 0, hw, hd, hh), fr = P.fR(hx, hy, 0, hw, hd, hh);
    band(P, fl, 0.55, 0.7, BLUE2); band(P, fr, 0.55, 0.7, shade(BLUE2, 0.85));
    P.windows(fl, 6, 1, { mv: 0.74, gv: 0.3, c1: '#d8efff', c2: '#7aa9d8' });
    P.windows(fr, 5, 1, { mv: 0.74, gv: 0.3, c1: '#d8efff', c2: '#7aa9d8' });
    door(P, fl, 0.08, 0.3, 0.48);
    door(P, fl, 0.62, 0.84, 0.48, '#6f7c89');   // conveyor inlet
    P.gable(hx, hy, hh, hw, hd, 18, BLUE, 'x', { stripes: 14 });
    // fish emblem on gable end
    const [ex, ey] = P.p(hx + hw + 0.18, hy + hd / 2, hh + 6);
    P.c.fillStyle = '#fff'; P.c.beginPath(); P.c.ellipse(ex, ey, 11 * P.S, 7 * P.S, 0, 0, 7); P.c.fill();
    fishGlyph(P.c, ex, ey, 0.6 * P.S, BLUE2);
    sign(P, fl, 0.36, 0.58, 0.18, 0.4, 'EMAL', RED);
    // loading bay
    P.box(0.6, 7.5, 0, 1.6, 0.4, 4, '#b8bec4');
    if (t >= 3) { acUnit(P, 2, 3.3, hh + 9); acUnit(P, 4.2, 3.3, hh + 9); }
  },

  warehouse(P, t) {
    const x = t >= 2 ? 0.4 : 1, y = 0.8, w = t >= 2 ? 8 : 6.4, d = t >= 2 ? 5.4 : 5, h = t >= 3 ? 36 : 32;
    if (t >= 3) {
      P.box(w + x, 3.2, 0, 0.55, 2.5, 22, WALL);
    }
    P.box(x, y, 0, w, d, h, '#e3e8ed');
    const fl = P.fL(x, y, 0, w, d, h), fr = P.fR(x, y, 0, w, d, h);
    // corrugated wall lines
    const c = P.c; c.strokeStyle = 'rgba(80,100,120,0.18)'; c.lineWidth = 0.8 * P.S;
    for (let k = 1; k < 40; k++) {
      const u = k / 40;
      let a = P.p(...fl(u, 0)), b = P.p(...fl(u, 1)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      a = P.p(...fr(u, 0)); b = P.p(...fr(u, 1)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    }
    band(P, fl, 0.88, 1, BLUE2); band(P, fr, 0.88, 1, shade(BLUE2, 0.85));
    const doors = t >= 2 ? 3 : 2;
    for (let k = 0; k < doors; k++) {
      const u0 = 0.1 + k * (0.8 / doors), u1 = u0 + 0.8 / doors - 0.08;
      door(P, fl, u0, u1, 0.62, '#7c8996');
      P.quad(fl, u0 - 0.01, 0.62, u1 + 0.01, 0.66, YEL);
    }
    P.windows(fr, 3, 1, { mv: 0.64, gv: 0.45 });
    P.gable(x, y, h, w, d, 16, BLUE, 'x', { stripes: 16 });
    if (t >= 3) {
      for (let k = 0; k < 3; k++) P.poly([[x + 1 + k * 2.2, y + d * 0.55, h + 7], [x + 2 + k * 2.2, y + d * 0.55, h + 7], [x + 2 + k * 2.2, y + d * 0.85, h + 3], [x + 1 + k * 2.2, y + d * 0.85, h + 3]], 'rgba(200,235,255,0.85)', 'rgba(255,255,255,0.8)');
    }
    sign(P, fl, 0.3, 0.7, 0.89, 0.99, 'ANBAR', BLUE2);
    // loading canopy
    P.box(x, y + d, 20, w, 0.7, 2, '#c2cad2');
  },

  market(P, t) {
    const two = t >= 3;
    const x = t >= 2 ? 0.5 : 1, w = t >= 2 ? 7 : 5.4, y = 0.6, d = 3.8, h = two ? 40 : 28;
    P.box(x, y, 0, w, d, h, '#fff6e6');
    const fl = P.fL(x, y, 0, w, d, h), fr = P.fR(x, y, 0, w, d, h);
    P.windows(fl, t >= 2 ? 5 : 4, 1, { mv: two ? 0.08 : 0.12, gv: 0.2, c1: '#fff3c4', c2: '#e3a74b', frame: '#fff' });
    if (two) P.windows(fl, 5, 1, { mv: 0.62, gv: 0.3 });
    P.windows(fr, 3, 1, { mv: 0.15, gv: 0.3 });
    P.gable(x, y, h, w, d, 14, BLUE, 'x', { stripes: 12 });
    awning(P, x + 0.1, x + w - 0.1, y + d, two ? 22 : 20, 0.55, RED, '#fff', t >= 2 ? 14 : 10);
    // sign with fish
    const sx = x + w / 2;
    P.box(sx - 1.4, y + d + 0.05, h - 4, 2.8, 0.15, 12, BLUE2, { edge: false });
    sign(P, P.fL(sx - 1.4, y + d + 0.2, h - 4, 2.8, 0, 12), 0.05, 0.95, 0.1, 0.9, 'BALIQ BAZARI', BLUE2);
    if (two) {
      const [fx, fy] = P.p(x + w / 2, y + d / 2, h + 26);
      fishGlyph(P.c, fx, fy, 2.4 * P.S, '#3d8fe0');
    }
    // stalls & umbrellas on the forecourt
    stall(P, x + 0.4, 5.15); stall(P, x + 2.2, 5.15, ['#f2a35b', '#9ec9ee']);
    if (t >= 2) { stall(P, x + 5, 5.15, ['#e86f6f', '#9fd0f0']); umbrella(P, x + 6.6, 5.5, BLUE2); }
    umbrella(P, x + 3.9, 5.5, RED);
    if (two) umbrella(P, x - 0.2, 5.4, '#2fa34a');
  },

  harbor(P, t) {
    if (t >= 2) {
      P.cyl(4.2, 1.2, 0, 0.45, 44, WALL, { top: BLUE, bands: [[0.85, 1, BLUE2]] });
      P.box(4.05, 1.05, 44, 0.3, 0.3, 10, '#ccc', { edge: false });
    }
    P.box(0.5, 0.6, 0, 3.4, 2.9, 26, WALL);
    const fl = P.fL(0.5, 0.6, 0, 3.4, 2.9, 26), fr = P.fR(0.5, 0.6, 0, 3.4, 2.9, 26);
    P.windows(fl, 3, 1, { mv: 0.35 }); P.windows(fr, 2, 1, { mv: 0.35 });
    band(P, fl, 0.85, 1, BLUE2); band(P, fr, 0.85, 1, shade(BLUE2, 0.85));
    door(P, fl, 0.42, 0.6, 0.6, '#4b84c9');
    P.gable(0.5, 0.6, 26, 3.4, 2.9, 12, BLUE, 'y', { stripes: 8 });
    // anchor badge
    const [ax, ay] = P.p(2.2, 3.55, 19);
    P.c.font = `${12 * P.S}px system-ui`; P.c.textAlign = 'center'; P.c.textBaseline = 'middle'; P.c.fillText('⚓', ax, ay);
    if (t >= 3) flag(P, 0.2, 3.6, 40, RED);
    // life ring & barrels
    P.cyl(4.4, 3.4, 0, 0.18, 9, '#2f78c4', { top: '#1f5a99' });
    P.cyl(4.75, 3.1, 0, 0.18, 9, '#d64a3a', { top: '#a7362a' });
  },

  farm(P, t) {
    if (t === 0) { site(P, 8, 8, 'FERMA'); return; }
  },
};

// Fenced construction site with a sign (locked / not yet built).
function site(P, w, d, label) {
  P.poly([[0.3, 0.3], [w - 0.3, 0.3], [w - 0.3, d - 0.3], [0.3, d - 0.3]], '#c9a777');
  const c = P.c;
  for (let k = 0; k < 18; k++) {
    const [sx, sy] = P.p(0.8 + (k * 37 % 61) / 61 * (w - 1.6), 0.8 + (k * 23 % 47) / 47 * (d - 1.6));
    c.fillStyle = 'rgba(120,90,50,0.35)'; c.beginPath(); c.ellipse(sx, sy, 6 * P.S, 3 * P.S, 0, 0, 7); c.fill();
  }
  // fence posts & rails along the near edges
  for (let k = 0; k <= w; k += 0.5) P.box(k, d - 0.1, 0, 0.08, 0.08, 9, '#f0f0f0', { edge: false });
  for (let k = 0; k <= d; k += 0.5) P.box(w - 0.1, k, 0, 0.08, 0.08, 9, '#f0f0f0', { edge: false });
  P.poly([[0, d - 0.08, 7], [w, d - 0.08, 7], [w, d - 0.08, 4], [0, d - 0.08, 4]], '#f28c28');
  P.poly([[w - 0.08, 0, 7], [w - 0.08, d, 7], [w - 0.08, d, 4], [w - 0.08, 0, 4]], '#d9771e');
  // material piles
  P.box(1.2, 1.2, 0, 1.4, 0.8, 6, '#b0763c');
  P.box(1.3, 1.3, 6, 1.2, 0.6, 5, '#c08447');
  P.cyl(w - 2, 2, 0, 0.6, 8, '#9a8f84', { top: '#b3a99e' });
  // sign board
  P.box(w / 2 - 0.05, d / 2, 0, 0.1, 0.1, 22, '#7a5a3a', { edge: false });
  const f = P.fL(w / 2 - 1.2, d / 2 + 0.1, 22, 2.4, 0, 14);
  sign(P, f, 0, 1, 0, 1, '🔒 ' + label, '#3b4a5a');
}
