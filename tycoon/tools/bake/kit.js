// Low-poly modelling kit in a Kenney-like flat cartoon style.
// Grid convention: x = grid x, z = grid y, y = up; boxes take their min corner.
import * as THREE from 'three';

const mats = {};
export function mat(col, o = {}) {
  const k = col + JSON.stringify(o);
  if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color: col, roughness: o.r ?? 0.78, metalness: o.m ?? 0, flatShading: true, emissive: o.e || 0x000000, emissiveIntensity: o.ei ?? 0, transparent: !!o.t, opacity: o.t ?? 1, map: o.map || null });
  return mats[k];
}
export const C = {
  wall: '#f3f1ec', wall2: '#e4e9ef', cream: '#fbefd6', blue: '#2e6fd8', blue2: '#4b8ff0', navy: '#244a8c',
  red: '#e2473b', yellow: '#f6c22f', orange: '#f28c28', glass: '#8fd0f5', glassD: '#4f95d4', dark: '#3a414b',
  steel: '#a9b3bd', steel2: '#cfd6dc', wood: '#b9824b', wood2: '#94643a', green: '#4fae45', leaf: '#3f9a3a',
  concrete: '#d5d8db', asphalt: '#565c64', white: '#ffffff', rock: '#8e8a82', sand: '#e8d7a6', teal: '#2bb3a5',
};

export function group(...kids) { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; }

export function box(g, x, y, z, w, h, d, col, o) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof col === 'string' ? mat(col, o) : col);
  m.position.set(x + w / 2, y + h / 2, z + d / 2);
  g.add(m); return m;
}
export function cyl(g, cx, y, cz, r, h, col, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 24), mat(col, o));
  m.position.set(cx, y + h / 2, cz); g.add(m); return m;
}
export function sphere(g, cx, cy, cz, r, col, o = {}) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, o.seg || 14, o.seg2 || 10), mat(col, o));
  m.position.set(cx, cy, cz); if (o.sy) m.scale.y = o.sy; g.add(m); return m;
}
export function cone(g, cx, y, cz, r, h, col, seg = 8) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(col));
  m.position.set(cx, y + h / 2, cz); g.add(m); return m;
}

// Glass panes with a white frame on a visible facade.
// face '+z' → the +y grid face (screen front-left), '+x' → the +x face (front-right).
export function windows(g, face, x, y, z, w, h, d, cols, rows, o = {}) {
  const fx = face === '+x';
  const span = fx ? d : w, mu = o.mu ?? 0.12, mv = o.mv ?? 0.18, gap = o.gap ?? 0.28;
  const cw = (span - 2 * mu) / cols, rh = (h - 2 * mv) / rows;
  const gl = mat(o.glass || C.glass, { r: 0.25, e: o.lit ? 0xfff2b0 : 0x000000, ei: o.lit ? 0.6 : 0 });
  const fr = mat(o.frame || C.white);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const u0 = mu + i * cw + cw * gap / 2, ww = cw * (1 - gap), v0 = y + mv + j * rh + rh * gap / 2, hh = rh * (1 - gap);
    if (fx) {
      box(g, x + w, v0 - 0.02, z + u0 - 0.02, 0.03, hh + 0.04, ww + 0.04, fr);
      box(g, x + w + 0.01, v0, z + u0, 0.03, hh, ww, gl);
      if (o.mull !== false) box(g, x + w + 0.03, v0 + hh / 2 - 0.01, z + u0, 0.02, 0.02, ww, fr);
    } else {
      box(g, x + u0 - 0.02, v0 - 0.02, z + d, ww + 0.04, hh + 0.04, 0.03, fr);
      box(g, x + u0, v0, z + d + 0.01, ww, hh, 0.03, gl);
      if (o.mull !== false) box(g, x + u0, v0 + hh / 2 - 0.01, z + d + 0.03, ww, 0.02, 0.02, fr);
    }
  }
}

