// Ambient life & water effects (render-only, never touch the economy):
// road traffic, a shuttling forklift, walker separation, sea glints,
// animated shore foam, coastal rocks, boat wakes and reflections.
import { iso, unIso, isLand, hash, SEA_Z, PIERS } from '../config.js';
import { findPath, roadTiles } from '../sim/path.js';
import { has, addSprite, setSprite } from '../render/atlas.js';

const depthAt = (x, y) => (x + y) * 16;
const inRect = (rs, i, j) => rs.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1);
const dir4 = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);

export class Life {
  constructor(scene) {
    this.sc = scene;
    this.cars = [];
    this.makeCars(5);
    this.makeForklift();
    this.makeShore();
    this.makeGlints(22);
    this.offsets = new Map();
  }

  // ---------------------------------------------------------------- traffic
  makeCars(n) {
    const targets = roadTiles.filter(([i, j]) => isLand(i, j));
    for (let k = 0; k < n; k++) {
      const [i, j] = targets[Math.floor(hash(k * 7, 3) * targets.length)];
      const car = { isCar: true, x: i + 0.5, y: j + 0.5, path: null, idx: 0, dx: 1, dy: 0, wait: 0, col: k % 4, speed: 2.1 + (k % 3) * 0.3, stuck: 0 };
      car.s = addSprite(this.sc, 0, 0, `prop/car_${car.col}_0`);
      this.route(car, targets);
      this.cars.push(car);
    }
    this.targets = targets;
  }
  route(car, targets = this.targets) {
    for (let tries = 0; tries < 6; tries++) {
      const t = targets[Math.floor(Math.random() * targets.length)];
      const p = findPath([Math.floor(car.x), Math.floor(car.y)], t, true);
      if (p && p.length > 1) { car.path = p; car.idx = 1; return; }
    }
    car.path = null;
  }
  // Is something in our lane within reach ahead? Cars only queue behind cars
  // going the same way; people are yielded to only when they stand in our lane.
  blocked(ent, nx, ny, dx, dy, walkers) {
    const lane = ent.isCar ? 0.24 : 0;
    const ox = ent.x - dy * lane, oy = ent.y + dx * lane;
    const check = (x, y, reach, width) => {
      const ex = x - ox, ey = y - oy, along = ex * dx + ey * dy, side = Math.abs(-ex * dy + ey * dx);
      return along > 0.05 && along < reach && side < width;
    };
    for (const c of this.cars) {
      if (c === ent || c.dx * dx + c.dy * dy < 0.7) continue;
      if (check(c.x - c.dy * 0.24, c.y + c.dx * 0.24, 1.2, 0.3)) return true;
    }
    if (this.lift && this.lift !== ent && check(this.lift.x, this.lift.y, 1.1, 0.45)) return true;
    for (const w of walkers) if (check(w.x + (w.ox || 0), w.y + (w.oy || 0), 0.75, 0.32)) return true;
    return false;
  }
  stepCar(car, dt, walkers) {
    if (!car.path) { this.route(car); return; }
    const [tx, ty] = car.path[car.idx];
    // drive on the right-hand side of the road
    const ex = tx - car.x, ey = ty - car.y, d = Math.hypot(ex, ey);
    if (d < 0.05) { car.idx++; if (car.idx >= car.path.length) { car.wait = 0.5 + Math.random() * 2; this.route(car); } return; }
    const dx = ex / d, dy = ey / d;
    car.dx = dx; car.dy = dy;
    if (car.wait > 0) { car.wait -= dt; return; }
    if (this.blocked(car, 0, 0, dx, dy, walkers) && car.stuck < 2.5) { car.stuck += dt; return; }
    car.stuck = 0;
    const m = Math.min(d, car.speed * dt);
    car.x += dx * m; car.y += dy * m;
  }
  drawCar(car) {
    const lx = -car.dy * 0.24, ly = car.dx * 0.24;      // right-hand lane offset
    const p = iso(car.x + lx, car.y + ly);
    const ax = Math.abs(car.dx) > Math.abs(car.dy) ? 0 : 1;
    const name = `prop/car_${car.col}_${ax}`;
    if (car.s.frame.name !== name) setSprite(car.s, name);
    car.s.setPosition(p.x, p.y).setDepth(depthAt(car.x + lx, car.y + ly) + 2);
  }

  // forklift shuttling pallets along the warehouse apron
  makeForklift() {
    if (!has('veh/forklift/0/0')) return;
    this.lift = { x: 16.6, y: 19.55, pts: [[16.6, 19.55], [24.2, 19.55]], to: 1, wait: 1, load: 1, s: addSprite(this.sc, 0, 0, 'veh/forklift/0/1') };
  }
  stepLift(dt, walkers) {
    const L = this.lift; if (!L) return;
    const [tx, ty] = L.pts[L.to], ex = tx - L.x, ey = ty - L.y, d = Math.hypot(ex, ey);
    if (L.wait > 0) { L.wait -= dt; return; }
    if (d < 0.05) { L.to ^= 1; L.wait = 1.6; L.load ^= 1; return; }
    const dx = ex / d, dy = ey / d; L.dx = dx; L.dy = dy;
    if (this.blocked(L, 0, 0, dx, dy, walkers)) return;
    const m = Math.min(d, 1.4 * dt); L.x += dx * m; L.y += dy * m;
  }
  drawLift(t) {
    const L = this.lift; if (!L) return;
    const name = `veh/forklift/${dir4(L.dx || 1, L.dy || 0)}/${L.load}`;
    if (L.s.frame.name !== name) setSprite(L.s, name);
    const p = iso(L.x, L.y, L.wait > 0 ? 0 : Math.sin(t * 18) * 0.3);
    L.s.setPosition(p.x, p.y).setDepth(depthAt(L.x, L.y) + 2);
  }

