// Boats as the player sees them (render only).
//
// The simulation (sim/sim.js) still moves every boat along its straight route
// with unchanged timings, so trips, catches and income are exactly as before.
// Here each boat follows the manoeuvres of boatpaths.js instead, with a speed
// planned from the simulation's clock: it leaves when the simulation leaves and
// is back in its slip when the simulation starts unloading.
//   docked → cast off → back out of the slip, stop, go ahead → tow the nets
//   → turn for home → glide into the slip → settle and make fast
// Boats leaving wait (or stop) for boats coming home. Hull, reflection,
// shadow, waterline, bow wave, prop wash and mooring lines are drawn per
// preset (quality.boatFx: 2 high, 1 medium, 0 low).
import { iso, SEA_Z, BERTHS } from '../config.js';
import { addSprite, setSprite, has } from './atlas.js';
import { departurePlan, arrivalPlan, fishingPlan, poseAt, curvAt, hullLocal, groundPose, shortDeparture, shortArrival, shortFishing, shortSpot, VBERTH, BOLLARDS, HULL, CLASS_S, DECOR_BOATS, RETURN_FROM, SEA_R, STEP, LINGER } from './boatpaths.js';
import { G, stat } from '../core/economy.js';

const UZ = 39.2, TAU = Math.PI * 2;
const depthAt = (x, y) => (x + y) * 16;
const wrap = a => a - TAU * Math.floor((a + Math.PI) / TAU);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const D_REFL = -51, D_UNDER = -41;

// ---- motion model: speeds as fractions of the cruise speed V, rates per second
const CAP = { reverse: 0.55, sea: 1, glide: 0.75 };
const ACC = 0.45;
const DEC = { reverse: 0.4, sea: 0.3, glide: 0.25, fish: 0.3 };
const FISH_V = 0.3;        // × simulation cruise speed while towing the nets
const CREEP = 0.05;        // last few centimetres into a stop
const DWELL = 0.55;        // s stopped while the gearbox goes from astern to ahead
const PRE_RETURN = 1.0;    // s before the simulation's catch is complete the nets come in
const CAST_AT = 1.15;      // s before the simulation leaves, the lines are let go
const LEAVE_AT = 0.55;     // … and the boat starts backing out
// Visual fishing (cast the net, tow, haul it in) lasts in proportion to the
// simulation's fishing time, never less than FISH_HARD seconds.
const fishVis = F => clamp(0.45 * F, 0.9, 2.5);
const FISH_HARD = 0.7;
const DOCK_EARLY = 0.5;    // s: a boat is in its slip at least this long before unloading starts
const TURN_RATE = 1.0;     // rad/s at the starting engine: a boat slows down rather than turn faster
// cruise share c: the speed planner's knob. Normally a boat cruises at up to
// C_OUT × its speed and manoeuvres in the harbour at up to C_HARBOUR ×. When the
// simulation's whole trip is shorter than a calm run to the fishing grounds
// (heavily upgraded boats) the boats make the short harbour trip instead (see
// shortMode); only to keep the deadline may the animation run a little faster,
// by warp(c) ≤ C_LIMIT / C_OUT.
const C_MIN = 0.6, C_OUT = 1.6, C_LIMIT = 3, C_HARBOUR = 1.2;
const C_FULL = 2.0;        // a trip to the fishing grounds may need at most this
const warp = c => Math.max(1, c / C_OUT);
const Vof = (V0, c, kind) => V0 * (kind === 'sea' ? c : Math.min(c, C_HARBOUR * warp(c)));

// ---- simulation timing (the formulas of sim.js updBoat, read only)
function simOutTime(run, rem, base) {          // speed = base·min(1, 0.3 + run/2.5)
  let t = 0;
  if (run < 1.75 && rem > 0) {
    const r1 = Math.min(1.75, run + rem);
    t += 2.5 / base * Math.log((0.3 + r1 / 2.5) / (0.3 + run / 2.5));
    rem -= r1 - run;
  }
  return t + Math.max(0, rem) / base;
}
function simBackTime(rem, base) {              // speed = base·max(0.22, min(1, rem/3.5))
  let t = 0;
  if (rem > 3.5) { t += (rem - 3.5) / base; rem = 3.5; }
  if (rem > 0.77) { t += 3.5 / base * Math.log(rem / 0.77); rem = 0.77; }
  return t + Math.max(0, rem) / (0.22 * base);
}
function routeLen(B) {                           // the way out and the way back share this polyline
  const P = [B.at, [B.at[0], B.at[1] + 1.5], ...B.route];
  let L = 0;
  for (let k = 1; k < P.length; k++) L += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
  return L;
}

// Highest speed at each point of a path so that the turn rate stays below `rate`,
// braking ahead of the bends at `dec` (backward pass, cached on the path).
function turnCap(path, s, rate, dec) {
  if (path.tcKey !== rate * 1000 + dec) {
    const n = path.n, tc = path.tc || (path.tc = new Float32Array(n));
    for (let i = n - 1; i >= 0; i--) {
      const own = path.k[i] > 1e-3 ? rate / path.k[i] : 1e9;
      tc[i] = i === n - 1 ? own : Math.min(own, Math.sqrt(tc[i + 1] * tc[i + 1] + 2 * dec * (path.s[i + 1] - path.s[i])));
    }
    path.tcKey = rate * 1000 + dec;
  }
  return path.tc[Math.max(0, Math.min(path.n - 1, Math.round(s / STEP)))];
}

// The two long swells of the water shader (water.js FRAG), in grid units.
const swell = (x, y, t) => 0.30 * Math.sin((0.62 * x + 0.28 * y) * 2.1 + t * 1.15) + 0.20 * Math.sin((-0.25 * x + 0.70 * y) * 2.9 + t * 1.55);

