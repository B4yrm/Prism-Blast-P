// Renders the island, buildings and every moving unit; owns the camera.
import { iso, unIso, BOUNDS, BUILDINGS, isLand, hash, SEA_Z, POI, CONVEYOR, CRANES, LIGHTHOUSE, BERTHS } from '../config.js';
import { addGround, groundBounds } from '../render/ground.js';
import { buildingTexture } from '../render/buildings.js';
import { Painter } from '../render/paint.js';
import { isRoad, isWalk } from '../sim/path.js';
import { Sim, CONVEY_TIME } from '../sim/sim.js';
import { G, stat } from '../core/economy.js';
import { BOAT_TEX, VEH_TEX } from '../render/sprites.js';
import { bus } from '../core/bus.js';

const D_WATER = -100, D_GROUND = -50;
const depthAt = (x, y) => (x + y) * 16;

export class WorldScene extends Phaser.Scene {
  constructor() { super('world'); }

  create() {
    const Q = G.quality;
    this.TS = Q.tex;
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
    const a = iso(BOUNDS.x0 + 6, BOUNDS.y1 - 4), b = iso(BOUNDS.x1 - 2, BOUNDS.y0 + 6);
    const top = iso(BOUNDS.x0 + 10, BOUNDS.y0 + 10).y, bot = iso(BOUNDS.x1 - 6, BOUNDS.y1 - 4).y;
    cam.setBounds(a.x, top, b.x - a.x, bot - top);
    this.fitZoom();
    const c0 = iso(22, 20);
    cam.centerOn(c0.x, c0.y);
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
    const w = gb.right - gb.left + 2000, h = gb.bottom - gb.top + 1400;
    this.w1 = this.add.tileSprite(gb.left - 1000, gb.top - 700, w, h, 'waves').setOrigin(0).setDepth(D_WATER).setAlpha(0.9);
    this.w2 = this.add.tileSprite(gb.left - 1000, gb.top - 700, w, h, 'waves').setOrigin(0).setDepth(D_WATER + 1).setAlpha(0.5).setTileScale(1.6, 1.6);
    // darker deep water further out: big soft gradient overlay
    const t = this.textures.createCanvas('deep', 256, 256), c = t.getContext();
    const gr = c.createRadialGradient(128, 90, 30, 128, 128, 180);
    gr.addColorStop(0, 'rgba(40,190,230,0.0)'); gr.addColorStop(1, 'rgba(8,60,130,0.55)');
    c.fillStyle = gr; c.fillRect(0, 0, 256, 256); t.refresh();
    const ctr = iso(24, 18);
    this.add.image(ctr.x, ctr.y + 200, 'deep').setDisplaySize(w * 0.9, h * 0.9).setDepth(D_WATER + 2);
  }

  // ------------------------------------------------------------- buildings
  makeBuildings() {
    this.bspr = {};
    for (const id of Object.keys(BUILDINGS)) this.refreshBuilding(id);
  }
  refreshBuilding(id) {
    const def = BUILDINGS[id], tier = G.S.tier[id] || 0;
    const tx = buildingTexture(this, id, tier, def, this.TS);
    const p = iso(def.x, def.y);
    let s = this.bspr[id];
    if (!s) {
      s = this.bspr[id] = this.add.image(p.x, p.y, tx.key);
      s.setDepth(depthAt(def.x + def.w / 2, def.y + def.d / 2));
    } else {
      s.setTexture(tx.key);
      this.tweens.add({ targets: s, scaleY: { from: s.scaleX * 0.85, to: s.scaleX }, duration: 500, ease: 'Back.Out' });
      this.burst(def.x + def.w / 2, def.y + def.d / 2, 30);
    }
    s.setOrigin(tx.ox, tx.oy).setScale(1 / tx.S);
    s.bid = id;
  }