// Horizontal band (stripe) around the two visible faces.
export function band(g, x, y, z, w, h, d, col) {
  box(g, x - 0.01, y, z + d - 0.01, w + 0.02, h, 0.03, col);
  box(g, x + w - 0.01, y, z - 0.01, 0.03, h, d + 0.02, col);
}

// Roller door on a facade.
export function door(g, face, x, y, z, w, h, d, u0, u1, dh, col = '#7c8a98') {
  const fr = mat(C.steel2), m = mat(col);
  if (face === '+x') {
    box(g, x + w, y, z + u0 - 0.05, 0.04, dh + 0.05, u1 - u0 + 0.1, fr);
    box(g, x + w + 0.01, y, z + u0, 0.04, dh, u1 - u0, m);
    for (let k = 1; k < 7; k++) box(g, x + w + 0.03, y + dh * k / 7, z + u0, 0.02, 0.012, u1 - u0, mat('#5f6c79'));
  } else {
    box(g, x + u0 - 0.05, y, z + d, u1 - u0 + 0.1, dh + 0.05, 0.04, fr);
    box(g, x + u0, y, z + d + 0.01, u1 - u0, dh, 0.04, m);
    for (let k = 1; k < 7; k++) box(g, x + u0, y + dh * k / 7, z + d + 0.03, u1 - u0, 0.012, 0.02, mat('#5f6c79'));
  }
}

// Gable roof; ridge along 'x' or 'z'. Corrugated ribs optional.
export function gable(g, x, y, z, w, d, rh, col, axis = 'x', o = {}) {
  const ov = o.over ?? 0.12;
  x -= ov; z -= ov; w += 2 * ov; d += 2 * ov;
  const span = axis === 'x' ? d : w, len = axis === 'x' ? w : d;
  const s = new THREE.Shape();
  s.moveTo(-span / 2, 0); s.lineTo(span / 2, 0); s.lineTo(0, rh); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  const m = new THREE.Mesh(geo, [mat(o.end || C.wall2), mat(col)]);
  if (axis === 'x') { m.rotation.y = Math.PI / 2; m.position.set(x, y, z + d / 2); }
  else { m.position.set(x + w / 2, y, z); }
  g.add(m);
  // eave trim
  if (o.trim !== false) {
    if (axis === 'x') { box(g, x, y - 0.04, z + d - 0.03, w, 0.05, 0.05, o.trimCol || C.white); }
    else { box(g, x + w - 0.03, y - 0.04, z, 0.05, 0.05, d, o.trimCol || C.white); }
  }
  if (o.ribs) {
    const slope = Math.atan2(rh, span / 2), sl = Math.hypot(rh, span / 2), rib = mat(o.ribCol || '#ffffff', { t: 0.35 });
    for (let k = 0.5; k < o.ribs; k++) {
      const t = len * k / o.ribs;
      for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, sl), rib);
        if (axis === 'x') { r.position.set(x + t, y + rh / 2 + 0.012, z + d / 2 + side * span / 4); r.rotation.x = side * slope; }
        else { r.rotation.y = Math.PI / 2; r.position.set(x + w / 2 + side * span / 4, y + rh / 2 + 0.012, z + t); r.rotation.order = 'YXZ'; r.rotation.x = side * slope; }
        g.add(r);
      }
    }
  }
  return m;
}

// Flat roof with parapet.
export function flatRoof(g, x, y, z, w, d, col = C.steel2, par = C.wall) {
  box(g, x, y, z, w, 0.05, d, col);
  box(g, x - 0.04, y, z - 0.04, w + 0.08, 0.14, 0.08, par);
  box(g, x - 0.04, y, z + d - 0.04, w + 0.08, 0.14, 0.08, par);
  box(g, x - 0.04, y, z - 0.04, 0.08, 0.14, d + 0.08, par);
  box(g, x + w - 0.04, y, z - 0.04, 0.08, 0.14, d + 0.08, par);
}
export function acUnit(g, x, y, z) {
  box(g, x, y, z, 0.42, 0.24, 0.34, '#c7cfd6');
  cyl(g, x + 0.21, y + 0.24, z + 0.17, 0.12, 0.02, '#6b7580');
}

