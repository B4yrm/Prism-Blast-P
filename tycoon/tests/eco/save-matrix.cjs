// T1.2 save matrix in the real pages (headless Chromium), with the fixtures in tests/fixtures:
//   A. old save → eco build → save → reload (eco build): S.eco created once, then unchanged; progress untouched
//   B. eco save → OLD build → save → eco build, for every old build given: S.eco is carried through the old build
//      value for value (not just present), and the eco build then finds it unchanged
//   C. eco save → old build PLAYED for a while (simulation running) → eco build: S.eco still carried; the eco build
//      repairs only what the played stock requires (empty places); progress written by the old build untouched
//   D. damaged S.eco (null, not an object, partial, NaN / Infinity / negative / wrong lengths, future schema)
//      → eco build: the game loads, progress untouched, S.eco repaired / recovered / left alone as specified;
//      a future schema also survives the old build and a second eco session byte for byte
// Every session saves the way the game does when the page is left (pagehide → save); the simulation is frozen
// (as in tests/workers-regress.cjs) except in C, so the state does not move between the steps.
//   node tests/eco/save-matrix.cjs <eco.html> <old.html>[,<old2.html>...] [out.json]
//   The FIRST old build is the main reference (use the production index.html, the build players have).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { bundle, fresh } = require('./_load.cjs');
const E = fresh(bundle('state-eco-matrix', "export * from './eco/state-eco.js'; export { STREAMS } from './eco/rng.js';"));

const root = path.resolve(__dirname, '../..');
const ECO = 'file://' + path.resolve(process.argv[2]);
const OLDS = process.argv[3].split(',').map(f => ({ name: path.basename(f), url: 'file://' + path.resolve(f), sha: sha(f) }));
const OUT = process.argv[4];
const BLANK = path.join(root, '.preview', 'blank.html');
fs.mkdirSync(path.dirname(BLANK), { recursive: true });
fs.writeFileSync(BLANK, '<!doctype html><meta charset="utf-8"><title>blank</title>');
const BLANK_URL = 'file://' + BLANK;
const KEY = 'fishingTycoon.save';
const FIXDIR = path.join(__dirname, '../fixtures');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const PLAY_SECS = +(process.env.PLAY_SECS || 20);

function sha(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
const fixtureSums = () => Object.fromEntries(fs.readFileSync(path.join(FIXDIR, 'fixtures.sha256'), 'utf8').trim().split('\n').map(l => l.split(/\s+/)).map(([h, f]) => [f, { want: h, got: sha(path.join(FIXDIR, f)) }]));
const FIX = name => JSON.parse(fs.readFileSync(path.join(FIXDIR, `save-${name}.json`), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const strip = (S, ...keys) => { const c = clone(S); for (const k of ['lastSeen', ...keys]) delete c[k]; return c; };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function diff(a, b, pre = '') {
  const out = [];
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const x = a ? a[k] : undefined, y = b ? b[k] : undefined;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x)) out.push(...diff(x, y, pre + k + '.'));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${pre}${k}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
  }
  return out;
}
// every fixture field is still there with the same value (load may add fields, never change these)
function keeps(fix, S, pre = '') {
  const out = [];
  for (const k of Object.keys(fix)) {
    if (k === 'lastSeen') continue;
    const x = fix[k], y = S ? S[k] : undefined;
    if (x && typeof x === 'object' && !Array.isArray(x)) out.push(...keeps(x, y, pre + k + '.'));
    else if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${pre}${k}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
  }
  return out;
}
// the eco build's own rules, checked on what was really saved
function ecoProblems(S) {
  const p = [], e = S.eco, u32 = x => Number.isInteger(x) && x >= 0 && x <= 0xffffffff;
  if (!e || typeof e !== 'object') return ['no S.eco'];
  if (e.v !== E.ECO_SCHEMA) p.push('v ' + e.v);
  if (!u32(e.seed)) p.push('seed');
  if (!(e.clock && e.clock.acc >= 0 && e.clock.acc < 60 && Number.isInteger(e.clock.hours) && e.clock.hours >= 0)) p.push('clock');
  for (const n of E.STREAMS) { const st = e.rng && e.rng[n]; if (!(Array.isArray(st) && st.length === 4 && st.every(u32) && st.some(x => x))) p.push('rng.' + n); }
  for (const [k, locs] of [['mix', E.MIX_LOCS], ['pmix', E.PMIX_LOCS]]) for (const l of locs) {
    const a = e[k] && e[k][l];
    if (!(Array.isArray(a) && a.length === 5 && a.every(x => Number.isFinite(x) && x >= 0) && Math.abs(a.reduce((s, x) => s + x, 0) - 1) < 1e-9)) p.push(`${k}.${l}`);
    else if (!(S.stock[l] > 0) && !eq(a, k === 'mix' ? E.REF_MIX : E.REF_PMIX)) p.push(`${k}.${l} (empty place, not the reference mix)`);
  }
  for (const l of E.Q_LOCS) { const x = e.q && e.q[l]; if (!(Number.isFinite(x) && x >= 0 && x <= 1)) p.push('q.' + l); }
  if (S.v !== 1) p.push('main save v ' + S.v);
  return p;
}

