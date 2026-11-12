// The two outer jetties (render only). They are built once the harbour's nets
// reach level 18 and its engine level 14 — no new currency, no payment — in a
// short visible sequence: piles are driven, the deck is laid from the shore
// outwards, then bollards and fenders go on. When finished, G.S.harborOuter = 1
// is saved, so after a restart they are simply there.
// Carts (visual only) shuttle crates from a boat unloading at an outer berth
// to the crate pile on the quay; the simulation's unloading is unchanged.
import { SEA_Z } from '../config.js';
import { addSprite, has } from './atlas.js';
import { JETTIES, OUTER_X, OUTER_JETTY, outerBollards } from './boatpaths.js';
import { G } from '../core/economy.js';
import { save } from '../core/state.js';

const iso = (x, y, z = 0) => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const depthAt = (x, y) => (x + y) * 16;
const BUILD_S = 7;                                   // seconds the construction takes
export const outerUnlocked = () => G.S.up.harbor.net >= 18 && G.S.up.harbor.speed >= 14;
// cart routes: jetty berth area → jetty root → along the shore → crate pile on the quay
const CART_ROUTES = [
  [[30.5, 28.2], [30.5, 20.7], [24.2, 20.7], [22.4, 22.55], [13.2, 22.55]],
  [[-3.5, 28.2], [-3.5, 21.7], [1.4, 21.7], [2.6, 22.55], [10.8, 22.55]],
];

