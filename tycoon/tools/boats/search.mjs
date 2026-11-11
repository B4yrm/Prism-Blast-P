// Finds the departure manoeuvre for every berth (results are pasted into
// BERTH_MOVES in src/render/boatpaths.js and checked by tests/boat-check.cjs):
// the quickest back-out (reverse at ~0.5×, ahead at cruise) whose hull never
// touches a pier, the quay, land or a boat moored in another slip, with turns at
// sea no tighter than SEA_R. (The fishing spots: tools/boats/grounds.mjs.)
//   node tools/boats/search.mjs
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, '.preview', 'boatpaths.mjs');
fs.mkdirSync(path.dirname(out), { recursive: true });
await esbuild.build({ entryPoints: [path.join(root, 'src/render/boatpaths.js')], bundle: true, format: 'esm', outfile: out, logLevel: 'error' });
const P = await import(out + '?' + Date.now());
const nB = 4, moves = [];
for (let i = 0; i < nB; i++) {
  const others = [0, 1, 2, 3].filter(j => j !== i).map(P.dockedHull);
  let best = null, tried = 0;
  for (const side of [1, -1]) for (let d0 = 0; d0 <= 4.0001; d0 += 0.25) for (const R of [2.5, 3, 3.5, 4, 4.5, 5]) for (let deg = 50; deg <= 110; deg += 10) {
    const mv = { side, d0: +d0.toFixed(2), R, phi: +(deg * Math.PI / 180).toFixed(3) };
    const plan = P.departurePlan(i, mv);
    tried++;
    const r = P.minRadius(plan[1].path);
    if (r < P.SEA_R - 0.05) continue;
    const score = plan[0].path.len / 0.55 + 1 + plan[1].path.len;
    if (best && score >= best.score) continue;
    if (P.planHits(plan, others).length) continue;
    best = { mv, score: +score.toFixed(2), rev: +plan[0].path.len.toFixed(2), sea: +plan[1].path.len.toFixed(2) };
  }
  moves.push(best.mv);
  console.log('berth', i, 'tried', tried, JSON.stringify(best));
}
console.log('BERTH_MOVES =', JSON.stringify(moves));
