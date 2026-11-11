// Fishing-company buildings, 3 tiers each, modelled on their grid footprint
// (origin = footprint corner with the smallest grid x/y).
import * as THREE from 'three';
import { C, group, box, cyl, sphere, windows, band, door, gable, flatRoof, acUnit, sign, fishBadge, awning, umbrella, pallet, barrel, tree, lamp, fence, flowerbed, bush, bench, crate, cone } from './kit.js';

function pad(g, w, d, col = C.concrete) {
  box(g, 0, 0, 0, w, 0.04, d, col);
  box(g, 0.08, 0.04, 0.08, w - 0.16, 0.005, d - 0.16, '#e2e5e7');
}

export const BUILD = {
  hq(t, W, D) {
    const g = group(); pad(g, W, D);
    // planters & lawn strips
    flowerbed(g, 0.3, D - 0.75, 1.6, 0.45); flowerbed(g, W - 1.9, D - 0.75, 1.6, 0.45);
    if (t >= 2) {
      box(g, 4.6, 0.04, 0.6, 2.0, 1.25, 3.6, C.wall);
      windows(g, '+z', 4.6, 0.04, 0.6, 2.0, 1.25, 3.6, 3, 2);
      windows(g, '+x', 4.6, 0.04, 0.6, 2.0, 1.25, 3.6, 4, 2);
      band(g, 4.6, 1.15, 0.6, 2.0, 0.14, 3.6, C.blue2);
      flatRoof(g, 4.6, 1.29, 0.6, 2.0, 3.6); acUnit(g, 5.2, 1.34, 1.2); acUnit(g, 5.2, 1.34, 2.4);
    }
    const h = 1.7;
    box(g, 0.6, 0.04, 0.5, 4.2, h, 4.2, C.wall);
    windows(g, '+z', 0.6, 0.04, 0.5, 4.2, h, 4.2, 6, 3, { mv: 0.1 });
    windows(g, '+x', 0.6, 0.04, 0.5, 4.2, h, 4.2, 6, 3, { mv: 0.1 });
    band(g, 0.6, h - 0.2, 0.5, 4.2, 0.2, 4.2, C.blue2);
    flatRoof(g, 0.6, h + 0.04, 0.5, 4.2, 4.2);
    // entrance: glass lobby + canopy
    box(g, 1.9, 0.04, 4.7, 1.6, 0.75, 0.35, C.glass, { r: 0.2 });
    box(g, 1.7, 0.79, 4.6, 2.0, 0.08, 0.75, C.blue);
    box(g, 1.75, 0.04, 5.25, 0.06, 0.75, 0.06, C.white); box(g, 3.6, 0.04, 5.25, 0.06, 0.75, 0.06, C.white);
    // flag poles
    for (const [x, col] of [[0.3, C.blue2], [0.6, C.red], [0.9, C.yellow]]) {
      cyl(g, x, 0.04, D - 1.1, 0.02, 1.5, '#e0e0e0', { seg: 6 });
      box(g, x + 0.02, 1.2, D - 1.12, 0.36, 0.22, 0.02, col);
    }
    if (t >= 3) {
      box(g, 1.2, h + 0.04, 1.0, 3.0, 2.6, 3.0, '#cfe3f4');
      windows(g, '+z', 1.2, h + 0.04, 1.0, 3.0, 2.6, 3.0, 5, 6, { mu: 0.05, mv: 0.05, gap: 0.15, glass: '#7cc3f0' });
      windows(g, '+x', 1.2, h + 0.04, 1.0, 3.0, 2.6, 3.0, 5, 6, { mu: 0.05, mv: 0.05, gap: 0.15, glass: '#5ea9e0' });
      flatRoof(g, 1.2, h + 2.64, 1.0, 3.0, 3.0, C.steel2, C.blue);
      // rooftop billboard
      box(g, 1.4, h + 2.7, 3.6, 0.05, 0.5, 0.05, C.dark); box(g, 3.9, h + 2.7, 3.6, 0.05, 0.5, 0.05, C.dark);
      sign(g, '+z', 2.67, h + 3.4, 3.68, 2.9, 0.7, 'FISHING TYCOON', { bg: C.blue, fg: C.yellow, stroke: '#6b3a00' });
      fishBadge(g, '+x', 4.22, h + 2.0, 2.5, 0.55);
    } else {
      sign(g, '+z', 2.7, h - 0.1, 4.72, 2.2, 0.3, 'BAŞ OFİS', { bg: C.blue2 });
      acUnit(g, 1.2, h + 0.09, 1.0); acUnit(g, 2.2, h + 0.09, 1.0); acUnit(g, 3.2, h + 0.09, 1.0);
      if (t >= 2) { box(g, 1.3, h + 0.1, 3.8, 0.05, 0.4, 0.05, C.dark); box(g, 3.7, h + 0.1, 3.8, 0.05, 0.4, 0.05, C.dark); sign(g, '+z', 2.52, h + 0.75, 3.88, 2.7, 0.55, 'FISHING CO.', { bg: C.blue, fg: C.yellow, stroke: '#6b3a00' }); }
    }
    return g;
  },

  factory(t, W, D) {
    const g = group();
    if (t === 0) return site(W, D, 'ZAVOD');
    pad(g, W, D);
    // chimneys (back)
    const chim = (x, z, h) => {
      cyl(g, x, 0.04, z, 0.26, h, C.white, { rt: 0.22 });
      for (let k = 0; k < 3; k++) cyl(g, x, 0.04 + h * (0.25 + k * 0.27), z, 0.255 - k * 0.012, h * 0.12, C.red, { rt: 0.245 - k * 0.012 });
      cyl(g, x, 0.04 + h, z, 0.24, 0.08, C.dark);
    };
    chim(1.0, 0.8, 3.4);
    if (t >= 2) chim(2.0, 0.8, 3.0);
    if (t >= 3) {
      box(g, 0.3, 0.04, 1.5, 2.4, 2.5, 2.2, C.wall2);
      windows(g, '+x', 0.3, 0.04, 1.5, 2.4, 2.5, 2.2, 3, 4, { glass: '#a9dbf6' });
      flatRoof(g, 0.3, 2.54, 1.5, 2.4, 2.2); acUnit(g, 0.8, 2.6, 2.0); acUnit(g, 1.6, 2.6, 2.6);
    }
    if (t >= 2) {
      for (const z of [0.9, 2.4]) {
        cyl(g, W - 0.9, 0.04, z, 0.6, 2.3, C.steel2, { seg: 28 });
        cone(g, W - 0.9, 2.34, z, 0.6, 0.35, C.steel, 28);
        cyl(g, W - 0.9, 0.04 + 1.9, z, 0.605, 0.12, C.blue2, { seg: 28 });
        box(g, W - 1.55, 1.6, z - 0.05, 0.7, 0.1, 0.1, C.steel);
      }
    }
    // main hall
    const hx = 0.4, hz = 3.0, hw = 5.6, hd = 3.4, hh = 1.35;
    box(g, hx, 0.04, hz, hw, hh, hd, C.wall);
    band(g, hx, 0.85, hz, hw, 0.18, hd, C.blue2);
    windows(g, '+z', hx, 1.03, hz, hw, 0.32, hd, 8, 1, { mv: 0.04, gap: 0.2 });
    windows(g, '+x', hx, 1.03, hz, hw, 0.32, hd, 5, 1, { mv: 0.04, gap: 0.2 });
    door(g, '+z', hx, 0.04, hz, hw, hh, hd, 0.4, 1.4, 0.75);
    door(g, '+z', hx, 0.04, hz, hw, hh, hd, 4.2, 5.2, 0.75, '#6f7c89');
    gable(g, hx, hh + 0.04, hz, hw, hd, 0.75, C.blue, 'x', { ribs: 26 });
    fishBadge(g, '+x', hx + hw + 0.14, hh + 0.33, hz + hd / 2, 0.3);
    sign(g, '+z', hx + 2.8, 0.55, hz + hd + 0.03, 1.8, 0.36, 'EMAL', { bg: C.red });
    // extension hall (tier 2+) to the right
    if (t >= 2) {
      box(g, hx + hw, 0.04, hz + 0.4, 1.6, 1.05, hd - 0.4, C.wall2);
      windows(g, '+x', hx + hw, 0.3, hz + 0.4, 1.6, 0.6, hd - 0.4, 3, 1);
      gable(g, hx + hw, 1.09, hz + 0.4, 1.6, hd - 0.4, 0.4, C.blue2, 'z', { ribs: 10 });
    }
    // yard: pallets, barrels, forklift-free loading area
    pallet(g, 0.3, D - 0.6, 'prod', 2); pallet(g, 0.9, D - 0.6, 'prod', 1);
    barrel(g, W - 0.4, D - 0.4, C.blue2); barrel(g, W - 0.7, D - 0.35, C.red);
    lamp(g, W - 0.25, 2.8);
    return g;
  },

  warehouse(t, W, D) {
    const g = group(); pad(g, W, D);
    const x = t >= 2 ? 0.3 : 0.8, z = 0.6, w = t >= 2 ? 6.6 : 5.2, d = t >= 2 ? 4.4 : 4.0, h = t >= 3 ? 1.35 : 1.2;
    if (t >= 3) {
      box(g, x + w, 0.04, 1.8, 0.9, 0.9, 2.6, C.wall);
      windows(g, '+x', x + w, 0.04, 1.8, 0.9, 0.9, 2.6, 3, 1, { mv: 0.3 });
      flatRoof(g, x + w, 0.94, 1.8, 0.9, 2.6);
    }
    box(g, x, 0.04, z, w, h, d, '#e3e8ed');
    // corrugated walls
    const n = Math.round(w * 8), m = Math.round(d * 8), rib = '#c8d1d9';
    for (let k = 1; k < n; k++) box(g, x + w * k / n - 0.01, 0.04, z + d, 0.02, h, 0.015, rib);
    for (let k = 1; k < m; k++) box(g, x + w, 0.04, z + d * k / m - 0.01, 0.015, h, 0.02, rib);
    band(g, x, h - 0.12, z, w, 0.16, d, C.blue2);
    const doors = t >= 2 ? 3 : 2;
    for (let k = 0; k < doors; k++) {
      const u0 = 0.4 + k * ((w - 0.8) / doors), u1 = u0 + (w - 0.8) / doors - 0.35;
      door(g, '+z', x, 0.04, z, w, h, d, u0, u1, 0.82, '#7c8996');
      box(g, x + u0 - 0.05, 0.86, z + d, u1 - u0 + 0.1, 0.05, 0.05, C.yellow);
    }
    windows(g, '+x', x, 0.55, z, w, 0.4, d, 4, 1, { mv: 0.05 });
    gable(g, x, h + 0.04, z, w, d, 0.6, C.blue, 'x', { ribs: Math.round(w * 5) });
    sign(g, '+z', x + w / 2, h - 0.04, z + d + 0.04, 1.6, 0.26, 'ANBAR', { bg: C.blue2 });
    if (t >= 3) for (let k = 0; k < 3; k++) box(g, x + 0.8 + k * 2, h + 0.36, z + d * 0.55, 0.9, 0.04, 0.8, '#bfe6ff', { r: 0.2 });
    // loading dock + canopy
    box(g, x, 0.04, z + d, w, 0.18, 0.5, C.concrete);
    box(g, x, 0.9, z + d, w, 0.04, 0.55, '#c2cad2');
    pallet(g, W - 0.65, D - 0.7, 'raw', 2);
    return g;
  },

  market(t, W, D) {
    const g = group(); pad(g, W, D, '#e6dfd0');
    const two = t >= 3;
    const x = t >= 2 ? 0.3 : 0.8, w = t >= 2 ? 6.2 : 5.0, z = 0.4, d = 2.8, h = two ? 1.55 : 1.0;
    box(g, x, 0.04, z, w, h, d, C.cream);
    windows(g, '+z', x, 0.04, z, w, two ? 0.75 : h, d, t >= 2 ? 6 : 5, 1, { mv: 0.12, gap: 0.12, glass: '#ffe9a8', lit: true });
    if (two) windows(g, '+z', x, 0.8, z, w, 0.7, d, 6, 1, { mv: 0.1, gap: 0.2 });
    windows(g, '+x', x, 0.3, z, w, 0.55, d, 3, 1);
    gable(g, x, h + 0.04, z, w, d, 0.55, C.blue, 'x', { ribs: Math.round(w * 4) });
    awning(g, '+z', x + 0.05, x + w - 0.05, z + d, two ? 0.85 : 0.82, 0.55, C.red, C.white, t >= 2 ? 14 : 10);
    box(g, x + w / 2 - 1.2, h - 0.05, z + d + 0.02, 2.4, 0.4, 0.05, C.blue2);
    sign(g, '+z', x + w / 2, h + 0.15, z + d + 0.06, 2.3, 0.34, 'BALIQ BAZARI', { bg: C.blue2 });
    if (two) {
      const fish = new THREE.Group();
      sphere(fish, 0, 0, 0, 0.45, C.blue2, { sy: 0.6 });
      cone(fish, -0.62, -0.25, 0, 0.3, 0.5, C.blue2, 6).rotation.z = Math.PI / 2;
      sphere(fish, 0.28, 0.08, 0.36, 0.07, C.white, { seg: 8 });
      fish.position.set(x + w / 2, h + 1.0, z + d / 2); fish.rotation.y = -0.6; g.add(fish);
      cyl(g, x + w / 2, h + 0.55, z + d / 2, 0.05, 0.3, C.dark, { seg: 6 });
    }
    // forecourt stalls with ice & fish
    const stall = (sx, sz, cols) => {
      box(g, sx, 0.04, sz, 0.9, 0.42, 0.5, C.wood); box(g, sx + 0.04, 0.46, sz + 0.04, 0.82, 0.05, 0.42, '#eaf6ff');
      for (let k = 0; k < 6; k++) sphere(g, sx + 0.15 + (k % 3) * 0.28, 0.53, sz + 0.13 + Math.floor(k / 3) * 0.2, 0.09, cols[k % cols.length], { sy: 0.45, seg: 8 });
    };
    stall(x + 0.3, D - 1.6, ['#8fbde6', '#e98a6b']); stall(x + 1.5, D - 1.6, ['#f2a35b', '#c6d4dd']);
    if (t >= 2) { stall(x + 4.0, D - 1.6, ['#e86f6f', '#9fd0f0']); umbrella(g, x + 5.5, D - 1.0, C.blue2); }
    umbrella(g, x + 3.0, D - 1.0, C.red);
    if (two) { umbrella(g, x + 0.2, D - 0.5, C.green); stall(x + 2.7, D - 0.9, ['#9ec9ee', '#f2a35b']); }
    bench(g, W - 0.6, 0.6, 'z'); bush(g, W - 0.35, 1.6); bush(g, 0.25, 0.4);
    return g;
  },

  harbor(t, W, D) {
    const g = group(); pad(g, W, D, '#d9d2c3');
    if (t >= 2) {
      cyl(g, 3.2, 0.04, 0.8, 0.42, 2.0, C.wall, { seg: 16 });
      cyl(g, 3.2, 2.04, 0.8, 0.5, 0.45, C.glass, { seg: 16, r: 0.2 });
      cone(g, 3.2, 2.49, 0.8, 0.55, 0.3, C.blue, 16);
      if (t >= 3) { cyl(g, 3.2, 2.79, 0.8, 0.03, 0.35, C.dark, { seg: 6 }); box(g, 3.0, 3.1, 0.75, 0.4, 0.06, 0.1, C.red); }
    }
    box(g, 0.4, 0.04, 0.5, 2.6, 1.0, 2.4, C.wall);
    windows(g, '+z', 0.4, 0.04, 0.5, 2.6, 1.0, 2.4, 3, 1, { mv: 0.3 });
    windows(g, '+x', 0.4, 0.04, 0.5, 2.6, 1.0, 2.4, 2, 1, { mv: 0.3 });
    band(g, 0.4, 0.84, 0.5, 2.6, 0.14, 2.4, C.blue2);
    gable(g, 0.4, 1.04, 0.5, 2.6, 2.4, 0.55, C.blue, 'z', { ribs: 12 });
    sign(g, '+z', 1.7, 0.86, 2.95, 1.6, 0.24, 'LİMAN', { bg: C.navy });
    // life rings & ropes, barrels
    cyl(g, 3.3, 0.04, D - 0.6, 0.15, 0.25, C.blue2, { seg: 12 }); barrel(g, 3.6, D - 0.35, C.red); barrel(g, 3.35, D - 0.25, C.yellow);
    if (t >= 3) for (const [x, col] of [[0.2, C.red], [0.45, C.blue2]]) { cyl(g, x, 0.04, D - 0.3, 0.02, 1.4, '#e0e0e0', { seg: 6 }); box(g, x + 0.02, 1.15, D - 0.32, 0.3, 0.2, 0.02, col); }
    return g;
  },

  farm(t, W, D) { return site(W, D, 'FERMA'); },

  // decorative town buildings (2.5 × 2.5 tiles)
  cafe() {
    const g = group(); pad(g, 2.5, 2.5, '#e6dfd0');
    box(g, 0.25, 0.04, 0.25, 1.9, 0.85, 1.4, '#fff4dc');
    windows(g, '+z', 0.25, 0.04, 0.25, 1.9, 0.6, 1.4, 3, 1, { mv: 0.1, gap: 0.15, glass: '#ffe9a8', lit: true });
    windows(g, '+x', 0.25, 0.3, 0.25, 1.9, 0.45, 1.4, 2, 1);
    gable(g, 0.25, 0.89, 0.25, 1.9, 1.4, 0.4, C.red, 'x', { ribs: 8 });
    awning(g, '+z', 0.3, 2.1, 1.65, 0.7, 0.35, '#2fa34a', C.white, 8);
    sign(g, '+z', 1.2, 0.98, 1.68, 1.1, 0.2, 'KAFE', { bg: '#2fa34a' });
    for (const x of [0.5, 1.4]) { cyl(g, x, 0.04, 2.1, 0.16, 0.02, C.white, { seg: 12 }); cyl(g, x, 0.04, 2.1, 0.02, 0.28, C.dark, { seg: 6 }); cyl(g, x, 0.3, 2.1, 0.17, 0.02, C.white, { seg: 12 }); }
    umbrella(g, 2.1, 2.1, '#2fa34a', 0.6);
    return g;
  },
  shed() {
    const g = group(); pad(g, 2.5, 2.5);
    box(g, 0.2, 0.04, 0.3, 2.1, 0.9, 1.7, '#d9e0e6');
    door(g, '+z', 0.2, 0.04, 0.3, 2.1, 0.9, 1.7, 0.3, 1.5, 0.7, '#8696a5');
    windows(g, '+x', 0.2, 0.4, 0.3, 2.1, 0.4, 1.7, 2, 1);
    gable(g, 0.2, 0.94, 0.3, 2.1, 1.7, 0.45, '#d8743a', 'x', { ribs: 10 });
    sign(g, '+z', 1.75, 0.8, 2.02, 0.8, 0.16, 'TƏMİR', { bg: C.navy });
    barrel(g, 2.25, 2.25, C.blue2); pallet(g, 0.2, 2.0, 'prod', 1);
    return g;
  },
  icehouse() {
    const g = group(); pad(g, 2.5, 2.5);
    box(g, 0.25, 0.04, 0.25, 2.0, 1.1, 1.8, C.white);
    band(g, 0.25, 0.9, 0.25, 2.0, 0.16, 1.8, C.teal);
    door(g, '+z', 0.25, 0.04, 0.25, 2.0, 1.1, 1.8, 0.5, 1.3, 0.75, '#a9c4d6');
    windows(g, '+x', 0.25, 0.5, 0.25, 2.0, 0.35, 1.8, 2, 1);
    flatRoof(g, 0.25, 1.14, 0.25, 2.0, 1.8); acUnit(g, 0.6, 1.19, 0.6); acUnit(g, 1.3, 1.19, 0.6);
    sign(g, '+z', 1.25, 0.98, 2.07, 1.2, 0.16, 'SOYUDUCU', { bg: C.teal });
    return g;
  },
};