// Text sign on a facade ('+z' or '+x'), drawn with a canvas texture.
export function sign(g, face, cx, cy, cz, w, h, text, o = {}) {
  const cv = document.createElement('canvas'); const px = 128;
  cv.width = Math.round(w * px); cv.height = Math.round(h * px);
  const c = cv.getContext('2d');
  c.fillStyle = o.bg || C.blue; c.fillRect(0, 0, cv.width, cv.height);
  c.strokeStyle = o.border || '#ffffff'; c.lineWidth = 6; c.strokeRect(3, 3, cv.width - 6, cv.height - 6);
  let fs = cv.height * 0.62;
  c.font = `900 ${fs}px "Arial Black", Arial, sans-serif`;
  while (c.measureText(text).width > cv.width * 0.88 && fs > 8) { fs -= 2; c.font = `900 ${fs}px "Arial Black", Arial, sans-serif`; }
  c.fillStyle = o.fg || '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle';
  if (o.stroke) { c.lineWidth = fs * 0.16; c.strokeStyle = o.stroke; c.strokeText(text, cv.width / 2, cv.height / 2 + fs * 0.05); }
  c.fillText(text, cv.width / 2, cv.height / 2 + fs * 0.05);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25 }));
  if (face === '+x') m.rotation.y = Math.PI / 2;
  m.position.set(cx, cy, cz);
  g.add(m); return m;
}

// Fish emblem (flat disc + fish shape) facing a facade.
export function fishBadge(g, face, cx, cy, cz, r, bg = C.white, fg = C.blue2) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d');
  c.fillStyle = bg; c.beginPath(); c.arc(128, 128, 124, 0, 7); c.fill();
  c.lineWidth = 10; c.strokeStyle = fg; c.stroke();
  drawFish(c, 128, 132, 7, fg);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 }));
  if (face === '+x') m.rotation.y = Math.PI / 2;
  m.position.set(cx, cy, cz); g.add(m); return m;
}
export function drawFish(c, x, y, s, col) {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col;
  c.beginPath(); c.moveTo(-10, 0); c.quadraticCurveTo(-2, -9, 9, -2); c.quadraticCurveTo(11, 0, 9, 2); c.quadraticCurveTo(-2, 9, -10, 0); c.fill();
  c.beginPath(); c.moveTo(-9, 0); c.lineTo(-15, -6); c.lineTo(-14, 0); c.lineTo(-15, 6); c.closePath(); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(4.5, -1.5, 1.7, 0, 7); c.fill();
  c.restore();
}

// Striped awning sloping out from a facade at height y.
export function awning(g, face, x0, x1, at, y, depth, colA, colB = C.white, n = 8) {
  const drop = depth * 0.55, len = Math.hypot(depth, drop), ang = Math.atan2(drop, depth);
  for (let k = 0; k < n; k++) {
    const a = x0 + (x1 - x0) * k / n, w = (x1 - x0) / n;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, len), mat(k % 2 ? colB : colA));
    if (face === '+x') { m.rotation.y = Math.PI / 2; m.rotation.order = 'YXZ'; m.rotation.x = ang; m.position.set(at + depth / 2, y - drop / 2, a + w / 2); }
    else { m.rotation.x = ang; m.position.set(a + w / 2, y - drop / 2, at + depth / 2); }
    g.add(m);
    // valance
    if (face === '+x') box(g, at + depth - 0.01, y - drop - 0.12, a, 0.02, 0.12, w, k % 2 ? colB : colA);
    else box(g, a, y - drop - 0.12, at + depth - 0.01, w, 0.12, 0.02, k % 2 ? colB : colA);
  }
}