// ---- hull capsules for keeping boats apart
function capsule(x, y, h, sc) {                 // spans stern to stem, as wide as the hull
  const c = Math.cos(h), s = Math.sin(h), r = HULL.half * sc, f = HULL.bow * sc - r, a = HULL.stern * sc - r;
  return [x + c * f, y + s * f, x - c * a, y - s * a, r];
}
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {     // closest distance of two segments
  const ux = bx - ax, uy = by - ay, vx = dx - cx, vy = dy - cy, wx = ax - cx, wy = ay - cy;
  const a = ux * ux + uy * uy, b = ux * vx + uy * vy, c = vx * vx + vy * vy, d = ux * wx + uy * wy, e = vx * wx + vy * wy;
  const D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c; }
  else {
    sN = b * e - c * d; tN = a * e - b * d;
    if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; }
  }
  if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
  else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
  const sc = Math.abs(sN) < 1e-9 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-9 ? 0 : tN / tD;
  return Math.hypot(wx + sc * ux - tc * vx, wy + sc * uy - tc * vy);
}
export const capGap = (A, B) => segDist(A[0], A[1], A[2], A[3], B[0], B[1], B[2], B[3]) - A[4] - B[4];

export class Fleet {
  constructor(scene, quality) {
    this.sc = scene;
    this.fx = quality.boatFx === undefined ? 1 : quality.boatFx;
    this.boats = []; this.decor = []; this.depPlans = [];
    this.V0 = 1; this.checkT = 0; this.t = 0;
    // for the logs: how late (s) a boat reached its slip after the simulation docked, waits
    this.stats = { arrivals: 0, lagMax: -Infinity, lagSum: 0, waits: 0, nets: 0, netMin: Infinity };
    this.under = scene.add.graphics().setDepth(D_UNDER);
    this.still = scene.add.graphics().setDepth(D_UNDER);           // decorative boats: drawn once
    this.A = Array.from({ length: 40 }, () => ({ x: 0, y: 0 }));   // scratch screen points
    this.B = Array.from({ length: 40 }, () => ({ x: 0, y: 0 }));
    for (const pair of BOLLARDS) for (const [x, y] of pair) {
      const p = iso(x, y);
      if (has('prop/bollard')) addSprite(scene, p.x, p.y, 'prop/bollard', 1.15).setDepth(depthAt(x, y) + 2);
    }
    for (const d of DECOR_BOATS) this.decor.push(this.makeDecor(d));
    for (const vb of this.decor) this.drawBoat(vb, 0, 0, this.still);
  }

  // ---------------------------------------------------------------- set-up
  depPlan(k) { return this.depPlans[k] || (this.depPlans[k] = departurePlan(k)); }
  classOf(i) { return (G.S.boatTypes && G.S.boatTypes[i]) || 0; }
  // nearest baked direction: 32 per turn for working boats (11.25° steps, so
  // turns look continuous without blending two frames), 8 for the others
  dirFrame(cls, h, refl) {
    const n = cls === 0 ? 32 : 8, k = Math.round((((h / TAU) * n) % n + n) % n) % n;
    return `${cls === 0 ? (refl ? 'boatR32' : 'boat32') : (refl ? 'boatR' : 'boat')}/${cls}/${k}`;
  }
  sprites(vb) {
    const sc = this.sc, fa = this.dirFrame(vb.cls, vb.h, false), ra = this.dirFrame(vb.cls, vb.h, true);
    vb.hull = addSprite(sc, 0, 0, fa, vb.ss);
    if (this.fx >= 1 && has(ra)) vb.refl = addSprite(sc, 0, 0, ra, vb.ss).setDepth(D_REFL);
    vb.over = sc.add.graphics();
  }
  makeBoat(b) {
    const k = b.i % VBERTH.length, cls = this.classOf(b.i);
    const vb = {
      b, k, i: b.i, phase: 'docked', plan: null, st: null, c: 1, replanT: 0, holdT: 0, hold: false,
      x: VBERTH[k][0], y: VBERTH[k][1], h: -Math.PI / 2, prevH: -Math.PI / 2, v: 0, accel: 0,
      lean: 0, trim: 0, rope: 1, settleT: 99, settleV: 0, cls, ss: 1, scale: CLASS_S[cls] / CLASS_S[0],
    };
    this.sprites(vb);
    // a boat already out at sea (only after a very long first frame) starts where the simulation has it
    if (b.state === 'out' || b.state === 'fish') {
      const g = this.depPlan(k)[1].path, e = poseAt(g, g.len);
      Object.assign(vb, { x: e.x, y: e.y, h: e.a, prevH: e.a, rope: 0 });
      this.start(vb, 'fishing');
    } else if (b.state === 'back' && b.m.y > 33) {
      Object.assign(vb, { x: b.m.x, y: b.m.y, h: Math.atan2(b.m.dy, b.m.dx), rope: 0 });
      vb.prevH = vb.h;
      this.start(vb, 'return');
    }
    return vb;
  }
  makeDecor([x, y, cls, d, ss]) {
    const vb = { decor: true, i: -1, x, y, h: d * Math.PI / 4, cls, ss, scale: CLASS_S[cls] / CLASS_S[0] * ss, v: 0, accel: 0, lean: 0, trim: 0, rope: 0, phase: 'docked' };
    this.sprites(vb);
    return vb;
  }