  // ----------------------------------------------------------------- props
  makeProps() {
    const blocked = (i, j) => {
      if (isRoad(i, j) || isWalk(i, j)) return true;
      for (const b of Object.values(BUILDINGS)) if (i >= b.x - 1 && i < b.x + b.w + 1 && j >= b.y - 1 && j < b.y + b.d + 1) return true;
      if (j >= 27 && i > 2 && i < 25) return true;       // quay strip
      if (i >= 16 && i <= 22 && j >= 4 && j <= 10) return true; // park centre
      if (i >= 30 && i <= 33 && j >= 11 && j <= 17) return true; // conveyor
      if (i >= 48 && j >= 22) return true;                // lighthouse cape
      return false;
    };
    const add = (key, x, y, sc = 1, oy = 0.86) => {
      const p = iso(x, y);
      return this.add.image(p.x, p.y, key).setOrigin(0.5, oy).setScale(sc / this.TS).setDepth(depthAt(x, y));
    };
    this.trees = [];
    for (let i = BOUNDS.x0; i < BOUNDS.x1; i++) for (let j = BOUNDS.y0; j < BOUNDS.y1; j++) {
      if (!isLand(i, j) || !isLand(i + 1, j) || !isLand(i, j + 1) || blocked(i, j)) continue;
      const forest = i < 3 || j < 2;
      const h = hash(i * 13, j * 17);
      const dens = forest ? 0.75 : (i > 44 || (j > 15 && j < 24 && i < 13) ? 0.35 : 0.12);
      if (h > dens) continue;
      const x = i + 0.2 + hash(i, j * 3) * 0.6, y = j + 0.2 + hash(i * 5, j) * 0.6;
      const k = forest ? 'pine' + Math.floor(hash(i, j) * 3) : (hash(j, i) > 0.4 ? 'tree' + Math.floor(hash(i + 1, j) * 3) : 'pine' + Math.floor(hash(i, j + 1) * 3));
      const t = add(k, x, y, 0.85 + hash(i + 2, j) * 0.35, 0.9);
      if (!forest && this.trees.length < 60) this.trees.push(t);
    }
    // park with fountain and benches between HQ and factory
    const f = iso(19.5, 7.5);
    this.add.image(f.x, f.y, 'fountain').setOrigin(0.5, 45 / 70).setScale(1 / this.TS).setDepth(depthAt(19.5, 7.5));
    this.fountain = f;
    for (const [x, y] of [[17.2, 6], [21.8, 6], [17.2, 9], [21.8, 9]]) add('bench', x, y, 1, 12 / 18);
    for (const [x, y] of [[16.5, 4.5], [22.5, 4.5], [16.6, 10.3], [22.6, 10.4]]) add('tree' + ((x + y) | 0) % 3, x, y, 1, 0.9);
    // street lamps
    for (let x = 3; x < 48; x += 4) { if (!isWalk(x, 12)) add('lamp', x + 0.5, 12.6, 1, 0.94); if (isLand(x, 28)) add('lamp', x + 0.5, 25.4, 1, 0.94); }
    for (let y = 16; y < 26; y += 4) { add('lamp', 22.6, y + 0.5, 1, 0.94); add('lamp', 39.4, y + 0.5, 1, 0.94); }
    // parked cars
    for (const [x, y, c, ax] of [[25.4, 15.6, 0, 1], [25.4, 17.2, 1, 1], [25.4, 21.3, 3, 1], [12.6, 15.8, 2, 0], [8.5, 15.8, 1, 0], [39.8, 16, 0, 1]]) {
      const p = iso(x, y); this.add.image(p.x, p.y, `car_${c}_${ax}`).setOrigin(0.5, 32 / 52).setScale(1 / this.TS).setDepth(depthAt(x, y));
    }
    // cranes on the quay
    this.cranes = CRANES.map(([x, y]) => {
      const p = iso(x + 0.5, y + 0.5);
      const s = this.add.image(p.x, p.y, 'crane').setOrigin(0.5, 130 / 150).setScale(1 / this.TS).setDepth(depthAt(x + 0.5, y + 0.5));
      const hp = iso(x + 0.5, y + 2.6, 86);
      const line = this.add.graphics().setDepth(depthAt(x + 0.5, y + 2.6) + 30);
      const hook = this.add.image(hp.x, hp.y + 40, 'hook').setScale(1 / this.TS).setDepth(depthAt(x + 0.5, y + 2.6) + 31);
      return { s, hook, line, top: hp, drop: 40, t: 0 };
    });
    // lighthouse
    const lp = iso(LIGHTHOUSE[0], LIGHTHOUSE[1]);
    this.add.image(lp.x, lp.y, 'lighthouse').setOrigin(0.5, 175 / 190).setScale(1 / this.TS).setDepth(depthAt(...LIGHTHOUSE));
    this.beam = this.add.image(lp.x, lp.y - 129, 'puff').setScale(0.9).setAlpha(0.6).setTint(0xfff2a6).setDepth(depthAt(...LIGHTHOUSE) + 1).setBlendMode('ADD');
    // fishing ground buoys
    this.buoys = [];
    for (const B of BERTHS) {
      const [fx, fy] = B.route[B.route.length - 1];
      for (const [ox, oy] of [[-1.4, 0.6], [1.2, -0.8], [0.6, 1.6]]) {
        const p = iso(fx + ox, fy + oy, SEA_Z);
        this.buoys.push(this.add.image(p.x, p.y, 'buoy').setOrigin(0.5, 0.8).setScale(1 / this.TS).setDepth(depthAt(fx + ox, fy + oy)));
      }
    }
    // gulls
    this.gulls = [];
    for (let k = 0; k < 6; k++) this.gulls.push({ s: this.add.image(0, 0, 'gull', 'g0').setDepth(5000).setScale(0.55), cx: 6 + k * 5, cy: 30 + (k % 3) * 4, r: 2 + k % 3, sp: 0.25 + k * 0.04, a: k });
  }

