// Sea and shore rendering (visual only).
//
// Everything is driven by one "distance to shore" field over the map grid
// (land and surf rocks are sources). From it we get:
//   • high   — a WebGL shader: depth colour, 4 wave systems, sun glitter,
//              shallow-water light, foam washing onto the shore and rocks
//   • medium — no shader: a depth-gradient image + 3 scrolling wave layers,
//              animated foam strips along the coast, foam rings round rocks
//   • low    — depth-gradient image + 2 wave layers, static foam (ground)
// If the shader cannot be built the medium path is used instead.
// Boat wakes are V-shaped Kelvin wakes drawn from each boat's recent track.
import { iso, isLand, hash, SEA_Z, PIERS, BOUNDS } from '../config.js';
import { has, addSprite } from './atlas.js';

const inRect = (rs, i, j) => rs.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1);
const depthAt = (x, y) => (x + y) * 16;
const D_WATER = -100;
// palette (shared by shader and gradient so presets look alike)
export const SEA = { shallow: [79, 206, 214], mid: [31, 150, 210], deep: [12, 92, 168] };

// ---- surf rocks (deterministic) -------------------------------------------
export function surfRocks() {
  const out = [];
  for (let i = -12; i < 54; i++) for (let j = -12; j < 44; j++) {
    if (!isLand(i, j)) continue;
    const edges = [];
    if (!isLand(i, j + 1) && !inRect(PIERS, i, j + 1)) edges.push([i + 0.5, j + 1.12, 1]);
    if (!isLand(i + 1, j)) edges.push([i + 1.12, j + 0.5, 0]);
    for (const [x, y, along] of edges) {
      const h = hash(i * 3 + 1, j * 5 + 2);
      if (h < 0.22 && !(j >= 21 && i > 0 && i < 26)) {
        out.push({ x: x + (along ? 0 : 0.35) + (h - 0.1), y: y + (along ? 0.35 : 0) + (0.1 - h), s: 0.8 + h * 2, flip: h < 0.11 });
      }
    }
  }
  return out;
}

// ---- distance-to-shore field -------------------------------------------------
const RES = 2;                                  // samples per tile
function shoreField(rocks) {
  const gx0 = BOUNDS.x0, gy0 = BOUNDS.y0, W = (BOUNDS.x1 - gx0) * RES, H = (BOUNDS.y1 - gy0) * RES;
  const d = new Float32Array(W * H).fill(1e9);
  const q = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.floor(gx0 + (x + 0.5) / RES), j = Math.floor(gy0 + (y + 0.5) / RES);
    if (isLand(i, j)) { d[y * W + x] = 0; q.push(x, y); }
  }
  for (const r of rocks) {
    const cx = (r.x - gx0) * RES, cy = (r.y - gy0) * RES, rad = 0.22 * r.s * RES;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++)
      if (x >= 0 && y >= 0 && x < W && y < H && Math.hypot(x - cx, y - cy) <= rad) { d[y * W + x] = 0; q.push(x, y); }
  }
  // two-pass chamfer distance (3-4), good enough and fast
  const a = 1, b = 1.4142;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = d[y * W + x];
    if (x > 0) v = Math.min(v, d[y * W + x - 1] + a);
    if (y > 0) { v = Math.min(v, d[(y - 1) * W + x] + a); if (x > 0) v = Math.min(v, d[(y - 1) * W + x - 1] + b); if (x < W - 1) v = Math.min(v, d[(y - 1) * W + x + 1] + b); }
    d[y * W + x] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    let v = d[y * W + x];
    if (x < W - 1) v = Math.min(v, d[y * W + x + 1] + a);
    if (y < H - 1) { v = Math.min(v, d[(y + 1) * W + x] + a); if (x < W - 1) v = Math.min(v, d[(y + 1) * W + x + 1] + b); if (x > 0) v = Math.min(v, d[(y + 1) * W + x - 1] + b); }
    d[y * W + x] = v;
  }
  return { d, W, H, gx0, gy0, at(gx, gy) {        // distance in tiles, bilinear
    if (gx < gx0 || gy < gy0 || gx >= gx0 + W / RES || gy >= gy0 + H / RES) return 99;   // beyond the map: open sea
    const fx = (gx - gx0) * RES - 0.5, fy = (gy - gy0) * RES - 0.5;
    const x = Math.max(0, Math.min(W - 2, Math.floor(fx))), y = Math.max(0, Math.min(H - 2, Math.floor(fy)));
    const tx = Math.max(0, Math.min(1, fx - x)), ty = Math.max(0, Math.min(1, fy - y));
    const v = d[y * W + x] * (1 - tx) * (1 - ty) + d[y * W + x + 1] * tx * (1 - ty) + d[(y + 1) * W + x] * (1 - tx) * ty + d[(y + 1) * W + x + 1] * tx * ty;
    return v / RES;
  } };
}
const MAXD = 7;                                  // tiles from shore that count as "deep"
const seaColor = t => {                          // t: 0 shore … 1 deep
  const k1 = Math.min(1, t * 2.2), k2 = Math.max(0, (t - 0.35) / 0.65);
  const c = SEA.shallow.map((v, i) => v + (SEA.mid[i] - v) * k1);
  return c.map((v, i) => Math.round(v + (SEA.deep[i] - v) * k2 * k2 * (3 - 2 * k2)));
};

