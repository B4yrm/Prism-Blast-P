// Shared by run-device.mjs (live), analyze.mjs and the self tests: reads the PROBE_* console lines that the
// APK's WebView bridge writes to logcat (tag FishingTycoon) and the Android-side dumps.
import fs from 'fs';

const LINE = /\bFishingTycoon\s*:\s*(PROBE_[A-Z_]+) (.*)$/;

// Parse a logcat text (any -v format that keeps "FishingTycoon: <message>") into the probe's events of ONE run.
export function parseProbeLog(text) {
  const ev = { boot: null, ready: null, syncBegin: null, windowBegin: null, windowEnd: null, result: null, rawEnd: null, micro: null, done: null, fail: null, storage: null,
    rawChunks: new Map(), badLines: 0, jsErrorLines: [], ecoErrLines: 0, probeLineCount: 0 };
  for (const line of text.split('\n')) {
    const m = LINE.exec(line);
    if (!m) {
      if (/FishingTycoon\s*:\s*ERR /.test(line)) ev.jsErrorLines.push(line.replace(/^.*FishingTycoon\s*:\s*/, '').slice(0, 200));
      else if (/FishingTycoon\s*:\s*ECOERR/.test(line)) ev.ecoErrLines++;
      continue;
    }
    ev.probeLineCount++;
    const [, tag, payload] = m;
    if (tag === 'PROBE_RAW') {
      const sp = payload.indexOf(' ');
      ev.rawChunks.set(+payload.slice(0, sp), payload.slice(sp + 1).trim());
      continue;
    }
    let obj;
    try { obj = JSON.parse(payload); } catch (e) { ev.badLines++; continue; }
    const key = { PROBE_BOOT: 'boot', PROBE_READY: 'ready', PROBE_SYNC_BEGIN: 'syncBegin', PROBE_WINDOW_BEGIN: 'windowBegin', PROBE_WINDOW_END: 'windowEnd',
      PROBE_RESULT: 'result', PROBE_RAW_END: 'rawEnd', PROBE_MICRO: 'micro', PROBE_DONE: 'done', PROBE_FAIL: 'fail', PROBE_STORAGE: 'storage' }[tag];
    if (key) ev[key] = obj; else ev.badLines++;
  }
  return ev;
}

// The raw frame intervals (ms) re-assembled from RAW chunks; null + reason if chunks are missing or the count differs.
export function rawFrames(ev) {
  if (!ev.rawEnd) return { frames: null, why: 'no PROBE_RAW_END line' };
  const out = [];
  for (let i = 0; i < ev.rawEnd.chunks; i++) {
    if (!ev.rawChunks.has(i)) return { frames: null, why: `raw chunk ${i} of ${ev.rawEnd.chunks} missing` };
    for (const s of ev.rawChunks.get(i).split(',')) if (s !== '') out.push(+s);
  }
  if (out.length !== ev.rawEnd.frames) return { frames: null, why: `raw frames ${out.length} != announced ${ev.rawEnd.frames}` };
  if (out.some(x => !Number.isFinite(x) || x <= 0)) return { frames: null, why: 'non-numeric or non-positive interval in raw data' };
  return { frames: out, why: null };
}

// Android crash / ANR / process-death evidence in a full logcat text.
export const CRASH_PATTERNS = [/FATAL EXCEPTION/, /\bANR in /, /Fatal signal \d+/, /Process .* has died/, /RenderProcessGone/i, /Render process.*(crash|gone)/i, /Renderer.*crash/i, /has crashed/i];
export function crashLines(text, pkg) {
  const out = [];
  for (const l of text.split('\n')) {
    if (!CRASH_PATTERNS.some(p => p.test(l))) continue;
    if (/Process .* has died/.test(l) && !(pkg && l.includes(pkg))) continue;          // other processes of the emulator image dying is not ours
    out.push(l.slice(0, 240));
  }
  return out;
}

// dumpsys gfxinfo (summary part): the Android window compositor's view of the app's frames. NOT the page's JS frame rate.
export function parseGfxinfo(text) {
  const num = re => { const m = re.exec(text); return m ? +m[1] : null; };
  const jank = /Janky frames: (\d+) \(([\d.]+)%\)/.exec(text);
  return {
    totalFrames: num(/Total frames rendered: (\d+)/), jankyFrames: jank ? +jank[1] : null, jankyPct: jank ? +jank[2] : null,
    p50ms: num(/50th percentile: (\d+)ms/), p90ms: num(/90th percentile: (\d+)ms/), p95ms: num(/95th percentile: (\d+)ms/), p99ms: num(/99th percentile: (\d+)ms/),
    missedVsync: num(/Number Missed Vsync: (\d+)/), slowUiThread: num(/Number Slow UI thread: (\d+)/), slowBitmapUploads: num(/Number Slow bitmap uploads: (\d+)/),
    slowIssueDraw: num(/Number Slow issue draw commands: (\d+)/), deadlineMissed: num(/Number Frame deadline missed: (\d+)/),
  };
}

// dumpsys meminfo <pkg>: PSS of the app process only (the WebView renderer, if separate, is in the full dump below).
export function parseMeminfoPkg(text) {
  const m = /TOTAL PSS:\s+(\d+)\s+TOTAL RSS:\s+(\d+)/.exec(text), t = /^\s*TOTAL\s+(\d+)/m.exec(text);
  const row = name => { const r = new RegExp('^\\s*' + name + ':?\\s+(\\d+)', 'm').exec(text); return r ? +r[1] : null; };
  return { totalPssKb: m ? +m[1] : (t ? +t[1] : null), totalRssKb: m ? +m[2] : null, javaHeapPssKb: row('Java Heap'), nativeHeapPssKb: row('Native Heap'), graphicsPssKb: row('Graphics') };
}

// Full "dumpsys meminfo" -> "Total PSS by process" lines for the app and for WebView / sandboxed renderer processes.
export function parseMeminfoProcesses(text, pkg) {
  const procs = [];
  for (const l of text.split('\n')) {
    const m = /^\s*([\d,]+)K:\s+(\S+)\s+\(pid (\d+)/.exec(l);
    if (!m) continue;
    const name = m[2];
    if (name === pkg || /sandboxed_process/i.test(name)) procs.push({ name, pid: +m[3], pssKb: +m[1].replace(/,/g, '') });
  }
  const app = procs.filter(p => p.name === pkg).reduce((a, p) => a + p.pssKb, 0);
  const web = procs.filter(p => p.name !== pkg).reduce((a, p) => a + p.pssKb, 0);
  return { procs, appPssKb: procs.length ? app : null, webviewPssKb: procs.length ? web : null, sumPssKb: procs.length ? app + web : null, rendererSeparate: procs.some(p => p.name !== pkg && /sandboxed_process/i.test(p.name)) };
}

export function readIf(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } }
