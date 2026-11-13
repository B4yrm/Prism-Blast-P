// Outer jetties, head arms, loop berths and saves:
//   1. a save that reaches nets 18 / engine 14 builds the jetties (visible stages)
//      and stores harborOuter = 1; after a reload they are there at once;
//   2. played on: the stem boat moves, the head arms are built (harborOuter = 2),
//      the other boats move in order; after a reload every boat lies at its loop
//      berth, nothing is built twice and the progress snapshot is unchanged;
//   3. an old save without the field, below the threshold, loads with no jetties;
//   4. the same old save above the threshold loads with jetties, head arms and
//      the boats at their loop berths in place (nothing to build, no boat to move);
//   5. so does a save of the previous build (harborOuter = 1).
//   node tests/outer-save.cjs [path/to/index.html]  → test-results/outer-save.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(process.argv[2] || path.join(__dirname, '../index.html'));
const ready = p => p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });

async function session(b, save) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  const p = await ctx.newPage(), errs = [];
  // seed the save once, with the game told not to write on the way out, then start it for real
  await p.goto(FILE); await ready(p);
  await p.evaluate(s => { window.__noSave = true; localStorage.setItem('fishingTycoon.save', JSON.stringify(s)); }, save);
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await ready(p);
  return { ctx, p, errs };
}
const state = p => p.evaluate(() => {
  const w = __game.scene.getScene('world'), J = w.fleet.jetties;
  return { built: J.built, arms: J.arms, armProgress: +J.armProgress.toFixed(2), sites: w.fleet.boats.map(v => v.site), progress: +J.progress.toFixed(2), flag: w.sim.S.harborOuter, stored: JSON.parse(localStorage.getItem('fishingTycoon.save') || '{}').harborOuter };
});
const snap = p => p.evaluate(() => { const S = __game.scene.getScene('world').sim.S; return { money: Math.floor(S.money), gems: S.gems, level: S.level, xp: S.xp, boats: S.boats, workers: S.workers, caught: S.stats.caught, up: JSON.stringify(S.up), tier: JSON.stringify(S.tier) }; });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
  const base = { v: 1, money: 900, gems: 33, boats: 4, workers: 10, level: 12, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, stats: { caught: 50, sold: 40 }, lastSeen: Date.now() };
  // whole frames of the game, stepped (render loop asleep)
  const play = (p, secs) => p.evaluate(secs => { __game.loop.sleep(); let T = performance.now(); const w = __game.scene.getScene('world'), J = w.fleet.jetties, seen = [], arm = []; for (let k = 0; k < 30 * secs; k++) { T += 33.3; __game.step(T, 33.3); if (k % 30 === 0) { seen.push(+J.progress.toFixed(2)); arm.push(+J.armProgress.toFixed(2)); } } __game.loop.wake(); return { seen, arm }; }, secs);
  // 1 + 2
  {
    const s = await session(b, { ...base, up: { ...MAXUP, harbor: { cap: 0, speed: 14, net: 17 } } });
    const before = await state(s.p);
    await s.p.evaluate(() => { __game.scene.getScene('world').sim.S.up.harbor.net = 18; });      // the last upgrade is bought in play
    const st1 = await play(s.p, 9);
    const after = await state(s.p);
    report.jetties = { before, constructionProgressEverySecond: st1.seen, after, errors: s.errs.slice() };
    report.jetties.pass = !before.built && after.built && after.stored >= 1 && st1.seen.some(x => x > 0 && x < 1) && !s.errs.length;
    // play on until every boat lies at its loop berth (at most 6 minutes of game time)
    let st = after, armStages = [], secs = 0;
    while (secs < 360 && !(st.arms && st.sites.every(x => x >= 4))) { const r = await play(s.p, 20); armStages.push(...r.arm.filter(x => x > 0 && x < 1)); secs += 20; st = await state(s.p); }
    await s.p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    st = await state(s.p);
    const snap1 = await snap(s.p);
    await s.p.reload(); await ready(s.p);
    const again = await state(s.p), snap2 = await snap(s.p);
    report.headArmsAndMoves = { gameSecondsNeeded: secs, armProgressSeen: armStages.slice(0, 6), afterPlaying: st, afterReload: again, errors: s.errs.slice() };
    report.headArmsAndMoves.pass = st.arms && st.stored === 2 && st.sites.every(x => x >= 4) && again.arms && again.armProgress === 1 && again.sites.every(x => x >= 4) && armStages.length > 0 && !s.errs.length;
    report.reloadKeepsProgress = { pass: JSON.stringify({ ...snap1, money: 0, caught: 0, xp: 0 }) === JSON.stringify({ ...snap2, money: 0, caught: 0, xp: 0 }) && snap2.money >= snap1.money - 1 && snap2.caught >= snap1.caught, before: snap1, after: snap2 };
    await s.ctx.close();
  }
  // 3. old save (no harborOuter field) below the threshold
  {
    const s = await session(b, { ...base, up: { harbor: { cap: 2, speed: 3, net: 2 } } });
    await s.p.waitForTimeout(1500);
    const st = await state(s.p);
    report.oldSaveBelow = { ...st, errors: s.errs, pass: !st.built && !st.arms && st.flag === 0 && st.sites.every(x => x < 4) && !s.errs.length };
    await s.ctx.close();
  }
  // 4. old save above the threshold: built once
  {
    const s = await session(b, { ...base, up: { harbor: { cap: 2, speed: 20, net: 22 } } });
    const atLoad = await state(s.p);
    await play(s.p, 9);
    await s.p.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    const st = await state(s.p);
    if (!(atLoad.built && atLoad.arms && atLoad.progress === 1 && atLoad.armProgress === 1 && atLoad.sites.every(x => x >= 4))) s.errs.push('not in place at load: ' + JSON.stringify(atLoad));
    report.oldSaveAbove = { ...st, errors: s.errs, pass: st.built && st.arms && st.stored === 2 && st.sites.every(x => x >= 4) && !s.errs.length };
    await s.ctx.close();
  }
  // 5. a save of the previous build: jetties built (1), no head arms yet
  {
    const s = await session(b, { ...base, harborOuter: 1, up: { ...MAXUP, harbor: { cap: 0, speed: 30, net: 30 } } });
    const st0 = await state(s.p);
    let st = st0, secs = 0;
    await play(s.p, 5); await s.p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); st = await state(s.p);
    report.previousBuildSave = { atLoad: st0, gameSecondsNeeded: secs, afterPlaying: st, errors: s.errs, pass: st0.built && st0.arms && st0.progress === 1 && st0.armProgress === 1 && st0.sites.every(x => x >= 4) && st.stored === 2 && !s.errs.length };
    await s.ctx.close();
  }
  await b.close();
  report.ok = Object.values(report).every(r => r.pass !== false);
  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(__dirname, '../test-results/outer-save.json'), JSON.stringify(report, null, 1));
  process.exit(report.ok ? 0 : 1);
})();
