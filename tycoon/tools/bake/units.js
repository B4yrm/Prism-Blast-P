// Boats, people, props and ground tiles.
import * as THREE from 'three';
import { C, mat, group, box, cyl, sphere, cone, windows, crate, pallet, barrel, tree, lamp, bench, bush, flowerbed, fence, umbrella } from './kit.js';

// Facing: dir 0:+x 1:+y(grid) 2:-x 3:-y → rotation about up axis.
export const yaw = dir => [0, -Math.PI / 2, Math.PI, Math.PI / 2][dir];

// ---- boats (modelled along +x, centred on the origin at the waterline) ------
export const BOAT_LOOKS = [
  { hull: '#2f63c8', stripe: '#e6463c', cabin: '#ffffff', roof: '#2f63c8', s: 1.0 },
  { hull: '#d8423a', stripe: '#ffffff', cabin: '#ffffff', roof: '#d8423a', s: 1.25 },
  { hull: '#2a9a6a', stripe: '#f3c533', cabin: '#f5f5f5', roof: '#24734f', s: 1.5 },
];
export function boat(cls) {
  const L = BOAT_LOOKS[cls], s = L.s, g = group();
  const hullShape = (k, inset = 0) => {
    const sh = new THREE.Shape();
    const l = 1.3 * k - inset, w = 0.42 * k - inset;
    sh.moveTo(-l, -w); sh.lineTo(l * 0.55, -w); sh.quadraticCurveTo(l * 0.95, -w * 0.8, l * 1.08, 0);
    sh.quadraticCurveTo(l * 0.95, w * 0.8, l * 0.55, w); sh.lineTo(-l, w); sh.lineTo(-l, -w);
    return sh;
  };
  const layer = (y, h, col, inset = 0) => {
    const geo = new THREE.ExtrudeGeometry(hullShape(s, inset), { depth: h, bevelEnabled: false, curveSegments: 10 });
    const m = new THREE.Mesh(geo, mat(col)); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m;
  };
  layer(-0.12, 0.12, L.stripe, 0.04);
  layer(0, 0.26 * s, L.hull);
  layer(0.26 * s, 0.07, '#ffffff');
  layer(0.33 * s, 0.015, '#e9dcc3', 0.05);                       // deck
  const dy = 0.345 * s;
  // cabin & wheelhouse at the stern
  box(g, -1.05 * s, dy, -0.3 * s, 0.75 * s, 0.38 * s, 0.6 * s, L.cabin);
  windows(g, '+z', -1.05 * s, dy, -0.3 * s, 0.75 * s, 0.38 * s, 0.6 * s, 3, 1, { mv: 0.1, gap: 0.3, mull: false });
  windows(g, '+x', -1.05 * s, dy, -0.3 * s, 0.75 * s, 0.38 * s, 0.6 * s, 2, 1, { mv: 0.1, gap: 0.3, mull: false });
  box(g, -1.0 * s, dy + 0.38 * s, -0.24 * s, 0.55 * s, 0.24 * s, 0.48 * s, L.cabin);
  windows(g, '+x', -1.0 * s, dy + 0.38 * s, -0.24 * s, 0.55 * s, 0.24 * s, 0.48 * s, 2, 1, { mv: 0.05, gap: 0.15, mull: false, glass: '#5aa6e0' });
  windows(g, '+z', -1.0 * s, dy + 0.38 * s, -0.24 * s, 0.55 * s, 0.24 * s, 0.48 * s, 2, 1, { mv: 0.05, gap: 0.15, mull: false, glass: '#5aa6e0' });
  box(g, -1.04 * s, dy + 0.62 * s, -0.28 * s, 0.63 * s, 0.05, 0.56 * s, L.roof);
  cyl(g, -0.75 * s, dy + 0.67 * s, 0, 0.02, 0.3, '#dddddd', { seg: 6 });
  // mast, boom and rigging
  cyl(g, 0.15 * s, dy, 0, 0.035, 1.0 * s, '#f2f2f2', { seg: 8 });
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.0 * s, 6), mat(C.yellow));
  boom.position.set(0.5 * s, dy + 0.75 * s, 0); boom.rotation.z = -1.1; g.add(boom);
  box(g, 0.12 * s, dy + 0.98 * s, -0.04, 0.22, 0.12, 0.02, L.stripe);
  // net pile & crates on deck
  sphere(g, 0.55 * s, dy + 0.05, 0.05, 0.22 * s, '#3f8f4a', { sy: 0.45, seg: 9 });
  crate(g, -0.2 * s, dy, 0.08 * s, 0.18 * s, 'raw'); crate(g, -0.2 * s, dy, -0.24 * s, 0.18 * s, 'raw');
  if (cls >= 1) { cyl(g, 0.9 * s, dy, 0, 0.13 * s, 0.16, '#8a8f96', { seg: 12 }); }
  if (cls >= 2) {
    cyl(g, -0.2 * s, dy, 0, 0.04, 1.3 * s, C.yellow, { seg: 8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.05, 0.05), mat(C.yellow)); arm.position.set(0.2 * s, dy + 1.25 * s, 0); arm.rotation.z = -0.35; g.add(arm);
    box(g, -0.32 * s, dy, -0.36 * s, 0.24 * s, 0.24 * s, 0.24 * s, '#e2453c');
  }
  // tyre fenders
  for (const k of [-0.6, 0, 0.5]) { cyl(g, k * s, 0.12 * s, 0.43 * s, 0.06, 0.04, '#222', { seg: 10 }).rotation.x = Math.PI / 2; }
  return g;
}

