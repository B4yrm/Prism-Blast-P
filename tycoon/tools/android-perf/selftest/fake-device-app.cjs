// SELF TEST ONLY. Stands in for "the app on the emulator": opens a perf page in headless Chromium with a persistent
// profile (like the app's data dir, so localStorage survives until it is cleared) and writes every console line to the
// fake logcat in the format "MM-DD HH:MM:SS.mmm <pid> <tid> I FishingTycoon: <message>". Not Android, not WebView.
// FAKE_DOUBLE_LOAD=1: the page is loaded a second time 6 s after the first (like an activity re-creation);
// FAKE_DOUBLE_LOAD_FIRST=1: only for the very first launch of the fake device.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [, , dataDir, logFile, page, query, pidFile, assetsDir, eventsFile, launchNo] = process.argv;
const ts = () => { const d = new Date(), p = (n, w = 2) => String(n).padStart(w, '0'); return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`; };
(async () => {
  fs.writeFileSync(pidFile, String(process.pid));
  const ctx = await chromium.launchPersistentContext(dataDir, { headless: true, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.75,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = ctx.pages()[0] || await ctx.newPage();
  const emit = m => fs.appendFileSync(logFile, `${ts()}  ${process.pid}  ${process.pid} I FishingTycoon: ${m.replace(/\n/g, ' ')}\n`);
  const ev = m => fs.appendFileSync(eventsFile, `${ts()}  1000  1000 I ${m}\n`);
  p.on('console', m => emit(m.text()));
  p.on('pageerror', e => emit('ERR ' + e.message));
  const stop = async () => { try { await ctx.close(); } catch (e) { /* ignore */ } process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  const comp = 'az.fishing.tycoon.perf/az.universitet.tycoon.MainActivity';
  ev(`am_proc_start: [0,${process.pid},10200,az.fishing.tycoon.perf,activity,${comp}]`);
  ev(`am_create_activity: [0,1,1,${comp},android.intent.action.MAIN,NULL,NULL,0]`);
  const url = 'file://' + path.resolve(assetsDir, page) + (query ? '?' + query : '');
  await p.goto(url);
  if (process.env.FAKE_DOUBLE_LOAD === '1' || (process.env.FAKE_DOUBLE_LOAD_FIRST === '1' && launchNo === '1')) {
    await new Promise(r => setTimeout(r, 6000));
    ev(`am_destroy_activity: [0,1,1,${comp},relaunch]`); ev(`am_create_activity: [0,2,1,${comp},android.intent.action.MAIN,NULL,NULL,0]`);
    await p.goto(url + '#again'); await p.reload();                       // a second full load of the same page in the same process
  }
})().catch(e => { fs.appendFileSync(logFile, `${ts()}  1  1 E AndroidRuntime: FATAL EXCEPTION: fake app failed to start: ${e.message}\n`); process.exit(1); });
