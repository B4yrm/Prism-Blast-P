// Bake entry (runs in headless Chromium). Builds every sprite and packs atlases.
import * as THREE from 'three';
import { renderSprite, pack, glb, setBakeScale } from './render.js';
import { BUILD } from './buildings.js';
import { boat, person, PEOPLE, PROPS, TILES, yaw } from './units.js';

const FOOT = { hq: [8, 8], factory: [9, 8], farm: [9, 8], market: [8, 8], warehouse: [10, 8], harbor: [3, 5] };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Kenney tiles are centred 1×1 models; move them so the tile's min corner is the origin.
async function kenney(name, rot = 0) {
  const m = await glb(`/kenney/${name}.glb`);
  const g = new THREE.Group(), inner = new THREE.Group();
  inner.add(m); inner.rotation.y = rot * Math.PI / 2; g.add(inner);
  g.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(g), s = b.getSize(new THREE.Vector3());
  const k = 1 / Math.max(s.x, s.z);
  g.scale.setScalar(k);
  g.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(g);
  const flat = name.startsWith('road') || name.startsWith('pavement');
  // flat tiles: road surface at y = 0 (lamp posts / fountains stick up from it)
  let top = b2.max.y;
  if (flat && name !== 'road-straight' && name !== 'pavement') top = (await kenney('road-straight')).userData.top;
  g.position.set(-b2.min.x, flat ? -top : -b2.min.y, -b2.min.z);
  g.userData.top = b2.max.y;
  g.userData.box = [b2.min.toArray(), b2.max.toArray()];
  // keep the top surface of flat tiles at y = 0
  return g;
}

function jobs() {
  const J = [];
  const add = (name, make, opts = {}) => J.push({ name, make, opts });
  for (const [type, [w, d]] of Object.entries(FOOT)) {
    const tiers = type === 'farm' ? [0] : type === 'factory' ? [0, 1, 2, 3] : [1, 2, 3];
    for (const t of tiers) add(`b/${type}/${t}`, () => BUILD[type](t, w, d), { shadow: true });
  }
  for (const n of ['cafe', 'shed', 'icehouse']) add(`b/${n}/1`, () => BUILD[n](), { shadow: true });
  for (let c = 0; c < 3; c++) for (let d = 0; d < 4; d++) add(`boat/${c}/${d}`, () => { const g = new THREE.Group(), b = boat(c); b.rotation.y = yaw(d); g.add(b); return g; }, { shadow: false, outline: 2 });
  for (const look of Object.keys(PEOPLE)) {
    const carries = look === 'worker' ? ['none', 'raw', 'prod', 'can'] : ['none', 'bag'];
    for (const carry of carries) for (let d = 0; d < 4; d++) for (let f = 0; f < 4; f++)
      add(`p/${look}/${carry}/${d}/${f}`, () => { const g = new THREE.Group(), p = person(look, f, carry); p.rotation.y = yaw(d); g.add(p); return g; }, { shadow: true, outline: 1.5 });
  }
  for (const [name, make] of Object.entries(PROPS)) add(`prop/${name}`, make, { shadow: !['belt', 'hook', 'buoy', 'cbox'].includes(name), outline: name === 'belt_legs' ? 1.5 : 2 });
  // ground tiles: anchored at the tile's min corner, no outline (they tile seamlessly)
  for (const [name, make] of Object.entries(TILES)) {
    const variants = name === 'grass' ? [0, 1, 2] : [0];
    for (const v of variants) add(`t/${name}${name === 'grass' ? v : ''}`, () => make(v), { outline: 0, castShadow: false });
  }
  for (const [n, rots] of [['road-straight', [0, 1]], ['road-corner', [0, 1, 2, 3]], ['road-split', [0, 1, 2, 3]], ['road-intersection', [0]], ['road-straight-lightposts', [0, 1]], ['pavement', [0]], ['pavement-fountain', [0]]])
    for (const r of rots) add(`k/${n}/${r}`, () => kenney(n, r), { outline: 0, castShadow: n.includes('lightposts') || n.includes('fountain'), shadow: n.includes('lightposts') || n.includes('fountain') });
  for (const n of ['grass-trees', 'grass-trees-tall'])
    for (const r of [0, 1]) add(`k/${n}/${r}`, () => kenney(n, r), { shadow: true, outline: 2 });
  return J;
}

// Large buildings are baked at 1.5× (96 px tiles) to keep GPU memory low;
// everything else at 2× (128 px tiles). Each atlas page records its scale.
const BIG = 1.5, SMALL = 2;
const isBig = n => n.startsWith('b/') && !/b\/(cafe|shed|icehouse)/.test(n);
window.bake = async (filter, only) => {
  const sprites = {};
  const list = jobs().filter(j => (!filter || filter.some(f => j.name.startsWith(f))) && (!only || only(j.name)));
  for (const j of list) {
    setBakeScale(isBig(j.name) ? BIG : SMALL);
    const obj = await j.make();
    sprites[j.name] = renderSprite(obj, { anchor: V(0, 0, 0), ...j.opts });
  }
  return sprites;
};
window.bakeAtlas = async (filter) => {
  const big = await window.bake(filter, isBig), small = await window.bake(filter, n => !isBig(n));
  return [...pack(big, 'bld', BIG), ...pack(small, 'world', SMALL)];
};
window.preview = async (filter) => {
  const sprites = await window.bake(filter);
  return Object.fromEntries(Object.entries(sprites).map(([k, s]) => [k, { url: s.canvas.toDataURL('image/png'), ax: s.ax, ay: s.ay, w: s.canvas.width, h: s.canvas.height }]));
};
window.ready = true;
