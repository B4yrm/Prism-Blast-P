// Q10: make the isolated perf copy of the Android project. The repository's android/ is only READ.
//   node make-perf-project.mjs --android ../android --assets perf-assets --out $RUNNER_TEMP/perf-android
// The copy differs from the production project in exactly these ways (each replacement must match exactly once,
// otherwise this script fails, so a changed production file can never be patched silently wrong):
//   app/build.gradle: applicationId az.fishing.tycoon -> az.fishing.tycoon.perf (cannot replace or share data with the
//                     production app); the tycoon flavor packs the perf pages (base.html, eco.html) instead of
//                     ../tycoon/index.html; preBuild no longer depends on the idle / fishing copy tasks.
//   MainActivity.java: loads file:///android_asset/<page>?<query> from the launch intent (--es page, --es query)
//                     instead of the fixed index.html. WebView settings, console bridge, bars: unchanged.
// AGP, Gradle, compileSdk, minSdk, targetSdk, Java level, manifest: copied unchanged.
import fs from 'fs';
import path from 'path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
for (const k of ['android', 'assets', 'out']) if (!args[k]) { console.error('missing --' + k); process.exit(2); }
const src = path.resolve(args.android), assets = path.resolve(args.assets), out = path.resolve(args.out);
if (out === src || out.startsWith(src + path.sep) || src.startsWith(out + path.sep)) { console.error('output must be outside the android/ project'); process.exit(2); }
for (const f of ['base.html', 'eco.html']) if (!fs.existsSync(path.join(assets, f))) { console.error('missing perf page ' + f); process.exit(2); }

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: p => !/[\\/](build|\.gradle)([\\/]|$)/.test(p) && !/local\.properties$/.test(p) });
fs.cpSync(assets, path.join(out, 'perf-assets'), { recursive: true });

function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  for (const [from, to] of edits) {
    const n = t.split(from).length - 1;
    if (n !== 1) { console.error(`${file}: expected exactly one match for ${JSON.stringify(from)}, found ${n}`); process.exit(3); }
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, t);
}
patch(path.join(out, 'app/build.gradle'), [
  ['applicationId "az.fishing.tycoon"', 'applicationId "az.fishing.tycoon.perf"'],
  ['from("$rootDir/../tycoon/index.html")', 'from("$rootDir/perf-assets") { include "base.html", "eco.html" }'],
  ['preBuild.dependsOn("copyUni", "copyFish", "copyTycoon")', 'preBuild.dependsOn("copyTycoon")'],
]);
patch(path.join(out, 'app/src/main/java/az/universitet/tycoon/MainActivity.java'), [
  ['web.loadUrl("file:///android_asset/index.html");',
   'String page = getIntent().getStringExtra("page"), query = getIntent().getStringExtra("query");\n' +
   '        if (!"base.html".equals(page) && !"eco.html".equals(page)) throw new IllegalStateException("perf APK needs --es page base.html|eco.html");\n' +
   '        web.loadUrl("file:///android_asset/" + page + ((query == null || query.isEmpty()) ? "" : "?" + query));'],
]);
console.log('perf project written to', out);
