// Measurement: which trips the boats make BEFORE the outer jetties open (nets < 18
// or engine < 14), level by level, in the game's own code with the speed and turn
// limits. 4 boats, 4 game minutes per level, stepped at 30 FPS with a seeded random.
// Per level: trips to the fishing grounds / harbour trips, how far out of the slip
// the harbour trips go, how late the latest arrival was, top speed.
//   [NAV=3] node tests/prelock-measure.cjs [path/to/index.html]  → test-results/prelock-measure[-nav3].json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '../index.html'));
const ENG = [0, 2, 4, 6, 8, 10, 12, 14, 18, 22, 26, 30], NETS = [0, 6, 12, 17, 18, 24, 30];
const NAV = +(process.env.NAV || 0);                 // sea-charts research level
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const net of NETS) for (const sp of ENG) {
    if (net >= 18 && sp >= 14) continue;             // the jetties are open there
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(([net, sp, nav]) => {
      if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: 4, workers: 6, level: 12, settings: { quality: 'low' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 0, farm: 0 }, up: { harbor: { cap: 0, speed: sp, net } }, research: { lv: nav ? { nav, nets: 0 } : {}, active: null }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() }));
    }, [net, sp, NAV]);
    const p = await ctx.newPage();
    await p.goto(FILE);
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(() => {
      __game.loop.sleep();
      let seed = 777; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; let seed2 = 99; const vr = () => (seed2 = (seed2 * 48271) % 2147483647) / 2147483647;
      const w = __game.scene.getScene('world'), sim = w.sim, F = w.fleet, dt = 1 / 30, prev = [], share = [];
      let t = 0, vmax = 0;
      const st = F.start.bind(F); F.start = (vb, ph) => { st(vb, ph); if (ph === 'depart' && vb.mode === 'short') share.push(vb.shortF); };
      for (let k = 0; k < 240 * 30; k++) {
        Math.random = rnd; sim.update(dt); Math.random = vr; F.update(t, dt); t += dt;
        F.boats.forEach((v, i) => { if (prev[i] && v.phase !== 'docked' && v.phase !== 'settle' && v.phase !== 'castoff') vmax = Math.max(vmax, Math.hypot(v.x - prev[i][0], v.y - prev[i][1]) / dt); prev[i] = [v.x, v.y]; });
        if (k % 200 === 0) { Math.random = rnd; sim.collect(true); }
      }
      const S = F.stats;
      return { trips: S.trips, arrivals: S.arrivals, lagMax: S.arrivals ? +S.lagMax.toFixed(2) : null, lagMean: S.arrivals ? +(S.lagSum / S.arrivals).toFixed(2) : null, vmax: +vmax.toFixed(2), V0: +F.V0.toFixed(2), shortShareMin: share.length ? Math.min(...share) : null, shortShareMean: share.length ? +(share.reduce((a, c) => a + c, 0) / share.length).toFixed(2) : null };
    });
    await ctx.close();
    out.push({ nets: net, engine: sp, nav: NAV, ...r });
    console.error(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, '../test-results/prelock-measure' + (NAV ? '-nav' + NAV : '') + '.json'), JSON.stringify(out, null, 1));
})();
