// Workers phase A: save / load, old saves and offline income, before vs after.
// The same saves are loaded into both builds with a fixed clock, then played 60 s of game time with the same
// seed. Compared between the builds:
//   • the state right after loading (migration / filling of old saves, the offline amount offered)
//   • the state after 60 s, as the game would save it (JSON of the state, the clock fixed)
//   • the progress snapshot the game logs on save
// Saves: a current save, an old minimal save (fields missing: filled by load), a save with an hour away
// (offline income), and a max-level save with loop berths.
//   node tests/save-compare.cjs <before.html> <after.html>  → test-results/workers/save-compare.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [A, B] = process.argv.slice(2).map(f => 'file://' + path.resolve(f));
const BASE = 1.8e12;
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const SAVES = {
  current: { v: 1, money: 1234.5, register: 40, boats: 3, workers: 5, level: 9, xp: 12, settings: { quality: 'medium' }, tier: { harbor: 2, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 4, speed: 6, net: 3 }, warehouse: { cap: 3, load: 2, cold: 1 } }, stock: { quay: 7, wh: 20, facOut: 3, mRaw: 5, mProd: 2 }, stats: { caught: 900, sold: 700 }, lastSeen: BASE - 30e3 },
  oldMinimal: { v: 1, money: 300, boats: 2, workers: 2, level: 4, stats: { caught: 120, sold: 80 }, lastSeen: BASE - 30e3 },
  hourAway: { v: 1, money: 5000, boats: 4, workers: 6, level: 12, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } }, stats: { caught: 5000, sold: 4500 }, lastSeen: BASE - 3600e3 },
  maxLoopBerths: { v: 1, money: 99999, boats: 4, workers: 10, level: 30, harborOuter: 2, settings: { quality: 'medium' }, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 30, speed: 30, net: 30 } }, stats: { caught: 90000, sold: 80000 }, lastSeen: BASE - 30e3 },
};
async function run(b, url, save) {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
  await ctx.addInitScript(([save, BASE]) => {
    window.__T = 0; Date.now = () => BASE + window.__T;
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
    localStorage.setItem('fishingTycoon.save', JSON.stringify(save));
  }, [save, BASE]);
  const p = await ctx.newPage(); const errs = [], logs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => logs.push(m.text()));
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const r = await p.evaluate(() => {
    __game.loop.sleep();
    const w = __game.scene.getScene('world'), S = w.sim.S, clean = o => { const c = JSON.parse(JSON.stringify(o)); delete c.lastSeen; return c; };
    const modal = document.getElementById('modal'), offerText = modal && !modal.hidden ? modal.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null;
    const afterLoad = clean(S);
    let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    let T = performance.now();
    for (let k = 0; k < 60 * 30; k++) { T += 1000 / 30; window.__T += 1000 / 30; __game.step(T, 1000 / 30); }
    return { afterLoad, offerText, after60: clean(S) };
  });
  await ctx.close();
  return { ...r, errs: errs.slice(0, 3) };
}
const diff = (a, b, pre = '') => {
  const out = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    if (x && y && typeof x === 'object' && typeof y === 'object') out.push(...diff(x, y, pre + k + '.'));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${pre}${k}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
  }
  return out;
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const [name, save] of Object.entries(SAVES)) {
    const ra = await run(b, A, save), rb = await run(b, B, save);
    const dLoad = diff(ra.afterLoad, rb.afterLoad), d60 = diff(ra.after60, rb.after60);
    const res = { save: name, loadIdentical: !dLoad.length, offlineOfferIdentical: ra.offerText === rb.offerText, offlineOffer: rb.offerText, after60Identical: !d60.length,
      money: [Math.floor(ra.after60.money), Math.floor(rb.after60.money)], diffsAfterLoad: dLoad.slice(0, 10), diffsAfter60: d60.slice(0, 10), errors: [...ra.errs, ...rb.errs] };
    out.push(res); console.log(JSON.stringify(res));
  }
  await b.close();
  const ok = out.every(r => r.loadIdentical && r.offlineOfferIdentical && r.after60Identical && !r.errors.length);
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/save-compare.json'), JSON.stringify({ ok, runs: out }, null, 1));
  console.log('ok', ok); process.exit(ok ? 0 : 1);
})();
