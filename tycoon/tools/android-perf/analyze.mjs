// Q10: turn the driver's raw run folders into REPORT.md and summary.json.
//   node analyze.mjs <perf-out dir> [--history <dir with the old summary.txt / device.txt>]
// Statistics are recomputed here from the raw frame intervals the page logged (PROBE_RAW), not taken on trust from
// the page's own summary. Exit code 1 if any run failed or a mode has fewer valid runs than requested.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { parseProbeLog, rawFrames, parseGfxinfo, parseMeminfoPkg, parseMeminfoProcesses, readIf } from './logparse.mjs';

export const MODES = [['base', 'BASE'], ['tracking', 'TRACKING'], ['pricing', 'PRICING']];
const TCRIT = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228];   // two-sided 95 %, df 1..10

export const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
export const sd = a => (a.length < 2 ? NaN : Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / (a.length - 1)));
export const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];   // nearest rank

// Per-run statistics from the raw intervals (ms).
export function frameStats(f) {
  const s = [...f].sort((a, b) => a - b), sum = f.reduce((a, b) => a + b, 0);
  return {
    frames: f.length, elapsedS: sum / 1000, fpsMean: f.length / (sum / 1000), fpsMedian: 1000 / median(f), frameMsMedian: median(f), frameMsP95: pct(s, 0.95), frameMsP99: pct(s, 0.99),
    frameMsMax: s[s.length - 1], jank25Pct: 100 * f.filter(x => x > 25).length / f.length, slow50Pct: 100 * f.filter(x => x > 50).length / f.length,
  };
}
// Welch comparison of two samples: difference of means, standard error, 95 % interval, verdict.
export function welch(a, b) {
  if (a.length < 2 || b.length < 2) return null;
  const va = sd(a) ** 2 / a.length, vb = sd(b) ** 2 / b.length, se = Math.sqrt(va + vb);
  const df = se === 0 ? 1 : Math.max(1, Math.floor((va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1))));
  const t = TCRIT[df] || (df <= 30 ? 2.1 : 1.96), d = mean(b) - mean(a);
  return { diff: d, se, df, ci: [d - t * se, d + t * se], distinguishable: Math.abs(d) > t * se };
}
export function heapReliability(samples) { const d = new Set((samples || []).map(x => x.toFixed(1))); return { distinct: d.size, reliable: d.size >= 3 }; }

const f1 = (x, n = 1) => (x === null || x === undefined || !Number.isFinite(x) ? 'n/a' : x.toFixed(n));
const signed = (x, n = 1) => (x === null || !Number.isFinite(x) ? 'n/a' : (x >= 0 ? '+' : '') + x.toFixed(n));

