// The eco layer must not use the global random generator (it is shared by rendering
// and the simulation) nor any other unseeded source. Scans src/eco/** and src/main-eco.js,
// comments included (stricter and simpler).
//   node tests/eco/no-math-random.cjs   → exit code 1 on a hit
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
const files = [path.join(root, 'src/main-eco.js')];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.m?js$/.test(f) && files.push(p); } })(path.join(root, 'src/eco'));
const BAD = [/Math\s*\.\s*random/, /Math\s*\[\s*['"`]random/, /getRandomValues/, /randomUUID/];
const hits = [];
for (const f of files) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (BAD.some(r => r.test(l))) hits.push(`${path.relative(root, f)}:${i + 1}: ${l.trim()}`); });
console.log(JSON.stringify({ test: 'no-math-random', files: files.map(f => path.relative(root, f)), hits, pass: hits.length === 0 }));
process.exit(hits.length ? 1 : 0);
