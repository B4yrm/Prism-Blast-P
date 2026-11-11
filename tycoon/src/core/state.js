// Persistent game state with versioned saves.

export const SAVE_KEY = 'fishingTycoon.save';
export const SAVE_VERSION = 1;

export function fresh() {
  return {
    v: SAVE_VERSION,
    money: 120, gems: 10, xp: 0, level: 1,
    register: 0,
    tier: { harbor: 1, warehouse: 1, market: 1, hq: 1, factory: 0, farm: 0 },
    up: {
      harbor: { cap: 0, speed: 0, net: 0 },
      warehouse: { cap: 0, load: 0, cold: 0 },
      factory: { speed: 0, out: 0, qual: 0 },
      market: { price: 0, ads: 0, till: 0 },
      hq: { train: 0, carry: 0 },
    },
    workers: 1, boats: 1,
    stock: { quay: 0, wh: 0, facOut: 0, mRaw: 0, mProd: 0 },
    stats: { caught: 0, sold: 0, soldProd: 0, earned: 0, collected: 0, research: 0 },
    mission: 0,
    ach: {},                      // id -> number of claimed steps
    daily: { day: 0, last: '' },
    research: { lv: {}, active: null }, // active: {id, ends}
    boostUntil: 0, freeChestAt: 0,
    log: [], logUnread: 0,
    settings: { sound: true, vibrate: true, quality: 'auto', missionOpen: false },
    lastSeen: Date.now(),
    created: Date.now(),
  };
}

// Each migration upgrades a save from version k to k+1.
const MIGRATIONS = {
  // 1: s => { ...; s.v = 2; return s; },
};

function deepFill(dst, def) {
  for (const k in def) {
    if (dst[k] === undefined) dst[k] = def[k];
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof dst[k] === 'object')
      deepFill(dst[k], def[k]);
  }
  return dst;
}

export function load() {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* storage blocked */ }
  if (!raw) return fresh();
  try {
    let s = JSON.parse(raw);
    while (s.v < SAVE_VERSION && MIGRATIONS[s.v]) s = MIGRATIONS[s.v](s);
    if (s.v > SAVE_VERSION) return fresh();
    return deepFill(s, fresh());
  } catch (e) {
    return fresh();
  }
}

export function save(S) {
  if (window.__noSave) return;
  S.lastSeen = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ }
}

export function wipe() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}
