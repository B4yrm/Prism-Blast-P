// Pure helpers for species vectors (arrays of 5 numbers). No game modules.

export const sum = v => { let s = 0; for (let i = 0; i < v.length; i++) s += v[i]; return s; };

// Whole-number counts from a vector of (fractional) quantities, summing to `total` EXACTLY (largest remainder
// method): rounding never creates or removes a fish. `vec` only gives the proportions; `total` is a whole
// number (the simulation's stock). Ties go to the lower index. A species with quantity 0 never gets a fish.
export function roundCounts(vec, total) {
  const n = vec.length, out = new Array(n).fill(0);
  const s = sum(vec);
  if (!(total > 0) || !(s > 0)) return out;
  const rem = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const q = vec[i] > 0 ? vec[i] * total / s : 0, f = Math.floor(q);
    out[i] = f; used += f;
    if (q > f) rem.push([q - f, i]);
  }
  let left = total - used;
  rem.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let j = 0; j < rem.length && left > 0; j++, left--) out[rem[j][1]]++;
  return out;
}
