// Unit tests of the log / dump parsers (Node's built-in test runner). The meminfo text below is a SYNTHETIC sample of the
// layout of `dumpsys meminfo`: the first CI run showed that the same processes appear in more than one section.
// Whether the real device output matches is checked in every CI run (the driver logs and the report shows the parsed result).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProbeLog, parseMeminfoProcesses, parseMeminfoPkg, eventsSummary, rawFrames } from '../logparse.mjs';

const PKG = 'az.fishing.tycoon.perf';
const R0 = 'com.google.android.webview:sandboxed_process0:org.chromium.content.app.SandboxedProcessService0:0';
const DUMP = `Applications Memory Usage (in kilobytes):
Uptime: 1 Realtime: 1

Total RAM: 2,432,296K (status normal)
 Free RAM: 1,000,000K

Total PSS by process:
    130,519K: ${PKG} (pid 7028 / activities)
     65,000K: ${R0} (pid 7100)
     30,000K: com.google.android.webview:webview_service (pid 900)
     20,000K: system_server (pid 600)

Total PSS by OOM adjustment:
    215,000K: Foreground
        130,519K: ${PKG} (pid 7028 / activities)
         65,000K: ${R0} (pid 7100)
     20,000K: Native
         20,000K: system_server (pid 600)

Total PSS by category:
    100,000K: Native
`;

test('meminfo: only the by-process section, renderer separate, nothing double counted', () => {
  const r = parseMeminfoProcesses(DUMP, PKG);
  assert.equal(r.sectionFound, true);
  assert.equal(r.appPssKb, 130519);
  assert.equal(r.rendererPssKb, 65000);
  assert.equal(r.sumPssKb, 195519);
  assert.equal(r.procs.length, 2);                     // webview_service and system_server are not ours
  assert.equal(r.rendererSeparate, true);
});
test('meminfo: a pid listed twice inside the section is dropped, not summed', () => {
  const twice = DUMP.replace(`     20,000K: system_server (pid 600)\n\nTotal PSS by OOM`, `     65,000K: ${R0} (pid 7100)\n\nTotal PSS by OOM`);
  const r = parseMeminfoProcesses(twice, PKG);
  assert.equal(r.duplicatesDropped, 1);
  assert.equal(r.rendererPssKb, 65000);
});
test('meminfo: two renderer processes are both counted; section missing -> nothing guessed', () => {
  const two = DUMP.replace(`     30,000K: com.google`, `     50,000K: ${R0.replace('process0', 'process1')} (pid 7200)\n     30,000K: com.google`);
  assert.equal(parseMeminfoProcesses(two, PKG).rendererPssKb, 115000);
  const none = parseMeminfoProcesses('nothing here', PKG);
  assert.equal(none.sectionFound, false); assert.equal(none.sumPssKb, null);
});
test('meminfo per pid: TOTAL PSS', () => {
  assert.equal(parseMeminfoPkg('           TOTAL PSS:   130519            TOTAL RSS:   293708       TOTAL SWAP PSS:      178').totalPssKb, 130519);
});
const L = (pid, time, tag, o) => `${time}  ${pid}  ${pid} I FishingTycoon: PROBE_${tag} ${JSON.stringify(o)}`;
test('probe log: every boot is kept with pid and time; .boot is the first', () => {
  const txt = [L(111, '11-15 20:01:00.000', 'BOOT', { hadSave: false, lsKeys: 0, seeded: true }), L(111, '11-15 20:01:20.000', 'BOOT', { hadSave: true, lsKeys: 1, seeded: false }), L(111, '11-15 20:01:40.000', 'READY', { quality: 'medium' })].join('\n');
  const e = parseProbeLog(txt);
  assert.equal(e.boots.length, 2);
  assert.equal(e.boot.hadSave, false);
  assert.deepEqual([e.boots[1].logPid, e.boots[1].logTime, e.boots[1].hadSave], [111, '11-15 20:01:20.000', true]);
  assert.equal(e.readies.length, 1);
});
test('events summary counts only the package', () => {
  const s = eventsSummary(`x am_create_activity: [0,1,1,${PKG}/A]\nx am_create_activity: [0,1,1,${PKG}/A]\nx am_create_activity: [0,1,1,other.app/A]\nx am_destroy_activity: [${PKG}/A]\nx am_proc_start: [${PKG}]`, PKG);
  assert.deepEqual([s.created, s.destroyed, s.relaunched, s.procStart], [2, 1, 0, 1]);
});
test('raw frames: missing chunk is refused', () => {
  const e = { rawEnd: { chunks: 2, frames: 4 }, rawChunks: new Map([[0, '10,20']]) };
  assert.equal(rawFrames(e).frames, null);
});
