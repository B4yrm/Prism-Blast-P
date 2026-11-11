// Production simulation: boats → quay → haulers → warehouse → conveyor →
// factory → haulers → market → customers → cash register.
// Pure logic in tile coordinates; WorldScene only reads it to draw.
import { BERTHS, BUILDINGS, POI, CONVEYOR } from '../config.js';
import { findPath } from './path.js';
import { G, stat, addXp, addMoney } from '../core/economy.js';
import { VEHICLES } from '../data/defs.js';
import { bus } from '../core/bus.js';

const door = b => BUILDINGS[b].door;
const PLACES = {
  quay: POI.quay, wh: door('warehouse'), fac: door('factory'), mkt: door('market'), rest: POI.rest,
  facR: POI.facRoad, mktR: POI.mktRoad, export: POI.spawn, garage: POI.garage, lift: POI.lift,
};
export const CONVEY_TIME = 4;

class Mover {
  constructor(x, y, speed) {
    this.x = x; this.y = y; this.speed = speed; this.path = null; this.idx = 0;
    this.dx = 0; this.dy = 1; this.moving = false;
    this.lane = (Math.random() - 0.5) * 0.5;
  }
  go(path, laneOk = true) {
    this.path = path.map(p => laneOk ? [p[0] + this.lane, p[1] + this.lane] : p);
    this.idx = 0;
  }
  // returns true when the path end is reached
  step(dt) {
    if (!this.path) { this.moving = false; return true; }
    let rem = this.speed * dt;
    while (rem > 0 && this.idx < this.path.length) {
      const [tx, ty] = this.path[this.idx];
      const ex = tx - this.x, ey = ty - this.y, d = Math.hypot(ex, ey);
      if (d < 1e-4) { this.idx++; continue; }
      this.dx = ex / d; this.dy = ey / d;
      const m = Math.min(rem, d);
      this.x += this.dx * m; this.y += this.dy * m; rem -= m;
      if (m === d) this.idx++;
    }
    this.moving = this.idx < this.path.length;
    if (!this.moving) this.path = null;
    return !this.moving;
  }
}

export class Sim {
  constructor() {
    this.boats = []; this.workers = []; this.vehicles = []; this.customers = []; this.convey = [];
    this.res = { quay: 0, wh: 0, facOut: 0, facCan: 0, mRaw: 0, mProd: 0, mCan: 0 };   // reserved for pick-up
    this.inc = { wh: 0, mRaw: 0, mProd: 0, mCan: 0 };                       // reserved incoming
    this.custT = 1; this.facAcc = 0; this.queue = [];
    this.win = new Array(60).fill(0); this.winI = 0; this.winT = 0;
    this.warnT = 0; this.collectT = 0;
    this.sync();
  }

  get S() { return G.S; }

  sync() {
    while (this.boats.length < this.S.boats) this.addBoat(this.boats.length);
    while (this.workers.length < this.S.workers) this.addWorker(this.workers.length);
    for (const kind of ['forklift', 'truck'])
      while (this.vehicles.filter(v => v.kind === kind).length < this.S[kind + 's']) this.addVehicle(kind);
  }

  addBoat(i) {
    const B = BERTHS[i % BERTHS.length];
    const m = new Mover(B.at[0], B.at[1], 1);
    m.dx = 0; m.dy = -1;
    this.boats.push({ i, m, berth: B, state: 'dock', t: 1.5 + i * 2, load: 0, bob: Math.random() * 6 });
  }

  addWorker(i) {
    const [x, y] = this.boats.length ? POI.rest : POI.rest;
    const m = new Mover(x + 0.5, y + 0.5, stat.workerSpeed());
    this.workers.push({ i, kind: 'worker', m, state: 'idle', t: 0.3 * i, job: null, carry: 0, cargo: null });
  }

  addVehicle(kind) {
    const at = kind === 'truck' ? PLACES.garage : PLACES.lift;
    const m = new Mover(at[0] + 0.5, at[1] + 0.5, VEHICLES[kind].speed);
    m.lane = kind === 'truck' ? 0.25 : (Math.random() - 0.5) * 0.3;
    const i = this.vehicles.filter(v => v.kind === kind).length;
    this.vehicles.push({ i, kind, m, state: 'idle', t: 0.5 + i, job: null, carry: 0, cargo: null });
  }

  cap(k) {
    switch (k) {
      case 'quay': return stat.quayCap();
      case 'wh': return stat.whCap();
      case 'facOut': case 'facCan': return stat.facOutCap();
      default: return stat.shelfCap();
    }
  }