export function analyze(dir, historyDir) {
  const driver = JSON.parse(readIf(path.join(dir, 'driver.json')) || 'null');
  const device = JSON.parse(readIf(path.join(dir, 'device.json')) || 'null');
  const rawDir = path.join(dir, 'raw');
  const runDirs = fs.existsSync(rawDir) ? fs.readdirSync(rawDir).filter(d => /^run\d+-/.test(d)).sort() : [];
  const problems = [];
  if (!driver) problems.push('driver.json missing: the on-device driver did not finish');
  else if (driver.fatal) problems.push('driver fatal error: ' + driver.fatal);
  const runs = [];
  for (const d of runDirs) {
    const rec = JSON.parse(readIf(path.join(rawDir, d, 'run.json')) || 'null');
    if (!rec) { problems.push(`${d}: run.json missing`); continue; }
    const r = { dir: d, run: rec.run, mode: rec.mode, ok: !!rec.ok, problems: rec.problems || [], rec };
    const log = readIf(path.join(rawDir, d, 'logcat-full.txt'));
    const ev = log ? parseProbeLog(log) : null;
    const raw = ev ? rawFrames(ev) : { frames: null, why: 'no logcat' };
    if (raw.frames && ev.result) {
      r.frame = frameStats(raw.frames);
      r.page = { sceneStepsPerS: ev.result.sceneStepsPerS, simRatio: ev.result.simRatio, simMsMean: ev.result.simMsMean, sceneMsMean: ev.result.sceneMsMean, simSeconds: ev.result.simSeconds,
        phaserFpsMean: ev.result.phaserFpsSamples.length ? mean(ev.result.phaserFpsSamples) : null, longTasks: ev.result.longTasks, longTaskMs: ev.result.longTaskMs, jsErrors: ev.result.jsErrors };
      r.heap = { ...heapReliability(ev.result.heapSamplesMB), samples: ev.result.heapSamplesMB };
      r.config = { ua: ev.boot.ua, screen: JSON.stringify(ev.ready && ev.ready.screen), canvas: ev.ready && ev.ready.canvas, quality: ev.result.quality, boats: ev.result.boats, workers: ev.result.workers, save: ev.boot.saveSha256, preset: ev.boot.preset, seed: ev.boot.seed };
    }
    if (ev && ev.micro) r.micro = ev.micro;
    const gfx = readIf(path.join(rawDir, d, 'gfxinfo.txt'));
    if (gfx) r.gfx = parseGfxinfo(gfx);
    const ms = readIf(path.join(rawDir, d, 'meminfo-start.txt')), me = readIf(path.join(rawDir, d, 'meminfo-end.txt'));
    const fs0 = readIf(path.join(rawDir, d, 'meminfo-full-start.txt')), fe = readIf(path.join(rawDir, d, 'meminfo-full-end.txt'));
    const pkg = (driver && driver.pkg) || 'az.fishing.tycoon.perf';
    if (me) r.memEnd = { ...parseMeminfoPkg(me), ...(fe ? parseMeminfoProcesses(fe, pkg) : {}) };
    if (ms) r.memStart = { ...parseMeminfoPkg(ms), ...(fs0 ? parseMeminfoProcesses(fs0, pkg) : {}) };
    if (rec.cpuStart && rec.cpuEnd) {
      let ticks = 0, ok = true;
      for (const [pid, e] of Object.entries(rec.cpuEnd.procs)) {
        const s = rec.cpuStart.procs[pid];
        if (!s || e.utime === null || s.utime === null) { ok = false; continue; }
        ticks += (e.utime + e.stime) - (s.utime + s.stime);
      }
      const wall = (rec.cpuEnd.at - rec.cpuStart.at) / 1000;
      if (ticks > 0 && wall > 0) r.cpu = { cpuSeconds: ticks / rec.cpuEnd.clkTck, wallSeconds: wall, cores: ticks / rec.cpuEnd.clkTck / wall, partial: !ok };
    }
    runs.push(r);
  }
  for (const r of runs) if (!r.ok) problems.push(`run ${r.run} ${r.mode}: ${r.problems.join(' | ')}`);

  const valid = runs.filter(r => r.ok && r.frame);
  const byMode = Object.fromEntries(MODES.map(([id]) => [id, valid.filter(r => r.mode === id)]));
  const wanted = driver && driver.runsRequested ? driver.runsRequested : 3;
  for (const [id, label] of MODES) if (byMode[id].length < wanted) problems.push(`${label}: ${byMode[id].length} valid run(s), ${wanted} requested`);

  // config consistency across every valid run
  const cfgKeys = ['ua', 'screen', 'canvas', 'quality', 'boats', 'workers', 'save', 'preset'];
  const consistency = cfgKeys.map(k => ({ key: k, values: [...new Set(valid.map(r => String(r.config[k])))] }));
  for (const c of consistency) if (c.values.length > 1) problems.push(`configuration differs between runs: ${c.key} has ${c.values.length} values`);

  // metrics per mode
  const METRICS = [
    ['fpsMean', 'FPS, mean (frames / time)', r => r.frame.fpsMean, 2], ['fpsMedian', 'FPS, median (1000 / median frame time)', r => r.frame.fpsMedian, 2],
    ['frameMsMedian', 'frame time median, ms', r => r.frame.frameMsMedian, 1], ['frameMsP95', 'frame time P95, ms', r => r.frame.frameMsP95, 1], ['frameMsP99', 'frame time P99, ms', r => r.frame.frameMsP99, 1],
    ['jank25Pct', 'janky frames, % (interval > 25 ms)', r => r.frame.jank25Pct, 1], ['slow50Pct', 'slow frames, % (interval > 50 ms)', r => r.frame.slow50Pct, 1],
    ['simRatio', 'simulation time / real time', r => r.page.simRatio, 3], ['sceneStepsPerS', 'scene steps per second (source B)', r => r.page.sceneStepsPerS, 2],
    ['sceneMsMean', 'JS time in scene update, ms/frame', r => r.page.sceneMsMean, 3], ['simMsMean', 'JS time in Sim.update, ms/frame', r => r.page.simMsMean, 4],
    ['longTasks', 'long tasks (> 50 ms) in window', r => r.page.longTasks, 0],
    ['pssSum', 'PSS app + WebView processes at end, MB', r => (r.memEnd && r.memEnd.sumPssKb != null ? r.memEnd.sumPssKb / 1024 : (r.memEnd && r.memEnd.totalPssKb != null ? r.memEnd.totalPssKb / 1024 : null)), 1],
    ['pssApp', 'PSS app process only at end, MB', r => (r.memEnd && r.memEnd.totalPssKb != null ? r.memEnd.totalPssKb / 1024 : null), 1],
    ['pssGrowth', 'PSS growth during window (app + WebView), MB', r => (r.memEnd && r.memStart && (r.memEnd.sumPssKb ?? r.memEnd.totalPssKb) != null && (r.memStart.sumPssKb ?? r.memStart.totalPssKb) != null ? ((r.memEnd.sumPssKb ?? r.memEnd.totalPssKb) - (r.memStart.sumPssKb ?? r.memStart.totalPssKb)) / 1024 : null), 1],
    ['heapEnd', 'JS heap at end, MB (only if the values move)', r => (r.heap.reliable ? r.heap.samples[r.heap.samples.length - 1] : null), 1],
    ['heapGrowth', 'JS heap growth over window, MB (only if the values move)', r => (r.heap.reliable ? r.heap.samples[r.heap.samples.length - 1] - r.heap.samples[0] : null), 2],
    ['cpuCores', 'process CPU, cores busy (app + WebView)', r => (r.cpu ? r.cpu.cores : null), 2],
    ['gfxJankyPct', 'gfxinfo janky frames, % (Android compositor source)', r => (r.gfx ? r.gfx.jankyPct : null), 1], ['gfxP50', 'gfxinfo 50th percentile, ms', r => (r.gfx ? r.gfx.p50ms : null), 0],
    ['gfxP90', 'gfxinfo 90th percentile, ms', r => (r.gfx ? r.gfx.p90ms : null), 0], ['gfxP95', 'gfxinfo 95th percentile, ms', r => (r.gfx ? r.gfx.p95ms : null), 0], ['gfxP99', 'gfxinfo 99th percentile, ms', r => (r.gfx ? r.gfx.p99ms : null), 0],
    ['gfxFrames', 'gfxinfo total frames rendered', r => (r.gfx ? r.gfx.totalFrames : null), 0],
  ];
  const agg = {};
  for (const [id] of MODES) {
    agg[id] = {};
    for (const [k, , fn] of METRICS) {
      const vals = byMode[id].map(fn).filter(v => v !== null && v !== undefined && Number.isFinite(v));
      agg[id][k] = { n: vals.length, values: vals, mean: vals.length ? mean(vals) : null, sd: vals.length > 1 ? sd(vals) : null, min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null,
        cvPct: vals.length > 1 && mean(vals) !== 0 ? 100 * sd(vals) / Math.abs(mean(vals)) : null };
    }
  }
  const cmp = {};
  for (const [id, label] of MODES.slice(1)) {
    cmp[id] = {};
    for (const [k] of METRICS) cmp[id][k] = byMode.base.length >= 2 && byMode[id].length >= 2 ? welch(agg.base[k].values, agg[id][k].values) : null;
  }

  // micro benchmark (Sim.update µs per call), paired inside each run
  const micro = { base: { plain: [] }, tracking: { off: [], tracking: [], delta: [] }, pricing: { off: [], prices: [], delta: [] } };
  for (const r of valid) {
    if (!r.micro) continue;
    const m = r.micro.res;
    if (r.mode === 'base' && m.plain.length) micro.base.plain.push(median(m.plain));
    if (r.mode === 'tracking' && m.plain.length && m.tracking.length) { micro.tracking.off.push(median(m.plain)); micro.tracking.tracking.push(median(m.tracking)); micro.tracking.delta.push(median(m.tracking.map((x, i) => x - m.plain[i]))); }
    if (r.mode === 'pricing' && m.plain.length && m.prices.length) { micro.pricing.off.push(median(m.plain)); micro.pricing.prices.push(median(m.prices)); micro.pricing.delta.push(median(m.prices.map((x, i) => x - m.plain[i]))); }
  }

  // history (old M0 Android numbers): shown, never compared
  let history = null;
  if (historyDir) {
    const sum = readIf(path.join(historyDir, 'summary.txt')), dev = readIf(path.join(historyDir, 'device.txt'));
    if (sum && dev) history = { summary: sum.trim(), device: dev.trim() };
  }
  return { problems, driver, device, runs, valid, byMode, agg, cmp, METRICS, micro, consistency, history, wanted };
}