function site(W, D, label) {
  const g = group();
  box(g, 0, 0, 0, W, 0.04, D, '#c9a777');
  for (let k = 0; k < 12; k++) sphere(g, 0.6 + (k * 37 % 61) / 61 * (W - 1.2), 0.04, 0.6 + (k * 23 % 47) / 47 * (D - 1.2), 0.25, '#b8925f', { sy: 0.2, seg: 8 });
  fence(g, 0.05, D - 0.05, W - 0.05, D - 0.05, C.orange); fence(g, W - 0.05, 0.05, W - 0.05, D - 0.05, C.orange);
  fence(g, 0.05, 0.05, W - 0.05, 0.05, C.orange); fence(g, 0.05, 0.05, 0.05, D - 0.05, C.orange);
  box(g, 0.8, 0.04, 0.8, 1.2, 0.35, 0.7, C.wood); box(g, 0.9, 0.39, 0.9, 1.0, 0.3, 0.5, '#c08447');
  cyl(g, W - 1.6, 0.04, 1.5, 0.5, 0.4, '#9a8f84', { rt: 0.2 });
  for (let k = 0; k < 4; k++) cone(g, 1.2 + k * 0.5, 0.04, D - 1.2, 0.08, 0.25, C.orange, 8);
  cyl(g, W / 2 - 0.4, 0.04, D / 2, 0.04, 0.8, C.wood2, { seg: 6 }); cyl(g, W / 2 + 0.4, 0.04, D / 2, 0.04, 0.8, C.wood2, { seg: 6 });
  sign(g, '+z', W / 2, 0.95, D / 2 + 0.03, 1.4, 0.45, '🔒 ' + label, { bg: '#3b4a5a' });
  return g;
}
