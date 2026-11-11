// Fishing-company buildings, 3 tiers each, modelled on their grid footprint
// (origin = footprint corner with the smallest grid x/y). Front faces are +z
// (grid +y, screen lower-left) and +x (screen lower-right).
import * as THREE from 'three';
import {
  C, mat, group, box, cyl, sphere, cone, windows, band, door, gable, flatRoof, acUnit, sign, fishBadge, awning, umbrella,
  pallet, barrel, lamp, fence, flowerbed, bush, bench, crate, roofVent, duct, pipe, skylight, dish, railing, solar, downpipe,
  planter, billboard, fishBoxStack, container, netPile,
} from './kit.js';

function pad(g, w, d, col = C.concrete) {
  box(g, 0, 0, 0, w, 0.04, d, col);
  box(g, 0.1, 0.04, 0.1, w - 0.2, 0.004, d - 0.2, '#e4e7e9');
}
// Parked box truck (decor), along x or z, origin at its min corner.
export function boxTruck(g, x, z, axis = 'x', col = C.blue) {
  const L = 1.5, Wd = 0.55, alongX = axis === 'x';
  const B = (u0, u1, v0, v1, y, h, c) => alongX ? box(g, x + u0, y, z + v0, u1 - u0, h, v1 - v0, c) : box(g, x + v0, y, z + u0, v1 - v0, h, u1 - u0, c);
  for (const u of [0.25, 0.6, 1.25]) for (const v of [0.02, Wd - 0.1]) B(u, u + 0.16, v, v + 0.08, 0, 0.16, '#222');
  B(0, 1.05, 0, Wd, 0.1, 0.62, C.white);
  B(0.02, 1.03, -0.005, Wd + 0.005, 0.32, 0.12, col);
  B(1.08, L, 0.02, Wd - 0.02, 0.1, 0.45, col);
  B(1.3, L + 0.005, 0.07, Wd - 0.07, 0.33, 0.16, '#9fd8fb');
  const f = alongX ? '+z' : '+x';
  fishBadge(g, f, alongX ? x + 0.55 : x + Wd + 0.008, 0.45, alongX ? z + Wd + 0.008 : z + 0.55, 0.15, C.white, col);
}

