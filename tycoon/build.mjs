// Bundles src/ into one self-contained index.html (Phaser inlined) so the
// game runs offline inside the Android WebView and as a single-file page.
import * as esbuild from 'esbuild';
import fs from 'fs';

const r = await esbuild.build({
  entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife',
  target: 'es2019', write: false, legalComments: 'none',
});
const esc = s => s.replace(/<\/script/gi, '<\\/script');
const game = esc(r.outputFiles[0].text);
const phaser = esc(fs.readFileSync('node_modules/phaser/dist/phaser.min.js', 'utf8'));
const css = fs.readFileSync('src/ui/style.css', 'utf8');
const html = fs.readFileSync('src/index.template.html', 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*PHASER*/', () => phaser)
  .replace('/*GAME*/', () => game);
// Full document for the APK / repo; bare page body for the artifact viewer.
const full = html
  .replace('<!--DOC-->', '<!doctype html>\n<html lang="az">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">')
  .replace('<!--BODY-->', '</head>\n<body>') + '</body>\n</html>\n';
fs.writeFileSync('index.html', full);
fs.writeFileSync(process.env.ARTIFACT_OUT || '.artifact.html', html.replace('<!--DOC-->\n', '').replace('<!--BODY-->\n', ''));
console.log('index.html', (full.length / 1024).toFixed(0) + ' KB');
