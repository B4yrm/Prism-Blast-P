// Renders the island, buildings and every moving unit; owns the camera.
import { iso, unIso, BOUNDS, BUILDINGS, isLand, hash, SEA_Z, POI, CONVEYOR, CRANES, LIGHTHOUSE, BERTHS, DECOR, PAVE } from '../config.js';
import { addGround, groundBounds } from '../render/ground.js';
import { A, has, addSprite, setSprite } from '../render/atlas.js';
import { Life } from './life.js';
import { Water } from '../render/water.js';
import { Fleet } from '../render/boats.js';
import { VBERTH, buoysAt } from '../render/boatpaths.js';
import { isRoad, isWalk } from '../sim/path.js';
import { Sim, CONVEY_TIME } from '../sim/sim.js';
import { G, stat } from '../core/economy.js';
import { bus } from '../core/bus.js';

const D_WATER = -100, D_GROUND = -50;
const depthAt = (x, y) => (x + y) * 16;
const UZ = 39.2;   // world px per model unit of height (2:1 dimetric)

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  create() {
    const Q = G.quality;
    this.sim = new Sim();
    G.sim = this.sim; G.world = this;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0c5ca8');

    this.makeWater();
    addGround(this, Q.ground, D_GROUND);
    this.makeBuildings();
    this.makeProps();
    this.makeConveyor();
    this.makeStocks();
    this.makeFx();
    this.fleet = new Fleet(this, Q);
    this.life = new Life(this);
    this.workerSpr = []; this.custSpr = []; this.custPool = [];
    this.floats = [];

    // camera
    const gb = groundBounds();
    // soft camera limits (Phaser bounds misbehave when the view is larger than them)
    this.lim = { x0: iso(0, 30).x, x1: iso(38, 0).x, y0: iso(0, 0).y - 100, y1: iso(36, 30).y };
    this.fitZoom();
    this.setupInput();
    this.scale.on('resize', () => this.fitZoom(true));

    bus.on('tier', ({ b }) => this.refreshBuilding(b));
    bus.on('sale', e => this.floatText(e.x, e.y, '+$' + e.amt, '#ffe14d'));
    bus.on('sad', e => this.floatText(e.x, e.y, '😞', '#fff'));
    bus.on('unload', e => this.craneWork(e.b));
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.syncStocks() });
    this.events.emit('ready');
    bus.emit('worldReady');
  }

  // ---------------------------------------------------------------- water
  makeWater() {
    this.water = new Water(this, G.quality, groundBounds());
    this.cameras.main.setBackgroundColor('#0c5ca8');
  }

  // ------------------------------------------------------------- buildings
  makeBuildings() {
    this.bspr = {};
    for (const id of Object.keys(BUILDINGS)) this.refreshBuilding(id);
  }
  refreshBuilding(id) {
    const def = BUILDINGS[id], tier = G.S.tier[id] || 0;
    const name = `b/${id}/${id === 'farm' ? 0 : tier}`;
    if (!has(name)) return;
    const p = iso(def.x, def.y);
    let s = this.bspr[id];
    if (!s) {
      s = this.bspr[id] = addSprite(this, p.x, p.y, name);
      s.setDepth(depthAt(def.x + def.w / 2, def.y + def.d / 2));
    } else {
      setSprite(s, name);
      this.tweens.add({ targets: s, scaleY: { from: s.scaleX * 0.85, to: s.scaleX }, duration: 500, ease: 'Back.Out' });
      this.burst(def.x + def.w / 2, def.y + def.d / 2, 30);
    }
    s.bid = id;
  }

  makeProps() {
    const blocked = (i, j) => {
      if (isRoad(i, j) || isWalk(i, j)) return true;
      for (const b of Object.values(BUILDINGS)) if (i >= b.x - 1 && i <= b.x + b.w && j >= b.y - 1 && j <= b.y + b.d) return true;
      if (i >= 25 && i <= 35 && j >= 11 && j <= 20) return true;   // town & parking
      if (j >= 21) return true;                                     // harbour strip
      if (i >= 36 && j >= 12 && j <= 19) return true;              // lighthouse cape
      if (i >= 20 && i <= 23 && j >= 8 && j <= 11) return true;    // conveyor
      return false;
    };
    const prop = (name, x, y, sc = 1) => has(name) ? addSprite(this, iso(x, y).x, iso(x, y).y, name, sc).setDepth(depthAt(x, y)) : null;
    this.trees = [];
    // forest belt and scattered trees
    for (let i = BOUNDS.x0; i < BOUNDS.x1; i++) for (let j = BOUNDS.y0; j < BOUNDS.y1; j++) {
      if (!isLand(i, j) || !isLand(i + 1, j) || !isLand(i, j + 1) || blocked(i, j)) continue;
      const forest = i < -1 || j < -1, h = hash(i * 13, j * 17);
      if (forest) {
        if (h < 0.28) prop(`k/grass-trees${h < 0.12 ? '-tall' : ''}/${(i + j) & 1}`, i, j);
        else if (h < 0.55) { const t = prop('prop/tree' + Math.floor(hash(i, j) * 6), i + 0.3 + hash(j, i) * 0.4, j + 0.3 + hash(i + 3, j) * 0.4, 1.05 + hash(i, j + 9) * 0.5); if (t) { t.setFlipX(hash(i, j + 4) > 0.5); this.trees.push(t); } }
        else if (h < 0.62) prop('prop/rock', i + 0.5, j + 0.5, 1.2);
        else if (h < 0.7) prop('prop/bush', i + 0.5, j + 0.5, 1.3);
        continue;
      }
      if (h > 0.3) continue;
      const x = i + 0.25 + hash(i, j * 3) * 0.5, y = j + 0.25 + hash(i * 5, j) * 0.5;
      const k = hash(j, i);
      if (k < 0.5) { const t = prop('prop/tree' + (3 + Math.floor(hash(i + 1, j) * 3)), x, y, 0.95 + hash(i, j + 2) * 0.4); if (t) t.setFlipX(hash(j, i + 1) > 0.5); this.trees.push(t); }
      else if (k < 0.75) this.trees.push(prop('prop/tree' + Math.floor(hash(i, j + 1) * 3), x, y, 1.1));
      else if (k < 0.9) prop('prop/bush', x, y);
      else prop('prop/rock', x, y);
    }
    this.trees = this.trees.filter(Boolean);
    // background town (Kenney CC0 houses, scaled up to match our buildings)
    for (const [k, x, y] of [['cafe', 26.3, 11.3], ['icehouse', 29.3, 11.3], ['shed', 32.3, 11.3], ['shed', 26.3, 14.3], ['cafe', 32.3, 14.3]]) prop(`b/${k}/1`, x, y).setDepth(depthAt(x + 1.25, y + 1.25));
    prop('prop/fountain', 30.5, 15.5); prop('prop/bench_x', 29.6, 14.5); prop('prop/flowers', 30.5, 16.6);
    for (const [x, y] of [[34.6, 11.6], [34.6, 14.4], [26.3, 16.8], [34.5, 16.9]]) prop('prop/tree4', x, y, 1.2);
    // parking lot
    for (let k = 0; k < 7; k++) prop(`prop/car_${k % 4}_1`, 26.6 + k * 1.15, 18.2);
    // park with fountain and benches (west of the market)
    prop('prop/fountain', 4.3, 12.2);
    prop('prop/bench_x', 3.4, 11.2); prop('prop/bench_z', 5.6, 11.6); prop('prop/flowers', 3.5, 13.3);
    this.fountain = iso(4.3, 12.2, 0.66 * UZ);
    // flowerbeds, bushes & lamps along pavements
    for (const [x0, y0, x1, y1] of PAVE) {
      if (y0 === 22) continue;
      for (let x = x0; x <= x1; x += 3) prop('prop/lamp', x + 0.15, y1 + 0.85);
    }
    for (const [x, y] of [[14.6, 18.6], [24.6, 18.4], [24.6, 8.5], [13.6, 8.5], [2.6, 8.5], [34.6, 8.4]]) prop('prop/bush', x, y);
    for (const [x, y] of [[11.5, 8.4], [21, 18.4], [31, 8.4]]) prop('prop/flowers', x, y);
    // harbour: containers, pallets, barrels, cones, life on the quay
    prop('prop/container_yard', 20.9, 23.45);
    for (const [x, y, n] of [[3.6, 22.5, 'pallet_raw'], [5.0, 22.45, 'fishbox_stack'], [6.6, 22.45, 'fishbox_stack'], [16.6, 22.45, 'fishbox_stack'], [18.3, 22.5, 'forklift_parked'],
      [19.4, 22.5, 'barrels'], [11.6, 23.5, 'cones'], [6.5, 25.6, 'netpile'], [13.5, 26.8, 'netpile'], [20.5, 25.2, 'netpile'], [2.6, 23.5, 'pallet_prod']]) prop('prop/' + n, x, y);
    // (moored decorative boats and the bollards are part of the fleet, render/boats.js)
    // cranes on the quay
    this.cranes = CRANES.map(([x, y]) => {
      const c = iso(x + 0.5, y + 0.5);
      prop('prop/crane', x + 0.5, y + 0.5);
      const top = iso(x + 0.5, y + 0.5 + 2.8, 4.5 * UZ);
      const dz = depthAt(x + 0.5, y + 3.3);
      const line = this.add.graphics().setDepth(dz + 30);
      const hook = addSprite(this, top.x, top.y + 60, 'prop/hook').setDepth(dz + 31);
      const load = addSprite(this, top.x, top.y + 60, 'prop/crate_raw', 1.6).setDepth(dz + 32).setVisible(false);
      return { x: x + 0.5, hook, line, load, top, drop: 60, t: 0, ph: 0 };
    });
    // lighthouse + rocks on the cape
    const lp = iso(LIGHTHOUSE[0], LIGHTHOUSE[1]);
    prop('prop/lighthouse', LIGHTHOUSE[0], LIGHTHOUSE[1], 1.2);
    for (const [x, y] of [[36.4, 13.6], [38.3, 17.4], [36.2, 18.2], [38.5, 14.2]]) prop('prop/rock', x, y, 1.3);
    this.beam = this.add.image(lp.x, lp.y - 3.05 * UZ * 1.2, 'puff').setScale(0.9).setAlpha(0.6).setTint(0xfff2a6).setDepth(depthAt(...LIGHTHOUSE) + 1).setBlendMode('ADD');
    // fishing-ground buoys, either side of where each boat tows its nets
    this.buoys = [];
    BERTHS.forEach((B, k) => {
      for (const [x, y] of buoysAt(k)) {
        const p = iso(x, y, SEA_Z);
        if (has('prop/buoy')) this.buoys.push(addSprite(this, p.x, p.y, 'prop/buoy').setDepth(depthAt(x, y)));
      }
    });
    this.gulls = [];
    for (let k = 0; k < 7; k++) this.gulls.push({ s: this.add.image(0, 0, 'gull', 'g0').setDepth(5000).setScale(0.45), cx: 4 + k * 3.5, cy: 24 + (k % 3) * 3, r: 1.5 + k % 3, sp: 0.25 + k * 0.04, a: k });
  }

  makeConveyor() {
    const { x, y0, y1 } = CONVEYOR;
    this.belt = [];
    for (let y = y1; y < y0; y++) {
      const p = iso(x, y);
      if (has('prop/belt')) this.belt.push(addSprite(this, p.x, p.y, 'prop/belt').setDepth(depthAt(x, y + 1) + 40));
      if (!isRoad(Math.floor(x), y) && has('prop/belt_legs')) addSprite(this, p.x, p.y, 'prop/belt_legs').setDepth(depthAt(x, y + 0.5));
    }
    this.cboxes = [];
  }

  makeStocks() {
    const mk = (name, slots) => slots.map(([x, y, z]) => {
      const p = iso(x, y, z);
      return addSprite(this, p.x, p.y, name).setDepth(depthAt(x, y) + z * 0.1).setVisible(false);
    });
    const grid = (x0, y0, nx, ny, layers, dz = 0.16 * UZ) => {
      const s = [];
      for (let l = 0; l < layers; l++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.push([x0 + i * 0.26, y0 + j * 0.26, l * dz]);
      return s;
    };
    this.piles = {
      quay: { spr: mk('prop/crate_raw', grid(11.1, 22.2, 8, 2, 2)), per: () => 40 / 32 },
      wh: { spr: mk('prop/crate_raw', grid(22.2, 19.15, 8, 2, 2)), per: () => 3 },
      facOut: { spr: mk('prop/crate_prod', grid(17.3, 8.35, 8, 1, 3)), per: () => 2 },
      mProd: { spr: mk('prop/crate_prod', grid(6.2, 19.15, 5, 2, 2)), per: () => 2 },
      mRaw: { spr: mk('prop/crate_raw', grid(7.7, 19.15, 4, 2, 2)), per: () => 2 },
    };
  }
  syncStocks() {
    const st = G.S.stock;
    for (const [k, p] of Object.entries(this.piles)) {
      const n = Math.min(p.spr.length, Math.ceil(st[k] / p.per()));
      p.spr.forEach((s, i) => s.setVisible(i < n));
    }
  }

  // ---------------------------------------------------------------- effects
  makeFx() {
    const chims = [[1.0, 0.9, 4.0 * UZ], [2.1, 0.9, 3.4 * UZ]];
    this.smoke = chims.map(([x, y, z], i) => {
      const p = iso(BUILDINGS.factory.x + x, BUILDINGS.factory.y + y, z);
      return this.add.particles(p.x, p.y, 'puff', {
        speedX: { min: 4, max: 12 }, speedY: { min: -22, max: -12 }, scale: { start: 0.18, end: 0.75 },
        alpha: { start: 0.75, end: 0 }, lifespan: 3600, frequency: 220, emitting: false,
      }).setDepth(9000);
    });
    this.spray = this.add.particles(this.fountain.x, this.fountain.y, 'drop', {
      speedX: { min: -14, max: 14 }, speedY: { min: -46, max: -30 }, gravityY: 90, lifespan: 900,
      scale: { start: 0.6, end: 0.3 }, alpha: { start: 0.9, end: 0.2 }, frequency: 40,
    }).setDepth(depthAt(4.3, 12.2) + 1);
    this.sparkle = this.add.particles(0, 0, 'spark', {
      speed: { min: 30, max: 120 }, scale: { start: 0.5, end: 0 }, lifespan: 700, emitting: false, tint: [0xfff27a, 0xffffff, 0x9be7ff],
    }).setDepth(9500);
    this.wakeFx = this.add.particles(0, 0, 'dot', {
      speed: { min: 1, max: 6 }, scale: { start: 0.45, end: 1.5 }, alpha: { start: 0.75, end: 0 }, lifespan: 1700, emitting: false,
    }).setDepth(-40);
    this.dropFx = this.add.particles(0, 0, 'drop', {
      speed: { min: 20, max: 60 }, angle: { min: 220, max: 320 }, gravityY: 140, scale: { start: 0.7, end: 0.2 }, lifespan: 700, emitting: false,
    }).setDepth(9400);
  }
  burst(x, y, n = 16) { const p = iso(x, y, 20); this.sparkle.emitParticleAt(p.x, p.y, n); }
  // a fish jumps at grid (x, y): called by the fleet while a net is hauled in
  fishJump(x, y) {
    const p = iso(x, y, SEA_Z);
    this.dropFx.emitParticleAt(p.x, p.y, 6);
    const f = this.add.image(p.x, p.y, 'fishjump').setDepth(9300).setScale(0.8);
    this.tweens.add({ targets: f, y: p.y - 26, duration: 380, yoyo: true, ease: 'Quad.Out', angle: { from: -40, to: 40 }, onComplete: () => f.destroy() });
  }
  craneWork(b) {
    // only the crane at this boat's own berth, and only once the boat is in
    const bx = VBERTH[b.i % VBERTH.length][0], cr = this.cranes.find(c => Math.abs(c.x - bx) < 1.5);
    if (cr && this.fleet.moored(b)) cr.t = 1.2;
  }

  floatText(x, y, str, col) {
    if (this.floats.length > 18) return;
    const p = iso(x, y, 40);
    const t = this.add.text(p.x, p.y, str, {
      fontFamily: '"Baloo 2","Arial Black",system-ui,sans-serif', fontSize: '22px', color: col,
      stroke: '#3b2a00', strokeThickness: 5, resolution: G.quality.dpr,
    }).setOrigin(0.5).setDepth(9800).setScale(1 / this.cameras.main.zoom * G.quality.dpr * 0.8);
    this.floats.push(t);
    this.tweens.add({ targets: t, y: p.y - 46, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => { t.destroy(); this.floats.splice(this.floats.indexOf(t), 1); } });
  }

  // ------------------------------------------------------------------ input
  // Gestures on native Pointer Events (each finger tracked by pointerId,
  // timing from the event's own timeStamp) so slow frames can never merge or
  // drop touches: 1 finger = drag/tap, 2 fingers = pinch, double tap = zoom.
  setupInput() {
    const cam = this.cameras.main, cv = this.game.canvas;
    const pts = new Map();
    let drag = null, pinch = null, moved = 0, multi = false;
    const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };
    const slop = () => 9 * G.quality.dpr;
    const startDrag = q => { drag = { x: q.x, y: q.y, sx: cam.scrollX, sy: cam.scrollY }; };
    const twoFinger = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => {
      const q = toCanvas(e);
      pts.set(e.pointerId, q); this.fingers = pts.size;
      if (pts.size === 1) this.downT = e.timeStamp;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      this.vel = null;
      if (pts.size === 1) { startDrag(q); moved = 0; multi = false; }
      else if (pts.size === 2) { const f = twoFinger(); pinch = { d: Math.max(1, f.d), z: cam.zoom }; drag = null; multi = true; }
    });
    cv.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const q = toCanvas(e); pts.set(e.pointerId, q);
      if (pts.size >= 2 && pinch) { const f = twoFinger(); this.zoomTo(pinch.z * f.d / pinch.d, f.mx, f.my); return; }
      if (!drag) return;
      const dx = q.x - drag.x, dy = q.y - drag.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > slop()) {
        const nx = drag.sx - dx / cam.zoom, ny = drag.sy - dy / cam.zoom;
        this.vel = { x: (nx - cam.scrollX) * 0.45, y: (ny - cam.scrollY) * 0.45 };
        cam.setScroll(nx, ny);
      }
    });
    const end = e => {
      if (!pts.has(e.pointerId)) return;
      const q = toCanvas(e); pts.delete(e.pointerId); this.fingers = pts.size;
      if (pts.size === 1) { pinch = null; startDrag([...pts.values()][0]); moved = slop() + 1; return; }  // pinch → keep panning with the other finger
      if (pts.size > 0) return;
      pinch = null;
      const isTap = e.type === 'pointerup' && !multi && drag && moved <= slop();
      drag = null;
      if (!isTap) return;
      // double tap = the second finger-down comes < 350 ms after the first finger-up
      const t = e.timeStamp;
      if (this.lastTap && this.downT - this.lastTap.t < 350 && Math.hypot(q.x - this.lastTap.x, q.y - this.lastTap.y) < 40 * G.quality.dpr) {
        this.lastTap = null;
        this.zoomTo(cam.zoom > this.fitZ * 2.2 ? this.fitZ : cam.zoom * 1.8, q.x, q.y);
        console.log('GESTURE doubletap zoom=' + cam.zoom.toFixed(3));
        return;
      }
      // a tap that opens something is never the first half of a double tap
      const hit = this.tap(q);
      console.log('GESTURE tap hit=' + !!hit);
      this.lastTap = hit ? null : { t, x: q.x, y: q.y };
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => { e.preventDefault(); const q = toCanvas(e); this.zoomTo(cam.zoom * (e.deltaY > 0 ? 0.9 : 1.1), q.x, q.y); }, { passive: false });
    this.input.enabled = false;   // Phaser's own pointer handling is not used
  }
  // Opening view: landscape shows the whole complex between the HUD and the
  // dock; portrait fills the screen height and lets the player pan sideways.
  fitZoom(keep) {
    const cam = this.cameras.main, dpr = G.quality.dpr;
    const w = this.scale.width / dpr, h = this.scale.height / dpr, port = h > w;
    const L = iso(2, 27).x, R = iso(36, 1).x, T = iso(1, 1, 2.5 * UZ).y, Bt = iso(35, 28).y;
    const top = port ? 76 : 44, bottom = port ? 118 : 58;
    const usableH = h - top - bottom, usableW = w * 0.98;
    const zW = usableW / (R - L), zH = usableH / (Bt - T);
    this.fitZ = (port ? Math.min(zH, zW * 2.5) : Math.min(zW, zH)) * dpr;
    this.minZ = (port ? zW * 1.2 : Math.min(zW, zH) * 0.8) * dpr;
    this.maxZ = 2.6 * dpr;
    if (!keep) {
      cam.setZoom(this.fitZ);
      const cx = port ? iso(17, 14).x : (L + R) / 2;
      const cy = (T + Bt) / 2 - ((top - bottom) / 2) / this.fitZ * dpr - (port ? 30 / this.fitZ * dpr : 0);
      cam.centerOn(cx, cy);
    } else cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZ, this.maxZ));
  }
  // Smoothly return to the opening view (map "centre" button).
  recenter() {
    const cam = this.cameras.main, from = { z: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y };
    this.fitZoom(false);
    const to = { z: cam.zoom, x: cam.midPoint.x, y: cam.midPoint.y };
    cam.setZoom(from.z); cam.centerOn(from.x, from.y);
    this.vel = null;
    this.tweens.addCounter({ from: 0, to: 1, duration: 450, ease: 'Cubic.easeInOut', onUpdate: tw => {
      const k = tw.getValue();
      cam.setZoom(from.z + (to.z - from.z) * k);
      cam.centerOn(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k);
    } });
  }
  zoomTo(z, px, py) {
    const cam = this.cameras.main;
    const before = cam.getWorldPoint(px, py);
    cam.setZoom(Phaser.Math.Clamp(z, this.minZ, this.maxZ));
    cam.preRender();
    const after = cam.getWorldPoint(px, py);
    cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y;
  }
  focus(id) {
    const d = BUILDINGS[id], p = iso(d.x + d.w / 2, d.y + d.d / 2);
    this.cameras.main.pan(p.x, p.y - 40, 500, 'Cubic.easeInOut');
  }
  tap(p) {
    const dpr = G.quality.dpr, lab = G.labelAt && G.labelAt(p.x / dpr, p.y / dpr);
    if (lab) { bus.emit('tapBuilding', lab); return true; }
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const list = Object.values(this.bspr).sort((a, b) => b.depth - a.depth);
    for (const s of list) {
      const lx = (wp.x - s.x) / s.scaleX + s.displayOriginX, ly = (wp.y - s.y) / s.scaleY + s.displayOriginY;
      if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) continue;
      if (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), s.texture.key, s.frame.name) > 20) {
        this.tweens.add({ targets: s, scaleY: { from: s.scaleX * 0.94, to: s.scaleX }, duration: 260, ease: 'Back.Out' });
        bus.emit('tapBuilding', s.bid);
        return true;
      }
    }
    // tapping water near the harbour opens the harbour too
    const g = unIso(wp.x, wp.y - SEA_Z);
    if (g.y > 22 && g.x > 1 && g.x < 25) { bus.emit('tapBuilding', 'harbor'); return true; }
    return false;
  }

  worldToScreen(x, y, z = 0) {
    const cam = this.cameras.main, p = iso(x, y, z), dpr = G.quality.dpr;
    return {
      x: ((p.x - cam.scrollX - cam.width / 2) * cam.zoom + cam.width / 2) / dpr,
      y: ((p.y - cam.scrollY - cam.height / 2) * cam.zoom + cam.height / 2) / dpr,
    };
  }

  // ----------------------------------------------------------------- update
  update(time, delta) {
    const dt = Math.min(0.1, delta / 1000);
    this.sim.update(dt);
    const t = time / 1000, cam = this.cameras.main;
    // inertia after drag
    if (this.lim) {
      const mx = cam.scrollX + cam.width / 2, my = cam.scrollY + cam.height / 2, L = this.lim;
      cam.scrollX += Phaser.Math.Clamp(mx, L.x0, L.x1) - mx;
      cam.scrollY += Phaser.Math.Clamp(my, L.y0, L.y1) - my;
    }
    if (this.vel && !this.fingers) {
      cam.scrollX += this.vel.x; cam.scrollY += this.vel.y;
      this.vel.x *= 0.86; this.vel.y *= 0.86;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.y) < 0.1) this.vel = null;
    }
    this.water.update(t, dt, cam);
    this.beam.setAlpha(0.35 + 0.3 * Math.sin(t * 2));
    for (const b of this.buoys) b.setAngle(Math.sin(t * 2 + b.x) * 8);
    if (G.quality.sway) for (const tr of this.trees) tr.setAngle(Math.sin(t * 1.3 + tr.x * 0.01) * 1.2);
    for (const g of this.gulls) {
      g.a += dt * g.sp;
      const p = iso(g.cx + Math.cos(g.a) * g.r * 2, g.cy + Math.sin(g.a) * g.r, 120);
      g.s.setPosition(p.x, p.y).setFrame(Math.sin(t * 9 + g.cx) > 0 ? 'g0' : 'g1').setFlipX(Math.sin(g.a) > 0);
    }
    const fac = G.S.tier.factory > 0;
    this.smoke[0].emitting = fac; this.smoke[1].emitting = fac && G.S.tier.factory >= 2;
    this.drawBoats(t, dt);
    this.drawWalkers(t);
    this.life.update(t, dt, [...this.sim.workers.map(w => w.m), ...this.sim.customers.map(c => c.m)]);
    this.drawConveyor();
    this.drawCranes(dt);
    bus.emit('frame');
  }

  drawBoats(t, dt) {
    this.fleet.update(t, dt);          // same time step as the simulation, so the two stay in step
  }

  drawWalkers(t) {
    const sim = this.sim;
    // keep people from overlapping (visual offsets only)
    this.life.separate([...sim.workers.map(w => w.m), ...sim.customers.map(c => c.m)]);
    // haulers: walk cycle, or bend & lift while loading / unloading
    while (this.workerSpr.length < sim.workers.length) this.workerSpr.push(addSprite(this, 0, 0, 'p/worker/none/1/0'));
    sim.workers.forEach((w, i) => {
      const s = this.workerSpr[i]; s.look = 'worker';
      let pose = null;
      if (w.state === 'pick' || w.state === 'drop') {
        const prog = 1 - Math.max(0, w.t) / Math.max(0.05, stat.loadTime());
        const kind = w.job ? w.job.kind : 'raw';
        const lifting = w.state === 'pick' ? prog > 0.5 : prog < 0.5;
        pose = lifting ? `${kind === 'can' ? 'can' : kind}/b1` : 'none/b0';
      }
      this.placeWalker(s, w.m, w.carry > 0 ? w.kind : 'none', w, t, pose);
    });
    // customers (pooled sprites)
    const used = new Set();
    for (const c of sim.customers) {
      if (!c.spr) {
        c.spr = this.custPool.pop() || addSprite(this, 0, 0, 'p/c0/none/1/0');
        c.spr.look = 'c' + c.look; c.spr.setVisible(true);
      }
      used.add(c.spr);
      this.placeWalker(c.spr, c.m, c.state === 'out' && c.bag ? 'bag' : 'none', c, t);
    }
    for (const s of this.custSpr) if (!used.has(s)) { s.setVisible(false); this.custPool.push(s); }
    this.custSpr = [...used];
  }
  placeWalker(s, m, carry, ent, t, pose) {
    const x = m.x + (m.ox || 0), y = m.y + (m.oy || 0);
    const p = iso(x, y);
    let dir = Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx > 0 ? 0 : 2) : (m.dy > 0 ? 1 : 3);
    // people waiting in the queue look around now and then
    if (!m.moving && !pose && ent.state === 'queue') {
      ent.lookT = (ent.lookT || Math.random() * 3) - this.game.loop.delta / 1000;
      if (ent.lookT <= 0) { ent.lookT = 1.5 + Math.random() * 3; ent.lookDir = Math.random() < 0.5 ? 3 : (Math.random() < 0.5 ? 0 : 2); }
      if (ent.lookDir !== undefined) dir = ent.lookDir;
    }
    ent.walkT = (ent.walkT || 0) + (m.moving ? 1 : 0);
    const k = m.moving ? Math.floor(ent.walkT / 7) % 4 : 0;
    let name = pose ? `p/worker/${pose.split('/')[0]}/${dir}/${pose.split('/')[1]}` : `p/${s.look}/${carry}/${dir}/${k}`;
    if (!has(name)) name = `p/${s.look}/${carry}/${dir}/${k}`;
    if (s.frame.name !== name && has(name)) setSprite(s, name);
    // idle breathing bob
    const idle = !m.moving && !pose ? Math.sin(t * 3 + (ent.walkT || 0)) * 0.4 : 0;
    s.setPosition(p.x, p.y + idle).setDepth(depthAt(x, y) + 1);
  }

  drawConveyor() {
    const sim = this.sim, { x, y0, y1, z } = CONVEYOR;
    while (this.cboxes.length < sim.convey.length) this.cboxes.push(addSprite(this, 0, 0, 'prop/cbox'));
    this.cboxes.forEach((b, i) => {
      const c = sim.convey[i];
      if (!c) { b.setVisible(false); return; }
      const y = y0 - (y0 - y1) * (c.t / CONVEY_TIME);
      const p = iso(x, y, z * UZ + 3);
      b.setVisible(true).setPosition(p.x, p.y).setDepth(depthAt(x, y + 1) + 41);
    });
  }

  drawCranes(dt) {
    // while a boat unloads, the hook dips into the hold and lifts a crate up
    for (const c of this.cranes) {
      c.t = Math.max(0, c.t - dt);
      // cycle while unloading; afterwards finish the current lift and rest at the top
      if (c.t > 0 || (c.ph % (2 * Math.PI)) > 0.05) c.ph += dt * 2.2;
      if (c.t <= 0 && (c.ph % (2 * Math.PI)) < 0.06) c.ph = 0;
      const dip = 0.5 - 0.5 * Math.cos(c.ph);
      c.drop = 55 + dip * 110;
      const hy = c.top.y + c.drop;
      c.hook.setPosition(c.top.x, hy);
      const rising = Math.sin(c.ph) < 0 && dip > 0.05;
      c.load.setVisible(rising).setPosition(c.top.x, hy + 14);
      c.line.clear().lineStyle(1.2, 0x2b2f35, 0.9).lineBetween(c.top.x, c.top.y, c.top.x, hy - 4);
    }
  }

}
