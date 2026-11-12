// Measurement only (no game code involved): how long the simulation keeps a
// boat at its berth, and how much later than the simulation a visual boat would
// come in if it sailed no faster than 5 tiles/s and turned no faster than 90°/s.
//   • simulation: stepped alone at 30 FPS with a seeded random, 10 minutes per
//     scenario; per trip: out + fishing + back, time at the berth (unloading,
//     waiting for room on the quay, the fixed wait before leaving)
//   • visual estimate: the game's own motion model on the real routes at a
//     cruise of 5 tiles/s (lower bound) and 4.4 tiles/s (5 tiles/s cannot be
//     held in turns of radius 2.8 at 90°/s) — an estimate, not a test
//   node tests/dock-measure.cjs   → test-results/dock-measure.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const T3 = { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, T2 = { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, T1 = { harbor: 3, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 };
const H = (cap, speed, net) => ({ harbor: { cap, speed, net } });
const SCENARIOS = [
  { name: 'start: no upgrades, 1 boat, 2 workers', boats: 1, workers: 2, tier: { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 }, up: H(0, 0, 0) },
  { name: 'start: no upgrades, 4 boats, 6 workers', boats: 4, workers: 6, tier: T2, up: H(0, 0, 0) },
  { name: 'mid: engine 10 / nets 8 / hold 6, 6 workers', boats: 4, workers: 6, tier: T2, up: H(6, 10, 8) },
  { name: 'unlock: engine 14 / nets 18 / hold 10, 6 workers', boats: 4, workers: 6, tier: T2, up: H(10, 14, 18) },
  { name: 'unlock: engine 14 / nets 18 / hold 10, strong economy', boats: 4, workers: 10, tier: T3, up: { ...H(10, 14, 18), ...MAXUP } },
  { name: 'max 30/30, hold 30, 2 workers, small warehouse', boats: 4, workers: 2, tier: T1, up: H(30, 30, 30) },
  { name: 'max 30/30, hold 30, 6 workers, mid warehouse', boats: 4, workers: 6, tier: T2, up: H(30, 30, 30) },
  { name: 'max 30/30, hold 30, 10 workers, everything maxed', boats: 4, workers: 10, tier: T3, up: { ...H(30, 30, 30), ...MAXUP } },
  { name: 'max 30/30, hold 0, 10 workers, everything maxed', boats: 4, workers: 10, tier: T3, up: { ...H(0, 30, 30), ...MAXUP } },
  { name: 'max 30/30, hold 0, 6 workers, mid warehouse', boats: 4, workers: 6, tier: T2, up: H(0, 30, 30) },
  { name: 'max 30/30 + sea charts 3, hold 30, 6 workers, mid warehouse', boats: 4, workers: 6, tier: T2, up: H(30, 30, 30), research: { nav: 3, nets: 3 } },
  { name: 'max 30/30 + sea charts 3, hold 30, 10 workers, everything maxed', boats: 4, workers: 10, tier: T3, up: { ...H(30, 30, 30), ...MAXUP }, research: { nav: 3, nets: 3, ergo: 3 } },
  { name: 'max 30/30 + sea charts 3, hold 0, 10 workers, everything maxed', boats: 4, workers: 10, tier: T3, up: { ...H(0, 30, 30), ...MAXUP }, research: { nav: 3, nets: 3, ergo: 3 } },
  { name: 'upgrade during play: engine 14 → 30 and nets 18 → 30 bought at 200 s', boats: 4, workers: 10, tier: T3, up: { ...H(10, 14, 18), ...MAXUP }, buyAt: 200, buy: { speed: 30, net: 30 } },
];

