// Fresh-fish price by species (T1.4, GDD §3.1, ECONOMY-ARCHITECTURE.md §3.3). Pure functions, no game modules.
//
// The game sells fresh fish at stat.rawPrice() per unit (4 × cold-storage upgrade × market price upgrade × brand
// research × boost). With eco on, that price is multiplied by ONE factor that depends on which species the fish are:
//
//   value(mix)  = Σ mix_i × base_i / Σ mix_i                 (average base multiplier of the mix)
//   factor(mix) = clamp( value(mix) / value(REF_MIX), FACTOR_MIN, FACTOR_MAX )
//
// base = 0.6 sardine, 0.9 mackerel, 1.4 sea bass, 2.0 salmon, 3.5 tuna (balance assumption).
// Normalisation: value(REF_MIX) = 0.55·0.6 + 0.35·0.9 + 0.10·1.4 = 0.785, the average of the reference start mix.
// Dividing by it makes the start mix worth exactly what fresh fish is worth today (factor 1.000), while the species
// keep their differences relative to each other (sardine ×0.764, mackerel ×1.146, sea bass ×1.783, salmon ×2.548,
// tuna ×4.459 before the limit). The limit [0.4, 2.5] is the one of the architecture (§3.3); it binds only for a
// mix worth more than 2.5 × the start mix (for example salmon or tuna alone). Bad input never produces NaN,
// Infinity, 0 or a negative factor: it gives 1 (no change).

import { SPECIES_DEFS } from './defs-eco.js';
import { REF_MIX } from './state-eco.js';

export const BASE_PRICE = SPECIES_DEFS.map(s => s.price);
export const FACTOR_MIN = 0.4;
export const FACTOR_MAX = 2.5;

// Average base multiplier of a mix (array or typed array of 5 quantities or shares). NaN when unusable.
export function mixValue(mix) {
  if (!mix || mix.length !== BASE_PRICE.length) return NaN;
  let s = 0, v = 0;
  for (let i = 0; i < BASE_PRICE.length; i++) {
    const x = mix[i];
    if (!(x >= 0) || x === Infinity) return NaN;
    s += x; v += x * BASE_PRICE[i];
  }
  return s > 0 ? v / s : NaN;
}

export const PRICE_NORM = mixValue(REF_MIX);                // 0.785

// The factor for a mix; 1 when the mix is unusable.
export function priceFactor(mix) {
  const f = mixValue(mix) / PRICE_NORM;
  if (!Number.isFinite(f) || !(f > 0)) return 1;
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, f));
}

// The factor of each species alone (for reports and the dev console).
export function speciesFactors() {
  return BASE_PRICE.map((_, i) => { const m = [0, 0, 0, 0, 0]; m[i] = 1; return { raw: mixValue(m) / PRICE_NORM, factor: priceFactor(m) }; });
}