  // --------------------------------------------------------------- conveyor
  makeConveyor() {
    const S = this.TS, { x, y0, y1, z } = CONVEYOR;
    this.belt = [];
    for (let y = y1; y < y0; y++) {
      const key = 'belt_' + y;
      const legs = !isRoad(Math.floor(x), y);
      if (!this.textures.exists(key)) {
        const t = this.textures.createCanvas(key, 80 * S, 90 * S);
        const P = new Painter(t.getContext(), 40 * S, 70 * S, S);
        if (legs) { P.box(-0.28, 0.4, 0, 0.06, 0.06, z, '#7d8790', { edge: false }); P.box(0.22, 0.4, 0, 0.06, 0.06, z, '#7d8790', { edge: false }); }
        P.box(-0.3, 0, z, 0.6, 1, 4, '#6f7a85');
        P.box(-0.25, 0, z + 4, 0.5, 1, 0.5, '#2f3640', { edge: false });
        P.box(-0.3, 0, z + 4, 0.05, 1, 3, '#f6c531', { edge: false });
        P.box(0.25, 0, z + 4, 0.05, 1, 3, '#f6c531', { edge: false });
        t.refresh();
      }
      const p = iso(x, y);
      this.belt.push(this.add.image(p.x, p.y, key).setOrigin(0.5, 70 / 90).setScale(1 / S).setDepth(depthAt(x, y + 1) + 40));
    }
    this.cboxes = [];
  }

