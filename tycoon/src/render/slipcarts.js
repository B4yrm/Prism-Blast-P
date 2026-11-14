// Small forklift carts at the slips that have no crane (render only). While the
// simulation unloads the boat lying in that slip — and only while that boat is
// really moored there (WorldScene.craneWork checks fleet.mooredSite) — the cart
// shuttles between the boat's bow and the quay with a crate, then parks at the
// quay end. Nothing here changes the simulation or its unloading rate.
import { addSprite, has } from './atlas.js';

const iso = (x, y, z = 0) => ({ x: (x - y) * 32, y: (x + y) * 16 - z });
const depthAt = (x, y) => (x + y) * 16;
const BOW_Y = 23.75, QUAY_Y = 22.85, SPEED = 1.3, BUSY = 1.4;

export class SlipCarts {
  // slips: indices into VBERTH that get a cart; x: the slip's centre line
  constructor(scene, slips) {
    this.carts = slips.map(({ k, x }) => {
      const p = iso(x, QUAY_Y);
      const spr = has('prop/forklift_parked') ? addSprite(scene, p.x, p.y, 'prop/forklift_parked', 0.55) : null;
      const box = has('prop/crate_raw') ? addSprite(scene, p.x, p.y, 'prop/crate_raw', 1.3).setVisible(false) : null;
      return { k, x, s: 0, dir: 1, busy: 0, spr, box };        // s: 0 at the quay end, 1 at the bow
    });
    for (const c of this.carts) this.place(c);
  }
  // the simulation is unloading the boat moored in slip k
  unloading(k) { const c = this.carts.find(q => q.k === k); if (c) c.busy = BUSY; }
  active(k) { const c = this.carts.find(q => q.k === k); return !!c && (c.busy > 0 || c.s > 0); }
  update(dt) {
    for (const c of this.carts) {
      c.busy -= dt;
      if (c.busy > 0 || c.s > 0) {
        // out to the bow empty, back to the quay with a crate; when the unloading has ended, finish the run and park
        if (c.busy <= 0 && c.dir > 0) c.dir = -1;
        c.s += c.dir * SPEED * dt / (BOW_Y - QUAY_Y);
        if (c.s >= 1) { c.s = 1; c.dir = -1; }
        if (c.s <= 0) { c.s = 0; c.dir = 1; }
      }
      this.place(c);
    }
  }
  place(c) {
    if (!c.spr) return;
    const y = QUAY_Y + (BOW_Y - QUAY_Y) * c.s, p = iso(c.x, y);
    c.spr.setPosition(p.x, p.y).setDepth(depthAt(c.x, y) + 6).setFlipX(c.dir < 0);
    // the crate rides on the forks on the way back from the boat
    if (c.box) c.box.setVisible(c.dir < 0 && c.s > 0 && c.s < 1).setPosition(p.x, p.y - 14).setDepth(depthAt(c.x, y) + 7);
  }
}