export const BUILD = {
  // ---------------------------------------------------------------- HQ (8×8)
  hq(t, W, D) {
    const g = group(); pad(g, W, D);
    // plaza: planters, flags, benches
    for (const x of [0.3, 1.0, 1.7]) { cyl(g, x, 0.04, D - 0.4, 0.02, 1.7, '#e6e6e6', { seg: 6 }); }
    box(g, 0.32, 1.42, D - 0.42, 0.42, 0.26, 0.02, C.blue2); box(g, 1.02, 1.42, D - 0.42, 0.42, 0.26, 0.02, C.red); box(g, 1.72, 1.42, D - 0.42, 0.42, 0.26, 0.02, C.yellow);
    planter(g, 3.0, D - 0.55, 1.2); planter(g, 5.4, D - 0.55, 1.2); bench(g, 4.35, D - 0.5, 'x');
    flowerbed(g, W - 1.5, 4.6, 1.2, 1.4);
    // side wing (tier 1 already, grows with tiers)
    const wingH = t >= 2 ? 1.6 : 1.1;
    box(g, 5.3, 0.04, 0.6, 2.2, wingH, 3.6, C.wall);
    windows(g, '+x', 5.3, 0.04, 0.6, 2.2, wingH, 3.6, 5, t >= 2 ? 3 : 2, { mv: 0.08 });
    windows(g, '+z', 5.3, 0.04, 0.6, 2.2, wingH, 3.6, 4, t >= 2 ? 3 : 2, { mv: 0.08 });
    band(g, 5.3, wingH - 0.14, 0.6, 2.2, 0.14, 3.6, C.navy);
    flatRoof(g, 5.3, wingH + 0.04, 0.6, 2.2, 3.6);
    acUnit(g, 5.6, wingH + 0.09, 1.0); acUnit(g, 6.3, wingH + 0.09, 1.0); roofVent(g, 6.9, wingH + 0.09, 3.6); solar(g, 5.5, wingH + 0.09, 2.0, 4, 3);
    // main block with glass curtain wall
    const h = 2.2;
    box(g, 0.5, 0.04, 0.5, 4.8, h, 4.6, '#f4f6f9');
    windows(g, '+z', 0.5, 0.04, 0.5, 4.8, h, 4.6, 8, 4, { mu: 0.08, mv: 0.06, gap: 0.12, glass: '#6fb9ee', frame: '#e8f0f8' });
    windows(g, '+x', 0.5, 0.04, 0.5, 4.8, h, 4.6, 8, 4, { mu: 0.08, mv: 0.06, gap: 0.12, glass: '#5aa6e0', frame: '#e8f0f8' });
    for (let k = 0; k <= 4; k++) box(g, 0.5 + k * 1.2 - 0.04, 0.04, 5.1, 0.08, h, 0.05, C.white);    // pilasters
    band(g, 0.5, h - 0.22, 0.5, 4.8, 0.22, 4.6, C.blue);
    flatRoof(g, 0.5, h + 0.04, 0.5, 4.8, 4.6);
    railing(g, 0.6, 5.0, 5.2, 5.0, h + 0.18); railing(g, 5.2, 0.6, 5.2, 5.0, h + 0.18);
    // entrance atrium
    box(g, 1.6, 0.04, 5.1, 2.2, 1.1, 0.7, '#a8dcfb', { r: 0.15 });
    for (let k = 0; k <= 4; k++) box(g, 1.6 + k * 0.55 - 0.02, 0.04, 5.8, 0.04, 1.1, 0.03, C.white);
    box(g, 1.4, 1.14, 5.0, 2.6, 0.1, 1.1, C.blue);
    sign(g, '+z', 2.7, 1.32, 6.11, 2.2, 0.26, 'BAŞ OFİS', { bg: C.blue });
    if (t >= 3) {
      // glass tower
      box(g, 1.1, h + 0.04, 1.0, 3.2, 3.0, 3.2, '#cfe3f4');
      windows(g, '+z', 1.1, h + 0.04, 1.0, 3.2, 3.0, 3.2, 6, 8, { mu: 0.04, mv: 0.04, gap: 0.12, glass: '#79c2f1' });
      windows(g, '+x', 1.1, h + 0.04, 1.0, 3.2, 3.0, 3.2, 6, 8, { mu: 0.04, mv: 0.04, gap: 0.12, glass: '#4f9ad8' });
      flatRoof(g, 1.1, h + 3.04, 1.0, 3.2, 3.2, C.steel2, C.blue);
      cyl(g, 2.7, h + 3.1, 2.6, 0.9, 0.04, '#4b535c', { seg: 24 }); sign(g, '+z', 2.7, h + 3.15, 2.6, 0.01, 0.01, ' ');
      box(g, 2.2, h + 3.14, 2.55, 1.0, 0.012, 0.1, C.yellow); box(g, 2.65, h + 3.14, 2.1, 0.1, 0.012, 1.0, C.yellow);
      billboard(g, 2.7, h + 3.08, 3.9, 3.4, 0.75, 'FISHING TYCOON');
      dish(g, 1.5, h + 3.08, 1.4);
    } else {
      acUnit(g, 1.0, h + 0.09, 0.9); acUnit(g, 1.8, h + 0.09, 0.9); roofVent(g, 3.0, h + 0.09, 1.0); roofVent(g, 3.5, h + 0.09, 1.0); dish(g, 4.5, h + 0.09, 1.2);
      billboard(g, 2.9, h + 0.08, 3.7, t >= 2 ? 3.2 : 2.8, t >= 2 ? 0.7 : 0.6, 'FISHING CO.');
    }
    return g;
  },

  // ----------------------------------------------------------- factory (9×8)
  factory(t, W, D) {
    if (t === 0) return frameSite(W, D, 'ZAVOD');
    const g = group(); pad(g, W, D);
    const chim = (x, z, hgt) => {
      cyl(g, x, 0.04, z, 0.3, hgt, C.white, { rt: 0.24, seg: 20 });
      const r = f => 0.3 - 0.06 * f + 0.008;
      for (let k = 0; k < 3; k++) { const f0 = 0.3 + k * 0.25, f1 = f0 + 0.11; cyl(g, x, 0.04 + hgt * f0, z, r(f0), hgt * 0.11, C.red, { rt: r(f1), seg: 20 }); }
      cyl(g, x, 0.04 + hgt, z, 0.26, 0.1, C.dark, { seg: 20 });
      for (let y = 0.3; y < hgt - 0.2; y += 0.18) box(g, x + 0.24 + (y / hgt) * -0.06, y, z - 0.03, 0.02, 0.02, 0.06, C.dark);   // ladder rungs
    };
    chim(1.0, 0.9, 3.9);
    if (t >= 2) chim(2.1, 0.9, 3.3);
    // storage tanks
    const tank = (x, z, r, hh, col = C.steel2) => {
      cyl(g, x, 0.04, z, r, hh, col, { seg: 28 }); cone(g, x, 0.04 + hh, z, r, 0.3, C.steel, 28);
      cyl(g, x, 0.04 + hh * 0.8, z, r + 0.01, 0.1, C.blue2, { seg: 28 });
      railing(g, x - r, z + r, x + r, z + r, hh + 0.05, C.yellow);
    };
    tank(W - 0.8, 1.0, 0.55, 2.0);
    if (t >= 2) { tank(W - 0.8, 2.4, 0.55, 2.0); pipe(g, W - 2.4, 1.6, 1.7, 1.2, 'x', 0.06); pipe(g, W - 2.4, 1.75, 1.0, 1.2, 'x', 0.05, '#f2c230'); }
    if (t >= 3) {
      box(g, 0.3, 0.04, 1.6, 2.4, 2.9, 2.0, C.wall2);
      windows(g, '+x', 0.3, 0.04, 1.6, 2.4, 2.9, 2.0, 3, 5, { glass: '#a9dbf6' });
      flatRoof(g, 0.3, 2.94, 1.6, 2.4, 2.0); roofVent(g, 0.8, 2.99, 2.0); roofVent(g, 1.4, 2.99, 2.0); acUnit(g, 1.8, 2.99, 2.6);
      billboard(g, 1.5, 2.98, 3.2, 2.0, 0.5, 'FISH CO.', { bg: C.red, fg: C.white, stroke: '#6b0000' });
    }
    // main hall with sawtooth roof
    const hx = 0.3, hz = 3.4, hw = 6.4, hd = 3.8, hh = 1.4;
    box(g, hx, 0.04, hz, hw, hh, hd, C.wall);
    band(g, hx, 0.9, hz, hw, 0.2, hd, C.blue2);
    windows(g, '+z', hx, 1.1, hz, hw, 0.3, hd, 9, 1, { mv: 0.04, gap: 0.2 });
    windows(g, '+x', hx, 1.1, hz, hw, 0.3, hd, 5, 1, { mv: 0.04, gap: 0.2 });
    door(g, '+z', hx, 0.04, hz, hw, hh, hd, 0.4, 1.5, 0.8);
    door(g, '+z', hx, 0.04, hz, hw, hh, hd, 4.7, 5.8, 0.8, '#6f7c89');
    door(g, '+x', hx, 0.04, hz, hw, hh, hd, 1.2, 2.4, 0.75);
    for (let k = 0; k < 4; k++) {                           // sawtooth bays: glazing faces −z, slope to +z
      const z0 = hz + k * hd / 4, dd = hd / 4;
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(dd, 0); s.lineTo(0, 0.5); s.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: hw, bevelEnabled: false }), [mat(C.white), mat(C.blue)]);
      m.rotation.y = -Math.PI / 2; m.position.set(hx + hw, hh + 0.04, z0); g.add(m);
      box(g, hx + 0.05, hh + 0.06, z0 + 0.01, hw - 0.1, 0.4, 0.03, '#8fd0f5', { r: 0.2 });
    }
    for (let k = 0; k < 6; k++) roofVent(g, hx + 0.6 + k * 1.0, hh + 0.3, hz + hd - 0.3);
    // facade ductwork & downpipes
    duct(g, hx + 2.0, 1.55, hz + hd + 0.05, 2.4, 'x', C.steel2, 0.16);
    duct(g, hx + 4.3, 0.04, hz + hd + 0.05, 1.67, 'y', C.steel2, 0.16);
    pipe(g, hx + hw + 0.08, 1.2, hz + 0.2, hd - 0.4, 'z', 0.05, '#f2c230');
    for (const z of [hz + 0.3, hz + hd - 0.3]) downpipe(g, hx + hw + 0.02, 0.04, z, 1.35);
    fishBadge(g, '+x', hx + hw + 0.06, 0.6, hz + hd / 2 + 0.4, 0.32);
    sign(g, '+z', hx + 3.1, 0.6, hz + hd + 0.03, 2.4, 0.38, 'EMAL ZAVODU', { bg: C.red });
    if (t >= 2) {                                         // annex
      box(g, hx + hw, 0.04, hz + 0.5, 1.9, 1.1, hd - 0.5, C.wall2);
      windows(g, '+x', hx + hw, 0.3, hz + 0.5, 1.9, 0.6, hd - 0.5, 4, 1);
      gable(g, hx + hw, 1.14, hz + 0.5, 1.9, hd - 0.5, 0.4, C.blue2, 'z', { ribs: 12 });
    }
    // yard
    pallet(g, 0.3, D - 0.6, 'prod', 3); pallet(g, 0.9, D - 0.6, 'prod', 2); pallet(g, 1.5, D - 0.6, 'prod', 1);
    barrel(g, W - 0.4, D - 0.5, C.blue2); barrel(g, W - 0.7, D - 0.4, C.red); barrel(g, W - 0.55, D - 0.25, C.yellow);
    return g;
  },

  // -------------------------------------------------------- warehouse (10×8)
  warehouse(t, W, D) {
    const g = group(); pad(g, W, D);
    const x = 0.3, z = 0.4, w = t >= 2 ? 8.3 : 7.6, d = 5.4, h = t >= 3 ? 1.7 : 1.5;
    // office annex with glass
    const ow = W - x - w - 0.1;
    box(g, x + w, 0.04, 2.6, ow, 1.1, 2.8, C.wall);
    windows(g, '+x', x + w, 0.04, 2.6, ow, 1.1, 2.8, 4, 2, { glass: '#6fb9ee' });
    windows(g, '+z', x + w, 0.04, 2.6, ow, 1.1, 2.8, 2, 2, { glass: '#6fb9ee' });
    flatRoof(g, x + w, 1.14, 2.6, ow, 2.8); acUnit(g, x + w + 0.3, 1.19, 3.0);
    // main shed
    box(g, x, 0.04, z, w, h, d, '#e3e8ed');
    const n = Math.round(w * 8), m = Math.round(d * 8), rib = '#c3ccd5';
    for (let k = 1; k < n; k++) box(g, x + w * k / n - 0.01, 0.04, z + d, 0.02, h, 0.015, rib);
    for (let k = 1; k < m; k++) box(g, x + w, 0.04, z + d * k / m - 0.01, 0.015, h, 0.02, rib);
    band(g, x, h - 0.16, z, w, 0.2, d, C.blue);
    const doors = t >= 2 ? 4 : 3;
    for (let k = 0; k < doors; k++) {
      const u0 = 0.4 + k * ((w - 0.8) / doors), u1 = u0 + (w - 0.8) / doors - 0.4;
      door(g, '+z', x, 0.04, z, w, h, d, u0, u1, 0.9, '#7c8996');
      box(g, x + u0 - 0.06, 0.94, z + d, u1 - u0 + 0.12, 0.06, 0.06, C.yellow);
      box(g, x + u0, 0.04, z + d, u1 - u0, 0.2, 0.25, '#2b2f35');      // dock bumper
    }
    windows(g, '+x', x, 0.75, z, w, 0.4, d, 5, 1, { mv: 0.05 });
    gable(g, x, h + 0.04, z, w, d, 0.75, C.blue, 'x', { ribs: Math.round(w * 6) });
    for (let k = 0; k < 4; k++) skylight(g, x + 0.6 + k * (w - 1.2) / 4, h + 0.42, z + d * 0.62, 0.9, 0.06);
    for (let k = 0; k < 4; k++) roofVent(g, x + 0.9 + k * (w - 1.6) / 3, h + 0.79, z + d / 2);
    billboard(g, x + w / 2, h + 0.5, z + d * 0.55, t >= 2 ? 3.2 : 2.6, 0.55, 'ANBAR');
    // loading apron & canopy
    box(g, x, 0.04, z + d, w, 0.22, 0.6, C.concrete);
    box(g, x, 1.05, z + d, w, 0.05, 0.7, '#c2cad2');
    for (let k = 0; k <= 4; k++) box(g, x + k * w / 4 - 0.03, 0.26, z + d + 0.64, 0.05, 0.8, 0.05, C.steel);
    // yard: truck, pallets, fish-box stacks
    boxTruck(g, x + 0.6, D - 0.95, 'x', C.blue);
    if (t >= 2) boxTruck(g, x + 2.8, D - 0.95, 'x', C.red);
    pallet(g, W - 1.4, D - 0.7, 'raw', 3); pallet(g, W - 0.8, D - 0.7, 'raw', 2);
    fishBoxStack(g, W - 1.2, 0.5, 2, 3, 3);
    return g;
  },

  // ------------------------------------------------------------ market (8×8)
  market(t, W, D) {
    const g = group(); pad(g, W, D, '#e9e1cf');
    const two = t >= 3;
    const x = 0.3, w = t >= 2 ? 7.4 : 6.8, z = 0.3, d = 4.4, h = two ? 1.75 : 1.3;
    box(g, x, 0.04, z, w, h, d, C.cream);
    // glass shopfront
    windows(g, '+z', x, 0.04, z, w, two ? 0.9 : h - 0.1, d, t >= 2 ? 8 : 7, 1, { mv: 0.08, gap: 0.08, glass: '#ffe7a3', lit: true });
    if (two) windows(g, '+z', x, 0.95, z, w, 0.75, d, 8, 1, { mv: 0.1, gap: 0.18 });
    windows(g, '+x', x, 0.35, z, w, 0.6, d, 4, 1);
    gable(g, x, h + 0.04, z, w, d, 0.7, C.blue, 'x', { ribs: Math.round(w * 5) });
    // central entrance gable with big sign
    const ex = x + w / 2 - 0.9;
    box(g, ex, 0.04, z + d, 1.8, h + 0.3, 0.35, C.white);
    box(g, ex + 0.3, 0.04, z + d + 0.35, 1.2, 0.9, 0.02, '#8fd0f5', { r: 0.2 });
    gable(g, ex, h + 0.34, z + d - 0.2, 1.8, 0.75, 0.45, C.red, 'z', { trimCol: C.white });
    sign(g, '+z', x + w / 2, h + 0.06, z + d + 0.37, 1.7, 0.36, 'BALIQ BAZARI', { bg: C.blue });
    awning(g, '+z', x + 0.05, ex - 0.05, z + d, 0.95, 0.6, C.red, C.white, 8);
    awning(g, '+z', ex + 1.85, x + w - 0.05, z + d, 0.95, 0.6, t >= 2 ? C.blue2 : C.red, C.white, 8);
    // giant fish on the roof
    if (t >= 2) {
      const fish = new THREE.Group();
      sphere(fish, 0, 0, 0, 0.6, C.blue2, { sy: 0.55, seg: 16 });
      sphere(fish, 0.1, -0.08, 0, 0.5, '#cfe9ff', { sy: 0.35, seg: 14 });
      const tail = cone(fish, -0.8, -0.3, 0, 0.35, 0.6, C.blue2, 6); tail.rotation.z = Math.PI / 2;
      sphere(fish, 0.38, 0.1, 0.3, 0.09, C.white, { seg: 8 }); sphere(fish, 0.42, 0.1, 0.36, 0.045, '#111', { seg: 6 });
      fish.position.set(x + w / 2, h + 1.3, z + d / 2); fish.rotation.y = -0.5; g.add(fish);
      cyl(g, x + w / 2, h + 0.5, z + d / 2, 0.06, 0.5, C.dark, { seg: 8 });
    }
    roofVent(g, x + 0.8, h + 0.4, z + 0.9); roofVent(g, x + w - 0.8, h + 0.4, z + 0.9);
    // stalls & umbrellas in rows
    const stall = (sx, sz, cols) => {
      box(g, sx, 0.04, sz, 0.85, 0.42, 0.5, C.wood); box(g, sx + 0.04, 0.46, sz + 0.04, 0.77, 0.05, 0.42, '#eaf6ff');
      for (let k = 0; k < 6; k++) sphere(g, sx + 0.15 + (k % 3) * 0.27, 0.53, sz + 0.13 + Math.floor(k / 3) * 0.2, 0.09, cols[k % cols.length], { sy: 0.45, seg: 8 });
    };
    const cols = [['#8fbde6', '#e98a6b'], ['#f2a35b', '#c6d4dd'], ['#e86f6f', '#9fd0f0'], ['#9ec9ee', '#f2a35b']];
    const n = t >= 2 ? 6 : 5;
    for (let k = 0; k < n; k++) stall(0.4 + k * 1.15, D - 2.15, cols[k % 4]);
    for (let k = 0; k < n; k += 2) umbrella(g, 0.85 + k * 1.15, D - 1.15, [C.red, C.blue2, C.green][k / 2 % 3], 0.85);
    if (two) for (let k = 0; k < 4; k++) stall(1.4 + k * 1.5, D - 0.95, cols[(k + 1) % 4]);
    fishBoxStack(g, W - 0.7, D - 2.1, 2, 2, 2);
    return g;
  },

  // ----------------------------------------------------- harbour office (3×5)
  harbor(t, W, D) {
    const g = group(); pad(g, W, D, '#d9d2c3');
    box(g, 0.25, 0.04, 0.4, 2.5, 1.2, 2.6, C.wall);
    windows(g, '+z', 0.25, 0.04, 0.4, 2.5, 1.2, 2.6, 3, 2, { mv: 0.12 });
    windows(g, '+x', 0.25, 0.04, 0.4, 2.5, 1.2, 2.6, 3, 2, { mv: 0.12 });
    band(g, 0.25, 1.02, 0.4, 2.5, 0.16, 2.6, C.navy);
    gable(g, 0.25, 1.24, 0.4, 2.5, 2.6, 0.55, C.blue, 'z', { ribs: 14 });
    sign(g, '+z', 1.5, 1.08, 3.01, 1.6, 0.24, 'LİMAN', { bg: C.navy });
    fishBadge(g, '+x', 2.76, 0.75, 1.7, 0.22, C.white, C.navy);
    // control tower
    const th = t >= 2 ? 2.6 : 2.0;
    cyl(g, 1.5, 0.04, 3.6, 0.42, th, C.white, { seg: 18 });
    cyl(g, 1.5, 0.04 + th * 0.45, 3.6, 0.425, 0.12, C.red, { seg: 18 });
    cyl(g, 1.5, 0.04 + th, 3.6, 0.55, 0.4, '#8fd0f5', { seg: 18, r: 0.2 });
    cone(g, 1.5, 0.44 + th, 3.6, 0.6, 0.3, C.blue, 18);
    railing(g, 0.95, 4.15, 2.05, 4.15, th + 0.05, C.white);
    if (t >= 2) { cyl(g, 1.5, 0.74 + th, 3.6, 0.03, 0.4, C.dark, { seg: 6 }); box(g, 1.25, 1.12 + th, 3.55, 0.5, 0.06, 0.1, C.red); }
    if (t >= 3) dish(g, 0.7, 1.3, 1.0);
    // life ring stand, barrels, flags
    cyl(g, 2.75, 0.04, D - 0.4, 0.15, 0.25, '#f28c28', { seg: 12 }); barrel(g, 2.6, D - 0.15, C.red); barrel(g, 0.3, D - 0.25, C.blue2);
    for (const [x, col] of [[0.2, C.red], [0.45, C.blue2]]) { cyl(g, x, 0.04, 3.3, 0.02, 1.4, '#e0e0e0', { seg: 6 }); box(g, x + 0.02, 1.15, 3.28, 0.3, 0.2, 0.02, col); }
    return g;
  },

  // ---------------------------------------------------- fish farm site (9×8)
  farm(t, W, D) {
    const g = group();
    box(g, 0, 0, 0, W, 0.04, D, '#c9a777');
    // excavated pools (empty, waiting for stage 3)
    for (const [px, pz] of [[0.6, 0.6], [4.8, 0.6], [0.6, 4.2], [4.8, 4.2]]) {
      box(g, px, 0.04, pz, 3.6, 0.12, 3.0, '#b9bec3');
      box(g, px + 0.15, 0.1, pz + 0.15, 3.3, 0.04, 2.7, '#8fa5b5');
      box(g, px + 0.3, 0.13, pz + 0.3, 1.2, 0.02, 0.8, '#7bbbe0', { r: 0.2 });
    }
    fence(g, 0.05, D - 0.05, W - 0.05, D - 0.05, C.orange); fence(g, W - 0.05, 0.05, W - 0.05, D - 0.05, C.orange);
    fence(g, 0.05, 0.05, W - 0.05, 0.05, C.orange); fence(g, 0.05, 0.05, 0.05, D - 0.05, C.orange);
    for (let k = 0; k < 5; k++) cone(g, 4.2 + k * 0.3, 0.04, 3.85, 0.07, 0.22, C.orange, 8);
    pallet(g, 4.15, 0.7, 'prod', 2);
    cyl(g, W / 2 - 0.4, 0.04, D / 2, 0.04, 0.8, C.wood2, { seg: 6 }); cyl(g, W / 2 + 0.4, 0.04, D / 2, 0.04, 0.8, C.wood2, { seg: 6 });
    sign(g, '+z', W / 2, 0.95, D / 2 + 0.03, 1.5, 0.45, '🔒 FERMA', { bg: '#3b4a5a' });
    return g;
  },

  // ---------------------------------------- decorative town buildings (2.5²)
  cafe() {
    const g = group(); pad(g, 2.5, 2.5, '#e6dfd0');
    box(g, 0.25, 0.04, 0.25, 1.9, 0.95, 1.4, '#fff4dc');
    windows(g, '+z', 0.25, 0.04, 0.25, 1.9, 0.7, 1.4, 3, 1, { mv: 0.1, gap: 0.15, glass: '#ffe9a8', lit: true });
    windows(g, '+x', 0.25, 0.3, 0.25, 1.9, 0.5, 1.4, 2, 1);
    gable(g, 0.25, 0.99, 0.25, 1.9, 1.4, 0.45, C.red, 'x', { ribs: 8 });
    awning(g, '+z', 0.3, 2.1, 1.65, 0.78, 0.4, '#2fa34a', C.white, 8);
    sign(g, '+z', 1.2, 1.08, 1.68, 1.1, 0.2, 'KAFE', { bg: '#2fa34a' });
    for (const x of [0.5, 1.4]) { cyl(g, x, 0.04, 2.1, 0.16, 0.02, C.white, { seg: 12 }); cyl(g, x, 0.04, 2.1, 0.02, 0.28, C.dark, { seg: 6 }); cyl(g, x, 0.3, 2.1, 0.17, 0.02, C.white, { seg: 12 }); }
    umbrella(g, 2.1, 2.1, '#2fa34a', 0.6);
    return g;
  },
  shed() {
    const g = group(); pad(g, 2.5, 2.5);
    box(g, 0.2, 0.04, 0.3, 2.1, 1.0, 1.7, '#d9e0e6');
    door(g, '+z', 0.2, 0.04, 0.3, 2.1, 1.0, 1.7, 0.3, 1.5, 0.75, '#8696a5');
    windows(g, '+x', 0.2, 0.45, 0.3, 2.1, 0.4, 1.7, 2, 1);
    gable(g, 0.2, 1.04, 0.3, 2.1, 1.7, 0.45, '#d8743a', 'x', { ribs: 10 });
    sign(g, '+z', 1.75, 0.88, 2.02, 0.8, 0.16, 'TƏMİR', { bg: C.navy });
    barrel(g, 2.25, 2.25, C.blue2); pallet(g, 0.2, 2.0, 'prod', 1);
    return g;
  },
  icehouse() {
    const g = group(); pad(g, 2.5, 2.5);
    box(g, 0.25, 0.04, 0.25, 2.0, 1.2, 1.8, C.white);
    band(g, 0.25, 1.0, 0.25, 2.0, 0.16, 1.8, C.teal);
    door(g, '+z', 0.25, 0.04, 0.25, 2.0, 1.2, 1.8, 0.5, 1.3, 0.8, '#a9c4d6');
    windows(g, '+x', 0.25, 0.55, 0.25, 2.0, 0.35, 1.8, 2, 1);
    flatRoof(g, 0.25, 1.24, 0.25, 2.0, 1.8); acUnit(g, 0.6, 1.29, 0.6); acUnit(g, 1.3, 1.29, 0.6); roofVent(g, 1.9, 1.29, 1.6);
    sign(g, '+z', 1.25, 1.08, 2.07, 1.2, 0.16, 'SOYUDUCU', { bg: C.teal });
    return g;
  },
};

