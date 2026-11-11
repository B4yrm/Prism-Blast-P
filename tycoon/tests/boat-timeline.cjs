// Boat timing check: drives the simulation alone (render loop paused, seeded
// random) for 10 simulated minutes with 1 and with 4 boats, and records every
// boat state change and the duration of every leg (dock, out, fish, back). Used to prove that visual changes leave trip times,
// catches and income exactly as they were.
//   node tests/boat-timeline.cjs [path/to/index.html] > timeline.json
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '../index.html'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  for (const fleet of [1, 4]) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(n => {
      if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: n, workers: n === 4 ? 6 : 2, level: 9,
        tier: { harbor: n === 4 ? 3 : 1, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
    }, fleet);
    const p = await ctx.newPage();
    await p.goto('file://' + FILE);
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').sim && document.getElementById('loader') === null, null, { timeout: 90000 });
    out['boats' + fleet] = await p.evaluate(() => {
      __game.loop.sleep();
      let seed = 12345; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const sim = __game.scene.getScene('world').sim, S = sim.S, dt = 0.05;
      const tl = sim.boats.map(() => []), last = sim.boats.map(() => null);
      let t = 0;
      for (let k = 0; k < 600 / dt; k++) {
        sim.update(dt); t += dt;
        sim.boats.forEach((bt, i) => { if (bt.state !== last[i]) { tl[i].push([+t.toFixed(2), bt.state]); last[i] = bt.state; } });
        if (k % 200 === 0) sim.collect(true);
      }
      // leg durations (the first, partial dock is skipped: a few real-time frames run before the pause)
      const legs = tl.map(x => x.slice(1, -1).map((e, j) => [e[1], +(x[j + 2][0] - e[0]).toFixed(2)]));
      return { legs, caught: S.stats.caught, timeline: tl };
    });
    await ctx.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})();