  // ------------------------------------------------------------- per frame
  update(t, dt) {
    const sim = this.sc.sim;
    this.t = t;
    this.V0 = stat.boatSpeed() * 1.12;
    while (this.boats.length < sim.boats.length) this.boats.push(this.makeBoat(sim.boats[this.boats.length]));
    this.checkT -= dt;
    if (this.checkT <= 0) { this.checkT = 0.2; this.resolve(); }
    for (const vb of this.boats) { this.think(vb, dt); this.move(vb, dt); }
    this.under.clear();
    for (const vb of this.decor) this.bob(vb, t);
    for (const vb of this.boats) this.drawBoat(vb, t, dt, this.under);
    const items = this.items || (this.items = []);
    this.boats.forEach((vb, j) => {
      const it = items[j] || (items[j] = { key: vb });
      it.x = vb.x; it.y = vb.y; it.dx = Math.cos(vb.h); it.dy = Math.sin(vb.h); it.sp = Math.max(0, vb.v);
      it.moving = vb.v > 0.12; it.stern = HULL.stern * vb.scale + 0.05; it.scale = CLASS_S[vb.cls];
    });
    items.length = this.boats.length;
    if (this.sc.water && this.sc.water.wake) this.sc.water.wake.update(t, items, this.V0);
  }

  // phase changes, driven by the simulation's state
  think(vb, dt) {
    const b = vb.b;
    if (b.state !== vb.simState) {
      if (b.state === 'dock' && vb.simState === 'back') { vb.simDockAt = this.t; this.lag(vb); }
      vb.simState = b.state;
    }
    const away = b.state === 'out' || b.state === 'fish';     // the simulation has left the berth
    switch (vb.phase) {
      case 'docked':       // (a boat that is home early waits for the simulation to dock and unload)
        if (away || (b.state === 'dock' && b.load <= 0 && b.t <= CAST_AT)) vb.phase = 'castoff';
        break;
      case 'castoff':
        vb.rope = Math.max(0, vb.rope - dt / 0.6);
        if (vb.rope <= 0 && vb.holdT <= 0 && (away || (b.state === 'dock' && b.t <= LEAVE_AT))) this.start(vb, 'depart');
        break;
      case 'depart':
        if (vb.st.done) this.start(vb, b.state === 'dock' ? 'return' : 'fishing');
        // only if hopelessly late (the simulation already docked): turn round on the way out
        else if (b.state === 'dock' && vb.st.leg === 1 && vb.st.s >= RETURN_FROM[vb.k]) this.start(vb, 'return');
        break;
      case 'fishing': {
        vb.fishT -= dt;
        if (vb.fishT <= 0) { vb.fishT = 0.25; vb.fishUntil = Math.min(vb.fishUntil, this.fishEnd(vb)); }
        if (this.t >= vb.fishUntil || b.state === 'dock') { this.stats.nets++; this.stats.netMin = Math.min(this.stats.netMin, this.t - vb.fishAt); this.start(vb, 'return'); break; }
        // fish jump out of the net while it is hauled in
        const u = this.netPhase(vb), J = [0.6, 0.7, 0.8, 0.88, 0.95];
        while (vb.jumps < J.length && u >= J[vb.jumps]) {
          vb.jumps++;
          const q = this.netEnd(vb);
          if (this.sc.fishJump) this.sc.fishJump(q.x + (Math.random() - 0.5) * 0.6, q.y + (Math.random() - 0.5) * 0.6);
        }
        if (Math.random() < dt * 2.5 && this.sc.wakeFx && u > 0.15) {          // churn round the net
          const q = this.netEnd(vb), p = iso(q.x + (Math.random() - 0.5) * 0.8, q.y + (Math.random() - 0.5) * 0.8, SEA_Z);
          this.sc.wakeFx.emitParticleAt(p.x, p.y, 1);
        }
        break;
      }
      case 'return':
        if (vb.st.done) { vb.phase = 'settle'; vb.settleT = 0; vb.settleV = 0.16; vb.inAt = this.t; this.lag(vb); }
        break;
      case 'settle':
        vb.settleT += dt;
        vb.rope = Math.min(1, vb.rope + dt / 1.1);
        if (vb.rope >= 1 && vb.settleT > 1.3) vb.phase = 'docked';
        break;
    }
  }
  lag(vb) {                                       // both ends of a trip seen: record the arrival lag
    if (vb.simDockAt === undefined || vb.inAt === undefined || Math.abs(vb.inAt - vb.simDockAt) > 20) return;
    const l = vb.inAt - vb.simDockAt, S = this.stats;
    S.arrivals++; S.lagSum += l; S.lagMax = Math.max(S.lagMax, l);
    vb.simDockAt = vb.inAt = undefined;
  }
  logLine() {
    const S = this.stats;
    return `BOATS n=${this.boats.length} phases=${this.boats.map(v => v.phase).join(',')} arrivals=${S.arrivals} lagMean=${S.arrivals ? (S.lagSum / S.arrivals).toFixed(2) : 'n/a'} lagMax=${S.arrivals ? S.lagMax.toFixed(2) : 'n/a'} waits=${S.waits} trip=${this.modeShort ? 'harbour' : 'grounds'} nets=${S.nets} netMinS=${S.nets ? S.netMin.toFixed(2) : 'n/a'} fx=${this.fx}`;
  }
  start(vb, phase) {
    vb.phase = phase;
    vb.c = 1;
    const from = { x: vb.x, y: vb.y, a: vb.h };
    if (phase === 'depart') vb.mode = this.shortMode() ? 'short' : 'full';
    const short = vb.mode === 'short';
    vb.plan = phase === 'depart' ? (short ? shortDeparture(vb.k) : this.depPlan(vb.k))
      : phase === 'fishing' ? (short ? shortFishing(vb.k, from) : fishingPlan(vb.k, from))
        : (short ? shortArrival(vb.k, from) : arrivalPlan(vb.k, from));
    vb.st = { leg: 0, s: 0, v: phase === 'depart' ? 0 : Math.max(0, vb.v), dwell: 0, done: false };
    vb.replanT = vb.i * 0.06;                     // boats plan on different frames
    if (phase === 'fishing') { vb.fishAt = this.t; vb.jumps = 0; vb.fishT = 0.25; vb.fishUntil = Infinity; vb.fishUntil = this.fishEnd(vb); }
  }
  // net: 0 → 0.25 paid out, towed until 0.65, hauled in by 1
  netPhase(vb) { return clamp((this.t - vb.fishAt) / Math.max(0.01, vb.fishUntil - vb.fishAt), 0, 1); }
  netOut(vb) {
    const u = this.netPhase(vb), sm = x => x * x * (3 - 2 * x);
    return u < 0.25 ? sm(u / 0.25) : u < 0.65 ? 1 : 1 - sm((u - 0.65) / 0.35);
  }
  netEnd(vb) {                                    // cod end of the net (grid)
    const e = this.netOut(vb), d = HULL.stern * vb.scale + (0.5 + 2.6 * e) * vb.scale;
    return { x: vb.x - Math.cos(vb.h) * d, y: vb.y - Math.sin(vb.h) * d };
  }