  update(dt) {
    const S = this.S;
    this.sync();
    for (const b of this.boats) this.updBoat(b, dt);
    for (const w of this.workers) this.updCarrier(w, dt);
    for (const v of this.vehicles) this.updCarrier(v, dt);
    this.updFactory(dt);
    this.updCustomers(dt);
    this.winT += dt;
    if (this.winT >= 1) { this.winT -= 1; this.winI = (this.winI + 1) % 60; this.win[this.winI] = 0; }
    this.warnT = Math.max(0, this.warnT - dt);
    if (stat.autoCollect() && S.register > 0) {
      this.collectT += dt;
      if (this.collectT > 2) { this.collectT = 0; this.collect(true); }
    }
  }

  incomePerMin() {
    let s = 0;
    for (const v of this.win) s += v;
    return s;
  }

  collect(auto) {
    const S = this.S, v = Math.floor(S.register);
    if (v <= 0) return 0;
    S.register -= v; addMoney(v); S.stats.collected += v;
    bus.emit('collect', { v, auto });
    return v;
  }

  // ---- boats ---------------------------------------------------------------
  updBoat(b, dt) {
    const S = this.S, m = b.m;
    m.speed = stat.boatSpeedOf(b.i);
    b.bob += dt;
    switch (b.state) {
      case 'dock': {
        if (b.load > 0) {
          const space = stat.quayCap() - S.stock.quay;
          if (space <= 0) { b.blocked = true; break; }
          b.blocked = false;
          b.frac = (b.frac || 0) + stat.boatCapOf(b.i) / 2.5 * dt;
          const k = Math.floor(Math.min(b.frac, b.load, space));
          if (k > 0) { b.frac -= k; b.load -= k; S.stock.quay += k; b.unloading = 0.4; bus.emit('unload', { b }); }
          b.unloading = Math.max(0, (b.unloading || 0) - dt);
          if (b.load <= 0) { b.load = 0; b.t = 1.2; }
          break;
        }
        b.unloading = 0;
        b.t -= dt;
        if (b.t <= 0) { b.state = 'out'; m.go([[b.berth.at[0], b.berth.at[1] + 1.5], ...b.berth.route], false); bus.emit('horn', { b }); }
        break;
      }
      case 'out':
        if (m.step(dt)) { b.state = 'fish'; b.t = stat.fishTime(); b.cap = stat.boatCapOf(b.i); }
        break;
      case 'fish':
        b.t -= dt;
        b.load = Math.round(b.cap * (1 - Math.max(0, b.t) / stat.fishTime()));
        if (Math.random() < dt * 1.2) bus.emit('splash', { b });
        if (b.t <= 0) {
          b.load = b.cap; S.stats.caught += b.cap; addXp(1);
          b.state = 'back';
          const r = [...b.berth.route].reverse().slice(1);
          m.go([...r, [b.berth.at[0], b.berth.at[1] + 1.5], b.berth.at], false);
        }
        break;
      case 'back':
        if (m.step(dt)) { b.state = 'dock'; m.dx = 0; m.dy = -1; }
        break;
    }
  }

  // ---- haulers & vehicles ---------------------------------------------------
  // Every carrier (hauler, forklift, truck) runs the same job loop; the job
  // menu depends on its kind and, for haulers, on the assigned role.
  carrierCap(a) {
    return a.kind === 'worker' ? stat.carry() : VEHICLES[a.kind].cap;
  }

  pickJob(a) {
    const S = this.S, st = S.stock, carry = this.carrierCap(a);
    const avail = k => st[k] - this.res[k];
    const space = k => k === 'export' ? Infinity : this.cap(k) - st[k] - this.inc[k];
    const jobs = [];
    const add = (src, dst, from, to, kind, prio) => {
      const n = Math.min(carry, avail(src), space(dst));
      if (n > 0) jobs.push({ src, dst, from, to, kind, n, score: prio * (avail(src) / this.cap(src)) + n / carry });
    };
    const role = a.kind === 'worker' ? (S.roles[a.i] || 'any') : null;
    const port = a.kind === 'forklift' || role === 'any' || role === 'port';
    const shop = a.kind === 'truck' || role === 'any' || role === 'shop';
    const R = a.kind === 'truck' ? 'R' : '';
    if (port && a.kind !== 'truck') add('quay', 'wh', 'quay', 'wh', 'raw', a.kind === 'forklift' ? 2 : 1.2);
    if (shop && S.tier.factory) {
      add('facOut', 'mProd', 'fac' + R, 'mkt' + R, 'prod', 1.4);
      add('facCan', 'mCan', 'fac' + R, 'mkt' + R, 'can', 1.6);
      if (a.kind === 'truck') {
        // shelves nearly full and factory stock piling up → sell wholesale
        if (st.facOut > this.cap('facOut') * 0.4 && space('mProd') < carry) add('facOut', 'export', 'facR', 'export', 'prod', 1.1);
        if (st.facCan > this.cap('facCan') * 0.4 && space('mCan') < carry) add('facCan', 'export', 'facR', 'export', 'can', 1.2);
      }
    }
    if (shop && a.kind === 'worker' && (!S.tier.factory || st.wh > this.cap('wh') * 0.7)) add('wh', 'mRaw', 'wh', 'mkt', 'raw', S.tier.factory ? 0.6 : 1);
    if (!jobs.length) return null;
    jobs.sort((x, y) => y.score - x.score);
    return jobs[0];
  }