  // ------------------------------------------------------------ stock piles
  makeStocks() {
    const mk = (key, slots) => slots.map(([x, y, z]) => {
      const p = iso(x, y, z);
      return this.add.image(p.x, p.y, key).setOrigin(0.5, 16 / 30).setScale(1 / this.TS).setDepth(depthAt(x, y) + z * 0.1).setVisible(false);
    });
    const grid = (x0, y0, nx, ny, layers, dz = 9) => {
      const s = [];
      for (let l = 0; l < layers; l++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) s.push([x0 + i * 0.5, y0 + j * 0.5, l * dz]);
      return s;
    };
    this.piles = {
      quay: { spr: mk('crate_raw', grid(12.9, 28.25, 6, 1, 3)), per: () => 40 / 18 },
      wh: { spr: mk('crate_raw', grid(34.6, 18.4, 3, 9, 2)), per: () => 4 },
      facOut: { spr: mk('crate_prod', grid(26.1, 10.6, 4, 1, 3)), per: () => 3 },
      mProd: { spr: mk('crate_prod', grid(13.15, 24.15, 2, 2, 2)), per: () => 3 },
      mRaw: { spr: mk('crate_raw', grid(14.35, 24.15, 2, 2, 2)), per: () => 3 },
      facCan: { spr: mk('crate_can', grid(26.1, 10.1, 4, 1, 3)), per: () => 3 },
      mCan: { spr: mk('crate_can', grid(15.55, 24.15, 2, 2, 2)), per: () => 3 },
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
    const chims = [[1.2, 1.6, 104], [2.4, 1.6, 92]];
    this.smoke = chims.map(([x, y, z], i) => {
      const p = iso(BUILDINGS.factory.x + x, BUILDINGS.factory.y + y, z + 4);
      return this.add.particles(p.x, p.y, 'puff', {
        speedX: { min: 4, max: 12 }, speedY: { min: -22, max: -12 }, scale: { start: 0.18, end: 0.75 },
        alpha: { start: 0.75, end: 0 }, lifespan: 3600, frequency: 220, emitting: false,
      }).setDepth(9000);
    });
    this.spray = this.add.particles(this.fountain.x, this.fountain.y - 24, 'drop', {
      speedX: { min: -14, max: 14 }, speedY: { min: -46, max: -30 }, gravityY: 90, lifespan: 900,
      scale: { start: 0.6, end: 0.3 }, alpha: { start: 0.9, end: 0.2 }, frequency: 40,
    }).setDepth(depthAt(19.5, 7.5) + 1);
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

  floatAt(x, y, str, col) { this.floatText(x, y, str, col); }
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
    // show about 30 tiles across on landscape phones, fewer on portrait
    this.minZ = Math.max(0.35, Math.min(w / 2600, h / 1500)) * dpr;
    this.maxZ = 2.4 * dpr;
    const target = Math.sqrt(w * h) / 1100 * dpr;
    if (!keep) cam.setZoom(Phaser.Math.Clamp(target, this.minZ, this.maxZ));
    else cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZ, this.maxZ));
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
      if (this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), s.texture.key) > 20) {
        this.tweens.add({ targets: s, scaleY: { from: s.scaleX * 0.94, to: s.scaleX }, duration: 260, ease: 'Back.Out' });
        bus.emit('tapBuilding', s.bid);
        return;
      }
    }
    // tapping water near the harbour opens the harbour too
    const g = unIso(wp.x, wp.y - SEA_Z);
    if (g.y > 28 && g.x > 2 && g.x < 26) bus.emit('tapBuilding', 'harbor');
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
    if (this.vel && !this.input.activePointer.isDown) {
      cam.scrollX += this.vel.x; cam.scrollY += this.vel.y;
      this.vel.x *= 0.86; this.vel.y *= 0.86;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.y) < 0.1) this.vel = null;
    }
    this.w1.tilePositionX = t * 7; this.w1.tilePositionY = t * 2;
    this.w2.tilePositionX = -t * 4; this.w2.tilePositionY = t * 3;
    this.beam.setAlpha(0.35 + 0.3 * Math.sin(t * 2));
    for (const b of this.buoys) b.setAngle(Math.sin(t * 2 + b.x) * 8);
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
      this.boatSpr.push(this.add.image(0, 0, 'boat_0_3').setOrigin(BOAT_TEX.ox / BOAT_TEX.W, BOAT_TEX.oy / BOAT_TEX.H).setScale(1 / this.TS));
    }
    sim.boats.forEach((b, i) => {
      const s = this.boatSpr[i], m = b.m;
      const dir = Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx > 0 ? 0 : 2) : (m.dy > 0 ? 1 : 3);
      s.setTexture(`boat_${stat.boatType(i)}_${dir}`);
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
    while (this.workerSpr.length < sim.workers.length) this.workerSpr.push(this.add.sprite(0, 0, 'p_worker', 'none_0_0').setOrigin(0.5, 33 / 36).setScale(1 / G.quality.ppl));
    sim.workers.forEach((w, i) => this.placeWalker(this.workerSpr[i], w.m, w.carry > 0 ? w.cargo : 'none', w, t));
    // forklifts & trucks
    this.vehSpr = this.vehSpr || [];
    while (this.vehSpr.length < sim.vehicles.length) this.vehSpr.push(this.add.image(0, 0, 'truck_0_0').setOrigin(VEH_TEX.ox / VEH_TEX.W, VEH_TEX.oy / VEH_TEX.H).setScale(1 / this.TS));
    sim.vehicles.forEach((v, i) => {
      const s = this.vehSpr[i], m = v.m;
      const dir = Math.abs(m.dx) > Math.abs(m.dy) ? (m.dx > 0 ? 0 : 2) : (m.dy > 0 ? 1 : 3);
      s.setTexture(`${v.kind === 'truck' ? 'truck' : 'fork'}_${dir}_${v.carry > 0 ? 1 : 0}`);
      const p = iso(m.x, m.y, m.moving ? Math.sin(t * 20 + i) * 0.4 : 0);
      s.setPosition(p.x, p.y).setDepth(depthAt(m.x, m.y) + 2).setVisible(!v.hidden);
    });
    // customers (pooled sprites)
    const used = new Set();
    for (const c of sim.customers) {
      if (!c.spr) {
        c.spr = this.custPool.pop() || this.add.sprite(0, 0, 'p_c0', 'none_0_0').setOrigin(0.5, 33 / 36).setScale(1 / G.quality.ppl);
        c.spr.setTexture('p_c' + c.look).setVisible(true);
      }
      used.add(c.spr);
      this.placeWalker(c.spr, c.m, c.state === 'out' && c.bag ? 'bag' : 'none', c, t);
    }
    for (const s of this.custSpr) if (!used.has(s)) { s.setVisible(false); this.custPool.push(s); }
    this.custSpr = [...used];
  }
  placeWalker(s, m, carry, ent, t) {
    const p = iso(m.x, m.y);
    const sx = m.dx - m.dy, sy = m.dx + m.dy;
    const back = sy < -0.01 ? 1 : 0;
    ent.walkT = (ent.walkT || 0) + (m.moving ? 1 : 0);
    const k = m.moving ? Math.floor(ent.walkT / 6) % 4 : 0;
    s.setFrame(`${carry}_${back}_${k}`);
    s.setFlipX(back ? sx > 0 : sx < 0);
    s.setPosition(p.x, p.y).setDepth(depthAt(m.x, m.y) + 1);
  }

  drawConveyor() {
    const sim = this.sim, { x, y0, y1, z } = CONVEYOR;
    while (this.cboxes.length < sim.convey.length) this.cboxes.push(this.add.image(0, 0, 'cbox').setOrigin(0.5, 12 / 20).setScale(1 / this.TS));
    this.cboxes.forEach((b, i) => {
      const c = sim.convey[i];
      if (!c) { b.setVisible(false); return; }
      const y = y0 - (y0 - y1) * (c.t / CONVEY_TIME);
      const p = iso(x, y, z + 5);
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