export function umbrella(g, x, z, col, h = 0.75) {
  cyl(g, x, 0, z, 0.02, h, '#dddddd');
  const seg = 8;
  for (let k = 0; k < seg; k++) {
    const geo = new THREE.ConeGeometry(0.42, 0.18, seg, 1, true, k * Math.PI * 2 / seg, Math.PI * 2 / seg);
    const m = new THREE.Mesh(geo, mat(k % 2 ? C.white : col, {}));
    m.material.side = THREE.DoubleSide;
    m.position.set(x, h + 0.05, z); g.add(m);
  }
}

export function crate(g, x, y, z, s, kind = 'raw') {
  const col = kind === 'raw' ? '#3b95d9' : kind === 'can' ? '#b8c4cf' : '#d39b57';
  box(g, x, y, z, s, s * 0.7, s, col);
  if (kind === 'raw') box(g, x + s * 0.1, y + s * 0.7, z + s * 0.1, s * 0.8, 0.02, s * 0.8, '#cfe3f2');
  else box(g, x + s * 0.45, y + s * 0.7, z, s * 0.1, 0.01, s, kind === 'can' ? C.red : '#f1d39f');
}
export function pallet(g, x, z, kind = 'raw', layers = 2) {
  box(g, x, 0, z, 0.5, 0.06, 0.5, C.wood);
  for (let l = 0; l < layers; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) crate(g, x + 0.02 + i * 0.24, 0.06 + l * 0.16, z + 0.02 + j * 0.24, 0.22, kind);
}
export function barrel(g, x, z, col = '#d64a3a') { cyl(g, x, 0, z, 0.11, 0.28, col, { seg: 12 }); cyl(g, x, 0.28, z, 0.1, 0.01, '#333', { seg: 12 }); }

export function tree(g, x, z, kind = 0, s = 1) {
  if (kind < 3) {
    cyl(g, x, 0, z, 0.05 * s, 0.25 * s, '#7a5434', { seg: 6 });
    const cols = ['#2f8a3e', '#348f44', '#2a7d39'];
    for (let k = 0; k < 3; k++) cone(g, x, (0.18 + k * 0.22) * s, z, (0.36 - k * 0.09) * s, 0.42 * s, cols[(kind + k) % 3], 7);
  } else {
    cyl(g, x, 0, z, 0.05 * s, 0.32 * s, '#7a5434', { seg: 6 });
    const cols = ['#5cb544', '#4fa83a', '#66bf4d'];
    const c = cols[kind - 3];
    sphere(g, x, 0.55 * s, z, 0.3 * s, c, { seg: 7, seg2: 5 });
    sphere(g, x + 0.14 * s, 0.45 * s, z + 0.1 * s, 0.2 * s, c, { seg: 6, seg2: 4 });
    sphere(g, x - 0.12 * s, 0.47 * s, z + 0.08 * s, 0.2 * s, c, { seg: 6, seg2: 4 });
  }
}
export function lamp(g, x, z) {
  cyl(g, x, 0, z, 0.03, 0.85, C.dark, { seg: 8 });
  box(g, x - 0.02, 0.82, z - 0.02, 0.24, 0.03, 0.04, C.dark);
  box(g, x + 0.14, 0.76, z - 0.04, 0.12, 0.07, 0.08, '#fff3b0', { e: 0xffe48a, ei: 0.8 });
}
export function fence(g, x0, z0, x1, z1, col = C.white, h = 0.28) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.35));
  for (let k = 0; k <= n; k++) { const t = k / n; box(g, x0 + (x1 - x0) * t - 0.02, 0, z0 + (z1 - z0) * t - 0.02, 0.04, h, 0.04, col); }
  const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.03), mat(col));
  rail.position.set((x0 + x1) / 2, h * 0.8, (z0 + z1) / 2); rail.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(rail);
  const rail2 = rail.clone(); rail2.position.y = h * 0.45; g.add(rail2);
}
export function flowerbed(g, x, z, w, d) {
  box(g, x, 0, z, w, 0.1, d, '#9b7653');
  box(g, x + 0.04, 0.1, z + 0.04, w - 0.08, 0.04, d - 0.08, '#4e8f35');
  const cols = ['#ff6fa1', '#ffd84a', '#ffffff', '#ff8a3d'];
  for (let i = 0; i < w * 6; i++) sphere(g, x + 0.08 + Math.random() * (w - 0.16), 0.17, z + 0.08 + Math.random() * (d - 0.16), 0.035, cols[i % 4], { seg: 5, seg2: 4 });
}
export function bush(g, x, z, s = 1) { sphere(g, x, 0.1 * s, z, 0.18 * s, '#4aa23a', { seg: 7, seg2: 5, sy: 0.75 }); }
export function bench(g, x, z, axis = 'x') {
  const w = axis === 'x' ? 0.5 : 0.16, d = axis === 'x' ? 0.16 : 0.5;
  box(g, x, 0.14, z, w, 0.04, d, C.wood); box(g, x, 0, z, 0.04, 0.14, 0.04, C.dark); box(g, x + w - 0.04, 0, z + d - 0.04, 0.04, 0.14, 0.04, C.dark);
  if (axis === 'x') box(g, x, 0.18, z, w, 0.14, 0.03, C.wood); else box(g, x, 0.18, z, 0.03, 0.14, d, C.wood);
}