  restOf(a) { return a.kind === 'worker' ? PLACES.rest : a.kind === 'truck' ? PLACES.garage : PLACES.lift; }

  updCarrier(a, dt) {
    const S = this.S, m = a.m;
    m.speed = a.kind === 'worker' ? stat.workerSpeed() : VEHICLES[a.kind].speed * (1 + 0.08 * S.up.hq.train);
    const load = a.kind === 'worker' ? stat.loadTime() : stat.loadTime() * 1.6;
    switch (a.state) {
      case 'idle': {
        a.t -= dt;
        if (a.t > 0) break;
        const j = this.pickJob(a);
        if (!j) {
          a.t = 1;
          const r = this.restOf(a);
          if (Math.abs(m.x - r[0] - 0.5) + Math.abs(m.y - r[1] - 0.5) > 1.5) this.walk(a, r, 'toRest');
          break;
        }
        a.job = j; this.res[j.src] += j.n; if (j.dst !== 'export') this.inc[j.dst] += j.n;
        this.walk(a, PLACES[j.from], 'toSrc');
        break;
      }
      case 'toRest': if (m.step(dt)) { a.state = 'idle'; a.t = 0.5; } break;
      case 'toSrc': if (m.step(dt)) { a.state = 'pick'; a.t = load; } break;
      case 'pick':
        a.t -= dt;
        if (a.t <= 0) {
          const j = a.job, take = Math.min(j.n, S.stock[j.src]);
          S.stock[j.src] -= take; this.res[j.src] -= j.n;
          a.carry = take; a.cargo = j.kind;
          if (take <= 0) { if (j.dst !== 'export') this.inc[j.dst] -= j.n; a.job = null; a.state = 'idle'; a.t = 0.2; break; }
          this.walk(a, PLACES[j.to], 'toDst');
        }
        break;
      case 'toDst':
        if (m.step(dt)) {
          a.state = 'drop'; a.t = load;
          if (a.job.dst === 'export') { a.state = 'away'; a.t = 3; a.hidden = true; }
        }
        break;
      case 'away':
        a.t -= dt;
        if (a.t <= 0) {
          const j = a.job, price = j.kind === 'can' ? stat.canPrice() : stat.prodPrice();
          const v = Math.round(a.carry * price * stat.exportMul());
          addMoney(v); S.stats.exported += a.carry;
          this.win[this.winI] += v;
          bus.emit('export', { v, n: a.carry });
          a.hidden = false; a.carry = 0; a.cargo = null; a.job = null; a.state = 'idle'; a.t = 0.1;
        }
        break;
      case 'drop':
        a.t -= dt;
        if (a.t <= 0) {
          const j = a.job;
          S.stock[j.dst] = Math.min(this.cap(j.dst), S.stock[j.dst] + a.carry);
          this.inc[j.dst] -= j.n;
          bus.emit('drop', { a, dst: j.dst, n: a.carry });
          a.carry = 0; a.cargo = null; a.job = null; a.state = 'idle'; a.t = 0.15;
        }
        break;
    }
  }

  walk(a, to, state) {
    const m = a.m;
    const from = [Math.floor(m.x - m.lane), Math.floor(m.y - m.lane)];
    const p = findPath(from, to, a.kind === 'truck');
    if (!p) { m.x = to[0] + 0.5; m.y = to[1] + 0.5; a.state = state; m.path = null; return; }
    m.go(p);
    a.state = state;
  }

