// Q10: on-device driver. Runs inside the emulator step of .github/workflows/android-eco-perf.yml.
//   env: PERF_APK (perf apk), PERF_ASSETS (dir with manifest.json from make-perf-pages), PERF_OUT (result dir),
//        PERF_RUNS (default 3), PERF_PKG (default az.fishing.tycoon.perf), ADB (default adb; tests use a fake)
// For every run (run 1..N, the three modes in a rotating order) it: force-stops and clears the app data, checks that
// nothing survived, starts the page for the mode, follows the probe's console lines in logcat, collects gfxinfo /
// meminfo / cpu time around the measurement window, and writes OUT/raw/run<N>-<mode>/. It never reports a failure as
// a success: every problem is written to the run's run.json and the process exits 1 if any run has one (results are
// still written, and the workflow uploads them anyway).
import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { parseProbeLog, rawFrames, crashLines } from './logparse.mjs';

const ADB = process.env.ADB || 'adb';
const PKG = process.env.PERF_PKG || 'az.fishing.tycoon.perf';
const OUT = path.resolve(process.env.PERF_OUT || 'perf-out');
const RUNS = +(process.env.PERF_RUNS || 3);
const ASSETS = process.env.PERF_ASSETS;
const APK = process.env.PERF_APK;
const SPEED = +(process.env.PERF_TIME_SCALE || 1);                      // tests with a fake adb shrink waits; never set in CI
const MODES = [
  { id: 'base', label: 'BASE', page: 'base.html', query: '', expect: { present: false } },
  { id: 'tracking', label: 'TRACKING', page: 'eco.html', query: 'eco=species', expect: { present: true, on: true, species: true, price: false } },
  { id: 'pricing', label: 'PRICING', page: 'eco.html', query: 'eco=1', expect: { present: true, on: true, species: true, price: true } },
];

const sleep = ms => new Promise(r => setTimeout(r, ms * SPEED));
const adb = (args, o = {}) => {
  try { return execFileSync(ADB, args, { encoding: 'utf8', timeout: o.timeout || 90000, maxBuffer: 1 << 28 }); }
  catch (e) { if (o.allowFail) return (e.stdout || '') + (e.stderr || ''); throw new Error(`adb ${args.join(' ')} failed: ${(e.stderr || e.message).toString().slice(0, 300)}`); }
};
const shell = (cmd, o) => adb(['shell', cmd], o);
const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof t === 'string' ? t : JSON.stringify(t, null, 1)); };
const stamp = () => new Date().toISOString().slice(11, 19);
const log = m => console.log(`[${stamp()}] ${m}`);

async function waitFor(fn, timeoutMs, what, pollMs = 500) {
  const end = Date.now() + timeoutMs * SPEED;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout waiting for ' + what);
    await new Promise(r => setTimeout(r, pollMs * Math.min(1, SPEED)));
  }
}

function deviceInfo() {
  const g = k => shell(`getprop ${k}`, { allowFail: true }).trim();
  const info = {
    androidRelease: g('ro.build.version.release'), sdk: g('ro.build.version.sdk'), model: g('ro.product.model'), abi: g('ro.product.cpu.abi'), fingerprint: g('ro.build.fingerprint'),
    wmSize: shell('wm size', { allowFail: true }).trim(), wmDensity: shell('wm density', { allowFail: true }).trim(),
    webviewUpdate: shell('dumpsys webviewupdate', { allowFail: true }).split('\n').filter(l => /Current WebView package|WebView package|isMultiProcess|Multiprocess/i.test(l)).map(l => l.trim()).slice(0, 6),
    webviewVersion: (shell('dumpsys package com.google.android.webview', { allowFail: true }).match(/versionName=(\S+)/) || [])[1] || null,
    nproc: shell('nproc', { allowFail: true }).trim(), memTotal: (shell('cat /proc/meminfo', { allowFail: true }).match(/MemTotal:\s+(\d+)/) || [])[1] || null,
    gles: shell('dumpsys SurfaceFlinger | grep -m2 -i "GLES"', { allowFail: true }).trim().split('\n').slice(0, 2),
  };
  return info;
}