export function report(a) {
  const L = [], P = s => L.push(s);
  const have = MODES.filter(([id]) => a.byMode[id].length > 0);
  P('# Q10: Android emulator performance, BASE / TRACKING / PRICING');
  P('');
  P(a.problems.length ? `**STATUS: PROBLEMS FOUND (${a.problems.length}). Numbers below come only from runs that passed every check.**` : '**STATUS: every run passed every check.**');
  P('');
  if (a.problems.length) { for (const x of a.problems) P(`- ${x}`); P(''); }
  if (!a.valid.length) { P('No valid measurement exists. Nothing was measured; no FPS figure is given.'); return L.join('\n') + '\n'; }

  P('## Method in short');
  P('');
  P('- **Frame source for every FPS / frame-time / jank number: `requestAnimationFrame` intervals logged by a probe inside the page (the WebView\'s JS frame loop).** The probe');
  P('  runs only in these CI pages (not in `index.html`, not in normal dev builds). Raw intervals are in the logcat files; all statistics here are recomputed from them.');
  P('- `gfxinfo` rows are the Android window compositor\'s view of the app (HWUI). They are listed separately and are **not** the page\'s JS frame rate.');
  P('- Modes: BASE = plain dev build; TRACKING = ECO=1 build with `?eco=species`; PRICING = ECO=1 build with `?eco=1`. Same APK, same emulator, same start save, same preset,');
  P('  same seed for the same run number, app data cleared before every run, mode order rotated per run (ABC, BCA, CAB).');
  P('- "Janky" = interval above 25 ms (more than 1.5 vsync periods). At about 10 FPS nearly every frame is janky; the column is meaningful mainly for comparison between modes.');
  P(`- Valid runs: ${have.map(([id, l]) => `${l} ${a.byMode[id].length}`).join(', ')} (requested ${a.wanted} each).`);
  P('');

  if (a.device) {
    P('## Device and configuration');
    P('');
    P('```');
    P(JSON.stringify(a.device, null, 1));
    P('```');
    P('');
    P('Run-to-run configuration check (all valid runs): ' + (a.consistency.every(c => c.values.length === 1) ? 'identical' : '**DIFFERENT**') + '.');
    P('');
    P('| property | distinct values |');
    P('|---|---|');
    for (const c of a.consistency) P(`| ${c.key} | ${c.values.length} ${c.values.length === 1 ? '(' + String(c.values[0]).slice(0, 90) + ')' : ''} |`);
    P('');
  }

  P('## Results per mode (mean of runs, standard deviation between runs, n = valid runs)');
  P('');
  P('| metric | ' + have.map(([, l]) => l).join(' | ') + ' |');
  P('|---|' + have.map(() => '---|').join(''));
  for (const [k, label, , dec] of a.METRICS) {
    const cells = have.map(([id]) => { const g = a.agg[id][k]; return g.n ? `${f1(g.mean, dec)} ± ${f1(g.sd, dec)} (n=${g.n}, ${f1(g.min, dec)}…${f1(g.max, dec)}, cv ${f1(g.cvPct, 1)} %)` : 'n/a'; });
    P(`| ${label} | ${cells.join(' | ')} |`);
  }
  P('');
  const hr = a.valid.map(r => `run ${r.run} ${r.mode}: ${r.heap.distinct} distinct value(s)`);
  P(`JS heap: \`performance.memory\` is coarse in WebView; a run is used only if its 5-second samples show at least 3 distinct values. ${hr.join('; ')}.`);
  P('');

  P('## Differences against BASE (mean difference, 95 % interval from Welch, difference of the means of the runs)');
  P('');
  P('With only a few runs per mode the interval is wide. "not distinguishable" means the difference is smaller than the run-to-run noise, **not** that it is zero.');
  P('');
  P('| metric | TRACKING - BASE | PRICING - BASE |');
  P('|---|---|---|');
  for (const [k, label, , dec] of a.METRICS) {
    const cell = id => { const c = a.cmp[id] && a.cmp[id][k]; return c ? `${signed(c.diff, dec)} [${signed(c.ci[0], dec)}, ${signed(c.ci[1], dec)}] ${c.distinguishable ? '**differs**' : 'not distinguishable'}` : 'n/a'; };
    P(`| ${label} | ${cell('tracking')} | ${cell('pricing')} |`);
  }
  P('');

  P('## Cost of the eco adapter');
  P('');
  P('1. In-window (above): JS time in `Sim.update` and in the whole scene update per frame, TRACKING and PRICING against BASE.');
  P('2. Micro benchmark on the device (run after the window, same process, interleaved rounds, median per run, `Sim.update` with dt 1/30; eco switched off / tracking / prices inside the ECO page):');
  P('');
  P('| measure | value |');
  P('|---|---|');
  const m = a.micro, mm = arr => (arr.length ? `${f1(mean(arr), 2)} µs (n=${arr.length})` : 'n/a');
  P(`| BASE page, plain Sim.update | ${mm(m.base.plain)} |`);
  P(`| TRACKING page, eco off | ${mm(m.tracking.off)} |`);
  P(`| TRACKING page, tracking on | ${mm(m.tracking.tracking)} |`);
  P(`| TRACKING page, tracking minus off, paired | ${m.tracking.delta.length ? `${signed(mean(m.tracking.delta), 2)} µs per call (runs: ${m.tracking.delta.map(x => signed(x, 2)).join(', ')})` : 'n/a'} |`);
  P(`| PRICING page, eco off | ${mm(m.pricing.off)} |`);
  P(`| PRICING page, tracking + prices on | ${mm(m.pricing.prices)} |`);
  P(`| PRICING page, prices minus off, paired | ${m.pricing.delta.length ? `${signed(mean(m.pricing.delta), 2)} µs per call (runs: ${m.pricing.delta.map(x => signed(x, 2)).join(', ')})` : 'n/a'} |`);
  P('');
  P('`Sim.update` runs once per frame, so µs per call / 1000 = ms per frame (roadmap target for eco: at most 0.02 ms per frame). The state is not reset between blocks, so the blocks differ slightly in game state; the paired design cancels most, not all, of that.');
  P('');

  P('## Per-run table');
  P('');
  P('| run | mode | frames | FPS mean | FPS median | frame ms median / P95 / P99 | janky % | sim/real | PSS MB | gfxinfo janky % | ok |');
  P('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of a.runs) {
    if (!r.frame) { P(`| ${r.run} | ${r.mode} | - | - | - | - | - | - | - | - | **FAILED** |`); continue; }
    const pss = r.memEnd ? (r.memEnd.sumPssKb ?? r.memEnd.totalPssKb) / 1024 : null;
    P(`| ${r.run} | ${r.mode} | ${r.frame.frames} | ${f1(r.frame.fpsMean, 2)} | ${f1(r.frame.fpsMedian, 2)} | ${f1(r.frame.frameMsMedian)} / ${f1(r.frame.frameMsP95)} / ${f1(r.frame.frameMsP99)} | ${f1(r.frame.jank25Pct)} | ${f1(r.page.simRatio, 3)} | ${f1(pss)} | ${r.gfx ? f1(r.gfx.jankyPct) : 'n/a'} | ${r.ok ? 'yes' : '**NO**'} |`);
  }
  P('');

  P('## JavaScript errors and Android crashes');
  P('');
  P('| run | mode | JS errors | ECOERR lines | crash / ANR lines |');
  P('|---|---|---|---|---|');
  for (const r of a.runs) P(`| ${r.run} | ${r.mode} | ${r.rec.jsErrorCount ?? 'n/a'} | ${r.rec.ecoErrLines ?? 'n/a'} | ${(r.rec.crashLines || []).length} |`);
  P('');

  P('## Earlier Android numbers (history only, not compared)');
  P('');
  if (a.history) {
    P('Committed `test-results/android/` (production `index.html` before workers phase A, high preset, new game, `PERF` log fps):');
    P('');
    P('```');
    P(a.history.summary);
    P('---');
    P(a.history.device);
    P('```');
    P('');
    const reasons = ['different build: the old APK is the production page before workers phase A; these runs use dev builds that contain phase A and the eco adapter', 'different protocol: old fps is the game\'s own `actualFps` from the PERF log on a new game at preset high; new numbers are rAF intervals on a mid save at the preset above', 'different frame source and window length'];
    if (a.device && !/sdk_gphone64_x86_64/.test(a.device.model || '')) reasons.push('different emulator model: ' + a.device.model);
    if (a.device && a.device.webviewVersion && !/113\.0\.5672\.136/.test(a.device.webviewVersion)) reasons.push(`different WebView: ${a.device.webviewVersion} vs 113.0.5672.136`);
    P('**Direct FPS comparison: not performed.** Reasons: ' + reasons.join('; ') + '.');
  } else P('History directory not given or incomplete; nothing shown.');
  P('');
  P('## Limits of this measurement');
  P('');
  P('- Emulator without a GPU (`swiftshader_indirect`) on a shared CI machine: absolute numbers are not phone numbers. Use differences between modes, measured side by side.');
  P('- Small number of runs per mode. See the intervals above; absence of a significant difference at n=3 is weak evidence.');
  P('- About 24 metrics x 2 comparisons are tested at 95 %: one or two "differs" marks are expected by chance alone. Treat a single isolated mark as a lead to check with more runs, not as a finding; a consistent shift across FPS, frame time and JS time is more meaningful.');
  P('- The in-window JS time and the micro benchmark can disagree (the window includes real game state and render-side effects, the micro benchmark isolates `Sim.update` with the adapter off/on). Report both, conclude from neither alone.');
  P('- The probe adds its own constant overhead to all three modes equally (a requestAnimationFrame callback, two wrapper calls per frame).');
  P('- Math.random is replaced by a seeded generator in these pages; the frame timing still makes the game state diverge between runs.');
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2];
  if (!dir) { console.error('usage: analyze.mjs <perf-out dir> [--history dir]'); process.exit(2); }
  const hi = process.argv.indexOf('--history');
  const a = analyze(dir, hi > 0 ? process.argv[hi + 1] : null);
  const md = report(a);
  fs.writeFileSync(path.join(dir, 'REPORT.md'), md);
  const slim = { problems: a.problems, wanted: a.wanted, device: a.device, validRuns: a.valid.map(r => `${r.run}-${r.mode}`), agg: Object.fromEntries(Object.entries(a.agg).map(([m, o]) => [m, Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.n, mean: v.mean, sd: v.sd, min: v.min, max: v.max, values: v.values }]))])), cmp: a.cmp, micro: a.micro, consistency: a.consistency };
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(slim, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  process.exit(a.problems.length ? 1 : 0);
}
