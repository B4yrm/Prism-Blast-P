// Workers phase A: does the drawn hauler stay in step with the simulation?
// For every hauler, every pick-up / drop the simulation makes is matched with the one drawn on screen:
//   • skipped:      simulation poses that never appeared on screen (must be 0)
//   • startDelay:   simulation pose start → drawn pose start (s), max / median (bounded by LAG_MAX 0.25 + 1 frame)
//   • aheadMax:     most poses the simulation was ahead of the figure at any time (1 = fine; 2+ would mean
//                   the figure still shows a job while the simulation is already doing the one after)
//   • shownPose:    how long each drawn pose stayed on screen, min / median (aim ≥ 0.32 s or the real time)
//   • loadLate:     longest time the hand showed a load the simulation had already dropped (or not yet picked)
//   • stockLate:    after each drop the stock rose at once in the simulation; how long after that the drawn
//                   figure still held the load (max)
// The figure is checked against the simulation's own state at the same frame.
//   node tests/pose-sync.cjs <build.html>  → test-results/workers/pose-sync.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(process.argv[2]);
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const SCEN = [
  { name: 'mid (pick/drop 0.6 s)', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } } },
  { name: 'high warehouse level (pick/drop 0.04 s)', boats: 4, workers: 10, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } } },
];
const SECS = +(process.env.SECS || 120);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const sc of SCEN) for (const fps of [15, 30, 60]) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, settings: { quality: 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE);
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(([fps, SECS]) => {
      document.querySelectorAll('[data-m]').forEach(x => x.click());
      __game.loop.sleep();
      let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const w = __game.scene.getScene('world'), sim = w.sim, ms = 1000 / fps, dt = 1 / fps;
      const st = [], delays = [], shown = [];
      let skipped = 0, aheadMax = 0, loadLate = 0, stockLate = 0, simPoses = 0, loadTime = 0;
      let T = performance.now(), t = 0;
      for (let k = 0; k < SECS * fps; k++) {
        T += ms; __game.step(T, ms); t += dt;
        sim.workers.forEach((wk, i) => {
          const s = w.workerSpr[i]; if (!s) return;
          const a = st[i] || (st[i] = { simIn: false, figIn: false, simN: 0, figN: 0, starts: [], figT: 0, lateRun: 0, dropAt: null });
          const simIn = wk.state === 'pick' || wk.state === 'drop';
          const parts = s.frame.name.split('/'), figIn = !!parts[4] && parts[4][0] === 'b';
          if (simIn && !a.simIn) { a.simN++; simPoses++; a.starts.push(t); }
          if (a.simIn && !simIn && wk.state !== 'pick' && a.lastSim === 'drop') a.dropAt = t;       // a drop has just finished: stock is up
          a.lastSim = simIn ? wk.state : a.lastSim;
          if (figIn && !a.figIn) { a.figN++; const s0 = a.starts.shift(); if (s0 !== undefined) delays.push(t - s0); a.figT = 0; }
          if (figIn) a.figT += dt; else if (a.figIn) shown.push(a.figT);
          aheadMax = Math.max(aheadMax, a.simN - a.figN);
          // load in hand (walking frames only) vs the simulation
          const handLoad = !figIn && parts[2] && parts[2] !== 'none', simLoad = wk.carry > 0;
          if (!figIn && handLoad !== simLoad) { a.lateRun += dt; loadLate = Math.max(loadLate, a.lateRun); } else a.lateRun = 0;
          if (a.dropAt !== null) { if (handLoad || figIn) stockLate = Math.max(stockLate, t - a.dropAt); else a.dropAt = null; }
          a.simIn = simIn; a.figIn = figIn;
        });
      }
      // poses still pending at the end (the simulation started them in the last LAG_MAX seconds) are not skips
      for (const a of st) if (a) skipped += a.starts.filter(s0 => t - s0 > 0.5).length;
      const med = v => { const q = [...v].sort((x, y) => x - y); return q.length ? +q[q.length >> 1].toFixed(3) : null; };
      return { simPoses, skipped, startDelayMax: +Math.max(0, ...delays).toFixed(3), startDelayMedian: med(delays), aheadMax, shownPoseMin: shown.length ? +Math.min(...shown).toFixed(3) : null, shownPoseMedian: med(shown), loadLateMax: +loadLate.toFixed(3), stockLateMax: +stockLate.toFixed(3) };
    }, [fps, SECS]);
    await ctx.close();
    out.push({ scenario: sc.name, fps, ...r, errors: errs.slice(0, 3) });
    console.log(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/pose-sync.json'), JSON.stringify(out, null, 1));
})();
