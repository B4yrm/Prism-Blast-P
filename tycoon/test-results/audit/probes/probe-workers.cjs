// READ-ONLY probe of the worker/logistics system: wraps methods in the page, changes no game file.
const { chromium } = require('playwright');
const sc = JSON.parse(process.argv[2] || '{}');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats || 4, workers: sc.workers || 6, level: 12, settings: { quality: sc.q || 'medium' }, harborOuter: sc.outer || 0,
      tier: sc.tier || { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, up: { ...(sc.max ? MAXUP : {}), harbor: { cap: 0, speed: 0, net: 0, ...(sc.up || {}) }, hq: { train: 0, carry: 0, ...(sc.hq || {}) } }, stock: sc.stock || { quay: 0, wh: 0, facOut: 0, mRaw: 0, mProd: 0 }, stats: { caught: 1, sold: 1 }, lastSeen: sc.lastSeen ? Date.now() - sc.lastSeen * 1000 : Date.now() })); }, sc);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file:///home/user/Prism-Blast-P/tycoon/index.html');
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(sc => {
    __game.loop.sleep(); document.querySelectorAll('[data-m]').forEach(x => x.click());
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let seed2 = 99; const vr = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, S = sim.S, dt = 1 / 30, out = {};
    // timing wrappers (the page's own methods are only timed, not altered)
    const T = {}; const wrap = (obj, name, label) => { const f = obj[name].bind(obj); T[label] = [0, 0]; obj[name] = (...a) => { const t0 = performance.now(); const r = f(...a); T[label][0] += performance.now() - t0; T[label][1]++; return r; }; };
    wrap(sim, 'update', 'sim.update'); wrap(w, 'drawWalkers', 'drawWalkers'); wrap(w.life, 'update', 'life.update'); wrap(w.life, 'separate', 'life.separate'); wrap(w, 'drawCranes', 'drawCranes'); wrap(w, 'drawConveyor', 'drawConveyor'); wrap(w.fleet, 'update', 'fleet.update');
    // trace
    const ev = { pick: [], drop: [], unload: 0, walkTeleports: 0, cranes: [], jobs: 0, idleWalks: 0 };
    const orig = { walk: sim.walk.bind(sim) };
    sim.walk = (wk, to, state) => { const before = [wk.m.x, wk.m.y]; orig.walk(wk, to, state); if (!wk.m.path && Math.hypot(wk.m.x - before[0], wk.m.y - before[1]) > 0.6) ev.walkTeleports++; if (state === 'toRest') ev.idleWalks++; };
    const stateTime = {}, maxStuck = {}; const lastPos = sim.workers.map(wk => [wk.m.x, wk.m.y, 0]);
    const nearBoat = []; let pickFromQuayWhileNoBoatIn = 0, unloadWithBoatAway = 0, craneAtUnload = [0, 0, 0, 0];
    const bus = window.__bus; // not exposed; use sim events via monkeypatch on craneWork
    const cw = w.craneWork.bind(w); w.craneWork = b => { ev.unload++; const before = w.cranes.map(c => c.t); cw(b); const moved = w.cranes.some((c, n) => c.t !== before[n]); craneAtUnload[b.i % 4] += moved ? 1 : 0; if (w.fleet.mooredSite(b) < 0) unloadWithBoatAway++; };
    const dropCount = { n: 0 };
    const heap = []; let t = 0, minQuay = 1e9, maxQuay = 0, maxRes = 0;
    const carriedKinds = {}; const dists = [];
    for (let k = 0; k < sc.secs * 30; k++) {
      Math.random = rnd; sim.update(dt); Math.random = vr; w.fleet.update(t, dt); w.drawWalkers(t); w.life.update(t, dt, [...sim.workers.map(x => x.m), ...sim.customers.map(x => x.m)]); w.drawConveyor(); w.drawCranes(dt); t += dt;
      sim.workers.forEach((wk, i) => { stateTime[wk.state] = (stateTime[wk.state] || 0) + dt; const lp = lastPos[i]; if (Math.hypot(wk.m.x - lp[0], wk.m.y - lp[1]) < 0.001 && (wk.state.startsWith('to'))) lp[2] += dt; else lp[2] = 0; maxStuck[i] = Math.max(maxStuck[i] || 0, lp[2]); lp[0] = wk.m.x; lp[1] = wk.m.y; if (wk.carry > 0) carriedKinds[wk.kind] = (carriedKinds[wk.kind] || 0) + 1; });
      minQuay = Math.min(minQuay, S.stock.quay); maxQuay = Math.max(maxQuay, S.stock.quay); maxRes = Math.max(maxRes, sim.res.quay);
      // a worker picking at the quay while its pick point is far from any boat that is in a slip
      if (k % 15 === 0) { Math.random = rnd; sim.collect(true); }
      if (k % (60 * 30) === 0 && performance.memory) { if (window.gc) window.gc(); heap.push(+(performance.memory.usedJSHeapSize / 1048576).toFixed(1)); }
    }
    for (const k in T) T[k] = { ms: +(T[k][0] / T[k][1]).toFixed(4), calls: T[k][1] };
    const q = sim.workers.map(wk => ({ state: wk.state, x: +wk.m.x.toFixed(1), y: +wk.m.y.toFixed(1) }));
    return { T, stateShareOfWorkerTime: Object.fromEntries(Object.entries(stateTime).map(([a, v]) => [a, +(v / Object.values(stateTime).reduce((x, y) => x + y, 0)).toFixed(3)])), ev, craneAtUnload, unloadWithBoatAway, maxStuckS: maxStuck, quay: { min: minQuay, max: maxQuay, maxReserved: maxRes }, carriedKinds, workers: q, stock: { ...S.stock }, caught: S.stats.caught, sold: S.stats.sold, money: Math.floor(S.money), customers: sim.customers.length, heapMBAfterGcEveryMinute: heap, sprites: { workerSpr: w.workerSpr.length, custSpr: w.custSpr.length, pool: w.custPool.length }, objects: w.children.length };
  }, sc);
  console.log(JSON.stringify(r, null, 1)); if (errs.length) console.log('ERRORS', errs.slice(0, 3)); await b.close();
})();
