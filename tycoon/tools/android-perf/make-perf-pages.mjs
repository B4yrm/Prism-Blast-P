// Q10: turn the two development builds into the two pages of the perf APK.
//   node make-perf-pages.mjs --base base.raw.html --eco eco.raw.html --save tests/fixtures/save-mid.json \
//        --preset medium --warmup 30 --duration 90 --out perf-assets   (--sync-gap / --end-gap only for the self test)
// Writes out/base.html (plain build) and out/eco.html (ECO=1 build) = the raw build with config + probe.js
// injected right after <head>, and out/manifest.json (hashes of every input and output).
// The inputs must be development builds written with BUILD_OUT; this script never touches tycoon/index.html.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const need = k => { if (!args[k]) { console.error('missing --' + k); process.exit(2); } return args[k]; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const out = path.resolve(need('out'));
if (path.basename(out) === 'tycoon' || path.resolve(out) === path.resolve(here, '../..')) { console.error('refusing to write into the project root'); process.exit(2); }

const preset = args.preset || 'medium';
if (!['low', 'medium', 'high'].includes(preset)) { console.error('preset must be low, medium or high'); process.exit(2); }
const probe = fs.readFileSync(path.join(here, 'probe.js'), 'utf8');
const saveRaw = fs.readFileSync(need('save'));
const save = JSON.parse(saveRaw.toString('utf8'));
const cfg = {
  probeVersion: sha(probe).slice(0, 12), preset, saveName: path.basename(args.save), saveSha256: sha(saveRaw), save,
  warmupS: +(args.warmup || 30), durationS: +(args.duration || 90), syncGapS: +(args['sync-gap'] || 12), endGapS: +(args['end-gap'] || 25), bootTimeoutS: 150, seedBase: 1000,
};
if (!(cfg.warmupS >= 5 && cfg.durationS >= 10)) { console.error('warmup must be >= 5 s and duration >= 10 s'); process.exit(2); }

const inject = '<script>window.__PERF_CFG=' + JSON.stringify(cfg).replace(/<\/script/gi, '<\\/script') + ';</script>\n<script>' + probe.replace(/<\/script/gi, '<\\/script') + '</script>\n';
fs.mkdirSync(out, { recursive: true });
const manifest = { cfg: { ...cfg, save: undefined }, files: {} };
for (const [name, inFile, wantEco] of [['base.html', need('base'), false], ['eco.html', need('eco'), true]]) {
  const html = fs.readFileSync(inFile, 'utf8');
  const hasEco = html.includes('__eco');                                  // the ECO=1 bundle defines window.__eco
  if (hasEco !== wantEco) { console.error(`${inFile}: expected a ${wantEco ? 'ECO=1' : 'plain'} build, got the other one`); process.exit(2); }
  if (html.includes('__PERF_CFG')) { console.error(inFile + ' already contains the probe'); process.exit(2); }
  const marker = '<head>\n';
  if (html.split(marker).length !== 2) { console.error(inFile + ': <head> marker not found exactly once'); process.exit(2); }
  const page = html.replace(marker, () => marker + inject);
  fs.writeFileSync(path.join(out, name), page);
  manifest.files[name] = { input: path.basename(inFile), inputSha256: sha(html), sha256: sha(page), bytes: page.length };
}
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('perf pages written to', out, JSON.stringify(Object.fromEntries(Object.entries(manifest.files).map(([k, v]) => [k, v.sha256.slice(0, 12)]))));
