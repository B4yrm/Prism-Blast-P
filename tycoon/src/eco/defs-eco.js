// Eco content tables (ECONOMY-ARCHITECTURE.md §10). Every number here is an initial BALANCE ASSUMPTION
// (GDD "[BALANS]"), not a real market value.
//
// T1.3 added the species list and the catch weights, T1.4 the base price of each species. Seasons, abundance,
// decay and recipes (the other columns of GDD §3.1) are added by the tasks that activate them.

// Order is the index used by every species vector in S.eco (same order as SPECIES in state-eco.js).
// price: base price multiplier of the species, relative to the game's fresh-fish price (GDD §3.1). [BALANS]
export const SPECIES_DEFS = [
  { id: 'sardine',  name: 'Sardina',    unlockHarbor: 1, price: 0.6 },
  { id: 'mackerel', name: 'Skumbriya',  unlockHarbor: 1, price: 0.9 },
  { id: 'seabass',  name: 'Levrek',     unlockHarbor: 1, price: 1.4 },
  { id: 'salmon',   name: 'Qızılbalıq', unlockHarbor: 2, price: 2.0 },   // GDD §3.1: from harbor tier 2
  { id: 'tuna',     name: 'Tuna',       unlockHarbor: 3, price: 3.5 },   // GDD §3.1: from harbor tier 3
];

// Share of each species in a catch, by harbor tier. [BALANS]
//   tier 1 = the reference start mix of GDD §3.1 (sardine 55 %, mackerel 35 %, sea bass 10 %).
//   tiers 2 and 3 only add the species that unlock there; the numbers are placeholders until T1.5.
//   Since T1.4 they also decide the fresh-fish price at those tiers (more valuable species), see price.js:
//   expected price factor ×1.000 at tier 1, ×1.144 at tier 2, ×1.390 at tier 3 (eco on only).
// Each row sums to 1.
export const CATCH_WEIGHTS = {
  1: [0.55, 0.35, 0.10, 0.00, 0.00],
  2: [0.50, 0.30, 0.12, 0.08, 0.00],
  3: [0.45, 0.27, 0.12, 0.10, 0.06],
};

export function catchWeights(harborTier) {
  const t = Math.min(3, Math.max(1, Math.floor(harborTier) || 1));
  return CATCH_WEIGHTS[t];
}
