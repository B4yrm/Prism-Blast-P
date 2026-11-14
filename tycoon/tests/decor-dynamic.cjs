// Workers phase A: props vs the haulers as they are DRAWN (after the visual delay, the lane offset and the
// push-apart), at 15 / 30 / 60 FPS, before vs after. The whole game is stepped frame by frame.
// Per prop: the nearest a drawn hauler's feet came (tiles) and the frames in which a hauler stood inside
// the prop's footprint (distance < prop radius + 0.15 body). Screen space: frames in which a hauler's sprite
// overlaps the prop's sprite with the WRONG draw order (the one nearer the camera drawn behind).
//   node tests/decor-dynamic.cjs <before.html> <after.html>  → test-results/workers/decor-dynamic.json
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const files = process.argv.slice(2);
const MAXUP = { warehouse: { cap: 30, load: 30, cold: 30 }, factory: { speed: 30, out: 30, qual: 30 }, market: { price: 30, ads: 30, till: 30 }, hq: { train: 30, carry: 30 } };
const SCEN = [
  { name: 'mid, 6 haulers', boats: 4, workers: 6, tier: { harbor: 3, warehouse: 2, market: 2, hq: 2, factory: 1, farm: 0 }, up: { harbor: { cap: 6, speed: 10, net: 8 } } },
  { name: 'high, 10 haulers', boats: 4, workers: 10, tier: { harbor: 3, warehouse: 3, market: 3, hq: 3, factory: 3, farm: 0 }, up: { ...MAXUP, harbor: { cap: 10, speed: 12, net: 10 } } },
];
const SECS = +(process.env.SECS || 90);
const R = { fishbox_stack: 0.35, forklift_parked: 0.4, barrels: 0.3, pallet_raw: 0.35, pallet_prod: 0.35, cones: 0.25, netpile: 0.35 };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = [];
  for (const sc of SCEN) for (const fps of [15, 30, 60]) for (const [build, f] of [['before', files[0]], ['after', files[1]]]) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
    await ctx.addInitScript(sc => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', 1);
      localStorage.setItem('fishingTycoon.save', JSON.stringify({ v: 1, money: 500, boats: sc.boats, workers: sc.workers, level: 12, settings: { quality: 'medium' }, tier: sc.tier, up: { harbor: { cap: 0, speed: 0, net: 0 }, ...sc.up }, stats: { caught: 1, sold: 1 }, lastSeen: Date.now() })); }, sc);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(f));
    await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
    const r = await p.evaluate(([fps, SECS, R]) => {
      document.querySelectorAll('[data-m]').forEach(x => x.click());
      __game.loop.sleep();
      let seed = 4242; Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const w = __game.scene.getScene('world'), sim = w.sim, ms = 1000 / fps;
      const toTile = (sx, sy) => ({ x: (sx / 32 + sy / 16) / 2, y: (sy / 16 - sx / 32) / 2 });
      // the quay props: sprites whose frame is one of the prop names, south of the warehouse road
      const carts = new Set([...(w.slipCarts ? w.slipCarts.carts : []), ...w.fleet.jetties.carts].filter(Boolean).map(c => c.spr));
      const props = w.children.list.filter(o => !carts.has(o) && o.frame && /^prop\/(fishbox_stack|forklift_parked|barrels|pallet_raw|pallet_prod|cones)$/.test(o.frame.name))
        .map(o => { const t = toTile(o.x, o.y), n = o.frame.name.slice(5); return { o, n, x: +t.x.toFixed(2), y: +t.y.toFixed(2), r: R[n] || 0.35, min: 9, inside: 0, wrongOrder: 0 }; })
        .filter(q => q.y > 21.5 && q.y < 24.5 && q.x > 1 && q.x < 21);
      let T = performance.now();
      for (let k = 0; k < SECS * fps; k++) {
        T += ms; __game.step(T, ms);
        if (k < fps * 5) continue;                                         // first seconds: everyone leaves the HQ
        w.workerSpr.slice(0, sim.workers.length).forEach(s => {
          if (!s.visible) return;
          const t = toTile(s.x, s.y), bs = s.getBounds();
          for (const q of props) {
            const d = Math.hypot(t.x - q.x, t.y - q.y);
            if (d < q.min) q.min = d;
            if (d < q.r + 0.15) q.inside++;
            const bp = q.o.getBounds();
            if (bs.right > bp.left && bs.left < bp.right && bs.bottom > bp.top && bs.top < bp.bottom) {
              const workerNearer = t.x + t.y > q.x + q.y;
              if (workerNearer !== (s.depth > q.o.depth)) q.wrongOrder++;
            }
          }
        });
      }
      return props.map(q => ({ prop: q.n, at: [q.x, q.y], nearestHauler: +q.min.toFixed(2), framesInside: q.inside, framesWrongDrawOrder: q.wrongOrder }));
    }, [fps, SECS, R]);
    await ctx.close();
    out.push({ scenario: sc.name, fps, build, props: r, errors: errs.slice(0, 3) });
    console.log(JSON.stringify(out[out.length - 1]));
  }
  await b.close();
  fs.mkdirSync(path.join(__dirname, '../test-results/workers'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../test-results/workers/decor-dynamic.json'), JSON.stringify(out, null, 1));
})();
