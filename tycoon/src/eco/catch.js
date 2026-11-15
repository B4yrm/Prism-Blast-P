// Species of one catch. The simulation has no species: eco decides them here, from its own seeded
// stream (S.eco.rng.catch), never from the global random generator.
import { float } from './rng.js';

// Splits `n` caught fish (a whole number) into species counts. One draw per fish from `stream`
// (the stream state changes in place, so it is saved with S.eco and continues after a reload).
// `weights` are the species shares (sum 1); a species with weight 0 is never drawn.
// Returns a Float64Array of whole numbers that sums to n.
export function drawCatch(stream, n, weights) {
  const k = weights.length, out = new Float64Array(k);
  let last = 0;
  for (let i = 0; i < k; i++) if (weights[i] > 0) last = i;
  for (let f = 0; f < n; f++) {
    let u = float(stream), pick = last;
    for (let i = 0; i < k; i++) { const w = weights[i]; if (w > 0) { if (u < w) { pick = i; break; } u -= w; } }
    out[pick]++;
  }
  return out;
}