const FREEZE = () => {
  let g; Object.defineProperty(window, '__game', { configurable: true, get: () => g, set: v => { g = v; const hook = () => {
    const w = g.scene.getScene('world'); if (!w || w.__hooked) return; w.__hooked = true;
    const c = w.create, u = w.update;
    w.create = function (...a) { let s = 4242; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; return c.apply(this, a); };
    w.update = function (...a) { if (window.__go) return u.apply(this, a); };
    const st = w.sys.step; w.sys.step = function (...a) { if (window.__go) return st.apply(this, a); };
  }; if (g.scene.getScene && g.scene.getScene('world')) hook(); g.events.once('ready', hook); } });
};

async function newCtx(b, frozen) {
  const ctx = await b.newContext({ viewport: { width: 200, height: 100 } });
  if (frozen) await ctx.addInitScript(FREEZE);
  const p = await ctx.newPage(); p.errs = []; p.logs = [];
  p.on('pageerror', e => p.errs.push(e.message)); p.on('console', m => p.logs.push(m.text()));
  await p.goto(BLANK_URL);
  return { ctx, p };
}
const put = (p, S) => p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(S)]);
const raw = p => p.evaluate(k => localStorage.getItem(k), KEY);
// opens a build, lets it run, leaves it (pagehide → the game saves), returns the stored save and what the page reported
async function session(p, url, opts = {}) {
  const e0 = p.errs.length, l0 = p.logs.length;
  await p.goto(url);
  await p.waitForFunction(() => window.__game && __game.scene.getScene('world') && __game.scene.getScene('world').fleet && document.getElementById('loader') === null, null, { timeout: 90000 });
  const info = await p.evaluate(() => ({ eco: window.__eco ? { save: window.__eco.save, version: window.__eco.version, setOn: window.__eco.setOn(true) } : null }));
  if (info.eco) await p.evaluate(() => window.__eco.setOn(false));
  if (opts.playSecs) { await p.evaluate(() => { window.__go = true; }); await p.waitForTimeout(opts.playSecs * 1000); }
  await p.goto(BLANK_URL);
  const s = await raw(p);
  return { S: JSON.parse(s), raw: s, info, errs: p.errs.slice(e0), ecoerr: p.logs.slice(l0).filter(l => l.startsWith('ECOERR')), ecoLines: p.logs.slice(l0).filter(l => l.startsWith('ECO ')) };
}