// ---- people (≈0.55 tall) -----------------------------------------------------
export const PEOPLE = {
  worker: { shirt: '#2f6fd6', pants: '#33415c', skin: '#f2c49b', hair: '#4a3020', hat: '#f6c531', vest: '#ff8a1f' },
  c0: { shirt: '#e45757', pants: '#2c3e50', skin: '#f6d0ae', hair: '#2b1d14' },
  c1: { shirt: '#4caf50', pants: '#3b3b58', skin: '#c99872', hair: '#1c1c1c' },
  c2: { shirt: '#9c5bd6', pants: '#455a64', skin: '#f2c49b', hair: '#c9922f', long: true },
  c3: { shirt: '#f2b134', pants: '#37474f', skin: '#8d5a3b', hair: '#111111' },
  c4: { shirt: '#26a6c9', pants: '#4e342e', skin: '#f6d0ae', hair: '#6d4c2f', long: true },
  c5: { shirt: '#ffffff', pants: '#283593', skin: '#e0ac85', hair: '#3a2a1a', cap: '#e53935' },
};
export function person(look, frame, carry) {
  const L = PEOPLE[look], g = group();
  const ph = frame / 4 * Math.PI * 2, sw = Math.sin(ph) * 0.5, bob = Math.abs(Math.cos(ph)) * 0.015;
  const limb = (x, y, z, w, h, d, col, rot) => {
    const piv = new THREE.Group(); piv.position.set(x, y, z); piv.rotation.z = rot;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col)); m.position.y = -h / 2; piv.add(m); g.add(piv); return piv;
  };
  // legs swing about z (character faces +x)
  limb(0, 0.24 + bob, -0.045, 0.07, 0.24, 0.07, L.pants, sw);
  limb(0, 0.24 + bob, 0.045, 0.07, 0.24, 0.07, L.pants, -sw);
  box(g, -0.05 + Math.sin(sw) * 0.2, 0, -0.08, 0.1, 0.035, 0.07, '#2b2b2b');
  box(g, -0.05 - Math.sin(sw) * 0.2, 0, 0.01, 0.1, 0.035, 0.07, '#2b2b2b');
  box(g, -0.06, 0.23 + bob, -0.1, 0.12, 0.2, 0.2, L.shirt);
  if (L.vest) { box(g, -0.065, 0.25 + bob, -0.105, 0.13, 0.16, 0.21, L.vest); box(g, -0.066, 0.31 + bob, -0.106, 0.132, 0.025, 0.212, '#f5f7a8'); }
  const holding = carry === 'raw' || carry === 'prod' || carry === 'can';
  if (holding) {
    limb(0, 0.41 + bob, -0.12, 0.06, 0.15, 0.06, L.shirt, -1.2);
    limb(0, 0.41 + bob, 0.12, 0.06, 0.15, 0.06, L.shirt, -1.2);
    crate(g, 0.1, 0.27 + bob, -0.1, 0.2, carry);
  } else {
    limb(0, 0.42 + bob, -0.125, 0.055, 0.18, 0.055, L.shirt, -sw * 0.8);
    const r = limb(0, 0.42 + bob, 0.125, 0.055, 0.18, 0.055, L.shirt, sw * 0.8);
    if (carry === 'bag') { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.05), mat('#fafafa')); bag.position.set(0, -0.24, 0.02); r.add(bag); }
  }
  sphere(g, 0, 0.5 + bob, 0, 0.085, L.skin, { seg: 12 });
  sphere(g, -0.012, 0.535 + bob, 0, 0.088, L.hair, { seg: 12, sy: 0.7 });
  box(g, 0.075, 0.5 + bob, -0.035, 0.015, 0.02, 0.015, '#2a1c14'); box(g, 0.075, 0.5 + bob, 0.02, 0.015, 0.02, 0.015, '#2a1c14');
  if (L.long) box(g, -0.09, 0.4 + bob, -0.07, 0.05, 0.14, 0.14, L.hair);
  if (L.hat) { sphere(g, 0, 0.55 + bob, 0, 0.1, L.hat, { seg: 12, sy: 0.65 }); cyl(g, 0, 0.53 + bob, 0, 0.125, 0.02, L.hat, { seg: 14 }); }
  if (L.cap) { sphere(g, 0, 0.55 + bob, 0, 0.092, L.cap, { seg: 12, sy: 0.6 }); box(g, 0.05, 0.545 + bob, -0.06, 0.1, 0.015, 0.12, L.cap); }
  return g;
}