  // speed allowed at distance s along leg L (cruise share, turns, braking for what comes next)
  vLimit(P, L, s, c) {
    const lg = P.plan[L], V = Vof(this.V0, c, lg.kind);
    if (lg.kind === 'fish') return Math.min(FISH_V * this.V0, Math.sqrt(2 * DEC.fish * this.V0 * (lg.path.len - s)));
    const k = curvAt(lg.path, s), rate = TURN_RATE * Math.sqrt(this.V0 / 1.904) * warp(c);
    const cap = Math.min(CAP[lg.kind] * V * (1 - 0.12 * Math.min(1, k * SEA_R)), turnCap(lg.path, s, rate, DEC.sea * this.V0));
    let vEnd = 0;
    if (!lg.stop) vEnd = L + 1 < P.plan.length ? this.entry(P, L + 1, c) : (P.phase === 'depart' ? FISH_V * this.V0 : cap);
    return Math.min(cap, Math.sqrt(vEnd * vEnd + 2 * DEC[lg.kind] * V * (lg.path.len - s)));
  }
  entry(P, L, c) {
    const lg = P.plan[L], V = Vof(this.V0, c, lg.kind);
    if (lg.kind === 'fish') return FISH_V * this.V0;
    const cap = CAP[lg.kind] * V;
    return lg.stop ? Math.min(cap, Math.sqrt(2 * DEC[lg.kind] * V * lg.path.len)) : cap;
  }
  // one step of the motion model (also used to predict and to plan)
  advance(P, st, dt, c, hold) {
    if (st.done) return;
    if (st.dwell > 0) { st.dwell -= dt; if (st.dwell <= 0) { st.dwell = 0; st.leg++; st.s = 0; st.v = 0; } return; }
    const lg = P.plan[st.leg], len = lg.path.len, V = Vof(this.V0, c, lg.kind);
    let target = hold ? 0 : this.vLimit(P, st.leg, st.s, c);
    if (!hold && lg.stop && len - st.s > 0.004) target = Math.max(target, CREEP * V);
    const acc = ACC * V, dec = (DEC[lg.kind] || 0.3) * V;
    st.v = st.v < target ? Math.min(target, st.v + acc * dt) : Math.max(target, st.v - 2.2 * dec * dt);
    st.s += st.v * dt;
    if (st.s >= len) {
      if (lg.stop) { st.s = len; st.v = 0; if (st.leg + 1 < P.plan.length) st.dwell = DWELL / warp(c); else st.done = true; }
      else if (st.leg + 1 < P.plan.length) { st.s -= len; st.leg++; }
      else { st.s = len; st.done = true; }
    }
  }
  timeToGo(vb, c) {
    const st = { ...vb.st }, P = vb, h = 0.12;
    let T = 0;
    while (!st.done && T < 90) { this.advance(P, st, h, c, false); T += h; }
    return T;
  }
  // smallest cruise share c with f(c) <= T (f falls as c grows)
  solveFor(f, T) {
    if (f(C_LIMIT) >= T) return C_LIMIT;
    if (f(C_MIN) <= T) return C_MIN;
    let lo = C_MIN, hi = C_LIMIT;
    for (let it = 0; it < 9; it++) { const mid = (lo + hi) / 2; if (f(mid) > T) lo = mid; else hi = mid; }
    return hi;
  }
  solve(vb, T) { return this.solveFor(c => this.timeToGo(vb, c), T); }
  // the simulation's clock: seconds until its catch is complete / until it docks
  toFishEnd(b) {
    const base = this.V0, F = stat.fishTime(), L = routeLen(b.berth);
    return b.state === 'dock' ? Math.max(0, b.t) + simOutTime(0, L, base) + F
      : b.state === 'out' ? simOutTime(b.run || 0, b.m.remaining(), base) + F
        : b.state === 'fish' ? Math.max(0, b.t) : 0;
  }
  toDock(b) {
    const base = this.V0, L = routeLen(b.berth);
    return b.state === 'back' ? simBackTime(b.m.remaining(), base) : b.state === 'dock' && b.load > 0 ? 0 : this.toFishEnd(b) + simBackTime(L, base);
  }
  // how long the way home from the fishing spot takes at cruise share c
  retEst(k, c, mode = 'full') {
    const R = this.retPlans || (this.retPlans = {}), rk = mode + k;
    if (!R[rk]) {
      let plan;
      if (mode === 'short') plan = shortArrival(k, shortSpot(k));
      else { const g = groundPose(k), e = { x: g.x + Math.cos(g.a) * LINGER * 0.5, y: g.y + Math.sin(g.a) * LINGER * 0.5, a: g.a }; plan = arrivalPlan(k, e); }
      R[rk] = { plan, phase: 'return', st: { leg: 0, s: 0, v: 0, dwell: 0, done: false } };
    }
    // cached per cruise share (to 0.05) and engine level: it is asked many times per plan
    const key = `${rk}/${Math.round(c * 20)}/${this.V0.toFixed(3)}`, C = this.retCache || (this.retCache = new Map());
    let v = C.get(key);
    if (v === undefined) {
      if (C.size > 400) C.clear();
      R[rk].st.v = mode === 'short' ? 0 : FISH_V * this.V0;
      C.set(key, v = this.timeToGo(R[rk], Math.round(c * 20) / 20));
    }
    return v;
  }
  // Harbour trips when, for any berth, the trip to the fishing grounds (cruise
  // share ≤ C_FULL, net included) does not fit the simulation's trip.
  shortMode() {
    const F = stat.fishTime(), key = this.V0.toFixed(3) + '/' + F.toFixed(3);
    if (this.modeKey === key) return this.modeShort;
    let short = false;
    for (let k = 0; k < VBERTH.length && !short; k++) {
      const L = routeLen(BERTHS[k]);
      const budget = LEAVE_AT + simOutTime(0, L, this.V0) + F + simBackTime(L, this.V0) - DOCK_EARLY - 0.15;
      const dep = { plan: this.depPlan(k), phase: 'depart', st: { leg: 0, s: 0, v: 0, dwell: 0, done: false } };
      if (this.timeToGo(dep, C_FULL) + fishVis(F) + this.retEst(k, C_FULL) > budget) short = true;
    }
    this.modeKey = key; this.modeShort = short;
    return short;
  }
  // when the nets must be in so the boat is home in time
  fishEnd(vb) {
    const b = vb.b, t = this.t;
    if (b.state === 'dock') return t;
    const natural = t + this.toFishEnd(b) - PRE_RETURN;
    const latest = t + this.toDock(b) - DOCK_EARLY - 0.15 - this.retEst(vb.k, Math.max(1, vb.cTrip || 1), vb.mode);
    return Math.max(Math.min(natural, latest), vb.fishAt + FISH_HARD);
  }
  // seconds left: to the start of the visual towing (depart) or to the simulation's unloading (return)
  replan(vb) {
    const b = vb.b, F = stat.fishTime();
    if (vb.phase === 'depart') {
      // 1. comfortable: reach the spot in time for the nets before the catch is complete;
      // 2. binding: out + nets + home must fit before the simulation docks
      const D = fishVis(F), toDock = this.toDock(b);
      const cNat = this.solve(vb, this.toFishEnd(b) - PRE_RETURN - D);
      vb.cTrip = this.solveFor(c => this.timeToGo(vb, c) + this.retEst(vb.k, c, vb.mode), toDock - DOCK_EARLY - 0.15 - D);
      vb.c = clamp(Math.max(Math.min(C_OUT, cNat), vb.cTrip), C_MIN, C_LIMIT);
    } else if (vb.phase === 'return') {
      const c = this.solve(vb, this.toDock(b) - DOCK_EARLY);
      // gentle corrections, except when needed to be in on time
      vb.c = c > vb.c ? c : Math.max(c, vb.c - 0.2);
    } else vb.c = 1;
  }
  move(vb, dt) {
    vb.holdT -= dt; vb.hold = vb.holdT > 0;
    if (vb.phase === 'depart' || vb.phase === 'fishing' || vb.phase === 'return') {
      vb.replanT -= dt;
      if (vb.replanT <= 0) { vb.replanT = 0.25; this.replan(vb); }
      const v0 = vb.st.v * (vb.plan[Math.min(vb.st.leg, vb.plan.length - 1)].dir);
      this.advance(vb, vb.st, dt, vb.c, vb.hold);
      const lg = vb.plan[Math.min(vb.st.leg, vb.plan.length - 1)], p = poseAt(lg.path, vb.st.s, this.pose || (this.pose = {}));
      vb.x = p.x; vb.y = p.y;
      vb.h = lg.dir > 0 ? p.a : p.a + Math.PI;
      vb.v = vb.st.v * lg.dir;
      vb.accel = dt > 0 ? (vb.v - v0) / dt : 0;
    } else {
      // at the berth; after arriving the boat surges a little and the lines take it back
      const [bx, by] = VBERTH[vb.k];
      let off = 0;
      if (vb.phase === 'settle') { const w = 2.6, t = vb.settleT; off = vb.settleV / w * Math.exp(-0.9 * t) * Math.sin(w * t); }
      vb.x = bx; vb.y = by - off; vb.h = -Math.PI / 2; vb.v = 0; vb.accel = 0;
    }
  }