export class Jetties {
  constructor(scene) {
    this.sc = scene;
    this.built = G.S.harborOuter === 1;
    this.progress = this.built ? 1 : 0;
    this.rows = [];                                  // per jetty, per tile row: graphics
    for (let j = 0; j < JETTIES.length; j++) {
      const [x0, y0, x1, y1] = JETTIES[j];
      for (let y = y0; y < y1 - 1e-6; y += 1) this.rows.push({ j, x0, x1, ya: y, yb: Math.min(y1, y + 1), g: scene.add.graphics().setDepth(depthAt(x1, Math.min(y1, y + 1)) - 2) });
    }
    this.extras = [];                               // bollards and fenders
    for (let i = 0; i < 4; i++) for (const [x, y] of outerBollards(i)) {
      if (!has('prop/bollard')) continue;
      const p = iso(x, y);
      this.extras.push(addSprite(scene, p.x, p.y, 'prop/bollard', 1.15).setDepth(depthAt(x, y) + 2));
    }
    this.fenders = JETTIES.map(([, , x1, y1]) => scene.add.graphics().setDepth(depthAt(x1, y1) - 1));
    this.carts = CART_ROUTES.map(route => this.makeCart(route));
    this.dust = scene.add.particles(0, 0, 'puff', { speed: { min: 6, max: 20 }, scale: { start: 0.12, end: 0.4 }, alpha: { start: 0.55, end: 0 }, lifespan: 900, emitting: false, tint: 0xd9c7a5 }).setDepth(9000);
    this.dustT = 0;
    this.draw();
  }
  makeCart(route) {
    const pts = route.map(([x, y]) => ({ x, y })), segs = [];
    let L = 0;
    for (let k = 1; k < pts.length; k++) { const d = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y); segs.push(d); L += d; }
    const s0 = pts[0], p = iso(s0.x, s0.y);
    const spr = has('prop/forklift_parked') ? addSprite(this.sc, p.x, p.y, 'prop/forklift_parked', 0.55) : null;
    const box = has('prop/crate_raw') ? addSprite(this.sc, p.x, p.y, 'prop/crate_raw', 1.3) : null;
    return { pts, segs, L, s: 0, dir: 1, busy: 0, spr, box };
  }
  // the simulation unloads a boat at outer berth i: keep its jetty's cart going
  unloading(i) { const c = this.carts[OUTER_JETTY[i]]; if (c) c.busy = 2.5; }
  update(t, dt) {
    if (!this.built && outerUnlocked()) {
      this.progress = Math.min(1, this.progress + dt / BUILD_S);
      this.dustT -= dt;
      if (this.dustT <= 0) {               // dust and splashes where the work goes on
        this.dustT = 0.12;
        const [x0, y0, x1, y1] = JETTIES[Math.random() < 0.5 ? 0 : 1], y = y0 + (y1 - y0) * Math.min(1, this.progress * 1.2), q = iso((x0 + x1) / 2, y, 6);
        this.dust.emitParticleAt(q.x + (Math.random() - 0.5) * 20, q.y, 2);
      }
      this.draw();
      if (this.progress >= 1) { this.built = true; G.S.harborOuter = 1; save(G.S); console.log('OUTER jetties built'); }
    }
    for (const c of this.carts) this.moveCart(c, dt);
  }
  moveCart(c, dt) {
    const show = this.built;
    if (c.spr) c.spr.setVisible(show);
    if (!show) { if (c.box) c.box.setVisible(false); return; }
    c.busy -= dt;
    // shuttle while a boat unloads; afterwards go back to the jetty and wait
    if (c.busy > 0 || c.s > 0) {
      if (c.busy <= 0 && c.dir > 0) c.dir = -1;
      c.s += c.dir * 3.2 * dt;
      if (c.s >= c.L) { c.s = c.L; c.dir = -1; }
      if (c.s <= 0) { c.s = 0; c.dir = 1; }
    }
    let s = c.s, k = 0;
    while (k < c.segs.length - 1 && s > c.segs[k]) { s -= c.segs[k]; k++; }
    const a = c.pts[k], b = c.pts[k + 1], f = Math.min(1, s / c.segs[k]);
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, p = iso(x, y);
    c.spr.setPosition(p.x, p.y).setDepth(depthAt(x, y) + 6).setFlipX((b.x - a.x) - (b.y - a.y) < 0 === (c.dir > 0));
    if (c.box) c.box.setVisible(c.dir > 0 && (c.busy > 0 || c.s > 0)).setPosition(p.x, p.y - 14).setDepth(depthAt(x, y) + 7);
  }
  // timber deck on piles, drawn tile row by tile row (so boats alongside sort correctly)
  draw() {
    const P = this.progress, piles = Math.min(1, P / 0.35), deck = Math.max(0, Math.min(1, (P - 0.35) / 0.45)), fit = Math.max(0, (P - 0.8) / 0.2);
    for (const r of this.rows) {
      const g = r.g; g.clear();
      const [, y0, , y1] = JETTIES[r.j], len = y1 - y0, rowEnd = (r.yb - y0) / len, rowStart = (r.ya - y0) / len;
      // piles rise along the whole jetty first
      if (piles > rowStart) {
        const h = 22 * Math.min(1, (piles - rowStart) * 3);
        for (const x of [r.x0 + 0.1, r.x1 - 0.1]) for (let y = r.ya + 0.3; y < r.yb; y += 0.6) {
          const a = iso(x, y, SEA_Z + h), b = iso(x, y, SEA_Z - 6);
          g.fillStyle(0x4a2f1c, 1).fillRect(a.x - 2.5, a.y, 5, b.y - a.y);
        }
      }
      // deck laid from the shore outwards
      if (deck > rowStart) {
        const yb = r.ya + (r.yb - r.ya) * Math.min(1, (deck - rowStart) / Math.max(1e-3, rowEnd - rowStart));
        const c = [iso(r.x0, r.ya), iso(r.x1, r.ya), iso(r.x1, yb), iso(r.x0, yb)];
        g.fillStyle(0x9c6a3e, 1).fillPoints([iso(r.x1, r.ya), iso(r.x1, yb), iso(r.x1, yb, -6), iso(r.x1, r.ya, -6)], true);
        if (yb >= y1 - 1e-6 || r.yb >= y1 - 1e-6) g.fillStyle(0x8a5a33, 1).fillPoints([iso(r.x0, yb), iso(r.x1, yb), iso(r.x1, yb, -6), iso(r.x0, yb, -6)], true);
        g.fillStyle(0xc68a52, 1).fillPoints(c, true);
        g.lineStyle(1, 0x8f5d33, 0.8);
        for (let y = r.ya + 0.25; y < yb - 0.01; y += 0.25) { const a = iso(r.x0, y), b = iso(r.x1, y); g.lineBetween(a.x, a.y, b.x, b.y); }
        g.lineStyle(1.4, 0x6e4526, 0.9); { const a = iso(r.x0, r.ya), b = iso(r.x0, yb); g.lineBetween(a.x, a.y, b.x, b.y); }
      }
    }
    for (const e of this.extras) e.setVisible(fit > 0).setAlpha(fit);
    // tyre fenders along the berth sides
    for (const f of this.fenders) f.clear();
    if (fit > 0) for (let i = 0; i < 4; i++) {
      const [x0, , x1] = JETTIES[OUTER_JETTY[i]], x = OUTER_X[i] < x0 ? x0 - 0.04 : x1 + 0.04, f = this.fenders[OUTER_JETTY[i]];
      for (const y of [27.6, 29.0, 30.2]) { const q = iso(x, y, -3); f.fillStyle(0x23262b, fit).fillEllipse(q.x, q.y, 7, 9); }
    }
  }
}
