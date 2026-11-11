// Sprite bake: renders the 3D models (CC0 Kenney kit + our own models) in
// headless Chromium and writes WebP atlases + JSON (TexturePacker "hash" format).
//   node tools/bake/bake.mjs            → assets/atlas/world-*.webp/json
//   node tools/bake/bake.mjs preview p/ → PNG previews of matching sprites in ./.preview
import * as esbuild from 'esbuild';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const [mode = 'atlas', ...filter] = process.argv.slice(2);

const js = (await esbuild.build({ entryPoints: [path.join(root, 'tools/bake/main.js')], bundle: true, format: 'iife', write: false, minify: false })).outputFiles[0].text;
const page = `<!doctype html><meta charset="utf-8"><body><script>${js.replace(/<\/script/g, '<\\/script')}</script>`;
const server = http.createServer((req, res) => {
  if (req.url === '/' ) { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
  const f = path.join(root, 'assets', decodeURIComponent(req.url));
  if (!f.startsWith(path.join(root, 'assets')) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await browser.newPage();
p.on('pageerror', e => console.error('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
await p.goto(`http://127.0.0.1:${port}/`);
await p.waitForFunction(() => window.ready);
const t0 = Date.now();
if (mode === 'preview') {
  const out = await p.evaluate(f => window.preview(f.length ? f : null), filter);
  const dir = path.join(root, '.preview'); fs.mkdirSync(dir, { recursive: true });
  for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(dir, k.replace(/\//g, '_') + '.png'), Buffer.from(v.url.split(',')[1], 'base64'));
  console.log(Object.keys(out).length, 'previews', Date.now() - t0, 'ms');
} else {
  const pages = await p.evaluate(f => window.bakeAtlas(f.length ? f : null), filter);
  const dir = path.join(root, 'assets/atlas'); fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (/^(world|bld)-/.test(f)) fs.unlinkSync(path.join(dir, f));
  for (const pg of pages) {
    fs.writeFileSync(path.join(dir, pg.name + '.webp'), Buffer.from(pg.webp.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(dir, pg.name + '.json'), JSON.stringify(pg.json));
    console.log(pg.name, pg.json.meta.size, Object.keys(pg.json.frames).length, 'frames', (fs.statSync(path.join(dir, pg.name + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
  console.log('baked in', Date.now() - t0, 'ms');
}
await browser.close(); server.close();
