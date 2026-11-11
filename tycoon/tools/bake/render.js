// Browser-side sprite renderer: orthographic 2:1 dimetric camera, warm sun with
// soft shadows, cartoon outline, trimming and atlas packing.
// Grid convention: three.js x = grid x, three.js z = grid y, y = up. 1 unit = 1 tile.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export let B = 2;                           // bake scale: 2 → a tile is 128 px wide
let PPU = 32 * B * Math.SQRT2;              // pixels per world unit along screen axes
export function setBakeScale(b) { B = b; PPU = 32 * B * Math.SQRT2; }
const ELEV = Math.asin(Math.tan(Math.atan(0.5)));  // 30° → exact 2:1 tiles

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);

export const scene = new THREE.Scene();
const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x8a9a6a, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
sun.position.set(-6, 14, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 4;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(0xcfe6ff, 0.55);
fill.position.set(10, 6, 3);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.34 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
const dir = new THREE.Vector3(Math.cos(ELEV) * Math.SQRT1_2, Math.sin(ELEV), Math.cos(ELEV) * Math.SQRT1_2);
cam.position.copy(dir).multiplyScalar(100);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

const toCam = p => p.clone().applyMatrix4(cam.matrixWorldInverse);

// Reflection pass helpers: keep only what is above the water (after mirroring:
// y <= 0) and write the depth below the surface for the alpha fade.
const keepBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
const depthMat = new THREE.ShaderMaterial({
  vertexShader: 'varying float vY; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }',
  fragmentShader: 'varying float vY; void main() { if (vY > 0.0) discard; gl_FragColor = vec4(vec3(clamp(-vY / 1.6, 0.0, 1.0)), 1.0); }',
  side: THREE.DoubleSide,
});
const SEA_TINT = [24, 104, 176];

// ---- GLB loading ------------------------------------------------------------
const loader = new GLTFLoader();
const glbCache = {};
export async function glb(url) {
  if (!glbCache[url]) glbCache[url] = await loader.loadAsync(url);
  return glbCache[url].scene.clone(true);
}

// ---- rendering ----------------------------------------------------------------
// opts: anchor (Vector3, world point that becomes the sprite pivot), shadow (bool),
// outline (px, 0 = none), extra (Box3 extension for shadows), groundY
export function renderSprite(obj, opts = {}) {
  if (opts.reflect) return renderReflection(obj, opts);
  scene.add(obj);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = opts.castShadow !== false; o.receiveShadow = true; } });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  ground.visible = !!opts.shadow;
  ground.position.y = opts.groundY ?? 0;
  if (opts.shadow) { box.expandByVector(new THREE.Vector3(1.2, 0, 1.2)); box.min.y = Math.min(box.min.y, ground.position.y); }
  // sun shadow camera covers the object
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
  sun.target.position.copy(c); sun.position.copy(c).add(new THREE.Vector3(-6, 14, 9));
  Object.assign(sun.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.1, far: 60 });
  sun.shadow.camera.updateProjectionMatrix();
  // screen bounds
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = toCam(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const pad = 4 / PPU;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = Math.ceil((x1 - x0) * PPU), H = Math.ceil((y1 - y0) * PPU);
  cam.left = x0; cam.right = x0 + W / PPU; cam.top = y1; cam.bottom = y1 - H / PPU;
  cam.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  renderer.render(scene, cam);
  const full = copy(renderer.domElement, opts.grade !== false);
  let out = full;
  if (opts.outline !== 0) {
    ground.visible = false;
    renderer.render(scene, cam);
    const mask = copy(renderer.domElement);
    out = outline(full, mask, opts.outline ?? 2.5, opts.outlineColor || '#172036');
  }
  const a = toCam((opts.anchor || new THREE.Vector3()).clone());
  scene.remove(obj);
  return trim(out, (a.x - x0) * PPU, (y1 - a.y) * PPU);
}