// ---- extra architectural detail ---------------------------------------------
export function roofVent(g, x, y, z) {      // turbine ventilator
  cyl(g, x, y, z, 0.07, 0.12, C.steel, { seg: 10 });
  sphere(g, x, y + 0.16, z, 0.1, '#c9d1d8', { seg: 10, sy: 0.8 });
}
export function duct(g, x, y, z, len, axis = 'x', col = C.steel2, s = 0.18) {
  if (axis === 'x') box(g, x, y, z, len, s, s, col); else if (axis === 'z') box(g, x, y, z, s, s, len, col); else box(g, x, y, z, s, len, s, col);
}
export function pipe(g, x, y, z, len, axis = 'x', r = 0.06, col = '#d9dee3') {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat(col, { r: 0.4 }));
  if (axis === 'x') { m.rotation.z = Math.PI / 2; m.position.set(x + len / 2, y, z); }
  else if (axis === 'z') { m.rotation.x = Math.PI / 2; m.position.set(x, y, z + len / 2); }
  else m.position.set(x, y + len / 2, z);
  g.add(m); return m;
}
export function skylight(g, x, y, z, w, d) {
  box(g, x, y, z, w, 0.06, d, C.white);
  box(g, x + 0.04, y + 0.06, z + 0.04, w - 0.08, 0.05, d - 0.08, '#9fd8fb', { r: 0.15 });
}
export function dish(g, x, y, z) {
  cyl(g, x, y, z, 0.02, 0.18, C.dark, { seg: 6 });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(C.white));
  m.material.side = THREE.DoubleSide; m.position.set(x, y + 0.28, z); m.rotation.x = -2.2; m.rotation.z = 0.5; g.add(m);
}
export function railing(g, x0, z0, x1, z1, y, col = '#f2c230') {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 0.25));
  for (let k = 0; k <= n; k++) { const t = k / n; box(g, x0 + (x1 - x0) * t - 0.012, y, z0 + (z1 - z0) * t - 0.012, 0.024, 0.18, 0.024, col); }
  const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.025, 0.025), mat(col));
  r.position.set((x0 + x1) / 2, y + 0.18, (z0 + z1) / 2); r.rotation.y = -Math.atan2(z1 - z0, x1 - x0); g.add(r);
}
export function solar(g, x, y, z, nx, nz) {
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.22), mat('#24407a', { r: 0.25, m: 0.3 }));
    m.position.set(x + i * 0.36 + 0.16, y + 0.08, z + j * 0.26 + 0.11); m.rotation.x = -0.35; g.add(m);
    box(g, x + i * 0.36 + 0.15, y, z + j * 0.26 + 0.1, 0.02, 0.06, 0.02, C.steel);
  }
}
export function downpipe(g, x, y, z, h) { box(g, x, y, z, 0.05, h, 0.05, '#c3ccd4'); }
export function planter(g, x, z, w = 0.6) { box(g, x, 0, z, w, 0.14, 0.3, '#9aa3ab'); for (let k = 0; k < w * 4; k++) sphere(g, x + 0.1 + k * 0.14, 0.2, z + 0.15, 0.09, k % 2 ? '#4fae45' : '#3f9a3a', { seg: 6, seg2: 4 }); }
// Big billboard with fish logo + text, on two posts, facing +z.
export function billboard(g, cx, y, cz, w, h, text, o = {}) {
  box(g, cx - w / 2 + 0.15, y, cz, 0.06, 0.35, 0.06, C.dark); box(g, cx + w / 2 - 0.21, y, cz, 0.06, 0.35, 0.06, C.dark);
  box(g, cx - w / 2 - 0.04, y + 0.33, cz - 0.04, w + 0.08, h + 0.08, 0.06, o.frame || C.white);
  sign(g, '+z', cx + h * 0.3, y + 0.37 + h / 2, cz + 0.03, w - h * 0.6, h * 0.8, text, { bg: o.bg || C.blue, fg: o.fg || C.yellow, stroke: o.stroke || '#5a3000', border: o.bg || C.blue });
  fishBadge(g, '+z', cx - w / 2 + h * 0.45, y + 0.37 + h / 2, cz + 0.04, h * 0.42, C.white, o.bg || C.blue);
}
export function fishBox(g, x, y, z, s = 0.22) {      // blue plastic fish crate with ice + fish
  box(g, x, y, z, s, s * 0.45, s * 0.7, '#2f8ee0');
  box(g, x + 0.015, y + s * 0.45, z + 0.015, s - 0.03, 0.01, s * 0.7 - 0.03, '#e3f4ff');
  for (let k = 0; k < 3; k++) sphere(g, x + s * (0.25 + k * 0.25), y + s * 0.47, z + s * 0.35, s * 0.11, k % 2 ? '#c6d4dd' : '#9fb8c8', { sy: 0.4, seg: 7 });
}
export function fishBoxStack(g, x, z, nx = 2, nz = 2, layers = 3) {
  for (let l = 0; l < layers; l++) for (let i = 0; i < nx; i++) for (let j = 0; j < nz - (l > 1 ? 1 : 0); j++) fishBox(g, x + i * 0.24, l * 0.1, z + j * 0.17);
}
export function container(g, x, y, z, col, axis = 'z') {
  const w = axis === 'z' ? 0.5 : 1.3, d = axis === 'z' ? 1.3 : 0.5;
  box(g, x, y, z, w, 0.5, d, col);
  const rib = new THREE.Color(col).multiplyScalar(0.78).getStyle();
  const n = 10;
  for (let k = 1; k < n; k++) {
    if (axis === 'z') box(g, x + w, y + 0.03, z + d * k / n - 0.012, 0.012, 0.44, 0.024, rib);
    else box(g, x + w * k / n - 0.012, y + 0.03, z + d, 0.024, 0.44, 0.012, rib);
  }
  // doors on the short end
  if (axis === 'z') box(g, x + 0.04, y + 0.04, z + d, w - 0.08, 0.42, 0.014, rib);
  else box(g, x + w, y + 0.04, z + 0.04, 0.014, 0.42, d - 0.08, rib);
}
export function netPile(g, x, z, s = 1) {
  sphere(g, x, 0.05 * s, z, 0.32 * s, '#3c8f4a', { sy: 0.38, seg: 9 });
  sphere(g, x + 0.15 * s, 0.1 * s, z + 0.08 * s, 0.18 * s, '#e0662b', { sy: 0.5, seg: 7 });
  sphere(g, x - 0.12 * s, 0.1 * s, z - 0.1 * s, 0.1 * s, '#f6c22f', { sy: 0.8, seg: 7 });
}
