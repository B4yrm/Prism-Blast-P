// Test helper: bundles an ES module of src/ into a CommonJS file under .preview/eco-test
// (the same approach as boat-check.cjs) and loads a fresh copy of it on every call,
// so each call gets its own module instances and module-level state.
const esbuild = require('esbuild');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, '.preview', 'eco-test');

function bundle(name, contents) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, name + '.cjs');
  esbuild.buildSync({ stdin: { contents, resolveDir: path.join(root, 'src'), sourcefile: name + '.js' }, bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'error' });
  return out;
}
function fresh(file) { delete require.cache[require.resolve(file)]; return require(file); }

module.exports = { root, bundle, fresh };
