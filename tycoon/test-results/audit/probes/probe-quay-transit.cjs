// READ-ONLY: (a) crowding at the quay pick tile, (b) fish in transit at the moment of a save (what a restart loses)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: 4, workers: 10, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 }, hq: { train: 0, carry: 0 } }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); });
  const p = await ctx.newPage(); await p.goto('file:///home/user/Prism-Blast-P/tycoon/index.html');
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(() => {
    __game.loop.sleep();
    let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let seed2 = 99; const vr = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, S = sim.S, dt = 1 / 30;
    let t = 0, maxAtQuay = 0, atQuayFrames = 0, overlapFrames = 0, maxOverlap = 0; const inTransit = [];
    const qx = 10.5, qy = 22.5;
    for (let k = 0; k < 600 * 30; k++) {
      Math.random = rnd; sim.update(dt); Math.random = vr; w.fleet.update(t, dt); w.drawWalkers(t); w.life.update(t, dt, [...sim.workers.map(x => x.m), ...sim.customers.map(x => x.m)]); t += dt;
      const near = sim.workers.filter(x => Math.hypot(x.m.x - qx, x.m.y - qy) < 0.7 && (x.state === 'pick' || x.state === 'toSrc'));
      maxAtQuay = Math.max(maxAtQuay, near.length); if (near.length >= 2) atQuayFrames++;
      // sim positions of two workers closer than 0.3 (before the visual push-apart)
      let ov = 0; for (let a = 0; a < sim.workers.length; a++) for (let c = a + 1; c < sim.workers.length; c++) if (Math.hypot(sim.workers[a].m.x - sim.workers[c].m.x, sim.workers[a].m.y - sim.workers[c].m.y) < 0.3) ov++;
      if (ov) overlapFrames++; maxOverlap = Math.max(maxOverlap, ov);
      if (k % 15 === 0) { Math.random = rnd; sim.collect(true); }
      if (k % 300 === 299) { const carry = sim.workers.reduce((s, x) => s + x.carry, 0), boats = sim.boats.reduce((s, x) => s + (x.state === 'back' || x.state === 'dock' ? x.load : 0), 0), conv = sim.convey.length; inTransit.push({ t: +t.toFixed(0), carryingWorkers: sim.workers.filter(x => x.carry > 0).length, fishCarried: carry, fishOnBoats: boats, onConveyor: conv }); }
    }
    return { maxWorkersAtQuayTile: maxAtQuay, secondsTwoOrMoreAtQuay: +(atQuayFrames * dt).toFixed(1), secondsAnyTwoWorkersWithin0_3tiles: +(overlapFrames * dt).toFixed(1), maxPairsOverlapping: maxOverlap, inTransitEvery10s: inTransit.slice(0, 12), caught: S.stats.caught, sold: S.stats.sold };
  });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