// ---- props ------------------------------------------------------------------
export const PROPS = {
  crane() {
    const g = group();
    box(g, -0.4, 0, -0.4, 0.8, 0.25, 0.8, '#e0b320');
    const H = 2.8;
    for (const [x, z] of [[-0.18, -0.18], [0.14, -0.18], [-0.18, 0.14], [0.14, 0.14]]) box(g, x, 0.25, z, 0.04, H, 0.04, C.yellow);
    for (let y = 0.4; y < H; y += 0.3) { box(g, -0.18, y, 0.14, 0.36, 0.03, 0.03, '#d9a514'); box(g, 0.14, y, -0.18, 0.03, 0.03, 0.36, '#d9a514'); }
    box(g, -0.25, H + 0.25, -0.25, 0.5, 0.35, 0.5, C.yellow);
    windows(g, '+x', -0.25, H + 0.25, -0.25, 0.5, 0.35, 0.5, 1, 1, { mv: 0.08, gap: 0.2, mull: false });
    box(g, -0.07, H + 0.6, -1.0, 0.14, 0.12, 3.4, C.yellow);   // jib out over +z (water)
    box(g, -0.15, H + 0.4, -1.1, 0.3, 0.3, 0.35, '#8a8f96');     // counterweight
    cyl(g, 0, H + 0.72, 0, 0.03, 0.6, '#d9a514', { seg: 6 });
    return g;
  },
  hook() { const g = group(); box(g, -0.08, 0, -0.08, 0.16, 0.12, 0.16, C.dark); box(g, -0.06, 0.12, -0.06, 0.12, 0.04, 0.12, C.yellow); return g; },
  lighthouse() {
    const g = group();
    for (let k = 0; k < 6; k++) sphere(g, Math.cos(k) * 0.6, 0.1, Math.sin(k) * 0.6, 0.45, C.rock, { sy: 0.6, seg: 7 });
    for (let k = 0; k < 6; k++) cyl(g, 0, 0.3 + k * 0.42, 0, 0.42 - k * 0.035, 0.42, k % 2 ? C.red : C.white, { rt: 0.42 - (k + 1) * 0.035, seg: 20 });
    cyl(g, 0, 2.82, 0, 0.42, 0.06, C.dark, { seg: 20 });
    cyl(g, 0, 2.88, 0, 0.26, 0.38, '#fff2a6', { seg: 16, e: 0xffe066, ei: 0.8 });
    cone(g, 0, 3.26, 0, 0.32, 0.36, C.red, 16);
    for (let k = 0; k < 12; k++) box(g, Math.cos(k / 12 * 6.28) * 0.4 - 0.01, 2.88, Math.sin(k / 12 * 6.28) * 0.4 - 0.01, 0.02, 0.18, 0.02, C.dark);
    return g;
  },
  buoy() { const g = group(); sphere(g, 0, 0.05, 0, 0.12, C.red, { sy: 0.8 }); cyl(g, 0, 0.05, 0, 0.125, 0.04, C.white); cyl(g, 0, 0.12, 0, 0.012, 0.2, C.dark, { seg: 6 }); return g; },
  fountain() {
    const g = group();
    cyl(g, 0, 0, 0, 0.9, 0.18, '#cfd5da', { seg: 28 }); cyl(g, 0, 0.18, 0, 0.8, 0.01, '#5fc3ea', { seg: 28, r: 0.15 });
    cyl(g, 0, 0.18, 0, 0.12, 0.45, '#cfd5da', { seg: 12 }); cyl(g, 0, 0.6, 0, 0.35, 0.06, '#cfd5da', { seg: 20 }); cyl(g, 0, 0.66, 0, 0.3, 0.01, '#7fd3f2', { seg: 20 });
    return g;
  },
  lamp() { const g = group(); lamp(g, 0, 0); return g; },
  bench_x() { const g = group(); bench(g, -0.25, -0.08, 'x'); return g; },
  bench_z() { const g = group(); bench(g, -0.08, -0.25, 'z'); return g; },
  bush() { const g = group(); bush(g, 0, 0, 1.2); return g; },
  flowers() { const g = group(); flowerbed(g, -0.4, -0.25, 0.8, 0.5); return g; },
  rock() { const g = group(); sphere(g, 0, 0.05, 0, 0.25, C.rock, { sy: 0.6, seg: 6, seg2: 4 }); sphere(g, 0.2, 0.03, 0.1, 0.15, '#9b968b', { sy: 0.6, seg: 6, seg2: 4 }); return g; },
  pallet_raw() { const g = group(); pallet(g, -0.25, -0.25, 'raw', 2); return g; },
  pallet_prod() { const g = group(); pallet(g, -0.25, -0.25, 'prod', 2); return g; },
  barrels() { const g = group(); barrel(g, 0, 0, C.red); barrel(g, 0.22, 0.05, C.blue2); barrel(g, 0.1, 0.22, C.yellow); return g; },
  container_r() { const g = group(); box(g, -0.3, 0, -0.75, 0.6, 0.6, 1.5, '#c8463c'); for (let k = 0; k < 9; k++) box(g, 0.3, 0.05, -0.7 + k * 0.17, 0.01, 0.5, 0.03, '#a8382f'); return g; },
  container_b() { const g = group(); box(g, -0.3, 0, -0.75, 0.6, 0.6, 1.5, '#2f6fd6'); for (let k = 0; k < 9; k++) box(g, 0.3, 0.05, -0.7 + k * 0.17, 0.01, 0.5, 0.03, '#2558ad'); return g; },
  crate_raw() { const g = group(); crate(g, -0.11, 0, -0.11, 0.22, 'raw'); return g; },
  crate_prod() { const g = group(); crate(g, -0.11, 0, -0.11, 0.22, 'prod'); return g; },
  cbox() { const g = group(); crate(g, -0.08, 0, -0.08, 0.16, 'raw'); return g; },
  cones() { const g = group(); for (let k = 0; k < 3; k++) cone(g, k * 0.15, 0, k * 0.1, 0.05, 0.16, C.orange, 8); return g; },
  belt() {   // one tile of elevated conveyor running along grid y
    const g = group();
    box(g, -0.28, 0.7, 0, 0.56, 0.08, 1, '#6f7a85'); box(g, -0.24, 0.78, 0, 0.48, 0.02, 1, '#2f3640');
    box(g, -0.3, 0.78, 0, 0.04, 0.08, 1, C.yellow); box(g, 0.26, 0.78, 0, 0.04, 0.08, 1, C.yellow);
    return g;
  },
  belt_legs() { const g = group(); box(g, -0.26, 0, 0.45, 0.06, 0.7, 0.06, '#7d8790'); box(g, 0.2, 0, 0.45, 0.06, 0.7, 0.06, '#7d8790'); box(g, -0.26, 0.35, 0.46, 0.52, 0.04, 0.04, '#7d8790'); return g; },
};
for (let k = 0; k < 6; k++) PROPS['tree' + k] = () => { const g = group(); tree(g, 0, 0, k, 1.05); return g; };
const CAR_COLS = ['#e53935', '#1e88e5', '#fdd835', '#ffffff'];
CAR_COLS.forEach((col, i) => {
  for (const ax of [0, 1]) PROPS[`car_${i}_${ax}`] = () => {
    const g = group(), w = ax ? 0.4 : 0.8, d = ax ? 0.8 : 0.4;
    box(g, -w / 2, 0.06, -d / 2, w, 0.18, d, col);
    const cw = ax ? w * 0.9 : w * 0.5, cd = ax ? d * 0.5 : d * 0.9;
    box(g, -cw / 2, 0.24, -cd / 2, cw, 0.14, cd, '#a9d4f5', { r: 0.2 });
    box(g, -cw / 2 - 0.01, 0.38, -cd / 2 - 0.01, cw + 0.02, 0.03, cd + 0.02, col);
    for (const [u, v] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]]) { const [x, z] = ax ? [v, u] : [u, v]; cyl(g, x, 0.0, z, 0.07, 0.07, '#222', { seg: 10 }); }
    return g;
  };
});