// ---- shader (high preset) ------------------------------------------------------
const FRAG = `
precision mediump float;
uniform vec4 uRect;      // world x, y, w, h of the quad
uniform vec4 uGrid;      // grid x0, y0, width, height of the field texture
uniform float uTime;
uniform vec3 uShallow, uMid, uDeep;
uniform sampler2D iChannel0;   // distance field (r = distance / MAXD)
uniform sampler2D iChannel1;   // tiling value noise
varying vec2 outTexCoord;
float n(vec2 p) { return texture2D(iChannel1, p).r; }
void main() {
  vec2 w = uRect.xy + vec2(outTexCoord.x, 1.0 - outTexCoord.y) * uRect.zw;
  float sy = w.y - 18.0;                       // water plane sits below the land
  vec2 g = vec2((w.x / 32.0 + sy / 16.0) * 0.5, (sy / 16.0 - w.x / 32.0) * 0.5);
  vec2 fuv = (g - uGrid.xy) / uGrid.zw;
  float inside = step(0.0, fuv.x) * step(0.0, fuv.y) * step(fuv.x, 1.0) * step(fuv.y, 1.0);
  float d = mix(1.0, texture2D(iChannel0, fuv).r, inside);   // beyond the map: open sea
  float t = uTime;
  // wave height field: two long swells + two noise chop layers
  float s1 = sin(dot(g, vec2(0.62, 0.28)) * 2.1 + t * 1.15);
  float s2 = sin(dot(g, vec2(-0.25, 0.70)) * 2.9 + t * 1.55);
  float c1 = n(g * 0.11 + vec2(t * 0.012, t * 0.007));
  float c2 = n(g * 0.27 - vec2(t * 0.020, -t * 0.015));
  float h = s1 * 0.35 + s2 * 0.25 + (c1 - 0.5) * 0.9 + (c2 - 0.5) * 0.6;
  // slope from the analytic swell derivatives + noise differences
  vec2 sl = vec2(0.62, 0.28) * cos(dot(g, vec2(0.62, 0.28)) * 2.1 + t * 1.15) * 0.7
          + vec2(-0.25, 0.70) * cos(dot(g, vec2(-0.25, 0.70)) * 2.9 + t * 1.55) * 0.7
          + vec2(n(g * 0.27 + vec2(0.02, 0.0) - vec2(t * 0.020, -t * 0.015)) - c2, n(g * 0.27 + vec2(0.0, 0.02) - vec2(t * 0.020, -t * 0.015)) - c2) * 9.0;
  vec3 nrm = normalize(vec3(-sl * mix(0.18, 0.42, d), 1.0));
  // depth colour
  float k1 = clamp(d * 2.2, 0.0, 1.0), k2 = smoothstep(0.35, 1.0, d);
  vec3 col = mix(mix(uShallow, uMid, k1), uDeep, k2);
  col *= 0.93 + h * 0.06;
  // soft sky reflection + sun glitter (sun from the upper left)
  vec3 sun = normalize(vec3(-0.45, -0.55, 0.70));
  float diff = dot(nrm, sun);
  col += vec3(0.10, 0.13, 0.16) * smoothstep(0.55, 1.0, diff);
  float spec = pow(max(dot(reflect(-sun, nrm), vec3(0.0, 0.0, 1.0)), 0.0), 140.0);
  // glitter only where a slow mask lets the sun through (patches, not confetti)
  float gm = smoothstep(0.55, 0.75, n(g * 0.05 + vec2(t * 0.004, 0.0)));
  col += vec3(1.0, 0.97, 0.88) * spec * (0.18 + 0.35 * d) * (0.35 + 0.65 * gm);
  // light pattern on shallow sand
  float caus = smoothstep(0.62, 0.78, n(g * 0.55 + vec2(t * 0.05, -t * 0.03)) * 0.5 + n(g * 0.9 - vec2(t * 0.04, t * 0.06)) * 0.5);
  col += vec3(0.16, 0.20, 0.18) * caus * (1.0 - smoothstep(0.0, 0.22, d));
  // foam: a broken white edge at the waterline + wash lines rolling in
  float edge = (1.0 - smoothstep(0.03, 0.085, d)) * (0.6 + 0.4 * c1);
  float wash = sin(d * 42.0 + t * 1.35 + c1 * 3.0) * 0.5 + 0.5;
  float band = 1.0 - smoothstep(0.04, 0.2, d);
  float foam = max(edge, band * smoothstep(0.72, 0.95, wash) * (0.45 + 0.55 * c2));
  col = mix(col, vec3(0.97, 0.99, 1.0), foam * 0.85);
  gl_FragColor = vec4(col, 1.0);
}`;

