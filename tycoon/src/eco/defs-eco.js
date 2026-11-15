// Eco content tables (ECONOMY-ARCHITECTURE.md §10). Every number here is an initial BALANCE ASSUMPTION
// (GDD "[BALANS]"), not a real market value.
//
// T1.3 uses only the species list and the catch weights. Prices, seasons, abundance, decay and recipes
// (the other columns of GDD §3.1) are added by the tasks that activate them.

// Order is the index used by every species vector in S.eco (same order as SPECIES in state-eco.js).
export const SPECIES_DEFS = [
  { id: 'sardine',  name: 'Sardina',    unlockHarbor: 1 },
  { id: 'mackerel', name: 'Skumbriya',  unlockHarbor: 1 },
  { id: 'seabass',  name: 'Levrek',     unlockHarbor: 1 },
  { id: 'salmon',   name: 'Qızılbalıq', unlockHarbor: 2 },   // GDD §3.1: from harbor tier 2
  { id: 'tuna',     name: 'Tuna',       unlockHarbor: 3 },   // GDD §3.1: from harbor tier 3
];

// Share of each species in a catch, by harbor tier. [BALANS]
//   tier 1 = the reference start mix of GDD §3.1 (sardine 55 %, mackerel 35 %, sea bass 10 %).
//   tiers 2 and 3 only add the species that unlock there; the numbers are placeholders until T1.4 / T1.5
//   (they change the species mix of the stock, nothing else: no price reads them yet).
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
