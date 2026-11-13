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
// Embedded fonts (Baloo 2 + Nunito, SIL OFL) cover every Azerbaijani letter offline.
const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
const face = (fam, file, w, range) => `@font-face{font-family:"${fam}";font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync('assets/fonts/' + file).toString('base64')}) format("woff2");unicode-range:${range}}`;
const fonts = [
  face('Baloo 2', 'baloo-2-latin-800-normal.woff2', '400 900', LATIN), face('Baloo 2', 'baloo-2-latin-ext-800-normal.woff2', '400 900', LATIN_EXT),
  face('Nunito', 'nunito-latin-800-normal.woff2', '400 850', LATIN), face('Nunito', 'nunito-latin-ext-800-normal.woff2', '400 850', LATIN_EXT),
  face('Nunito', 'nunito-latin-900-normal.woff2', '851 1000', LATIN), face('Nunito', 'nunito-latin-ext-900-normal.woff2', '851 1000', LATIN_EXT),
].join('\n');
const css = fonts + '\n' + fs.readFileSync('src/ui/style.css', 'utf8');
// Inline every atlas page (assets/atlas/*.json + same-name .webp/.png) so the game stays one offline file.
const atlasDir = 'assets/atlas';
const pages = fs.existsSync(atlasDir) ? fs.readdirSync(atlasDir).filter(f => f.endsWith('.json')).sort().map(f => {
  const json = JSON.parse(fs.readFileSync(`${atlasDir}/${f}`, 'utf8'));
  const base = f.slice(0, -5), img = ['webp', 'png'].map(e => `${atlasDir}/${base}.${e}`).find(p => fs.existsSync(p));
  const mime = img.endsWith('.png') ? 'image/png' : 'image/webp';
  return { json, img: `data:${mime};base64,` + fs.readFileSync(img).toString('base64') };
}) : [];
const atlasJs = 'window.__ATLAS=' + JSON.stringify(pages) + ';';
const html = fs.readFileSync('src/index.template.html', 'utf8')
  .replace('/*CSS*/', () => css)
  .replace('/*PHASER*/', () => phaser)
  .replace('/*GAME*/', () => atlasJs + '\n' + game);
// Full document for the APK / repo; bare page body for the artifact viewer.
const full = html
  .replace('<!--DOC-->', '<!doctype html>\n<html lang="az">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">')
  .replace('<!--BODY-->', '</head>\n<body>') + '</body>\n</html>\n';
// BUILD_OUT=path writes a development build elsewhere and leaves index.html (the APK's page) alone
fs.writeFileSync(process.env.BUILD_OUT || 'index.html', full);
if (!process.env.BUILD_OUT || process.env.ARTIFACT_OUT) fs.writeFileSync(process.env.ARTIFACT_OUT || '.artifact.html', html.replace('<!--DOC-->\n', '').replace('<!--BODY-->\n', ''));
console.log(process.env.BUILD_OUT || 'index.html', (full.length / 1024).toFixed(0) + ' KB');