  // ---- factory: fillet line + canning line ---------------------------------
  updFactory(dt) {
    const S = this.S, st = S.stock;
    for (const c of this.convey) c.t += dt;
    while (this.convey.length && this.convey[0].t >= CONVEY_TIME) {
      const c = this.convey.shift();
      st[c.out]++;
      bus.emit('produce', c.out);
    }
    if (!S.tier.factory) return;
    const line = (accKey, rate, out) => {
      this[accKey] = Math.min(3, (this[accKey] || 0) + rate * dt);
      while (this[accKey] >= 1) {
        const inTransit = this.convey.filter(c => c.out === out).length;
        const room = this.cap(out) - st[out] - inTransit;
        if (st.wh - this.res.wh <= 0 || room <= 0) { this[accKey] = Math.min(this[accKey], 1); break; }
        this[accKey] -= 1; st.wh--;
        this.convey.push({ t: 0, out });
      }
    };
    line('canAcc', stat.canRate(), 'facCan');
    line('facAcc', stat.facRate(), 'facOut');
  }
  facBusy() { return this.convey.length > 0; }

  // ---- customers -------------------------------------------------------------
  updCustomers(dt) {
    const S = this.S, st = S.stock;
    this.custT -= dt;
    if (this.custT <= 0) {
      this.custT = stat.custEvery() * (0.6 + Math.random() * 0.8);
      if (this.customers.length < 14 && this.queue.length < POI.queue.length) this.spawnCustomer();
    }
    for (const c of this.customers) {
      const m = c.m;
      switch (c.state) {
        case 'in':
          if (m.step(dt)) { c.state = 'queue'; this.toSlot(c); }
          break;
        case 'queue': {
          m.step(dt);
          const qi = this.queue.indexOf(c);
          if (qi === 0 && !m.path) {
            c.t -= dt;
            if (c.t <= 0) this.serve(c);
          } else if (qi > 0) c.patience -= dt * 0.2;
          if (c.patience <= 0 && c.state === 'queue') this.leave(c, false);
          break;
        }
        case 'out':
          if (m.step(dt)) c.dead = true;
          break;
      }
    }
    if (this.customers.some(c => c.dead)) this.customers = this.customers.filter(c => !c.dead);
    if (st.mRaw < 0) st.mRaw = 0;
  }

  spawnCustomer() {
    const [sx, sy] = POI.spawn;
    const m = new Mover(sx + 0.5, sy + 0.5, 1.6 + Math.random() * 0.5);
    const c = { m, state: 'in', t: 1.2, patience: 8, look: Math.floor(Math.random() * 6), bag: 0 };
    this.queue.push(c);
    const slot = POI.queue[this.queue.length - 1];
    const p = findPath(POI.spawn, slot);
    m.go(p); m.path[m.path.length - 1] = [slot[0] + 0.5, slot[1] + 0.5];
    this.customers.push(c);
  }

  toSlot(c) {
    const qi = this.queue.indexOf(c);
    if (qi < 0) return;
    const s = POI.queue[qi];
    c.m.path = [[s[0] + 0.5, s[1] + 0.5]]; c.m.idx = 0;
  }

  serve(c) {
    const S = this.S, st = S.stock;
    if (S.register >= stat.tillCap() && !stat.autoCollect()) {
      c.t = 0.5; c.patience -= 0.5;
      if (this.warnT <= 0) { bus.emit('toast', { t: 'Kassa doludur! "Topla" düyməsinə bas.', warn: true }); this.warnT = 20; }
      return;
    }
    let want = 1 + Math.floor(Math.random() * 3), units = 0, amt = 0, prod = 0;
    let can = 0;
    while (want > 0 && st.mCan > 0) { st.mCan--; want--; units++; can++; amt += stat.canPrice(); }
    while (want > 0 && st.mProd > 0) { st.mProd--; want--; units++; prod++; amt += stat.prodPrice(); }
    while (want > 0 && st.mRaw > 0) { st.mRaw--; want--; units++; amt += stat.rawPrice(); }
    if (!units) { c.t = 0.6; c.patience -= 0.6; return; }
    amt = Math.round(amt);
    S.register += amt;
    S.stats.sold += units; S.stats.soldProd += prod; S.stats.soldCan += can;
    this.win[this.winI] += amt;
    addXp(units);
    c.bag = units;
    bus.emit('sale', { amt, units, x: c.m.x, y: c.m.y });
    this.leave(c, true);
  }

  leave(c, happy) {
    const qi = this.queue.indexOf(c);
    if (qi >= 0) this.queue.splice(qi, 1);
    this.queue.forEach((o, i) => {
      if (o.state === 'queue') this.toSlot(o);
      else if (o.m.path) { const s = POI.queue[i]; o.m.path[o.m.path.length - 1] = [s[0] + 0.5, s[1] + 0.5]; }
    });
    c.state = 'out'; c.happy = happy;
    if (!happy) bus.emit('sad', { x: c.m.x, y: c.m.y });
    const from = [Math.floor(c.m.x), Math.floor(c.m.y)];
    const p = findPath(from, POI.spawn);
    c.m.go(p || [POI.spawn]);
  }
}

export { PLACES, CONVEYOR };