async function run(b, sc) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    const z = { warehouse: { cap: 0, load: 0, cold: 0 }, factory: { speed: 0, out: 0, qual: 0 }, market: { price: 0, ads: 0, till: 0 }, hq: { train: 0, carry: 0 } };
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, harborOuter: sc.up.harbor.net >= 18 && sc.up.harbor.speed >= 14 ? 1 : 0, boats: sc.boats, workers: sc.workers, level: 12,
      tier: sc.tier, up: { ...z, ...sc.up }, research: { lv: sc.research || {}, active: null }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
  }, sc);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(sc => {
    __game.loop.sleep();
    const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, S = sim.S, dt = 1 / 30;
    // ---- visual estimate at the speed cap (before the simulation is stepped)
    const est = () => {
      F.levelKey = null; const lv = F.fleetLevel(), V0 = F.V0, o = { V0: +V0.toFixed(2), fishTime: +(6 * Math.pow(0.93, S.up.harbor.net)).toFixed(2), tier: lv.label, boats: [] };
      for (let k = 0; k < sim.boats.length; k++) {
        const site = lv.tier === 'outer' ? 4 + k : k, opt = F.tripOption(site, site, lv.z(k), lv.label);
        const t = v => +F.tripTime(opt, Math.min(1.6, v / V0)).toFixed(2);
        const row = { trip5: t(5), trip44: t(4.4), now: null };
        for (let c = 0.6; c <= 3.001; c += 0.05) { const b = { state: 'dock', t: 0.55, load: 0, berth: sim.boats[k].berth }; if (F.tripTime(opt, c) <= F.toDock(b) - 0.65) { row.now = +c.toFixed(2); break; } }
        if (lv.tier === 'outer') { const mv = F.tripOption(k, 4 + k, lv.z(k), lv.label); row.move5 = +F.tripTime(mv, Math.min(1.6, 5 / V0)).toFixed(2); row.move44 = +F.tripTime(mv, Math.min(1.6, 4.4 / V0)).toFixed(2); }
        o.boats.push(row);
      }
      return o;
    };
    const visual = [est()];
    // ---- the simulation alone
    let seed = 777; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ev = sim.boats.map(() => []), last = sim.boats.map(b => b.state), blocked = sim.boats.map(() => 0), unl = sim.boats.map(() => 0);
    let t = 0, bought = null;
    const secs = 600;
    for (let k = 0; k < secs * 30; k++) {
      if (sc.buyAt && !bought && t >= sc.buyAt) { Object.assign(S.up.harbor, sc.buy); bought = { t: +t.toFixed(2), states: sim.boats.map(b => b.state) }; visual.push(est()); }
      sim.update(dt); t += dt;
      sim.boats.forEach((b, i) => {
        if (b.state === 'dock') { if (b.blocked && b.load > 0) blocked[i] += dt; else if (b.load > 0) unl[i] += dt; }
        if (b.state !== last[i]) { ev[i].push([+t.toFixed(3), b.state, +blocked[i].toFixed(2), +unl[i].toFixed(2)]); last[i] = b.state; if (b.state === 'dock') { blocked[i] = 0; unl[i] = 0; } }
      });
      if (k % 200 === 0) sim.collect(true);
    }
    return { visual, ev, bought, quay: S.stock.quay, caught: S.stats.caught };
  }, sc);
  await ctx.close();
  // ---- trips and stays
  const trips = [], stays = [];
  r.ev.forEach((E, i) => {
    for (let k = 0; k < E.length; k++) {
      if (E[k][1] !== 'out') continue;
      const dock = E.slice(k).find(e => e[1] === 'dock'); if (!dock) continue;
      const next = E.slice(E.indexOf(dock) + 1).find(e => e[1] === 'out'); if (!next) continue;
      const prevDock = E.slice(0, k).reverse().find(e => e[1] === 'dock');
      trips.push({ boat: i, at: E[k][0], trip: +(dock[0] - E[k][0]).toFixed(2), stay: +(next[0] - dock[0]).toFixed(2), blocked: next[2], unloading: next[3], afterBuy: !!(r.bought && E[k][0] >= r.bought.t), spansBuy: !!(r.bought && E[k][0] < r.bought.t && dock[0] >= r.bought.t), prevDockAt: prevDock ? prevDock[0] : null });
    }
  });
  return { sc, r, trips, errs };
}
const q = (a, k) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * k))] : null; };
const LEAD = 0.55;       // the visual boat starts backing out this long before the simulation leaves
function summarise({ sc, r, trips, errs }) {
  const groups = sc.buyAt ? [['before the purchase', trips.filter(t => !t.afterBuy && !t.spansBuy), r.visual[0]], ['trips under way at the purchase', trips.filter(t => t.spansBuy), r.visual[1]], ['after the purchase', trips.filter(t => t.afterBuy), r.visual[1]]] : [['', trips, r.visual[0]]];
  return groups.map(([label, T, vis]) => {
    const trip = T.map(t => t.trip), stay = T.map(t => t.stay);
    const out = { scenario: sc.name + (label ? ' — ' + label : ''), trips: T.length, simCruise: vis.V0, fishTimeS: vis.fishTime, visualTripKind: vis.tier,
      simTripS: { min: q(trip, 0), median: q(trip, 0.5), max: q(trip, 0.999) },
      stayAtBerthS: { min: q(stay, 0), p10: q(stay, 0.1), median: q(stay, 0.5), p90: q(stay, 0.9), max: q(stay, 0.999) },
      shareOfStaysAtTheMinimum: T.length ? +(T.filter(t => t.stay <= 3.75).length / T.length).toFixed(2) : null,
      shareOfStaysWithFullQuay: T.length ? +(T.filter(t => t.blocked > 0.05).length / T.length).toFixed(2) : null,
      unloadingS: { min: q(T.map(t => t.unloading), 0), median: q(T.map(t => t.unloading), 0.5) },
      visualTripAtCapS: vis.boats.map(b => [b.trip5, b.trip44]), cruiseShareNeededNow: vis.boats.map(b => b.now), moveToOuterBerthAtCapS: vis.boats.map(b => b.move5 ? [b.move5, b.move44] : null), pageErrors: errs.slice(0, 2) };
    // per trip: how late the visual boat would be (lower / upper estimate) and what is left before it must back out again
    const late = [[], []], left = [[], []];
    for (const t of T) { const v = vis.boats[t.boat]; [v.trip5, v.trip44].forEach((x, n) => { const l = Math.max(0, x - LEAD - t.trip); late[n].push(l); left[n].push(t.stay - l - LEAD); }); }
    const st = a => ({ min: +(q(a, 0) ?? 0).toFixed(2), median: +(q(a, 0.5) ?? 0).toFixed(2), max: +(q(a, 0.999) ?? 0).toFixed(2) });
    out.visualLateS = { at5: st(late[0]), at44: st(late[1]) };
    out.mooredBeforeNextTripS = { at5: st(left[0]), at44: st(left[1]) };
    out.shareOfTripsWith2sMoored = { at5: T.length ? +(left[0].filter(x => x >= 2).length / T.length).toFixed(2) : null, at44: T.length ? +(left[1].filter(x => x >= 2).length / T.length).toFixed(2) : null };
    out.shareOfTripsWith1sMoored = { at5: T.length ? +(left[0].filter(x => x >= 1).length / T.length).toFixed(2) : null, at44: T.length ? +(left[1].filter(x => x >= 1).length / T.length).toFixed(2) : null };
    return out;
  });
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = [];
  for (const sc of SCENARIOS) { const s = summarise(await run(b, sc)); report.push(...s); for (const x of s) console.error(JSON.stringify(x)); }
  await b.close();
  fs.writeFileSync(path.join(__dirname, '../test-results/dock-measure.json'), JSON.stringify(report, null, 1));
})();