function pidsOf() {   // the app and its WebView renderer / GPU processes
  const ps = shell('ps -A -o PID,NAME', { allowFail: true });
  return ps.split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 2 && /^\d+$/.test(p[0]) && (p[1] === PKG || /sandboxed_process/i.test(p[1]))).map(p => ({ pid: +p[0], name: p[1] }));
}
function cpuTimes() {   // /proc/<pid>/stat utime+stime in clock ticks; best effort (null if not readable)
  const res = {};
  for (const p of pidsOf()) {
    const s = shell(`cat /proc/${p.pid}/stat`, { allowFail: true });
    const i = s.lastIndexOf(')');
    const f = i > 0 ? s.slice(i + 2).split(' ') : [];
    res[p.pid] = { name: p.name, utime: f.length > 12 ? +f[11] : null, stime: f.length > 12 ? +f[12] : null };
  }
  return { at: Date.now(), procs: res, clkTck: +(shell('getconf CLK_TCK', { allowFail: true }).trim()) || 100 };
}
const appPid = () => (shell(`pidof ${PKG}`, { allowFail: true }).trim().split(/\s+/)[0] || '');

async function oneRun(cfg, run, mode, runDir) {
  const problems = [], seed = cfg.seedBase + run, rec = { run, mode: mode.id, label: mode.label, seed, startedAt: new Date().toISOString(), problems };
  const query = ['mode=' + mode.id, 'run=' + run, 'seed=' + seed, mode.query].filter(Boolean).join('&');
  rec.page = mode.page; rec.query = query;
  const logFile = path.join(runDir, 'logcat-full.txt');
  fs.mkdirSync(runDir, { recursive: true });

  // 1. clean state
  shell(`am force-stop ${PKG}`, { allowFail: true });
  const cleared = shell(`pm clear ${PKG}`);
  rec.pmClear = cleared.trim();
  if (!/Success/.test(cleared)) problems.push('pm clear did not report Success: ' + cleared.trim());
  const ls = shell(`run-as ${PKG} ls -a`, { allowFail: true });
  rec.dataDirAfterClear = ls.trim();
  if (/app_webview|shared_prefs|databases/.test(ls)) problems.push('app data survived pm clear: ' + ls.replace(/\s+/g, ' ').trim());
  await sleep(5000);
  adb(['logcat', '-c'], { allowFail: true });

  // 2. start, follow the probe
  const lc = spawn(ADB, ['logcat', '-v', 'threadtime'], { stdio: ['ignore', fs.openSync(logFile, 'w'), 'ignore'] });
  let events = () => parseProbeLog(fs.readFileSync(logFile, 'utf8'));
  try {
    const started = adb(['shell', `am start -W -n ${PKG}/az.universitet.tycoon.MainActivity --es page ${mode.page} --es query '${query}'`], { timeout: 120000 });
    rec.amStart = started.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (/Error|Exception/i.test(started) && !/Status: ok/i.test(started)) problems.push('am start failed: ' + rec.amStart);
    const pid0 = await waitFor(() => appPid(), 30000, 'app process');
    rec.pid = pid0;
    const bootT = (cfg.bootTimeoutS + 30) * 1000;
    await waitFor(() => { const e = events(); if (e.fail) throw new Error('probe failure: ' + JSON.stringify(e.fail)); return e.boot && e.ready; }, bootT, 'PROBE_BOOT + PROBE_READY');
    let e = events();
    rec.boot = e.boot; rec.ready = e.ready;

    // 3. state checks
    if (e.boot.hadSave !== false || e.boot.lsKeys !== 0) problems.push(`state leak: localStorage had data at boot (hadSave=${e.boot.hadSave}, keys=${e.boot.lsKeys})`);
    if (e.boot.seeded !== true) problems.push('start save was not seeded');
    if (e.boot.mode !== mode.id || e.boot.run !== run || e.boot.seed !== seed) problems.push('page did not receive the expected mode/run/seed: ' + e.boot.search);
    if (e.ready.quality !== cfg.preset) problems.push(`graphics preset ${e.ready.quality} != ${cfg.preset}`);
    if (e.ready.renderer !== 'webgl') problems.push('renderer is ' + e.ready.renderer + ', not webgl');
    const ec = e.ready.eco, x = mode.expect;
    if (ec.present !== x.present || (x.present && (ec.on !== x.on || !ec.systems || ec.systems.species !== x.species || ec.systems.price !== x.price))) problems.push(`eco state ${JSON.stringify(ec)} does not match mode ${mode.id}`);
    log(`run ${run} ${mode.label}: ready (${e.ready.screen.w}x${e.ready.screen.h}, ${e.ready.canvas}, boats ${e.ready.boats}, workers ${e.ready.workers}, eco ${JSON.stringify(ec)})`);

    // 4. warm-up over -> start-of-window collection (inside the probe's idle gap)
    await waitFor(() => events().syncBegin, (cfg.warmupS + 40) * 1000, 'PROBE_SYNC_BEGIN');
    shell(`dumpsys gfxinfo ${PKG} reset`, { allowFail: true });
    rec.cpuStart = cpuTimes();
    write(path.join(runDir, 'meminfo-start.txt'), shell(`dumpsys meminfo ${PKG}`, { allowFail: true }));
    write(path.join(runDir, 'meminfo-full-start.txt'), shell('dumpsys meminfo', { allowFail: true, timeout: 120000 }));
    await waitFor(() => events().windowBegin, 60000, 'PROBE_WINDOW_BEGIN');
    const tWin = Date.now();

    // 5. window over -> end-of-window collection
    await waitFor(() => events().windowEnd, (cfg.durationS + 90) * 1000, 'PROBE_WINDOW_END');
    const tEnd = Date.now();
    write(path.join(runDir, 'gfxinfo.txt'), shell(`dumpsys gfxinfo ${PKG}`, { allowFail: true }));
    rec.gfxinfoDelayMs = Date.now() - tEnd;
    rec.cpuEnd = cpuTimes();
    write(path.join(runDir, 'meminfo-end.txt'), shell(`dumpsys meminfo ${PKG}`, { allowFail: true }));
    write(path.join(runDir, 'meminfo-full-end.txt'), shell('dumpsys meminfo', { allowFail: true, timeout: 120000 }));
    rec.windowHostMs = tEnd - tWin;
    rec.pidEnd = appPid();
    if (rec.pidEnd !== pid0) problems.push(`app process changed during the run (pid ${pid0} -> ${rec.pidEnd || 'none'})`);

    // 6. probe's own results + micro benchmark
    await waitFor(() => { const v = events(); return v.result && v.rawEnd && v.done; }, 180000, 'PROBE_RESULT / PROBE_RAW_END / PROBE_DONE');
    e = events();
    rec.result = e.result; rec.micro = e.micro; rec.done = e.done;
    const raw = rawFrames(e);
    if (!raw.frames) problems.push('raw frame data unusable: ' + raw.why);
    else if (e.result.frames !== raw.frames.length) problems.push('RESULT.frames != raw frames');
    if (e.result.frames < 100) problems.push('too few frames in the window: ' + e.result.frames);
    if (e.result.visibilityHidden > 0) problems.push('page was hidden during the window (' + e.result.visibilityHidden + ' times)');
    if (e.badLines) problems.push(e.badLines + ' unparseable probe lines');
    if (!e.micro) problems.push('micro benchmark result missing');
  } catch (err) {
    problems.push(String(err.message || err));
  } finally {
    await sleep(2000);
    lc.kill();
    await sleep(500);
  }
  // 7. crashes and JS errors from the whole log (also when the run failed earlier)
  const full = fs.readFileSync(logFile, 'utf8');
  const e2 = parseProbeLog(full), crashes = crashLines(full, PKG);
  rec.jsErrorLines = e2.jsErrorLines.slice(0, 10); rec.jsErrorCount = e2.jsErrorLines.length + (e2.result ? e2.result.jsErrors : 0); rec.ecoErrLines = e2.ecoErrLines; rec.crashLines = crashes.slice(0, 10);
  if (crashes.length) problems.push('Android crash/ANR evidence in logcat: ' + crashes[0]);
  if (e2.jsErrorLines.length || e2.ecoErrLines || (e2.done && e2.done.errorsTotal)) problems.push(`JavaScript errors: ${e2.jsErrorLines.length} ERR lines, ${e2.ecoErrLines} ECOERR lines, probe counted ${e2.done ? e2.done.errorsTotal : 'n/a'} (${(e2.jsErrorLines[0] || (e2.done && e2.done.errorFirst) || '')})`);
  fs.writeFileSync(path.join(runDir, 'probe-lines.txt'), full.split('\n').filter(l => /FishingTycoon\s*:/.test(l)).join('\n'));
  shell(`am force-stop ${PKG}`, { allowFail: true });
  rec.ok = problems.length === 0;
  write(path.join(runDir, 'run.json'), rec);
  log(`run ${run} ${mode.label}: ${rec.ok ? 'ok' : 'FAILED: ' + problems.join(' | ')}`);
  return rec;
}

