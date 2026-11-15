// SELF TEST ONLY. Stands in for "the app on the emulator": opens a perf page in headless Chromium with a persistent
// profile (like the app's data dir, so localStorage survives until it is cleared) and writes every console line to the
// fake logcat in the format "<time> <pid> <tid> I FishingTycoon: <message>". Not Android, not WebView.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [, , dataDir, logFile, page, query, pidFile, assetsDir] = process.argv;
(async () => {
  fs.writeFileSync(pidFile, String(process.pid));
  const ctx = await chromium.launchPersistentContext(dataDir, { headless: true, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2.75,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = ctx.pages()[0] || await ctx.newPage();
  const emit = m => fs.appendFileSync(logFile, `01-01 00:00:00.000  ${process.pid}  ${process.pid} I FishingTycoon: ${m.replace(/\n/g, ' ')}\n`);
  p.on('console', m => emit(m.text()));
  p.on('pageerror', e => emit('ERR ' + e.message));
  const stop = async () => { try { await ctx.close(); } catch (e) { /* ignore */ } process.exit(0); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  await p.goto('file://' + path.resolve(assetsDir, page) + (query ? '?' + query : ''));
})().catch(e => { fs.appendFileSync(logFile, `01-01 00:00:00.000  1  1 E AndroidRuntime: FATAL EXCEPTION: fake app failed to start: ${e.message}\n`); process.exit(1); });
