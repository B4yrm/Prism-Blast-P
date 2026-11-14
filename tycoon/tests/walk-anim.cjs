// Workers phase A: the haulers' animation at 15 / 30 / 60 FPS, before vs after.
// The whole game is stepped frame by frame (__game.step) with the same save and seed at each frame rate.
// Per build and frame rate, over all haulers:
//   • walk steps per real second while walking (should not depend on the frame rate)
//   • how long the bending pose (pick-up / drop) stays on screen, per pose: min / median
//   • the figure's delay behind the simulation (max), and whether it ever grows (no build-up)
//   • load in hand vs the simulation: time the figure shows a load the simulation no longer has (or not yet)
//   node tests/walk-anim.cjs <before.html> <after.html>  → test-results/workers/walk-anim.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const files = process.argv.slice(2);
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const SCEN = [
  { name: 'mid (pick/drop ≈ 0.6 s)', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } } },
  { name: 'high warehouse level (pick/drop 0.04 s)', boats: 4, workers: 10, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } } },
];
const SECS = 120;
async function run(b, url, sc, fps) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, settings: { quality: 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(([fps, SECS]) => {
    document.querySelectorAll('[data-m]').forEach(x => x.click());
    __game.loop.sleep();
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const w = __game.scene.getScene('world'), sim = w.sim, ms = 1000 / fps, dt = 1 / fps;
    let T = performance.now(), t = 0;
    const st = sim.workers.map(() => ({ lastK: null, steps: 0, walkT: 0, pose: 0, poses: [], wrongLoad: 0, wrongRun: 0, wrongMax: 0 }));
    let lagMax = 0; const lagByMinute = [];
    for (let k = 0; k < SECS * fps; k++) {
      T += ms; __game.step(T, ms); t += dt;
      sim.workers.forEach((wk, i) => {
        const s = w.workerSpr[i]; if (!s || !st[i]) return;
        const name = s.frame.name, parts = name.split('/'), isPose = parts[3] && parts[3][0] === 'b', walkK = !isPose ? +parts[3] : null;
        // walk steps: changes of the walk-cycle frame while the figure is walking
        const moving = s.view ? (w.replay(s.view, s.view.vt).moving) : wk.m.moving;
        if (!isPose && moving) { st[i].walkT += dt; if (st[i].lastK !== null && walkK !== st[i].lastK) st[i].steps++; st[i].lastK = walkK; } else st[i].lastK = null;
        if (isPose) st[i].pose += dt; else if (st[i].pose) { st[i].poses.push(st[i].pose); st[i].pose = 0; }
        // load in hand vs simulation
        const shown = !isPose && parts[2] !== 'none', simHas = wk.carry > 0;
        if (shown !== simHas && !isPose) { st[i].wrongLoad += dt; st[i].wrongRun += dt; st[i].wrongMax = Math.max(st[i].wrongMax, st[i].wrongRun); } else st[i].wrongRun = 0;
        if (s.view) { const lag = (w.walkT0 ?? 0) - s.view.vt; lagMax = Math.max(lagMax, lag); const mi = Math.floor(t / 30); lagByMinute[mi] = Math.max(lagByMinute[mi] || 0, lag); }
      });
    }
    const all = st.flatMap(s => s.poses).sort((a, b) => a - b), steps = st.reduce((a, s) => a + s.steps, 0), walkT = st.reduce((a, s) => a + s.walkT, 0);
    return { stepsPerSec: +(steps / walkT).toFixed(2), walkSeconds: +walkT.toFixed(1), poses: all.length, poseMin: all.length ? +all[0].toFixed(3) : null, poseMedian: all.length ? +all[all.length >> 1].toFixed(3) : null,
      lagMax: +lagMax.toFixed(3), lagMaxPer30s: lagByMinute.map(x => +(x || 0).toFixed(3)), loadMismatchMaxRun: +Math.max(...st.map(s => s.wrongMax)).toFixed(3), loadMismatchShare: +(st.reduce((a, s) => a + s.wrongLoad, 0) / (SECS * st.length)).toFixed(4),
    };
  }, [fps, SECS]);
  await ctx.close();
  return { ...r, errs: errs.slice(0, 3) };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const sc of SCEN) for (const fps of [15, 30, 60]) for (const [n, f] of [['before', files[0]], ['after', files[1]]]) {
    const r = await run(b, 'file://' + path.resolve(f), sc, fps);
    out.push({ scenario: sc.name, fps, build: n, ...r }); console.error(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/walk-anim.json'), JSON.stringify(out, null, 1));
})();