  // ------------------------------------------------- walkers keep their space
  // Purely visual push-apart so people never overlap (sim positions untouched).
  separate(list) {
    const n = list.length;
    for (let a = 0; a < n; a++) { const o = list[a]; o.ox = o.ox || 0; o.oy = o.oy || 0; o.tx = 0; o.ty = 0; }
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const A = list[a], Bq = list[b];
      const dx = A.x - Bq.x, dy = A.y - Bq.y, d = Math.hypot(dx, dy);
      if (d < 0.42) {
        const k = (0.42 - d) / 2, ux = d > 0.001 ? dx / d : (a % 2 ? 1 : -1), uy = d > 0.001 ? dy / d : 0;
        A.tx += ux * k; A.ty += uy * k; Bq.tx -= ux * k; Bq.ty -= uy * k;
      }
    }
    for (const o of list) { o.ox += (o.tx - o.ox) * 0.2; o.oy += (o.ty - o.oy) * 0.2; }
  }

  // -------------------------------------------------------------- shoreline
  makeShore() {
    const sc = this.sc;
    this.foam = [];
    const isPier = (i, j) => inRect(PIERS, i, j);
    for (let i = -12; i < 54; i++) for (let j = -12; j < 44; j++) {
      if (!isLand(i, j)) continue;
      const edges = [];
      if (!isLand(i, j + 1) && !isPier(i, j + 1)) edges.push([i + 0.5, j + 1.12, 26.57]);
      if (!isLand(i + 1, j)) edges.push([i + 1.12, j + 0.5, -26.57]);
      for (const [x, y, ang] of edges) {
        const p = iso(x, y, SEA_Z);
        const f = sc.add.image(p.x, p.y, 'puff').setScale(0.8, 0.2).setAngle(ang).setDepth(-45).setAlpha(0.6);
        f.base = { x: p.x, y: p.y, ph: hash(i, j) * 6.28, nx: ang > 0 ? -0.45 : 0.45 };
        this.foam.push(f);
        // a few rocks in the surf (outside the harbour)
        const h = hash(i * 3 + 1, j * 5 + 2);
        if (h < 0.22 && !(j >= 21 && i > 0 && i < 26) && has('prop/rock')) {
          const rx = x + (ang > 0 ? 0 : 0.35) + (h - 0.1), ry = y + (ang > 0 ? 0.35 : 0) + (0.1 - h);
          const rp = iso(rx, ry, SEA_Z + 2);
          addSprite(sc, rp.x, rp.y, 'prop/rock', 0.8 + h * 2).setDepth(depthAt(rx, ry) - 6).setFlipX(h < 0.11);
        }
      }
    }
  }
  animShore(t) {
    for (const f of this.foam) {
      const b = f.base, s = Math.sin(t * 1.3 + b.ph);
      f.setPosition(b.x + s * 2.5 * b.nx, b.y + s * 1.6).setAlpha(0.35 + 0.35 * (0.5 + 0.5 * s));
    }
  }

  // ------------------------------------------------------------- sun glints
  makeGlints(n) {
    this.glints = [];
    for (let k = 0; k < n; k++) this.glints.push({ s: this.sc.add.image(0, 0, 'spark').setDepth(-44).setBlendMode('ADD').setVisible(false), life: 0, max: 1 });
  }
  animGlints(dt) {
    const cam = this.sc.cameras.main, v = cam.worldView;
    for (const g of this.glints) {
      g.life -= dt;
      if (g.life <= 0) {
        // respawn on a random visible water spot
        for (let tries = 0; tries < 4; tries++) {
          const x = v.x + Math.random() * v.width, y = v.y + Math.random() * v.height;
          const q = unIso(x, y - SEA_Z);
          if (!isLand(Math.floor(q.x), Math.floor(q.y)) && !inRect(PIERS, Math.floor(q.x), Math.floor(q.y))) {
            g.s.setPosition(x, y).setVisible(true); g.max = g.life = 0.6 + Math.random() * 0.9; break;
          }
        }
      }
      const k = Math.max(0, g.life / g.max), a = Math.sin(k * Math.PI);
      g.s.setScale(0.18 + 0.3 * a).setAlpha(0.9 * a);
    }
  }

  // ------------------------------------------------------ boat wake & mirror
  wake(fx, b, speed) {
    // V-shaped wake from the stern plus bow spray; stronger when faster
    if (speed < 0.2 || Math.random() > 0.35 + speed * 0.2) return;
    const m = b.m, len = 1.6;
    for (const side of [-1, 1]) {
      const sx = m.x - m.dx * len + -m.dy * 0.35 * side, sy = m.y - m.dy * len + m.dx * 0.35 * side;
      const p = iso(sx, sy, SEA_Z);
      fx.emitParticleAt(p.x + (Math.random() - 0.5) * 4, p.y + (Math.random() - 0.5) * 2, 1);
    }
    if (Math.random() < 0.4) { const p = iso(m.x + m.dx * 1.4, m.y + m.dy * 1.4, SEA_Z); fx.emitParticleAt(p.x, p.y, 1); }
  }

  update(t, dt, walkers) {
    for (const c of this.cars) { this.stepCar(c, dt, walkers); this.drawCar(c); }
    this.stepLift(dt, walkers); this.drawLift(t);
    this.animShore(t);
    this.animGlints(dt);
  }
}
