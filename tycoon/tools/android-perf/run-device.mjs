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
import { parseProbeLog, rawFrames, crashLines, eventsSummary } from './logparse.mjs';

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

const WEBVIEW_PKG = 'com.google.android.webview';
function pidsOf() {   // the app and its WebView renderer (sandboxed_process) processes, as listed by ps
  const ps = shell('ps -A -o PID,NAME', { allowFail: true });
  return ps.split('\n').map(l => l.trim().split(/\s+/)).filter(p => p.length >= 2 && /^\d+$/.test(p[0]) && (p[1] === PKG || /sandboxed_process/i.test(p[1]))).map(p => ({ pid: +p[0], name: p[1], role: p[1] === PKG ? 'app' : 'renderer' }));
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

// Per-process memory: one `dumpsys meminfo <pid>` for the app process and for every WebView renderer process that
// exists right now (after the pre-run cleanup these are this run's own). The full dump is saved as a cross-check.
function memSnapshot(runDir, tag) {
  const procs = pidsOf();
  for (const p of procs) { p.file = `meminfo-${tag}-pid${p.pid}.txt`; write(path.join(runDir, p.file), shell(`dumpsys meminfo ${p.pid}`, { allowFail: true })); }
  write(path.join(runDir, `meminfo-full-${tag}.txt`), shell('dumpsys meminfo', { allowFail: true, timeout: 120000 }));
  return { tag, at: Date.now(), procs };
}

// Before a run: the app is stopped, and no WebView renderer process of an earlier run may be left. If one is, the
// WebView provider package is force-stopped (this kills only its own service processes; the next launch starts new
// ones). Whatever is found is recorded; if something still survives, the run is failed, not measured.
async function cleanLeftovers() {
  const left = () => pidsOf();
  const info = { before: left(), action: null, after: [] };
  if (info.before.length) {
    shell(`am force-stop ${PKG}`, { allowFail: true });
    for (let i = 0; i < 10 && left().length; i++) await sleep(500);
    if (left().some(p => p.role === 'renderer')) {
      info.action = `am force-stop ${WEBVIEW_PKG}`;
      shell(info.action, { allowFail: true });
      for (let i = 0; i < 20 && left().length; i++) await sleep(500);
    }
  }
  info.after = left();
  return info;
}

const bootBrief = b => `pid ${b.logPid} at ${b.logTime} (hadSave=${b.hadSave}, keys=${b.lsKeys}, seeded=${b.seeded})`;
// What the boot list says. The first boot is the clean-start check; every further boot is a failure of its own,
// described as what it is: a second load of the page in the same run (it finds the save the first load seeded).
function bootProblems(boots, events) {
  const out = [];
  if (!boots.length) return ['no PROBE_BOOT line'];
  const b0 = boots[0];
  if (b0.hadSave !== false || b0.lsKeys !== 0) out.push(`state leak at the FIRST boot: localStorage already had data before this page seeded anything, ${bootBrief(b0)}`);
  if (b0.seeded !== true) out.push('start save was not seeded at the first boot');
  if (boots.length > 1) {
    const later = boots.slice(1);
    const sawSeed = later.every(b => b.hadSave === true && b.seeded === false);
    out.push(`page booted ${boots.length} times in one run: ${boots.map(bootBrief).join(' | ')}; ` + (sawSeed ? 'every later boot found the save seeded by the first boot, so the page was loaded again inside the same run (not data left by an earlier run)' : 'later boots differ in a way that is not just the first boot\'s seed') +
      (events ? `; activity events: created ${events.created}, destroyed ${events.destroyed}, relaunched ${events.relaunched}, process starts ${events.procStart}` : ''));
  }
  return out;
}

async function launch(mode, run, seed, runDir) {   // clean state + logcat followers; returns handles
  fs.mkdirSync(runDir, { recursive: true });
  const rec = { problems: [] };
  shell(`am force-stop ${PKG}`, { allowFail: true });
  const cleared = shell(`pm clear ${PKG}`);
  rec.pmClear = cleared.trim();
  if (!/Success/.test(cleared)) rec.problems.push('pm clear did not report Success: ' + cleared.trim());
  const ls = shell(`run-as ${PKG} ls -a`, { allowFail: true });
  rec.dataDirAfterClear = ls.trim();
  if (/app_webview|shared_prefs|databases/.test(ls)) rec.problems.push('app data survived pm clear: ' + ls.replace(/\s+/g, ' ').trim());
  rec.leftover = await cleanLeftovers();
  if (rec.leftover.before.length) log(`${mode.label} run ${run}: ${rec.leftover.before.length} process(es) alive before start (${rec.leftover.before.map(p => p.pid + ' ' + p.name.slice(0, 40)).join(', ')}); action: ${rec.leftover.action || 'none needed beyond force-stop'}; left after: ${rec.leftover.after.length}`);
  if (rec.leftover.after.length) rec.problems.push(`processes survived the pre-run cleanup: ${rec.leftover.after.map(p => p.pid + ' ' + p.name).join(', ')}; run not measured`);
  await sleep(5000);
  adb(['logcat', '-b', 'all', '-c'], { allowFail: true });
  rec.logFile = path.join(runDir, 'logcat-full.txt'); rec.eventsFile = path.join(runDir, 'events.txt');
  rec.lc = spawn(ADB, ['logcat', '-v', 'threadtime'], { stdio: ['ignore', fs.openSync(rec.logFile, 'w'), 'ignore'] });
  rec.lcEvents = spawn(ADB, ['logcat', '-b', 'events', '-v', 'threadtime'], { stdio: ['ignore', fs.openSync(rec.eventsFile, 'w'), 'ignore'] });
  return rec;
}
const stopLogcat = async rec => { await sleep(2000); rec.lc.kill(); rec.lcEvents.kill(); await sleep(500); delete rec.lc; delete rec.lcEvents; };

async function oneRun(cfg, run, mode, runDir) {
  const seed = cfg.seedBase + run, query = ['mode=' + mode.id, 'run=' + run, 'seed=' + seed, mode.query].filter(Boolean).join('&');
  const rec = await launch(mode, run, seed, runDir);
  const problems = rec.problems;
  Object.assign(rec, { run, mode: mode.id, label: mode.label, seed, startedAt: new Date().toISOString(), page: mode.page, query });
  const logFile = rec.logFile, eventsFile = rec.eventsFile;
  const events = () => parseProbeLog(fs.readFileSync(logFile, 'utf8'));
  const blocked = rec.leftover.after.length > 0;
  try {
    if (blocked) throw new Error('skipped: ' + problems[problems.length - 1]);
    const started = adb(['shell', `am start -W -n ${PKG}/az.universitet.tycoon.MainActivity --es page ${mode.page} --es query '${query}'`], { timeout: 120000 });
    rec.amStart = started.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (/Error|Exception/i.test(started) && !/Status: ok/i.test(started)) problems.push('am start failed: ' + rec.amStart);
    const pid0 = await waitFor(() => appPid(), 30000, 'app process');
    rec.pid = pid0;
    const bootT = (cfg.bootTimeoutS + 30) * 1000;
    await waitFor(() => { const e = events(); if (e.fail) throw new Error('probe failure: ' + JSON.stringify(e.fail)); return e.boots.length && e.readies.length; }, bootT, 'PROBE_BOOT + PROBE_READY');
    let e = events();
    rec.boot = e.boot; rec.ready = e.ready;

    // 3. state checks on the first boot; mode / preset / renderer on the first ready
    if (e.boot.mode !== mode.id || e.boot.run !== run || e.boot.seed !== seed) problems.push('page did not receive the expected mode/run/seed: ' + e.boot.search);
    if (e.ready.quality !== cfg.preset) problems.push(`graphics preset ${e.ready.quality} != ${cfg.preset}`);
    if (e.ready.renderer !== 'webgl') problems.push('renderer is ' + e.ready.renderer + ', not webgl');
    const ec = e.ready.eco, x = mode.expect;
    if (ec.present !== x.present || (x.present && (ec.on !== x.on || !ec.systems || ec.systems.species !== x.species || ec.systems.price !== x.price))) problems.push(`eco state ${JSON.stringify(ec)} does not match mode ${mode.id}`);
    log(`run ${run} ${mode.label}: ready (${e.ready.screen.w}x${e.ready.screen.h}, ${e.ready.canvas}, boats ${e.ready.boats}, workers ${e.ready.workers}, eco ${JSON.stringify(ec)}); boots so far: ${e.boots.length}`);

    // 4. warm-up over -> start-of-window collection (inside the probe's idle gap)
    await waitFor(() => events().syncBegin, (cfg.warmupS + 40) * 1000, 'PROBE_SYNC_BEGIN');
    shell(`dumpsys gfxinfo ${PKG} reset`, { allowFail: true });
    rec.cpuStart = cpuTimes();
    rec.memStart = memSnapshot(runDir, 'start');
    await waitFor(() => events().windowBegin, 60000, 'PROBE_WINDOW_BEGIN');
    const tWin = Date.now();

    // 5. window over -> end-of-window collection
    await waitFor(() => events().windowEnd, (cfg.durationS + 90) * 1000, 'PROBE_WINDOW_END');
    const tEnd = Date.now();
    write(path.join(runDir, 'gfxinfo.txt'), shell(`dumpsys gfxinfo ${PKG}`, { allowFail: true }));
    rec.gfxinfoDelayMs = Date.now() - tEnd;
    rec.cpuEnd = cpuTimes();
    rec.memEnd = memSnapshot(runDir, 'end');
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
    await stopLogcat(rec);
  }
  // 7. boots, crashes and JS errors from the whole log (also when the run failed earlier)
  const full = fs.readFileSync(logFile, 'utf8'), evText = fs.existsSync(eventsFile) ? fs.readFileSync(eventsFile, 'utf8') : '';
  const e2 = parseProbeLog(full), crashes = crashLines(full, PKG);
  rec.events = eventsSummary(evText, PKG);
  rec.boots = e2.boots.map(b => ({ pid: b.logPid, time: b.logTime, hadSave: b.hadSave, lsKeys: b.lsKeys, seeded: b.seeded, mode: b.mode, run: b.run }));
  if (!blocked) for (const m of bootProblems(e2.boots, rec.events)) problems.push(m);
  rec.jsErrorLines = e2.jsErrorLines.slice(0, 10); rec.jsErrorCount = e2.jsErrorLines.length + (e2.result ? e2.result.jsErrors : 0); rec.ecoErrLines = e2.ecoErrLines; rec.crashLines = crashes.slice(0, 10);
  if (crashes.length) problems.push('Android crash/ANR evidence in logcat: ' + crashes[0]);
  if (e2.jsErrorLines.length || e2.ecoErrLines || (e2.done && e2.done.errorsTotal)) problems.push(`JavaScript errors: ${e2.jsErrorLines.length} ERR lines, ${e2.ecoErrLines} ECOERR lines, probe counted ${e2.done ? e2.done.errorsTotal : 'n/a'} (${(e2.jsErrorLines[0] || (e2.done && e2.done.errorFirst) || '')})`);
  fs.writeFileSync(path.join(runDir, 'probe-lines.txt'), full.split('\n').filter(l => /FishingTycoon\s*:/.test(l)).join('\n'));
  shell(`am force-stop ${PKG}`, { allowFail: true });
  rec.ok = problems.length === 0;
  delete rec.logFile; delete rec.eventsFile;
  write(path.join(runDir, 'run.json'), rec);
  const mem = rec.memEnd ? ` pids ${rec.memEnd.procs.map(p => p.role[0] + p.pid).join(',')}` : '';
  log(`run ${run} ${mode.label}: ${rec.ok ? 'ok' : 'FAILED: ' + problems.join(' | ')}; boots ${rec.boots.length}; events created/destroyed/relaunched ${rec.events.created}/${rec.events.destroyed}/${rec.events.relaunched};${mem}`);
  return rec;
}

// One discarded launch before the measured runs. It is NOT a measurement and not in any statistic: the first start of an
// app after the emulator boots is not representative (dex/oat, WebView provider start, first-boot configuration changes),
// and it lets the report show whether a first launch behaves differently (boots, activity events). No check is relaxed
// for the measured runs; this launch's findings are recorded and reported as an observation.
async function primeLaunch(cfg) {
  const dir = path.join(OUT, 'raw', 'prime'), mode = MODES[0];
  const rec = await launch(mode, 0, cfg.seedBase, dir);
  Object.assign(rec, { prime: true, startedAt: new Date().toISOString() });
  try {
    if (rec.leftover.after.length) throw new Error('skipped: ' + rec.problems[rec.problems.length - 1]);
    rec.amStart = adb(['shell', `am start -W -n ${PKG}/az.universitet.tycoon.MainActivity --es page ${mode.page} --es query 'mode=prime&run=0&seed=${cfg.seedBase}'`], { timeout: 120000 }).replace(/\s+/g, ' ').trim().slice(0, 300);
    await waitFor(() => appPid(), 30000, 'app process');
    await waitFor(() => { const e = parseProbeLog(fs.readFileSync(rec.logFile, 'utf8')); return e.boots.length && e.readies.length; }, (cfg.bootTimeoutS + 30) * 1000, 'prime PROBE_BOOT + PROBE_READY');
    await sleep(20000);                                                   // watch for a late second load
  } catch (err) { rec.problems.push(String(err.message || err)); }
  await stopLogcat(rec);
  const e2 = parseProbeLog(fs.readFileSync(rec.logFile, 'utf8'));
  rec.events = eventsSummary(fs.existsSync(rec.eventsFile) ? fs.readFileSync(rec.eventsFile, 'utf8') : '', PKG);
  rec.boots = e2.boots.map(b => ({ pid: b.logPid, time: b.logTime, hadSave: b.hadSave, lsKeys: b.lsKeys, seeded: b.seeded }));
  for (const m of bootProblems(e2.boots, rec.events)) rec.problems.push(m);
  fs.writeFileSync(path.join(dir, 'probe-lines.txt'), fs.readFileSync(rec.logFile, 'utf8').split('\n').filter(l => /FishingTycoon\s*:/.test(l)).join('\n'));
  shell(`am force-stop ${PKG}`, { allowFail: true });
  shell(`pm clear ${PKG}`, { allowFail: true });
  delete rec.logFile; delete rec.eventsFile;
  write(path.join(dir, 'prime.json'), rec);
  log(`PRIME launch (discarded, not measured): boots ${rec.boots.length}, events created/destroyed/relaunched ${rec.events.created}/${rec.events.destroyed}/${rec.events.relaunched}; observations: ${rec.problems.length ? rec.problems.join(' | ') : 'none'}`);
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

  let prime = null;
  try { prime = await primeLaunch(cfg); } catch (err) { prime = { prime: true, problems: ['prime launch error: ' + err.message] }; log('PRIME launch error: ' + err.message); }
  const runs = [];
  for (let r = 1; r <= RUNS; r++) {
    const order = MODES.map((_, i) => MODES[(i + r - 1) % MODES.length]);            // rotating order: ABC, BCA, CAB
    for (const m of order) {
      try { runs.push(await oneRun(cfg, r, m, path.join(OUT, 'raw', `run${r}-${m.id}`))); }
      catch (err) { runs.push({ run: r, mode: m.id, ok: false, problems: ['driver error: ' + err.message] }); }
    }
  }
  const failed = runs.filter(r => !r.ok);
  write(path.join(OUT, 'driver.json'), { ok: failed.length === 0, runsRequested: RUNS, order: 'rotating', cfg: { ...cfg, save: undefined }, pkg: PKG, prime: { boots: prime.boots, events: prime.events, observations: prime.problems }, runs: runs.map(r => ({ run: r.run, mode: r.mode, ok: r.ok, problems: r.problems })) });
  if (failed.length) { console.error(`${failed.length} of ${runs.length} runs FAILED`); process.exit(1); }
  log(`all ${runs.length} runs completed without problems`);
}
main().catch(e => { try { write(path.join(OUT, 'driver.json'), { ok: false, fatal: String(e.stack || e) }); } catch (x) { /* ignore */ } console.error('FATAL', e); process.exit(1); });
