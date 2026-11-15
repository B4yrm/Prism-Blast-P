// SELF TEST ONLY. A tiny stand-in for `adb` that answers the commands run-device.mjs uses and runs the "app" in
// headless Chromium (fake-device-app.cjs). dumpsys output is canned and labelled FAKE; it exists to exercise the driver,
// the log parser and the analyzer, never to produce Android numbers.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const D = process.env.FAKE_ADB_DIR, ASSETS = process.env.FAKE_ASSETS, PKG = 'az.fishing.tycoon.perf';
const LOG = path.join(D, 'logcat.txt'), DATA = path.join(D, 'userdata'), PID = path.join(D, 'app.pid');
fs.mkdirSync(D, { recursive: true });
const args = process.argv.slice(2);
const alive = p => { try { process.kill(p, 0); return true; } catch (e) { return false; } };
const pid = () => { try { const p = +fs.readFileSync(PID, 'utf8'); return alive(p) ? p : 0; } catch (e) { return 0; } };
const say = s => process.stdout.write(s.endsWith('\n') ? s : s + '\n');
if (args[0] === 'wait-for-device') process.exit(0);
if (args[0] === 'install') { say('Performing Streamed Install\nSuccess'); process.exit(0); }
if (args[0] === 'logcat') {
  if (args.includes('-c')) { fs.writeFileSync(LOG, ''); process.exit(0); }
  if (args.includes('-G')) process.exit(0);
  let off = 0; fs.closeSync(fs.openSync(LOG, 'a'));
  const pump = () => { const b = fs.readFileSync(LOG); if (b.length > off) { process.stdout.write(b.subarray(off)); off = b.length; } };
  setInterval(pump, 150); process.on('SIGTERM', () => { pump(); process.exit(0); });
} else if (args[0] === 'shell') {
  const c = args.slice(1).join(' ');
  let m;
  if (/^getprop sys\.boot_completed/.test(c)) say('1');
  else if ((m = /^getprop (\S+)/.exec(c))) say({ 'ro.build.version.release': '14', 'ro.build.version.sdk': '34', 'ro.product.model': 'FAKE-CHROMIUM-SELFTEST', 'ro.product.cpu.abi': 'x86_64', 'ro.build.fingerprint': 'selftest' }[m[1]] || '');
  else if (/^wm size/.test(c)) say('Physical size: 844x390');
  else if (/^wm density/.test(c)) say('Physical density: 440');
  else if (/^nproc/.test(c)) say('4');
  else if (/^cat \/proc\/meminfo/.test(c)) say('MemTotal:       16000000 kB');
  else if (/^pm clear/.test(c)) { if (!process.env.FAKE_ADB_NOCLEAR) fs.rmSync(DATA, { recursive: true, force: true }); say('Success'); }
  else if (/^run-as \S+ ls/.test(c)) say(fs.existsSync(DATA) ? 'app_webview\ncache' : 'cache');
  else if (/^am force-stop/.test(c)) { const p = pid(); if (p) { try { process.kill(p, 'SIGTERM'); } catch (e) { /* gone */ } for (let i = 0; i < 50 && alive(p); i++) await new Promise(r => setTimeout(r, 100)); } }
  else if ((m = /^am start .*--es page (\S+) --es query '([^']*)'/.exec(c))) {
    const child = spawn('node', [path.join(here, 'fake-device-app.cjs'), DATA, LOG, m[1], m[2], PID, ASSETS], { detached: true, stdio: 'ignore' });
    child.unref(); say('Starting: Intent\nStatus: ok\nComplete');
  }
  else if (/^pidof/.test(c)) { const p = pid(); if (p) say(String(p)); }
  else if (/^ps -A/.test(c)) { const p = pid(); if (p) say(`  ${p} ${PKG}`); }
  else if ((m = /^cat \/proc\/(\d+)\/stat/.exec(c))) say(`${m[1]} (${PKG}) S 1 1 1 0 -1 0 0 0 0 0 100 50 0 0 20 0 1 0 1 1 1`);
  else if (/^getconf CLK_TCK/.test(c)) say('100');
  else if (/^dumpsys gfxinfo \S+ reset/.test(c)) { /* nothing */ }
  else if (/^dumpsys gfxinfo/.test(c)) say('FAKE gfxinfo (self test)\nTotal frames rendered: 1000\nJanky frames: 500 (50.00%)\n50th percentile: 20ms\n90th percentile: 40ms\n95th percentile: 50ms\n99th percentile: 90ms');
  else if (/^dumpsys meminfo \S+/.test(c)) say('FAKE meminfo (self test)\n           TOTAL PSS:   100000            TOTAL RSS:   200000       TOTAL SWAP PSS:      0');
  else if (/^dumpsys meminfo/.test(c)) say(`Total PSS by process:\n    100,000K: ${PKG} (pid ${pid()} / activities)`);
  else if (/^dumpsys (webviewupdate|package|SurfaceFlinger)/.test(c)) say('');
  else if (/^(settings|svc|input|wm dismiss|pm disable)/.test(c)) { /* accepted, ignored */ }
  else { console.error('fake adb: unknown shell command: ' + c); process.exit(1); }
} else { console.error('fake adb: unknown command ' + args.join(' ')); process.exit(1); }