function noiseCanvas(size = 128) {
  // smooth tiling value noise (bilinear-interpolated lattice, 2 octaves)
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const oct = (cells) => { const L = Array.from({ length: cells * cells }, rnd); return (x, y) => {
    const fx = x / size * cells, fy = y / size * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const v = (a, b) => L[((b % cells + cells) % cells) * cells + ((a % cells + cells) % cells)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy; }; };
  const o1 = oct(8), o2 = oct(16);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = Math.round((o1(x, y) * 0.65 + o2(x, y) * 0.35) * 255), k = (y * size + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export class Water {
  constructor(scene, quality, gb) {
    this.sc = scene; this.Q = quality; this.gb = gb;
    this.rocks = surfRocks();
    this.field = shoreField(this.rocks);
    this.mode = quality.water;
    this.t = 0;
    if (this.mode === 'shader' && !this.makeShader()) this.mode = 'layers';
    if (this.mode !== 'shader') this.makeLayers();
    this.placeRocks();
    if (this.mode === 'layers') { this.makeFoamStrips(); this.makeRockRings(); }
    this.makeGlints(this.mode === 'layers' ? quality.glints : 0);
    this.wake = new Wake(scene, quality);
    console.log('WATER mode=' + this.mode + ' requested=' + quality.water);
  }

  // area the sea covers (generous, the camera never sees past it)
  rect() { const gb = this.gb; return { x: gb.left - 2500, y: gb.top - 1800, w: gb.right - gb.left + 5000, h: gb.bottom - gb.top + 3600 }; }

  makeShader() {
    try {
      const sc = this.sc, f = this.field, R = this.rect();
      if (sc.game.renderer.type !== Phaser.WEBGL) return false;
      // field texture: r = distance / MAXD
      const c = document.createElement('canvas'); c.width = f.W; c.height = f.H;
      const g = c.getContext('2d'), img = g.createImageData(f.W, f.H);
      for (let i = 0; i < f.W * f.H; i++) { const v = Math.min(255, Math.round(f.d[i] / RES / MAXD * 255)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
      g.putImageData(img, 0, 0);
      if (sc.textures.exists('seaField')) sc.textures.remove('seaField');
      sc.textures.addCanvas('seaField', c);
      if (!sc.textures.exists('seaNoise')) sc.textures.addCanvas('seaNoise', noiseCanvas());
      const v3 = a => ({ x: a[0] / 255, y: a[1] / 255, z: a[2] / 255 });
      const base = new Phaser.Display.BaseShader('sea', FRAG, undefined, {
        uRect: { type: '4f', value: { x: R.x, y: R.y, z: R.w, w: R.h } },
        uGrid: { type: '4f', value: { x: f.gx0, y: f.gy0, z: f.W / RES, w: f.H / RES } },
        uTime: { type: '1f', value: 0 },
        uShallow: { type: '3f', value: v3(SEA.shallow) }, uMid: { type: '3f', value: v3(SEA.mid) }, uDeep: { type: '3f', value: v3(SEA.deep) },
      });
      this.shader = sc.add.shader(base, R.x, R.y, R.w, R.h).setOrigin(0).setDepth(D_WATER);
      // the field is not a power of two: WebGL1 can only sample it with clamp-to-edge
      this.shader.setSampler2D('iChannel0', 'seaField', 0, { wrapS: 'clamp_to_edge', wrapT: 'clamp_to_edge' });
      this.shader.setSampler2D('iChannel1', 'seaNoise', 1, { repeat: true });
      if (!this.shader.program) { this.shader.destroy(); this.shader = null; return false; }
      return true;
    } catch (e) {
      console.log('ERR water shader ' + e.message);
      if (this.shader) { this.shader.destroy(); this.shader = null; }
      return false;
    }
  }

  // depth gradient rendered once into an iso-projected image + scrolling wave layers
  makeLayers() {
    const sc = this.sc, f = this.field, R = this.rect(), S = 1 / 8;
    const W = Math.ceil(R.w * S), H = Math.ceil(R.h * S);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), img = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const wx = R.x + x / S, sy = R.y + y / S + SEA_Z;
      const gx = (wx / 32 + sy / 16) / 2, gy = (sy / 16 - wx / 32) / 2;
      const col = seaColor(Math.min(1, f.at(gx, gy) / MAXD)), k = (y * W + x) * 4;
      img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    if (sc.textures.exists('seaDepth')) sc.textures.remove('seaDepth');
    sc.textures.addCanvas('seaDepth', c);
    sc.add.image(R.x, R.y, 'seaDepth').setOrigin(0).setScale(1 / S).setDepth(D_WATER - 1);
    // wave layers (TileSprites allocate their own size, so keep them small and scale up)
    const K = 8, n = this.mode === 'layers' ? 3 : 2;
    const L = [['waves', 0.6, 0.62, 7, 2], ['waves', 1.1, 0.34, -4, 3], ['swell', 1.0, 0.30, 2, -3]];
    this.layers = L.slice(0, n).map(([key, ts, a, vx, vy], i) =>
      ({ s: sc.add.tileSprite(R.x, R.y, R.w / K, R.h / K, key).setOrigin(0).setScale(K).setTileScale(ts / K).setDepth(D_WATER + i).setAlpha(a).setFlipX(i === 1), vx: vx / K, vy: vy / K }));
  }

  placeRocks() {
    if (!has('prop/rock')) return;
    for (const r of this.rocks) {
      const p = iso(r.x, r.y, SEA_Z + 2);
      addSprite(this.sc, p.x, p.y, 'prop/rock', r.s).setDepth(depthAt(r.x, r.y) - 6).setFlipX(r.flip);
    }
  }

  // medium: soft foam strips that wash in and out along the coast
  makeFoamStrips() {
    const sc = this.sc;
    this.foam = [];
    for (let i = -12; i < 54; i++) for (let j = -12; j < 44; j++) {
      if (!isLand(i, j)) continue;
      const edges = [];
      // skip inner corners: land drawn in front would cover the strip's upper half
      const front = isLand(i + 1, j + 1) || isLand(i - 1, j + 1) || isLand(i + 1, j - 1);
      if (!isLand(i, j + 1) && !inRect(PIERS, i, j + 1) && !front) edges.push([i + 0.5, j + 1.32, 26.57, 0, 1]);
      if (!isLand(i + 1, j) && !front) edges.push([i + 1.32, j + 0.5, -26.57, 1, 0]);
      for (const [x, y, ang, ox, oy] of edges) {
        const p = iso(x, y, SEA_Z);
        for (let k = 0; k < 2; k++) {
          const f = sc.add.image(p.x, p.y, 'foamstrip').setAngle(ang).setDepth(-45).setAlpha(0);
          f.base = { x: p.x, y: p.y, ph: hash(i * 7 + k, j * 3) * 6.28 + k * 3.14, ox: (ox - oy) * 32, oy: (ox + oy) * 16 };
          this.foam.push(f);
        }
      }
    }
  }
  makeRockRings() {
    this.rings = [];
    for (const r of this.rocks) for (let k = 0; k < 2; k++) {
      const p = iso(r.x, r.y, SEA_Z);
      const s = this.sc.add.image(p.x, p.y + 2, 'foamring').setDepth(depthAt(r.x, r.y) - 7).setAlpha(0);
      this.rings.push({ s, ph: k * 0.5 + hash(Math.round(r.x * 10), Math.round(r.y * 10)), sc: 0.32 * r.s });
    }
  }

  makeGlints(n) {
    this.glints = [];
    for (let k = 0; k < n; k++) this.glints.push({ s: this.sc.add.image(0, 0, 'spark').setDepth(-44).setBlendMode('ADD').setVisible(false), life: 0, max: 1 });
  }

  update(t, dt, cam) {
    this.t = t;
    if (this.shader) this.shader.setUniform('uTime.value', t);
    if (this.layers) for (const L of this.layers) { L.s.tilePositionX = t * L.vx; L.s.tilePositionY = t * L.vy; }
    if (this.foam) for (const f of this.foam) {
      // each strip slides up the beach and fades while running back
      const ph = (t * 0.32 + f.base.ph / 6.28) % 1, out = Math.sin(ph * Math.PI);
      f.setPosition(f.base.x + f.base.ox * 0.05 * ph, f.base.y + f.base.oy * 0.05 * ph).setAlpha(0.42 * out).setScale(0.8 + 0.25 * out, 0.75 + 0.25 * out);
    }
    if (this.rings) for (const r of this.rings) {
      const ph = (t * 0.35 + r.ph) % 1;
      r.s.setScale(r.sc * (0.8 + ph * 0.9), r.sc * (0.8 + ph * 0.9) * 0.5).setAlpha(0.55 * (1 - ph));
    }
    if (this.glints.length) this.animGlints(dt, cam);
  }

  animGlints(dt, cam) {
    const v = cam.worldView;
    for (const g of this.glints) {
      g.life -= dt;
      if (g.life <= 0) {
        for (let tries = 0; tries < 4; tries++) {
          const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
          const sy = y + SEA_Z, gx = (x / 32 + sy / 16) / 2, gy = (sy / 16 - x / 32) / 2;
          if (this.field.at(gx, gy) > 1.5) { g.s.setPosition(x, y).setVisible(true); g.max = g.life = 0.6 + Math.random() * 0.9; break; }
        }
      }
      const k = Math.max(0, g.life / g.max), a = Math.sin(k * Math.PI);
      g.s.setScale(0.16 + 0.26 * a).setAlpha(0.8 * a);
    }
  }
}

// ---- V-shaped (Kelvin) wakes -------------------------------------------------
// Each moving boat leaves samples of its stern position; every sample opens two
// arms that spread sideways and fade with age, plus a churned centre line.
export class Wake {
  constructor(scene, quality) {
    this.sc = scene;
    const lvl = quality.water === 'shader' ? 2 : quality.water === 'layers' ? 1 : 0;
    this.life = [1.1, 1.9, 2.6][lvl];
    this.every = [0.16, 0.11, 0.08][lvl];
    this.arms = lvl > 0;
    this.g = scene.add.graphics().setDepth(-43);
    this.trails = new Map();
  }
  update(t, boats, speedRef) {
    const g = this.g; g.clear();
    for (const b of boats) {
      let tr = this.trails.get(b); if (!tr) this.trails.set(b, tr = { pts: [], last: 0 });
      const m = b.m, moving = (b.state === 'out' || b.state === 'back') && m.speed > 0.05;
      if (moving && t - tr.last >= this.every) {
        tr.last = t;
        const len = 1.3 * (b.scale || 1.45) + 0.05;          // stern of the baked hull
        tr.pts.unshift({ x: m.x - m.dx * len, y: m.y - m.dy * len, dx: m.dx, dy: m.dy, v: Math.min(1.4, m.speed / Math.max(0.1, speedRef)), t });
      }
      while (tr.pts.length && t - tr.pts[tr.pts.length - 1].t > this.life) tr.pts.pop();
      if (tr.pts.length < 2) continue;
      const P = tr.pts, L = [], R = [], C = [];
      for (const p of P) {
        const a = (t - p.t) / this.life, spread = 0.18 + a * 1.25 * p.v;
        const px = -p.dy, py = p.dx;
        const back = a * 0.35 * p.v;                // arms trail slightly behind the centre
        L.push([iso(p.x + px * spread - p.dx * back, p.y + py * spread - p.dy * back, SEA_Z), a, p.v]);
        R.push([iso(p.x - px * spread - p.dx * back, p.y - py * spread - p.dy * back, SEA_Z), a, p.v]);
        C.push([iso(p.x, p.y, SEA_Z), a, p.v]);
      }
      // churned water behind the stern
      for (let i = 1; i < C.length; i++) {
        const [q0, a0, v] = C[i - 1], [q1] = C[i];
        const fade = Math.pow(1 - a0, 1.6);
        g.lineStyle(16 * (1 - a0 * 0.4), 0xffffff, 0.14 * fade * v).lineBetween(q0.x, q0.y, q1.x, q1.y);
        g.lineStyle(6 * (1 - a0 * 0.5), 0xffffff, 0.38 * fade * v).lineBetween(q0.x, q0.y, q1.x, q1.y);
      }
      if (!this.arms) continue;
      for (const side of [L, R]) for (let i = 1; i < side.length; i++) {
        const [q0, a0, v] = side[i - 1], [q1] = side[i];
        const fade = Math.pow(1 - a0, 1.4);
        g.lineStyle(7 - a0 * 3, 0xffffff, 0.16 * fade * Math.min(1, v)).lineBetween(q0.x, q0.y, q1.x, q1.y);
        g.lineStyle(3 - a0 * 1.5, 0xffffff, 0.6 * fade * Math.min(1, v)).lineBetween(q0.x, q0.y, q1.x, q1.y);
      }
    }
  }
}