async function main() {
  const fatal = m => { write(path.join(OUT, 'driver.json'), { ok: false, fatal: m, runs: [] }); console.error('FATAL: ' + m); process.exit(1); };
  if (!APK || !fs.existsSync(APK)) return fatal('PERF_APK missing: ' + APK);
  if (!ASSETS || !fs.existsSync(path.join(ASSETS, 'manifest.json'))) return fatal('PERF_ASSETS/manifest.json missing');
  const cfg = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8')).cfg;
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });
  adb(['wait-for-device'], { timeout: 300000 });
  await waitFor(() => shell('getprop sys.boot_completed', { allowFail: true }).trim() === '1', 180000, 'sys.boot_completed');
  const dev = deviceInfo();
  write(path.join(OUT, 'device.json'), dev);
  log('device ' + JSON.stringify(dev));
  const inst = adb(['install', '-r', '-t', APK], { timeout: 240000 });
  if (!/Success/.test(inst)) return fatal('adb install: ' + inst);
  shell('settings put global hide_error_dialogs 1', { allowFail: true });
  shell('settings put global stay_on_while_plugged_in 7', { allowFail: true });
  shell('svc power stayon true', { allowFail: true });
  shell('input keyevent KEYCODE_WAKEUP', { allowFail: true });
  shell('wm dismiss-keyguard', { allowFail: true });
  shell('settings put secure immersive_mode_confirmations confirmed', { allowFail: true });
  shell('pm disable-user --user 0 com.google.android.apps.nexuslauncher', { allowFail: true });
  adb(['logcat', '-G', '16M'], { allowFail: true });

  const runs = [];
  for (let r = 1; r <= RUNS; r++) {
    const order = MODES.map((_, i) => MODES[(i + r - 1) % MODES.length]);            // rotating order: ABC, BCA, CAB
    for (const m of order) {
      try { runs.push(await oneRun(cfg, r, m, path.join(OUT, 'raw', `run${r}-${m.id}`))); }
      catch (err) { runs.push({ run: r, mode: m.id, ok: false, problems: ['driver error: ' + err.message] }); }
    }
  }
  const failed = runs.filter(r => !r.ok);
  write(path.join(OUT, 'driver.json'), { ok: failed.length === 0, runsRequested: RUNS, order: 'rotating', cfg: { ...cfg, save: undefined }, pkg: PKG, runs: runs.map(r => ({ run: r.run, mode: r.mode, ok: r.ok, problems: r.problems })) });
  if (failed.length) { console.error(`${failed.length} of ${runs.length} runs FAILED`); process.exit(1); }
  log(`all ${runs.length} runs completed without problems`);
}
main().catch(e => { try { write(path.join(OUT, 'driver.json'), { ok: false, fatal: String(e.stack || e) }); } catch (x) { /* ignore */ } console.error('FATAL', e); process.exit(1); });