// ---- ground tiles (1×1, origin at the tile's min corner) ---------------------
export const TILE_DEPTH = 0.45;     // land plateau above the water surface
export const TILES = {
  grass: (v = 0) => { const g = group(); box(g, 0, -0.06, 0, 1, 0.06, 1, ['#74bf4f', '#6db94a', '#79c454'][v]); return g; },
  pave: () => { const g = group(); box(g, 0, -0.04, 0, 1, 0.05, 1, '#e3dccd'); for (const k of [0.5]) { box(g, k - 0.005, 0.01, 0, 0.01, 0.002, 1, '#cdc4b1'); box(g, 0, 0.01, k - 0.005, 1, 0.002, 0.01, '#cdc4b1'); } return g; },
  quay: () => { const g = group(); box(g, 0, -0.04, 0, 1, 0.05, 1, '#c9c2b4'); box(g, 0, 0.01, 0.9, 1, 0.004, 0.06, C.yellow); return g; },
  cliffY: () => { const g = group(); box(g, 0, -TILE_DEPTH - 0.1, 0.94, 1, TILE_DEPTH + 0.06, 0.06, '#918b80'); for (let k = 0; k < 3; k++) sphere(g, 0.2 + k * 0.3, -0.3, 1.0, 0.12, '#8a847a', { sy: 0.8, seg: 6, seg2: 4 }); return g; },
  cliffX: () => { const g = group(); box(g, 0.94, -TILE_DEPTH - 0.1, 0, 0.06, TILE_DEPTH + 0.06, 1, '#7d786f'); for (let k = 0; k < 3; k++) sphere(g, 1.0, -0.3, 0.2 + k * 0.3, 0.12, '#77726a', { sy: 0.8, seg: 6, seg2: 4 }); return g; },
  pier: () => {
    const g = group(), y = -0.08;
    for (const [x, z] of [[0.05, 0.05], [0.85, 0.05], [0.05, 0.85], [0.85, 0.85]]) box(g, x, -TILE_DEPTH - 0.1, z, 0.1, TILE_DEPTH + 0.02, 0.1, '#6b4a2f');
    for (let k = 0; k < 5; k++) box(g, k * 0.2 + 0.005, y, 0, 0.19, 0.06, 1, k % 2 ? '#c7925a' : '#bd8851');
    return g;
  },
};
