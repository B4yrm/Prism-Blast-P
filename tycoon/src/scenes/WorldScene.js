// Renders the island, buildings and every moving unit; owns the camera.
import { iso, unIso, BOUNDS, BUILDINGS, isLand, hash, SEA_Z, POI, CONVEYOR, CRANES, LIGHTHOUSE, BERTHS, DECOR, PAVE } from '../config.js';
import { addGround, groundBounds } from '../render/ground.js';
import { A, has, addSprite } from '../render/atlas.js';
import { isRoad, isWalk } from '../sim/path.js';
import { Sim, CONVEY_TIME } from '../sim/sim.js';
import { G } from '../core/economy.js';
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
    cam.setBackgroundColor('#1b8bd0');

    this.makeWater();
    addGround(this, Q.ground, D_GROUND);
    this.makeBuildings();
    this.makeProps();
    this.makeConveyor();
    this.makeStocks();
    this.makeFx();
    this.boatSpr = []; this.workerSpr = []; this.custSpr = []; this.custPool = [];
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
    bus.on('splash', e => this.splash(e.b));
    bus.on('unload', e => this.craneWork(e.b));
    this.time.addEvent({ delay: 250, loop: true, callback: () => this.syncStocks() });
    this.events.emit('ready');
    bus.emit('worldReady');
  }

  // ---------------------------------------------------------------- water
  makeWater() {
    const gb = groundBounds();
    const w = gb.right - gb.left + 8000, h = gb.bottom - gb.top + 6000;
    // TileSprites allocate a texture of their own size, so keep them small and scale up.
    const K = 8;
    this.w1 = this.add.tileSprite(gb.left - 4000, gb.top - 3000, w / K, h / K, 'waves').setOrigin(0).setScale(K).setTileScale(1 / K * 1.2).setDepth(D_WATER).setAlpha(0.9);
    this.w2 = this.add.tileSprite(gb.left - 4000, gb.top - 3000, w / K, h / K, 'waves').setOrigin(0).setScale(K).setTileScale(1.6 / K).setDepth(D_WATER + 1).setAlpha(0.5);
    // darker deep water further out: big soft gradient overlay
    const t = this.textures.createCanvas('deep', 256, 256), c = t.getContext();
    const gr = c.createRadialGradient(128, 90, 30, 128, 128, 180);
    gr.addColorStop(0, 'rgba(40,190,230,0.0)'); gr.addColorStop(1, 'rgba(8,60,130,0.55)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256); t.refresh();
    const ctr = iso(24, 18);
    this.add.image(ctr.x, ctr.y + 200, 'deep').setDisplaySize(w * 0.6, h * 0.6).setDepth(D_WATER + 2);
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
      s.setFrame(name);
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
      if (i >= 20 && i <= 23 && j >= 7 && j <= 11) return true;    // conveyor
      return false;
    };
    const prop = (name, x, y, sc = 1) => has(name) ? addSprite(this, iso(x, y).x, iso(x, y).y, name, sc).setDepth(depthAt(x, y)) : null;
    this.trees = [];
    // forest belt and scattered trees
    for (let i = BOUNDS.x0; i < BOUNDS.x1; i++) for (let j = BOUNDS.y0; j < BOUNDS.y1; j++) {
      if (!isLand(i, j) || !isLand(i + 1, j) || !isLand(i, j + 1) || blocked(i, j)) continue;
      const forest = i < 1 || j < 0, h = hash(i * 13, j * 17);
      if (forest) {
        if (h < 0.55) prop(`k/grass-trees${h < 0.25 ? '-tall' : ''}/${(i + j) & 1}`, i, j);
        else if (h < 0.85) this.trees.push(prop('prop/tree' + Math.floor(hash(i, j) * 3), i + 0.5, j + 0.5, 1.3));
        continue;
      }
      if (h > 0.3) continue;
      const x = i + 0.25 + hash(i, j * 3) * 0.5, y = j + 0.25 + hash(i * 5, j) * 0.5;
      const k = hash(j, i);
      if (k < 0.5) this.trees.push(prop('prop/tree' + (3 + Math.floor(hash(i + 1, j) * 3)), x, y, 1.1));
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
    prop('prop/container_b', 21.2, 22.8); prop('prop/container_r', 22.2, 22.8);
    for (const [x, y, n] of [[3.6, 22.5, 'pallet_raw'], [5.1, 22.5, 'pallet_raw'], [18.2, 22.5, 'pallet_prod'], [19.4, 22.5, 'barrels'], [16.8, 22.6, 'cones']]) prop('prop/' + n, x, y);
    // moored boats keep the harbour busy (decorative)
    this.moored = [];
    for (const [x, y, c, d, sc] of [[11.6, 24.6, 1, 0, 0.55], [18.4, 24.8, 2, 2, 0.5], [2.2, 25.4, 0, 1, 0.6], [21.8, 28.6, 1, 3, 0.7]]) {
      const p = iso(x, y, SEA_Z);
      if (has(`boat/${c}/${d}`)) this.moored.push({ s: addSprite(this, p.x, p.y, `boat/${c}/${d}`, sc).setDepth(depthAt(x, y) + 8), y0: p.y, ph: x });
    }
    // cranes on the quay
    this.cranes = CRANES.map(([x, y]) => {
      const c = iso(x + 0.5, y + 0.5);
      prop('prop/crane', x + 0.5, y + 0.5);
      const top = iso(x + 0.5, y + 0.5 + 2.2, 3.35 * UZ);
      const line = this.add.graphics().setDepth(depthAt(x + 0.5, y + 2.7) + 30);
      const hook = has('prop/hook') ? addSprite(this, top.x, top.y + 40, 'prop/hook').setDepth(depthAt(x + 0.5, y + 2.7) + 31) : this.add.image(0, 0, 'dot');
      return { hook, line, top, drop: 40, t: 0 };
    });
    // lighthouse + rocks on the cape
    const lp = iso(LIGHTHOUSE[0], LIGHTHOUSE[1]);
    prop('prop/lighthouse', LIGHTHOUSE[0], LIGHTHOUSE[1], 1.2);
    for (const [x, y] of [[36.4, 13.6], [38.3, 17.4], [36.2, 18.2], [38.5, 14.2]]) prop('prop/rock', x, y, 1.3);
    this.beam = this.add.image(lp.x, lp.y - 3.05 * UZ * 1.2, 'puff').setScale(0.9).setAlpha(0.6).setTint(0xfff2a6).setDepth(depthAt(...LIGHTHOUSE) + 1).setBlendMode('ADD');
    // fishing-ground buoys
    this.buoys = [];
    for (const B of BERTHS) {
      const [fx, fy] = B.route[B.route.length - 1];
      for (const [ox, oy] of [[-1.4, 0.6], [1.2, -0.8], [0.6, 1.6]]) {
        const p = iso(fx + ox, fy + oy, SEA_Z);
        if (has('prop/buoy')) this.buoys.push(addSprite(this, p.x, p.y, 'prop/buoy').setDepth(depthAt(fx + ox, fy + oy)));
      }
    }
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
      wh: { spr: mk('prop/crate_raw', grid(23.2, 12.2, 2, 16, 2)), per: () => 4 },
      facOut: { spr: mk('prop/crate_prod', grid(17.2, 7.25, 8, 1, 3)), per: () => 2 },
      mProd: { spr: mk('prop/crate_prod', grid(7.2, 18.15, 5, 2, 2)), per: () => 2 },
      mRaw: { spr: mk('prop/crate_raw', grid(8.6, 18.15, 4, 2, 2)), per: () => 2 },
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
    const chims = [[1.0, 0.8, 3.5 * UZ], [2.0, 0.8, 3.1 * UZ]];
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
      speed: { min: 2, max: 8 }, scale: { start: 0.5, end: 1.2 }, alpha: { start: 0.6, end: 0 }, lifespan: 1400, emitting: false,
    }).setDepth(-40);
    this.dropFx = this.add.particles(0, 0, 'drop', {
      speed: { min: 20, max: 60 }, angle: { min: 220, max: 320 }, gravityY: 140, scale: { start: 0.7, end: 0.2 }, lifespan: 700, emitting: false,
    }).setDepth(9400);
  }
  burst(x, y, n = 16) { const p = iso(x, y, 20); this.sparkle.emitParticleAt(p.x, p.y, n); }
  splash(b) {
    const p = iso(b.m.x + (Math.random() - 0.5) * 2, b.m.y + (Math.random() - 0.5) * 2, SEA_Z);
    this.dropFx.emitParticleAt(p.x, p.y, 6);
    const f = this.add.image(p.x, p.y, 'fishjump').setDepth(9300).setScale(0.8);
    this.tweens.add({ targets: f, y: p.y - 26, duration: 380, yoyo: true, ease: 'Quad.Out', angle: { from: -40, to: 40 }, onComplete: () => f.destroy() });
  }
  craneWork(b) {
    const cr = this.cranes[b.i % this.cranes.length];
    if (cr) cr.t = 1.2;
  }

  floatText(x, y, str, col) {
    if (this.floats.length > 18) return;
    const p = iso(x, y, 40);
    const t = this.add.text(p.x, p.y, str, {
      fontFamily: '"Lilita One","Arial Black",system-ui,sans-serif', fontSize: '22px', color: col,
      stroke: '#3b2a00', strokeThickness: 5, resolution: G.quality.dpr,
    }).setOrigin(0.5).setDepth(9800).setScale(1 / this.cameras.main.zoom * G.quality.dpr * 0.8);
    this.floats.push(t);
    this.tweens.add({ targets: t, y: p.y - 46, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => { t.destroy(); this.floats.splice(this.floats.indexOf(t), 1); } });
  }

  // ------------------------------------------------------------------ input
  setupInput() {
    const cam = this.cameras.main, inp = this.input;
    inp.addPointer(2);
    let drag = null, pinch = null, moved = 0;
    inp.on('pointerdown', p => {
      if (inp.pointer1.isDown && inp.pointer2.isDown) {
        pinch = { d: Phaser.Math.Distance.Between(inp.pointer1.x, inp.pointer1.y, inp.pointer2.x, inp.pointer2.y), z: cam.zoom };
        drag = null; moved = 99; return;
      }
      drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }; moved = 0;
      this.vel = null;
    });
    inp.on('pointermove', p => {
      if (pinch && inp.pointer1.isDown && inp.pointer2.isDown) {
        const d = Phaser.Math.Distance.Between(inp.pointer1.x, inp.pointer1.y, inp.pointer2.x, inp.pointer2.y);
        this.zoomTo(pinch.z * d / pinch.d, (inp.pointer1.x + inp.pointer2.x) / 2, (inp.pointer1.y + inp.pointer2.y) / 2);
        return;
      }
      if (!drag || !p.isDown) return;
      const dx = p.x - drag.x, dy = p.y - drag.y;
      moved = Math.max(moved, Math.hypot(dx, dy));
      if (moved > 8 * G.quality.dpr) {
        const nx = drag.sx - dx / cam.zoom, ny = drag.sy - dy / cam.zoom;
        this.vel = { x: (nx - cam.scrollX) * 0.45, y: (ny - cam.scrollY) * 0.45 };
        cam.setScroll(nx, ny);
      }
    });
    inp.on('pointerup', p => {
      if (!inp.pointer1.isDown && !inp.pointer2.isDown) pinch = null;
      if (drag && moved < 8 * G.quality.dpr) this.tap(p);
      drag = null;
    });
    inp.on('wheel', (p, objs, dx, dy) => this.zoomTo(cam.zoom * (dy > 0 ? 0.9 : 1.1), p.x, p.y));
  }
  fitZoom(keep) {
    const cam = this.cameras.main, dpr = G.quality.dpr;
    const w = this.scale.width / dpr, h = this.scale.height / dpr;
    // the complex spans grid x −1..39, y 0..30; leave room for the HUD and dock
    const L = iso(0, 29).x, R = iso(38, 0).x, T = iso(0, 0, 2.5 * UZ).y, Bt = iso(37, 29).y;
    const usableH = h * (h > w ? 0.62 : 0.98), usableW = w * (h > w ? 1.45 : 0.95);
    this.fitZ = Math.min(usableW / (R - L), usableH / (Bt - T)) * dpr;
    this.minZ = this.fitZ * (h > w ? 0.7 : 0.8);
    this.maxZ = 2.6 * dpr;
    if (!keep) {
      cam.setZoom(this.fitZ);
      const cx = (L + R) / 2 + (h > w ? -40 / this.fitZ * dpr : 0), cy = (T + Bt) / 2 - (h > w ? -20 : 22) / this.fitZ * dpr;
      cam.centerOn(cx, cy);
    } else cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZ, this.maxZ));
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
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    const list = Object.values(this.bspr).sort((a, b) => b.depth - a.depth);
    for (const s of list) {
      const lx = (wp.x - s.x) / s.scaleX + s.displayOriginX, ly = (wp.y - s.y) / s.scaleY + s.displayOriginY;
      if (lx < 0 || ly < 0 || lx >= s.width || ly >= s.height) continue;
      if (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), s.texture.key, s.frame.name) > 20) {
        this.tweens.add({ targets: s, scaleY: { from: s.scaleX * 0.94, to: s.scaleX }, duration: 260, ease: 'Back.Out' });
        bus.emit('tapBuilding', s.bid);
        return;
      }
    }
    // tapping water near the harbour opens the harbour too
    const g = unIso(wp.x, wp.y - SEA_Z);
    if (g.y > 22 && g.x > 1 && g.x < 25) bus.emit('tapBuilding', 'harbor');
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
    if (this.vel && !this.input.activePointer.isDown) {
      cam.scrollX += this.vel.x; cam.scrollY += this.vel.y;
      this.vel.x *= 0.86; this.vel.y *= 0.86;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.y) < 0.1) this.vel = null;
    }
    this.w1.tilePositionX = t * 7 / 8; this.w1.tilePositionY = t * 2 / 8;
    this.w2.tilePositionX = -t * 4 / 8; this.w2.tilePositionY = t * 3 / 8;
    this.beam.setAlpha(0.35 + 0.3 * Math.sin(t * 2));
    for (const b of this.buoys) b.setAngle(Math.sin(t * 2 + b.x) * 8);
    for (const m of this.moored) m.s.setY(m.y0 + Math.sin(t * 1.6 + m.ph) * 1.2).setAngle(Math.sin(t * 1.1 + m.ph) * 1.2);
    for (const tr of this.trees) tr.setAngle(Math.sin(t * 1.3 + tr.x * 0.01) * 1.2);
    for (const g of this.gulls) {
      g.a += dt * g.sp;
      const p = iso(g.cx + Math.cos(g.a) * g.r * 2, g.cy + Math.sin(g.a) * g.r, 120);
      g.s.setPosition(p.x, p.y).setFrame(Math.sin(t * 9 + g.cx) > 0 ? 'g0' : 'g1').setFlipX(Math.sin(g.a) > 0);
    }
    const fac = G.S.tier.factory > 0;
    this.smoke[0].emitting = fac; this.smoke[1].emitting = fac && G.S.tier.factory >= 2;
    this.drawBoats(t);
    this.drawWalkers(t);
    this.drawConveyor();
    this.drawCranes(dt);
    bus.emit('frame');
  }

  drawBoats(t) {
    const sim = this.sim;
    while (this.boatSpr.length < sim.boats.length) {
      const i = this.boatSpr.length;
      this.boatSpr.push(addSprite(this, 0, 0, 'boat/0/3'));
    }
    sim.boats.forEach((b, i) => {
      const s = this.boatSpr[i], m = b.m;
      const dir = Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx > 0 ? 0 : 2) : (m.dy > 0 ? 1 : 3);
      s.setFrame(`boat/0/${dir}`);
      const bob = Math.sin(b.bob * 2.2) * 1.6;
      const p = iso(m.x, m.y, SEA_Z + bob);
      s.setPosition(p.x, p.y).setDepth(depthAt(m.x, m.y) + 8).setAngle(Math.sin(b.bob * 1.7) * 1.5);
      if (b.state === 'out' || b.state === 'back') {
        if (Math.random() < 0.5) {
          const w = iso(m.x - m.dx * 1.2, m.y - m.dy * 1.2, SEA_Z);
          this.wakeFx.emitParticleAt(w.x + (Math.random() - 0.5) * 8, w.y, 1);
        }
      }
    });
  }

  drawWalkers(t) {
    const sim = this.sim;
    // haulers
    while (this.workerSpr.length < sim.workers.length) this.workerSpr.push(addSprite(this, 0, 0, 'p/worker/none/1/0'));
    sim.workers.forEach((w, i) => { this.workerSpr[i].look = 'worker'; this.placeWalker(this.workerSpr[i], w.m, w.carry > 0 ? w.kind : 'none', w, t); });
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
  placeWalker(s, m, carry, ent, t) {
    const p = iso(m.x, m.y);
    const dir = Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx > 0 ? 0 : 2) : (m.dy > 0 ? 1 : 3);
    ent.walkT = (ent.walkT || 0) + (m.moving ? 1 : 0);
    const k = m.moving ? Math.floor(ent.walkT / 7) % 4 : 0;
    const name = `p/${s.look}/${carry}/${dir}/${k}`;
    if (s.frame.name !== name && has(name)) s.setFrame(name);
    s.setPosition(p.x, p.y).setDepth(depthAt(m.x, m.y) + 1);
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
    for (const c of this.cranes) {
      c.t = Math.max(0, c.t - dt);
      const target = c.t > 0 ? 70 : 34;
      c.drop += (target - c.drop) * Math.min(1, dt * 3);
      const hy = c.top.y + c.drop;
      c.hook.setPosition(c.top.x, hy);
      c.line.clear().lineStyle(1, 0x333333, 0.8).lineBetween(c.top.x, c.top.y, c.top.x, hy - 3);
    }
  }
}