// Unbuilt site: steel frame going up, scaffolding, materials, mini crane.
function frameSite(W, D, label) {
  const g = group();
  box(g, 0, 0, 0, W, 0.04, D, '#c9a777');
  box(g, 0.4, 0.04, 3.4, 6.4, 0.08, 3.8, '#c9ccce');                 // poured slab
  for (let i = 0; i <= 4; i++) for (let j = 0; j <= 2; j++) {
    const x = 0.5 + i * 1.55, z = 3.5 + j * 1.75;
    box(g, x, 0.12, z, 0.08, j === 2 || i % 2 ? 1.3 : 0.7, 0.08, '#d0702c');
  }
  for (let i = 0; i < 4; i++) box(g, 0.5 + i * 1.55, 1.38, 7.0, 1.6, 0.06, 0.06, '#d0702c');
  for (let j = 0; j < 2; j++) box(g, 6.7, 1.38, 3.5 + j * 1.75, 0.06, 0.06, 1.8, '#d0702c');
  // scaffolding
  for (let k = 0; k < 4; k++) for (const y of [0.45, 0.9]) box(g, 0.3 + k * 0.6, y, 7.35, 0.6, 0.03, 0.25, C.wood);
  for (let k = 0; k <= 4; k++) box(g, 0.3 + k * 0.6, 0.04, 7.55, 0.03, 1.1, 0.03, C.steel);
  // materials
  for (let k = 0; k < 3; k++) box(g, 1.0, 0.04 + k * 0.08, 1.2, 1.6, 0.07, 0.5, '#d0702c');
  pallet(g, 3.2, 1.1, 'prod', 2); pallet(g, 3.8, 1.1, 'prod', 1);
  cyl(g, W - 1.5, 0.04, 1.4, 0.55, 0.45, '#9a8f84', { rt: 0.2 });
  // mini tower crane
  for (const [x, z] of [[W - 1.2, 3.0], [W - 0.9, 3.0], [W - 1.2, 3.3], [W - 0.9, 3.3]]) box(g, x, 0.04, z, 0.04, 3.0, 0.04, C.yellow);
  for (let y = 0.3; y < 3; y += 0.35) box(g, W - 1.2, y, 3.3, 0.34, 0.03, 0.03, '#d9a514');
  box(g, W - 4.2, 3.04, 3.08, 4.0, 0.1, 0.12, C.yellow); box(g, W - 1.4, 2.85, 2.95, 0.6, 0.3, 0.45, '#8a8f96');
  fence(g, 0.05, D - 0.05, W - 0.05, D - 0.05, C.orange); fence(g, W - 0.05, 0.05, W - 0.05, D - 0.05, C.orange);
  fence(g, 0.05, 0.05, W - 0.05, 0.05, C.orange); fence(g, 0.05, 0.05, 0.05, D - 0.05, C.orange);
  cyl(g, 2.4, 0.04, D - 0.3, 0.04, 0.8, C.wood2, { seg: 6 }); cyl(g, 3.6, 0.04, D - 0.3, 0.04, 0.8, C.wood2, { seg: 6 });
  sign(g, '+z', 3.0, 0.95, D - 0.27, 1.5, 0.45, '🔨 ' + label, { bg: '#3b4a5a' });
  return g;
}