(async () => {
  const b = await chromium.launch({ args: ARGS });
  const results = [], fxBefore = fixtureSums();
  const check = (group, name, pass, info) => { results.push({ group, name, pass: !!pass, ...(info ? { info } : {}) }); console.log((pass ? 'ok   ' : 'FAIL ') + group + ' | ' + name); };
  const MAIN = OLDS[0];
  const refs = {};

  for (const fx of ['new', 'mid', 'max']) {
    const F = FIX(fx);
    // reference: what the main old build saves for this fixture (frozen) — the non-eco state every other step must keep
    { const { ctx, p } = await newCtx(b, true); await put(p, F); const r = await session(p, MAIN.url); refs[fx] = r.S; await ctx.close();
      check(fx, `reference: ${MAIN.name} keeps every fixture field`, !keeps(F, r.S).length && !r.errs.length && r.S.eco === undefined, { lost: keeps(F, r.S).slice(0, 5), errs: r.errs }); }
    const REF = refs[fx];

    // A. old save → eco build → save → reload
    const { ctx, p } = await newCtx(b, true);
    await put(p, F);
    const a1 = await session(p, ECO);
    check(fx, 'A1 old save → eco build: S.eco created (status fresh), valid', a1.info.eco.save.status === 'fresh' && !ecoProblems(a1.S).length && !a1.errs.length && !a1.ecoerr.length,
      { report: a1.info.eco.save, problems: ecoProblems(a1.S), errs: a1.errs, ecoerr: a1.ecoerr });
    check(fx, 'A1 progress untouched (= old build, apart from S.eco)', !diff(strip(REF), strip(a1.S, 'eco')).length && !keeps(F, a1.S).length, { diff: diff(strip(REF), strip(a1.S, 'eco')).slice(0, 8) });
    check(fx, 'A1 main SAVE_VERSION still 1, no S.ecoBak', a1.S.v === 1 && a1.S.ecoBak === undefined);
    const a2 = await session(p, ECO);
    check(fx, 'A2 reload in eco build: status ok, 0 repairs, S.eco identical', a2.info.eco.save.status === 'ok' && a2.info.eco.save.repairs.length === 0 && eq(a2.S.eco, a1.S.eco) && !a2.errs.length,
      { report: a2.info.eco.save, ecoDiff: diff(a1.S.eco, a2.S.eco).slice(0, 5) });
    check(fx, 'A2 progress untouched', !diff(strip(a1.S), strip(a2.S)).length, { diff: diff(strip(a1.S), strip(a2.S)).slice(0, 8) });
    const ECO_SAVE = a2.S;
    await ctx.close();

    // B. eco save → each old build → eco build
    for (const old of OLDS) {
      const { ctx, p } = await newCtx(b, true);
      await put(p, ECO_SAVE);
      const b1 = await session(p, old.url);
      check(fx, `B1 eco save → ${old.name}: S.eco carried value for value`, eq(b1.S.eco, ECO_SAVE.eco) && !b1.errs.length, { ecoDiff: diff(ECO_SAVE.eco, b1.S.eco).slice(0, 5), errs: b1.errs });
      check(fx, `B1 ${old.name}: progress untouched`, !diff(strip(ECO_SAVE), strip(b1.S)).length, { diff: diff(strip(ECO_SAVE), strip(b1.S)).slice(0, 8) });
      const b2 = await session(p, ECO);
      check(fx, `B2 ${old.name} → eco build: status ok, 0 repairs, S.eco identical to before the old build`, b2.info.eco.save.status === 'ok' && !b2.info.eco.save.repairs.length && eq(b2.S.eco, ECO_SAVE.eco) && !b2.errs.length,
        { report: b2.info.eco.save, ecoDiff: diff(ECO_SAVE.eco, b2.S.eco).slice(0, 5) });
      check(fx, `B2 progress untouched`, !diff(strip(ECO_SAVE), strip(b2.S)).length, { diff: diff(strip(ECO_SAVE), strip(b2.S)).slice(0, 8) });
      await ctx.close();
    }

    // C. eco save → main old build played (simulation running) → eco build
    {
      const { ctx, p } = await newCtx(b, false);
      await put(p, ECO_SAVE);
      const c1 = await session(p, MAIN.url, { playSecs: PLAY_SECS });
      const moved = diff(strip(ECO_SAVE, 'eco'), strip(c1.S, 'eco'));
      check(fx, `C1 ${MAIN.name} played ${PLAY_SECS} s: S.eco carried value for value while the game moved on`, eq(c1.S.eco, ECO_SAVE.eco) && !c1.errs.length, { changedByPlay: moved.length, sample: moved.slice(0, 4), errs: c1.errs });
      await ctx.close();
      const { ctx: ctx2, p: p2 } = await newCtx(b, true);
      await put(p2, c1.S);
      const c2 = await session(p2, ECO);
      const r = c2.info.eco.save, e0 = ECO_SAVE.eco, e1 = c2.S.eco;
      const onlyEmptyFixes = r.repairs.every(x => /empty place/.test(x));
      const kept = eq(e1.seed, e0.seed) && eq(e1.rng, e0.rng) && eq(e1.clock, e0.clock) && eq(e1.flags, e0.flags)
        && [...E.MIX_LOCS.map(l => ['mix', l]), ...E.PMIX_LOCS.map(l => ['pmix', l])].every(([k, l]) => !(c1.S.stock[l] > 0) || eq(e1[k][l], e0[k][l]));
      check(fx, 'C2 eco build after the played old build: only empty-place repairs, everything else of S.eco kept, valid', ['ok', 'repaired'].includes(r.status) && onlyEmptyFixes && kept && !ecoProblems(c2.S).length && !c2.errs.length,
        { report: r, problems: ecoProblems(c2.S) });
      check(fx, 'C2 progress written by the old build untouched', !diff(strip(c1.S, 'eco'), strip(c2.S, 'eco')).length, { diff: diff(strip(c1.S, 'eco'), strip(c2.S, 'eco')).slice(0, 8) });
      await ctx2.close();
    }
  }

  // D. damaged S.eco on the mid fixture
  const F = FIX('mid'), REF = refs.mid;
  const CASES = [
    { name: 'null', eco: null, want: 'fresh' },
    { name: 'string', eco: 'garbage', want: 'recovered', bak: true },
    { name: 'array', eco: [1, 2, 3], want: 'recovered', bak: true },
    { name: 'v as string', eco: { v: '1', mix: {} }, want: 'recovered', bak: true },
    { name: 'partial { v: 1 }', eco: { v: 1, seed: 777 }, want: 'repaired' },
    { name: 'NaN / Infinity / negative / wrong lengths (as stored: null)', eco: 'BAD_NUMBERS', want: 'repaired' },
    { name: 'future schema v2', eco: { v: 2, mix: 'a newer format', extra: { deep: [1, { x: 2 }] } }, want: 'future' },
  ];
  for (const c of CASES) {
    let eco = c.eco;
    if (eco === 'BAD_NUMBERS') { const s = clone(refs.mid); E.initEco(s); eco = clone(s.eco);
      eco.mix.wh = [NaN, 1, 0, 0, 0]; eco.mix.quay = [0.5, 0.5]; eco.pmix.mProd = [-1, 1, 1, 0, 0]; eco.q.wh = Infinity; eco.q.quay = -3; eco.q.facOut = 7;
      eco.clock = { acc: -Infinity, hours: 2.5 }; eco.rng.market = [0, 0, 0, 0]; eco.seed = -5; }
    const S0 = { ...clone(F), eco }, stored = JSON.parse(JSON.stringify(S0));   // what the save really holds
    const { ctx, p } = await newCtx(b, true);
    await put(p, stored);
    const d1 = await session(p, ECO);
    const r = d1.info.eco.save;
    const progressOk = !diff(strip(REF), strip(d1.S, 'eco', 'ecoBak')).length;
    let ecoOk, extra = {};
    if (c.want === 'future') {
      ecoOk = d1.raw.includes(JSON.stringify(stored.eco)) && eq(d1.S.eco, stored.eco) && r.usable === false && r.blocked === true && d1.info.eco.setOn === false && d1.ecoerr.length === 1 && d1.S.ecoBak === undefined;
      const d2 = await session(p, MAIN.url), d3 = await session(p, ECO);
      const keptOld = eq(d2.S.eco, stored.eco), keptEco = eq(d3.S.eco, stored.eco) && d3.info.eco.save.status === 'future';
      extra = { afterOldBuild: keptOld, afterSecondEcoSession: keptEco, ecoerr: d1.ecoerr };
      ecoOk = ecoOk && keptOld && keptEco && !d2.errs.length && !d3.errs.length;
    } else {
      ecoOk = !ecoProblems(d1.S).length && (c.bak ? eq(d1.S.ecoBak.value, stored.eco) : d1.S.ecoBak === undefined);
      const d2 = await session(p, ECO);
      extra = { secondSession: d2.info.eco.save.status, problems: ecoProblems(d1.S), ecoBak: d1.S.ecoBak ? { reason: d1.S.ecoBak.reason } : null };
      ecoOk = ecoOk && d2.info.eco.save.status === 'ok' && eq(d2.S.eco, d1.S.eco);
    }
    check('damaged', `D ${c.name}: status ${c.want}, game loads, progress untouched, S.eco as specified`, r.status === c.want && progressOk && ecoOk && !d1.errs.length,
      { report: r, progressDiff: diff(strip(REF), strip(d1.S, 'eco', 'ecoBak')).slice(0, 5), ...extra, errs: d1.errs });
    await ctx.close();
  }

  await b.close();
  const fxAfter = fixtureSums();
  check('fixtures', 'fixture files unchanged (sha256 before = after = committed sums)', Object.values(fxBefore).every(x => x.want === x.got) && Object.values(fxAfter).every(x => x.want === x.got), { fxAfter });
  const out = { test: 'eco save matrix (T1.2)', eco: { url: ECO, sha256: sha(process.argv[2]) }, oldBuilds: OLDS, pass: results.every(r => r.pass), passed: results.filter(r => r.pass).length, total: results.length, results };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ pass: out.pass, passed: out.passed, total: out.total }));
  process.exit(out.pass ? 0 : 1);
})();