// Planar water reflection: the model mirrored in the waterline (y = 0) with the
// lights mirrored too, seen by the same camera. Only the part above the water is
// reflected; it fades with depth below the surface, takes on the sea colour and
// is slightly blurred. The pivot stays at the anchor, so at runtime the
// reflection sits exactly under the boat.
function renderReflection(obj, opts) {
  obj.scale.y *= -1;
  scene.add(obj);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  box.max.y = Math.min(box.max.y, 0);
  ground.visible = false;
  const sunPos = sun.position.clone(), fillPos = fill.position.clone(), sky = hemi.color.clone(), gnd = hemi.groundColor.clone();
  const c = box.getCenter(new THREE.Vector3());
  sun.target.position.copy(c); sun.position.copy(c).add(new THREE.Vector3(-6, -14, 9));
  fill.position.set(10, -6, 3);
  hemi.color.copy(gnd); hemi.groundColor.copy(sky);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    const p = toCam(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const pad = 4 / PPU;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = Math.ceil((x1 - x0) * PPU), H = Math.ceil((y1 - y0) * PPU);
  cam.left = x0; cam.right = x0 + W / PPU; cam.top = y1; cam.bottom = y1 - H / PPU;
  cam.updateProjectionMatrix();
  renderer.setSize(W, H, false);
  renderer.clippingPlanes = [keepBelow];
  renderer.render(scene, cam);
  const colour = copy(renderer.domElement, false);
  scene.overrideMaterial = depthMat;
  renderer.render(scene, cam);
  const depth = copy(renderer.domElement, false);
  scene.overrideMaterial = null;
  renderer.clippingPlanes = [];
  sun.position.copy(sunPos); fill.position.copy(fillPos); hemi.color.copy(sky); hemi.groundColor.copy(gnd);
  const cg = colour.getContext('2d'), img = cg.getImageData(0, 0, W, H), dd = depth.getContext('2d').getImageData(0, 0, W, H).data, px = img.data;
  const strength = opts.reflectAlpha ?? 0.8;
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const f = Math.pow(1 - dd[i] / 255, 1.8);
    px[i] = px[i] * 0.6 + SEA_TINT[0] * 0.4; px[i + 1] = px[i + 1] * 0.6 + SEA_TINT[1] * 0.4; px[i + 2] = px[i + 2] * 0.6 + SEA_TINT[2] * 0.4;
    px[i + 3] = px[i + 3] * f * strength;
  }
  cg.putImageData(img, 0, 0);
  const blur = document.createElement('canvas'); blur.width = W; blur.height = H;
  const bg = blur.getContext('2d'); bg.filter = 'blur(0.7px)'; bg.drawImage(colour, 0, 0);
  const a = toCam((opts.anchor || new THREE.Vector3()).clone());
  scene.remove(obj);
  return trim(blur, (a.x - x0) * PPU, (y1 - a.y) * PPU);
}

// Copy the WebGL frame; 'grade' adds the saturated cartoon colour grade.
function copy(src, grade) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  if (grade) g.filter = 'saturate(1.25) contrast(1.06) brightness(1.03)';
  g.drawImage(src, 0, 0); return c;
}

function outline(full, mask, r, col) {
  const W = full.width, H = full.height;
  const tint = document.createElement('canvas'); tint.width = W; tint.height = H;
  const t = tint.getContext('2d');
  t.drawImage(mask, 0, 0); t.globalCompositeOperation = 'source-in'; t.fillStyle = col; t.fillRect(0, 0, W, H);
  const o = document.createElement('canvas'); o.width = W; o.height = H;
  const c = o.getContext('2d');
  c.globalAlpha = 0.85;
  for (let a = 0; a < 16; a++) c.drawImage(tint, Math.cos(a / 16 * Math.PI * 2) * r, Math.sin(a / 16 * Math.PI * 2) * r);
  c.globalAlpha = 1;
  c.drawImage(full, 0, 0);
  return o;
}

function trim(cv, ax, ay) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 4) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const o = document.createElement('canvas'); o.width = w; o.height = h;
  o.getContext('2d').drawImage(cv, -x0, -y0);
  return { canvas: o, ax: ax - x0, ay: ay - y0 };
}

// ---- atlas packing (shelf packer, pages of 2048²) ---------------------------
export function pack(sprites, prefix, scale, size = 2048) {
  const list = Object.entries(sprites).sort((a, b) => b[1].canvas.height - a[1].canvas.height);
  const pages = [];
  let page = null;
  const newPage = () => { page = { cv: document.createElement('canvas'), x: 1, y: 1, rowH: 0, frames: {} }; page.cv.width = size; page.cv.height = size; pages.push(page); };
  newPage();
  for (const [name, s] of list) {
    const w = s.canvas.width, h = s.canvas.height;
    if (w > size - 2 || h > size - 2) throw new Error('sprite too big: ' + name + ' ' + w + 'x' + h);
    if (page.x + w + 1 > size) { page.x = 1; page.y += page.rowH + 2; page.rowH = 0; }
    if (page.y + h + 1 > size) newPage();
    page.cv.getContext('2d').drawImage(s.canvas, page.x, page.y);
    page.frames[name] = {
      frame: { x: page.x, y: page.y, w, h }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h }, sourceSize: { w, h },
      pivot: { x: +(s.ax / w).toFixed(5), y: +(s.ay / h).toFixed(5) },
    };
    page.x += w + 2; page.rowH = Math.max(page.rowH, h);
  }
  return pages.map((p, i) => {
    // crop unused bottom area to save memory
    const usedH = Math.min(size, p.y + p.rowH + 2), hPow = usedH;
    const c = document.createElement('canvas'); c.width = size; c.height = hPow;
    c.getContext('2d').drawImage(p.cv, 0, 0);
    const name = `${prefix}-${i}`;
    return {
      name, webp: c.toDataURL('image/webp', 0.9),
      json: { frames: p.frames, meta: { app: 'fishing-tycoon-bake', image: name + '.webp', size: { w: size, h: hPow }, scale } },
    };
  });
}
