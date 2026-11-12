// Outer jetties and saves:
//   1. a save that reaches nets 18 / engine 14 builds the jetties (visible stages)
//      and stores harborOuter = 1;
//   2. after a reload they are there at once (no second construction) and the
//      13-field progress snapshot is unchanged;
//   3. an old save without the field, below the threshold, loads with no jetties;
//   4. the same old save above the threshold builds them once.
//   node tests/outer-save.cjs   → test-results/outer-save.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const FILE = 'file://' + path.resolve(__dirname, '../index.html');
const ready = p => p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });

async function session(b, save) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(s => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1); localStorage.setItem('fishingTycoon.save', JSON.stringify(s)); }, save);
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(FILE); await ready(p);
  return { ctx, p, errs };
}
const state = p => p.evaluate(() => {
  const w = __game.scene.getScene('world'), J = w.fleet.jetties;
  return { built: J.built, progress: +J.progress.toFixed(2), flag: w.sim.S.harborOuter, stored: JSON.parse(localStorage.getItem('fishingTycoon.save') || '{}').harborOuter };
});
const snap = p => p.evaluate(() => { const S = __game.scene.getScene('world').sim.S; return { money: Math.floor(S.money), gems: S.gems, level: S.level, xp: S.xp, boats: S.boats, workers: S.workers, caught: S.stats.caught, up: JSON.stringify(S.up), tier: JSON.stringify(S.tier) }; });

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const report = {};
  const base = { v: 1, money: 900, gems: 33, boats: 4, workers: 6, level: 12, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, stats: { caught: 50, sold: 40 }, lastSeen: Date.now() };
  // 1 + 2
  {
    const s = await session(b, { ...base, up: { harbor: { cap: 5, speed: 14, net: 18 } } });
    const before = await state(s.p);
    // watch the construction for a few seconds of game time (stepped frames)
    const stages = await s.p.evaluate(() => { __game.loop.sleep(); let T = performance.now(); const J = __game.scene.getScene('world').fleet.jetties, seen = []; for (let k = 0; k < 30 * 9; k++) { T += 33.3; __game.step(T, 33.3); if (k % 30 === 0) seen.push(+J.progress.toFixed(2)); } return seen; });
    await s.p.evaluate(() => __game.loop.wake());
    const after = await state(s.p), snap1 = await snap(s.p);
    await s.p.reload(); await ready(s.p);
    const reloaded = await state(s.p), snap2 = await snap(s.p);
    report.build = { before, constructionProgressEverySecond: stages, after, reloaded, errors: s.errs };
    report.build.pass = !before.built && after.built && after.stored === 1 && reloaded.built && reloaded.progress === 1 && stages.some(x => x > 0 && x < 1);
    report.reloadKeepsProgress = { pass: JSON.stringify({ ...snap1, money: 0, caught: 0, xp: 0 }) === JSON.stringify({ ...snap2, money: 0, caught: 0, xp: 0 }) && snap2.money >= snap1.money - 1, before: snap1, after: snap2 };
    await s.ctx.close();
  }
  // 3. old save (no harborOuter field) below the threshold
  {
    const old = { ...base, up: { harbor: { cap: 2, speed: 3, net: 2 } } };
    const s = await session(b, old);
    await s.p.waitForTimeout(1500);
    const st = await state(s.p);
    report.oldSaveBelow = { ...st, errors: s.errs, pass: !st.built && st.flag === 0 && !s.errs.length };
    await s.ctx.close();
  }
  // 4. old save above the threshold: built once
  {
    const s = await session(b, { ...base, up: { harbor: { cap: 2, speed: 20, net: 22 } } });
    await s.p.evaluate(() => { __game.loop.sleep(); let T = performance.now(); for (let k = 0; k < 30 * 9; k++) { T += 33.3; __game.step(T, 33.3); } __game.loop.wake(); });
    const st = await state(s.p);
    report.oldSaveAbove = { ...st, errors: s.errs, pass: st.built && st.stored === 1 && !s.errs.length };
    await s.ctx.close();
  }
  await b.close();
  report.ok = Object.values(report).every(r => r.pass !== false);
  console.log(JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(__dirname, '../test-results/outer-save.json'), JSON.stringify(report, null, 1));
  process.exit(report.ok ? 0 : 1);
})();