  // ------------------------------------------------- keeping boats apart
  prio(vb) {
    const kind = vb.plan && vb.st ? vb.plan[Math.min(vb.st.leg, vb.plan.length - 1)].kind : '';
    const p = vb.phase === 'castoff' ? 0 : vb.phase === 'depart' ? (kind === 'reverse' ? 1 : 2) : vb.phase === 'fishing' ? 2.5 : vb.phase === 'return' ? (kind === 'glide' ? 4 : 3) : 5;
    return p - vb.i * 0.01;
  }
  canHold(vb) {
    if (vb.phase === 'castoff' || vb.phase === 'depart' || vb.phase === 'fishing') return true;
    return vb.phase === 'return' && vb.plan[vb.st.leg] && vb.plan[vb.st.leg].kind === 'sea';
  }
  track(vb, hold, n) {                            // hull capsules every 0.5 s (held: braking to a stop)
    let P = vb, st = vb.st;
    if (vb.phase === 'castoff') { P = { plan: this.depPlan(vb.k), phase: 'depart' }; st = { leg: 0, s: 0, v: 0, dwell: 0, done: false }; }
    st = { ...st };
    const out = [];
    for (let j = 0; j < n; j++) {
      const lg = P.plan[Math.min(st.leg, P.plan.length - 1)], p = poseAt(lg.path, st.s, this.pose2 || (this.pose2 = {}));
      out.push(capsule(p.x, p.y, lg.dir > 0 ? p.a : p.a + Math.PI, vb.scale));
      for (let k = 0; k < 5; k++) this.advance(P, st, 0.1, vb.c, hold);
    }
    return out;
  }
  // Predict the next seconds; the boat with the lower right of way waits or stops
  // when that avoids a touch (leaving the slip: 7 s ahead, under way: 4.5 s).
  resolve() {
    const act = this.boats.filter(vb => vb.phase === 'depart' || vb.phase === 'fishing' || vb.phase === 'return' || (vb.phase === 'castoff' && vb.rope <= 0));
    if (act.length < 2) return;
    const N = 15, mv = new Map(), hd = new Map();
    for (const vb of act) { mv.set(vb, this.track(vb, false, N)); hd.set(vb, this.track(vb, true, N)); }
    const clash = (A, B, n) => { for (let j = 0; j < n; j++) if (capGap(A[j], B[j]) < 0.3) return true; return false; };
    for (let a = 0; a < act.length; a++) for (let c = a + 1; c < act.length; c++) {
      let lo = act[a], hi = act[c];
      if (this.prio(lo) > this.prio(hi)) [lo, hi] = [hi, lo];
      const n = lo.phase === 'castoff' ? N : 10;
      if (!clash(mv.get(lo), mv.get(hi), n)) continue;
      if (!clash(hd.get(lo), mv.get(hi), n)) { if (lo.holdT <= 0) this.stats.waits++; lo.holdT = 0.8; continue; }
      if (this.canHold(hi) && !clash(mv.get(lo), hd.get(hi), n)) { if (hi.holdT <= 0) this.stats.waits++; hi.holdT = 0.8; }
    }
  }

