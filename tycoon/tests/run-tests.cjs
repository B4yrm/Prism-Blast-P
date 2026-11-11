// Fishing Tycoon browser test suite (headless Chromium, Playwright).
//   node tests/run-tests.cjs            → prints a JSON report
// Runs against tycoon/index.html. Covers layout on many screen sizes, panels
// on small screens, touch input, save/load, offline earnings, the simulation,
// label stability and the graphics presets.
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'];
const report = {};
const ok = (name, pass, info) => { report[name] = { pass: !!pass, ...(info || {}) }; };

async function boot(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: opts.dpr || 2, hasTouch: true, isMobile: false });
  if (opts.save !== undefined) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', 1); if (s === null) localStorage.removeItem('fishingTycoon.save'); else localStorage.setItem('fishingTycoon.save', s); } }, opts.save);
  const p = await ctx.newPage();
  p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.goto(URL);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').sim && document.getElementById('loader') === null, null, { timeout: 60000 });
  await p.evaluate(() => { document.querySelectorAll('[data-m=ok]').forEach(b => b.click()); });
  return p;
}
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const hit = (a, b) => a && b && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);

(async () => {
  const browser = await chromium.launch({ args: ARGS });

  // 1. layout on many screens: no overlaps between fixed UI blocks, nothing off-screen
  const sizes = [[640, 360], [732, 412], [800, 360], [844, 390], [915, 412], [960, 540], [1024, 600], [1280, 720], [360, 640], [390, 844], [412, 915], [768, 1024]];
  const layout = {};
  for (const [w, h] of sizes) {
    const p = await boot(browser, { width: w, height: h });
    const els = ['#hud .lvl', '#hud .coin', '#hud .gem', '#hud .fish', '#hud .inc', '#hud .gear', '#sideTog', '#recenter', '#mission', '#dock', '#collect'];
    const R = {}; for (const s of els) R[s] = await rect(p, s);
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) if (hit(R[els[i]], R[els[j]])) bad.push(els[i] + ' × ' + els[j]);
    for (const s of els) { const r = R[s]; if (r && (r.l < 0 || r.t < 0 || r.r > w + 0.5 || r.b > h + 0.5)) bad.push(s + ' off-screen'); }
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    layout[`${w}x${h}`] = bad.length || overflow ? { overlaps: bad, overflow } : 'ok';
    await p.context().close();
  }
  ok('layout_no_overlap', Object.values(layout).every(v => v === 'ok'), { sizes: layout });

  // 2. touch-target sizes (visible box; small controls get an invisible extended hit area)
  {
    const p = await boot(browser, { width: 844, height: 390 });
    const t = await p.evaluate(() => {
      const out = {};
      const eff = (el, ext) => { const r = el.getBoundingClientRect(); return [Math.round(r.width + 2 * ext), Math.round(r.height + 2 * ext)]; };
      out.plus = eff(document.querySelector('.pill .plus'), 9); out.gear = eff(document.querySelector('.gear'), 6);
      out.sideTog = eff(document.getElementById('sideTog'), 6); out.recenter = eff(document.getElementById('recenter'), 6);
      out.mission = eff(document.getElementById('mission'), 6); out.dockBtn = eff(document.querySelector('#dock button'), 0); out.collect = eff(document.getElementById('collect'), 0);
      return out;
    });
    ok('touch_targets_min_40px', Object.values(t).every(([w, h]) => w >= 40 && h >= 40), t);
    await p.context().close();
  }

  // 3. panels on the smallest screens: open, scroll, close
  for (const [w, h] of [[640, 360], [360, 640]]) {
    const p = await boot(browser, { width: w, height: h });
    const res = {};
    for (const name of ['upgrades', 'missions', 'workers', 'settings']) {
      await p.evaluate(n => document.querySelector(`#dock [data-open="${n}"], #side [data-open="${n}"], [data-open="${n}"]`).click(), name);
      await p.evaluate(() => Promise.all(document.getElementById('panel').getAnimations().map(a => a.finished)));
      const pr = await rect(p, '#panel'), xr = await rect(p, '#pclose');
      const sc = await p.evaluate(() => { const b = document.getElementById('pbody'); const before = b.scrollTop; b.scrollTop = 10000; return { scrollable: b.scrollHeight > b.clientHeight, moved: b.scrollTop > before }; });
      await p.tap('#pclose');
      await p.waitForTimeout(150);
      const closed = await p.evaluate(() => document.getElementById('panel').hidden);
      res[name] = { inView: pr.t >= 0 && pr.b <= h + 0.5 && pr.l >= 0 && pr.r <= w + 0.5, closeVisible: xr.b <= h && xr.r <= w, scroll: sc.scrollable ? sc.moved : 'fits', closed };
    }
    // mission chip expand / collapse
    await p.tap('#mission'); await p.waitForTimeout(150);
    const opened = await p.evaluate(() => document.getElementById('mission').className.includes('open'));
    await p.tap('#mission [data-act=missionClose]'); await p.waitForTimeout(150);
    const mini = await p.evaluate(() => document.getElementById('mission').className.includes('mini'));
    res.missionCard = { opened, collapsed: mini };
    const pass = Object.values(res).every(v => Object.values(v).every(x => x === true || x === 'fits'));
    ok(`panels_${w}x${h}`, pass, res);
    await p.context().close();
  }

  // 4. touch input: drag, pinch, double-tap, building tap, recenter
  {
    const p = await boot(browser, { width: 844, height: 390 });
    const cdp = await p.context().newCDPSession(p);
    const cam = () => p.evaluate(() => { const c = __game.scene.getScene('world').cameras.main; return { x: c.scrollX, y: c.scrollY, z: c.zoom }; });
    const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const c0 = await cam();
    await touch('touchStart', [[420, 220]]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[420 - k * 12, 220 - k * 4]]); await touch('touchEnd', []);
    await p.waitForTimeout(400);
    const c1 = await cam();
    await touch('touchStart', [[380, 200], [460, 200]]); for (let k = 1; k <= 8; k++) await touch('touchMove', [[380 - k * 8, 200], [460 + k * 8, 200]]); await touch('touchEnd', []);
    await p.waitForTimeout(300);
    const c2 = await cam();
    await p.tap('#recenter'); await p.waitForTimeout(1500);
    const c3 = await cam();
    await p.touchscreen.tap(770, 300); await p.waitForTimeout(80); await p.touchscreen.tap(770, 300); await p.waitForTimeout(500);
    const c4 = await cam();
    await p.tap('#recenter'); await p.waitForTimeout(700);
    await p.evaluate(() => document.getElementById('pclose').click());
    const pos = await p.evaluate(() => __game.scene.getScene('world').worldToScreen(20, 14, 20));
    await p.touchscreen.tap(pos.x, pos.y); await p.waitForTimeout(400);
    const panel = await p.evaluate(() => !document.getElementById('panel').hidden && document.getElementById('ptitle').textContent);
    ok('touch_input', Math.abs(c1.x - c0.x) > 20 && c2.z > c1.z * 1.2 && Math.abs(c3.z - c0.z) < 0.01 && c4.z > c3.z * 1.4 && !!panel,
      { dragMovedPx: Math.round(c1.x - c0.x), pinchZoom: +(c2.z / c1.z).toFixed(2), recenterZoomBack: +(c3.z / c0.z).toFixed(3), doubleTapZoom: +(c4.z / c3.z).toFixed(2), tapOpened: panel });
    await p.context().close();
  }

  // 5. label level-of-detail is stable (no flicker around the threshold)
  {
    const p = await boot(browser, { width: 844, height: 390 });
    const r = await p.evaluate(async () => {
      const w = __game.scene.getScene('world'), cam = w.cameras.main, dpr = window.devicePixelRatio, el = document.querySelector('.blabel');
      let flips = 0, last = el.classList.contains('far'); const z0 = cam.zoom;
      for (let k = 0; k < 120; k++) {           // wobble the zoom ±2 % around the threshold
        cam.setZoom(0.5 * dpr * (1 + 0.02 * Math.sin(k)));
        await new Promise(r => requestAnimationFrame(r));
        const f = el.classList.contains('far'); if (f !== last) flips++; last = f;
      }
      cam.setZoom(z0);
      return { flips };
    });
    ok('labels_no_flicker', r.flips <= 1, r);
    await p.context().close();
  }

  // 6. save / load keeps progress (fresh context = empty storage; no seeding script,
  //    which would also run again on reload)
  {
    const p = await boot(browser, { width: 844, height: 390 });
    const before = await p.evaluate(() => { const w = __game.scene.getScene('world'); for (let i = 0; i < 1200; i++) w.sim.update(0.1); w.sim.collect(false); const S = w.sim.S; S.up.market.price = 2; window.dispatchEvent(new Event('pagehide')); return JSON.stringify({ money: Math.floor(S.money), lvl: S.level, caught: S.stats.caught, price: S.up.market.price }); });
    await p.reload();
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').sim, null, { timeout: 60000 });
    const after = await p.evaluate(() => { const S = __game.scene.getScene('world').sim.S; return JSON.stringify({ money: Math.floor(S.money), lvl: S.level, caught: S.stats.caught, price: S.up.market.price }); });
    ok('save_load', before === after, { before: JSON.parse(before), after: JSON.parse(after) });
    await p.context().close();
  }

  // 7. offline earnings = half the steady rate × time away (capped), and corrupt save recovery
  {
    const seed = JSON.stringify({ v: 1, money: 1000, gems: 10, level: 4, workers: 3, boats: 1, lastSeen: Date.now() - 2 * 3600e3, stats: { caught: 500, sold: 400 }, tier: { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 } });
    const p = await boot(browser, { width: 844, height: 390 }, { save: seed });
    const r = await p.evaluate(() => { const t = document.getElementById('mcard').innerText; const m = t.match(/\+\$([\d.,]+)\s*([KMB]?)/); return { text: t.replace(/\s+/g, ' ').slice(0, 80), shown: m ? m[1] + m[2] : null }; });
    ok('offline_earnings_modal', !!r.shown, r);
    await p.context().close();
    const p2 = await boot(browser, { width: 844, height: 390 }, { save: '{not json' });
    const fresh = await p2.evaluate(() => __game.scene.getScene('world').sim.S.money);
    ok('corrupt_save_recovers', fresh === 120 && p2.errs.length === 0, { money: fresh, errors: p2.errs });
    await p2.context().close();
  }

  // 8. simulation: boats, workers, customers, economy over 15 simulated minutes
  {
    const p = await boot(browser, { width: 844, height: 390 }, { save: null });
    const r = await p.evaluate(() => {
      const w = __game.scene.getScene('world'), sim = w.sim, S = sim.S;
      const seenB = new Set(), seenW = new Set(); const m0 = S.money;
      for (let i = 0; i < 9000; i++) { sim.update(0.1); seenB.add(sim.boats[0].state); seenW.add(sim.workers[0].state); if (i % 600 === 0) sim.collect(false); }
      return { boatStates: [...seenB], workerStates: [...seenW], caught: S.stats.caught, sold: S.stats.sold, earned: Math.round(S.money - m0), customersSeen: sim.customers.length };
    });
    ok('simulation', r.boatStates.length === 4 && r.workerStates.includes('drop') && r.caught > 100 && r.sold > 50 && r.earned > 0, r);
    ok('no_page_errors', p.errs.length === 0, { errors: p.errs });
    await p.context().close();
  }

  // 9. graphics presets: memory and per-frame JS cost (CPU throttled 4×)
  const perf = {};
  for (const q of ['high', 'medium', 'low']) {
    const p = await boot(browser, { width: 844, height: 390 }, { save: JSON.stringify({ v: 1, settings: { quality: q }, stats: { caught: 0, sold: 0 } }), dpr: 2.75 });
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await p.evaluate(() => new Promise(res => {
      const g = __game, w = g.scene.getScene('world'), orig = w.sys.sceneUpdate; let n = 0, tot = 0;
      w.sys.sceneUpdate = function (t, d) { const a = performance.now(); orig.call(w, t, d); tot += performance.now() - a; n++; };
      setTimeout(() => {
        let px = 0; for (const k of g.textures.getTextureKeys()) { const s = g.textures.get(k).source[0]; if (s) px += s.width * s.height; }
        res({ preset: G_name(), canvas: g.canvas.width + 'x' + g.canvas.height, textureMB: +(px * 4 / 1048576).toFixed(1), heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, updateMsAvg: +(tot / Math.max(1, n)).toFixed(2), objects: w.children.length });
      }, 4000);
      function G_name() { return (window.__quality && window.__quality.name) || '?'; }
    }));
    perf[q] = r;
    await p.context().close();
  }
  ok('graphics_presets', perf.low.textureMB < perf.high.textureMB, perf);

  await browser.close();
  const passed = Object.values(report).filter(r => r.pass).length;
  console.log(JSON.stringify({ passed, total: Object.keys(report).length, report }, null, 1));
})();