  // ----------------------------------------------------------- drawing
  // boat coordinates (u towards the bow, v to the side, z screen px up) → screen,
  // turned with the hull by vb.rho about its waterline centre vb.P
  toScr(vb, u, v, z, out) {
    const wx = vb.x + u * vb.hc - v * vb.hs, wy = vb.y + u * vb.hs + v * vb.hc, P = vb.P;
    const dx = (wx - wy) * 32 - P.x, dy = (wx + wy) * 16 - z - P.y;
    out.x = P.x + dx * vb.rc - dy * vb.rs; out.y = P.y + dx * vb.rs + dy * vb.rc;
    return out;
  }
  outline(vb, grow, z, out, du = 0, dv = 0) {          // hull at the waterline (+ offset in grid tiles)
    const H = hullLocal(grow), sc = vb.scale;
    for (let j = 0; j < H.length; j++) {
      this.toScr(vb, H[j][0] * sc, H[j][1] * sc, z, out[j]);
      out[j].x += (du - dv) * 32; out[j].y += (du + dv) * 16;
    }
    return H.length;
  }
  // decorative boats only bob; their shadow and waterline were drawn once
  bob(vb, t) {
    const y = vb.P.y + Math.sin(t * 1.6 + vb.x) * 1.1, a = Math.sin(t * 1.1 + vb.x) * 1.1;
    vb.hull.setY(y).setAngle(a);
    if (vb.refl) vb.refl.setY(y).setAngle(-a);
  }
  drawBoat(vb, t, dt, g) {
    const fx = this.fx, sc = vb.scale, c = Math.cos(vb.h), s = Math.sin(vb.h);
    // off screen: no sprites or shapes to draw (keeps 4 boats cheap when zoomed in)
    const view = this.sc.cameras.main.worldView, px = (vb.x - vb.y) * 32, py = (vb.x + vb.y) * 16 + SEA_Z;
    const seen = !view.width || (px > view.x - 260 && px < view.right + 260 && py > view.y - 260 && py < view.bottom + 200);
    if (!vb.decor && vb.seen !== seen) { vb.seen = seen; vb.hull.setVisible(seen); if (vb.refl) vb.refl.setVisible(seen); if (!seen) vb.over.clear(); }
    if (!vb.decor && !seen) { vb.prevH = vb.h; return; }
    const calm = vb.phase === 'docked' || vb.phase === 'castoff' || vb.phase === 'settle' ? 0.45 : 1;
    let heave = 0, pitch = 0, roll = 0;
    if (!vb.decor) {
      // waves under bow, stern and both sides (the shader's swells): heave, pitch and roll
      const Lb = HULL.bow * sc * 0.75, Ls = HULL.stern * sc * 0.75, Hw = HULL.half * sc;
      const hb = swell(vb.x + c * Lb, vb.y + s * Lb, t), hs = swell(vb.x - c * Ls, vb.y - s * Ls, t);
      const hp = swell(vb.x - s * Hw, vb.y + c * Hw, t), hq = swell(vb.x + s * Hw, vb.y - c * Hw, t);
      heave = (hb + hs + hp + hq) * 0.25 * 3.4 * calm;
      pitch = (hb - hs) / (Lb + Ls) * 0.11 * calm; roll = -(hp - hq) / (2 * Hw) * 0.05 * calm;
      // heel out of a turn, lift the bow when speeding up
      const yaw = dt > 0 ? wrap(vb.h - vb.prevH) / dt : 0;
      vb.prevH = vb.h;
      vb.lean += (clamp(-yaw * Math.abs(vb.v) * 0.04, -0.07, 0.07) - vb.lean) * Math.min(1, dt / 0.45);
      vb.trim += (clamp(vb.accel * 0.05, -0.025, 0.025) - vb.trim) * Math.min(1, dt / 0.35);
      roll += vb.lean; pitch += vb.trim;
    }
    // pitch and roll as the camera sees them = a small turn of the sprite about the waterline centre
    const sx = (c - s) * 32, sy = (c + s) * 16, sl2 = sx * sx + sy * sy;
    const rho = clamp(-pitch * UZ * sx / sl2 - roll * (32 / UZ) * (s + c), -0.09, 0.09), ang = rho * 180 / Math.PI;
    const z = SEA_Z + heave, P = vb.P || (vb.P = { x: 0, y: 0 });
    P.x = (vb.x - vb.y) * 32; P.y = (vb.x + vb.y) * 16 - z;
    vb.hc = c; vb.hs = s; vb.rc = Math.cos(rho); vb.rs = Math.sin(rho);
    const dep = depthAt(vb.x, vb.y) + 8;
    // hull: nearest of 32 baked directions
    const fa = this.dirFrame(vb.cls, vb.h, false);
    if (vb.hull.frame.name !== fa && has(fa)) setSprite(vb.hull, fa, vb.ss);
    vb.hull.setPosition(P.x, P.y).setAngle(ang).setDepth(dep);
    // mirror image in the water (baked), swaying the other way
    if (vb.refl) {
      const ra = this.dirFrame(vb.cls, vb.h, true);
      if (vb.refl.frame.name !== ra && has(ra)) setSprite(vb.refl, ra, vb.ss);
      vb.refl.setPosition(P.x, P.y).setAngle(-ang);
    }
    const spd = Math.min(1.5, Math.abs(vb.v) / Math.max(0.1, this.V0)), A = this.A, B = this.B;
    // shadow on the water (sun from the upper left), and on medium/high a soft wet rim
    let n = this.outline(vb, 0.08, z, A, 0.16, 0);
    g.fillStyle(0x062a48, fx ? 0.2 : 0.16).fillPoints(A, true, false, n);
    if (fx >= 2 || (fx === 1 && spd > 0.05)) {
      n = this.outline(vb, 0.05, z, A);
      g.lineStyle(2.2, 0xffffff, 0.12 + 0.2 * Math.min(1, spd)).strokePoints(A, true, false, n);
    }
    // bow wave: two short white arms from the stem, longer with speed
    if (vb.v > 0.1) {
      const a = Math.min(1, spd), bow = HULL.bow * sc;
      for (const side of [1, -1]) {
        for (let j = 0; j <= 4; j++) {
          const u = j / 4;
          this.toScr(vb, bow - u * (1.1 + 0.6 * a) * sc, (0.12 + u * (0.75 + 0.35 * a)) * sc * side, z, A[j]);
        }
        g.lineStyle(fx >= 2 ? 3 : 2.4, 0xffffff, 0.55 * a).strokePoints(A, false, false, 5);
        if (fx >= 2) g.lineStyle(7, 0xffffff, 0.12 * a).strokePoints(A, false, false, 5);
      }
    }
    // propeller wash: behind the stern going ahead, along the hull going astern
    if (!vb.decor) {
      const astern = vb.v < -0.04, gear = vb.st && vb.st.dwell > 0;
      const thrust = clamp(Math.abs(vb.accel) / (ACC * this.V0) * 0.7 + (astern ? 0.55 : 0.18) * Math.min(1, spd * 1.6) + (gear ? 0.35 : 0) + (vb.phase === 'castoff' && vb.rope < 0.3 ? 0.3 : 0), 0, 1);
      if (thrust > 0.04) {
        const stern = -HULL.stern * sc;
        for (let j = 0; j < (fx >= 2 ? 3 : 2); j++) {
          const ph = t * 5 + j * 2.1 + vb.i * 1.7, jit = Math.sin(ph) * 0.14 * sc;
          const q = this.toScr(vb, stern + (astern ? 0.3 + j * 0.45 : -0.25 - j * 0.4) * sc, jit, z, B[0]);
          const r = (0.3 + j * 0.12 + 0.05 * Math.sin(ph * 1.3)) * sc;
          g.fillStyle(0xffffff, 0.24 * thrust * (1 - j * 0.25)).fillEllipse(q.x, q.y, r * 48, r * 24);
        }
      }
    }
    // the net: paid out astern, towed, hauled back in (scaled to the fishing time)
    if (vb.phase === 'fishing') this.drawNet(vb, g, z);
    // water lapping against the near side of the hull, and the mooring lines
    const o = vb.over;
    if (!vb.decor) o.clear().setDepth(dep + 0.02);
    else o.setDepth(dep + 0.02);
    if (fx >= 1) {
      const H = hullLocal(0), m = H.length;
      // outline points whose outward normal faces the camera (screen-down = +u+v in the grid)
      const faces = j => {
        const p = H[(j + m - 1) % m], q = H[(j + 1) % m], tu = q[0] - p[0], tv = q[1] - p[1];
        const nx = tv * c + tu * s, ny = tv * s - tu * c;          // outward normal (tv, −tu) turned to the grid
        return nx + ny > 0;
      };
      let start = -1, k = 0;
      for (let j = 0; j < m; j++) if (faces(j) && !faces((j + m - 1) % m)) { start = j; break; }
      if (start >= 0) for (; k < m && faces((start + k) % m); k++) { const [u, v] = H[(start + k) % m]; this.toScr(vb, u * sc, v * sc, z + 1.3, A[k]); }
      if (k > 1) {
        o.lineStyle(3.4, 0x1c78b8, 0.45).strokePoints(A, false, false, k);
        o.lineStyle(1.3, 0xffffff, 0.3 + 0.35 * Math.min(1, spd)).strokePoints(A, false, false, k);
      }
    }
    if (vb.rope > 0 && !vb.decor) this.drawLines(vb, o, z);
  }
  drawNet(vb, g, z) {
    const e = this.netOut(vb), u = this.netPhase(vb), sc = vb.scale, A = this.A, B = this.B;
    if (e < 0.02) return;
    const st = -HULL.stern * sc, mouth = st - (0.5 + 1.9 * e) * sc, half = (0.3 + 0.75 * e) * sc, cod = mouth - (0.35 + 0.8 * e) * sc;
    // net body (mesh), mouth to cod end
    this.toScr(vb, mouth, half, z, A[0]); this.toScr(vb, mouth - 0.25 * sc, 0, z, A[1]); this.toScr(vb, mouth, -half, z, A[2]); this.toScr(vb, cod, 0, z, A[3]);
    const T3 = this.T3 || (this.T3 = [null, null, null]); T3[0] = A[0]; T3[1] = A[3]; T3[2] = A[2];
    g.fillStyle(0x10283a, 0.45 * e).fillPoints(T3, true);
    if (this.fx >= 1) { g.lineStyle(1, 0x0f2530, 0.35 * e); g.lineBetween(A[1].x, A[1].y, A[3].x, A[3].y); }
    // warps from the stern quarters to the mouth
    this.toScr(vb, st + 0.15 * sc, 0.32 * sc, z + 6, B[0]); this.toScr(vb, st + 0.15 * sc, -0.32 * sc, z + 6, B[1]);
    g.lineStyle(1.6, 0x2e281f, 0.9).lineBetween(B[0].x, B[0].y, A[0].x, A[0].y).lineBetween(B[1].x, B[1].y, A[2].x, A[2].y);
    // float line with orange floats
    const C = this.C || (this.C = Array.from({ length: 7 }, () => ({ x: 0, y: 0 })));
    for (let j = 0; j <= 6; j++) { const f = j / 6, v = (f * 2 - 1) * half; this.toScr(vb, mouth - (1 - (f * 2 - 1) ** 2) * 0.35 * sc * e, v, z, C[j]); }
    g.lineStyle(1.5, 0xf2f2e6, 0.85).strokePoints(C, false, false, 7);
    g.fillStyle(0xff8a1f, 1);
    for (let j = 0; j <= 6; j += 2) g.fillCircle(C[j].x, C[j].y, 1.8);
    // hauling: the catch shines silver in the cod end
    if (u > 0.55) { const k = Math.min(1, (u - 0.55) / 0.2); g.fillStyle(0xd7ecff, 0.65 * k).fillEllipse(A[3].x, A[3].y, 9 * sc + 6 * e, 5 * sc + 3 * e); }
  }
  // bow line to the quay, stern line to the pier; thrown, made fast, let go
  drawLines(vb, o, z) {
    const k5 = CLASS_S[vb.cls], c = vb.hc, s = vb.hs, deck = z + 0.345 * k5 * UZ + 2, A = this.A;
    const r = vb.rope, u = Math.min(1, r * 1.6), sag = u < 1 ? 7 : 3 + 11 * (1 - (r - 0.625) / 0.375);
    for (let l = 0; l < 2; l++) {
      const [bx, by] = BOLLARDS[vb.k][l], cu = l ? -1.15 * k5 : 1.05 * k5, cv = (l ? 0.33 : 0.2) * k5;
      const side = ((bx - vb.x) * -s + (by - vb.y) * c) >= 0 ? 1 : -1;     // cleat on the side nearer the bollard
      const a = this.toScr(vb, cu, cv * side, deck, this.B[0]);
      const tx = (bx - by) * 32, ty = (bx + by) * 16 - 0.16 * UZ;
      const ex = a.x + (tx - a.x) * u, ey = a.y + (ty - a.y) * u - 16 * Math.sin(Math.PI * u);
      const mx = (a.x + ex) / 2, my = (a.y + ey) / 2 + 2 * sag;
      for (let j = 0; j <= 8; j++) {
        const q = j / 8, w0 = (1 - q) * (1 - q), w1 = 2 * (1 - q) * q, w2 = q * q;
        A[j].x = w0 * a.x + w1 * mx + w2 * ex; A[j].y = w0 * a.y + w1 * my + w2 * ey;
      }
      if (this.fx >= 1) o.lineStyle(2.2, 0x5a4630, 0.7).strokePoints(A, false, false, 9);
      o.lineStyle(1.2, 0xe6d3a3, 1).strokePoints(A, false, false, 9);
    }
  }

  // ---------------------------------------------------------- for the scene
  view(b) { return this.boats.find(vb => vb.b === b); }
  // where splashes go: round the boat while it tows its nets, or (fast boats
  // with short fishing) while it passes the fishing spot
  fishingAt(b) {
    const vb = this.view(b);
    if (!vb) return null;
    if (vb.phase === 'fishing') return vb;
    const G = b.berth.route[b.berth.route.length - 1];
    return (vb.phase === 'depart' || vb.phase === 'return') && vb.st && vb.plan[vb.st.leg].kind === 'sea' && Math.hypot(vb.x - G[0], vb.y - G[1]) < 5 ? vb : null;
  }
  // the crane at a berth works only while the boat is in
  moored(b) { const vb = this.view(b); return !!vb && (vb.phase === 'docked' || vb.phase === 'settle' || vb.phase === 'castoff'); }
}
