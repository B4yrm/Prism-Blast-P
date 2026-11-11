// Derived stats and money helpers. Everything reads the shared state G.S.
import { TRACKS, TIER, MAX_WORKERS, MAX_BOATS, BOAT_COST, BOAT_TYPES, VEHICLES, EXPORT_MUL, workerCost, RESEARCH, MISSIONS, ACHIEVEMENTS, ACH_GEMS } from '../data/defs.js';
import { bus } from './bus.js';

export const G = { S: null };

const rl = id => (G.S.research.lv[id] || 0);
const up = (b, t) => G.S.up[b][t];

export const stat = {
  boatCap: () => Math.round((10 + 3 * up('harbor', 'cap')) * (1 + 0.15 * rl('nets'))),
  boatSpeed: () => 1.7 * (1 + 0.08 * up('harbor', 'speed')) * (1 + 0.1 * rl('nav')),
  fishTime: () => 6 * Math.pow(0.93, up('harbor', 'net')),
  quayCap: () => 40 + 40 * (G.S.tier.harbor - 1),
  whCap: () => 40 + 30 * up('warehouse', 'cap') + 60 * (G.S.tier.warehouse - 1),
  loadTime: () => 0.9 * Math.pow(0.9, up('warehouse', 'load')),
  facRate: () => G.S.tier.factory ? 0.6 * Math.pow(1.15, up('factory', 'speed')) * G.S.tier.factory : 0,
  facOutCap: () => 30 + 20 * up('factory', 'out'),
  canRate: () => G.S.tier.factory >= 2 ? 0.35 * Math.pow(1.15, up('factory', 'can')) * (G.S.tier.factory - 1) : 0,
  boatType: i => G.S.boatTypes[i] || 0,
  boatCapOf: i => Math.round(stat.boatCap() * BOAT_TYPES[stat.boatType(i)].capMul),
  boatSpeedOf: i => stat.boatSpeed() * BOAT_TYPES[stat.boatType(i)].speedMul,
  fleetCap: () => { let c = 0; for (let i = 0; i < G.S.boats; i++) c += stat.boatCapOf(i); return c; },
  shelfCap: () => 30 + 25 * (G.S.tier.market - 1),
  custEvery: () => 3.6 / ((1 + 0.12 * up('market', 'ads')) * (1 + 0.15 * rl('mkt')) * (1 + 0.35 * (G.S.tier.market - 1))),
  tillCap: () => 400 * Math.pow(1.4, up('market', 'till')) * G.S.tier.market,
  workerSpeed: () => 3 * (1 + 0.08 * up('hq', 'train')) * (1 + 0.1 * rl('ergo')),
  carry: () => 6 + up('hq', 'carry'),
  priceMul: () => (1 + 0.1 * up('market', 'price')) * (1 + 0.1 * rl('brand')) * (Date.now() < G.S.boostUntil ? 2 : 1),
  rawPrice: () => 4 * (1 + 0.05 * up('warehouse', 'cold')) * stat.priceMul(),
  prodPrice: () => 11 * (1 + 0.08 * up('factory', 'qual')) * stat.priceMul(),
  canPrice: () => 24 * (1 + 0.08 * up('factory', 'qual')) * stat.priceMul(),
  exportMul: () => EXPORT_MUL,
  maxWorkers: () => MAX_WORKERS[G.S.tier.hq],
  maxBoats: () => MAX_BOATS[G.S.tier.harbor],
  offlineCapH: () => 8 + 2 * rl('night'),
  autoCollect: () => rl('cash') > 0,
};

export const trackCost = (b, tr) => Math.round(tr.base * Math.pow(tr.g, up(b, tr.id)));
export const trackMax = b => 10 * Math.max(1, G.S.tier[b]);

export function canAfford(c) { return G.S.money >= c; }
export function spend(c) {
  if (G.S.money < c) return false;
  G.S.money -= c; bus.emit('money'); return true;
}
export function addMoney(c) { G.S.money += c; G.S.stats.earned += c; bus.emit('money'); }
export function addGems(g) { G.S.gems += g; bus.emit('money'); }
export function reward(r) {
  if (r.c) addMoney(r.c);
  if (r.g) addGems(r.g);
}

export const xpNeed = l => Math.floor(30 * Math.pow(l, 1.7));
export function addXp(n) {
  const S = G.S; S.xp += n;
  while (S.xp >= xpNeed(S.level)) {
    S.xp -= xpNeed(S.level); S.level++;
    addGems(3 + S.level);
    bus.emit('levelup', S.level);
  }
}

export const trackOpen = (b, tr) => !tr.minTier || G.S.tier[b] >= tr.minTier;
export function buyTrack(b, tr) {
  if (!trackOpen(b, tr) || up(b, tr.id) >= trackMax(b)) return false;
  if (!spend(trackCost(b, tr))) return false;
  G.S.up[b][tr.id]++;
  addXp(2 + G.S.up[b][tr.id]);
  bus.emit('upgrade', { b, t: tr.id });
  return true;
}

export function tierInfo(b) {
  const t = G.S.tier[b], T = TIER[b];
  if (t >= 3) return null;
  return { next: t + 1, cost: T.cost[t + 1], lvl: T.lvl[t + 1] };
}
export function buyTier(b) {
  const ti = tierInfo(b);
  if (!ti || G.S.level < ti.lvl || !spend(ti.cost)) return false;
  G.S.tier[b] = ti.next;
  addXp(20 * ti.next);
  bus.emit('tier', { b, tier: ti.next });
  return true;
}

export function hireCost() { return workerCost(G.S.workers); }
export function hire() {
  if (G.S.workers >= stat.maxWorkers() || !spend(hireCost())) return false;
  G.S.workers++; bus.emit('workers'); return true;
}
export function boatCost() { return BOAT_COST[G.S.boats + 1] || Infinity; }
export function buyBoat() {
  if (G.S.boats >= stat.maxBoats() || !spend(boatCost())) return false;
  G.S.boatTypes[G.S.boats] = 0;
  G.S.boats++; bus.emit('boats'); return true;
}

// ---- vehicles & boat classes -------------------------------------------
export function vehicleMax(kind) { const v = VEHICLES[kind]; return v.max(G.S.tier[v.need] || 0); }
export function vehicleCost(kind) { return VEHICLES[kind].cost(G.S[kind + 's']); }
export function buyVehicle(kind) {
  const key = kind + 's';
  if (G.S[key] >= vehicleMax(kind) || !spend(vehicleCost(kind))) return false;
  G.S[key]++; addXp(10); bus.emit('vehicles', kind); return true;
}
export function boatRefit(i) {
  const t = stat.boatType(i), nx = BOAT_TYPES[t + 1];
  if (!nx) return null;
  return { next: t + 1, cost: nx.cost, tier: nx.tier, name: nx.name };
}
export function refitBoat(i) {
  const r = boatRefit(i);
  if (!r || G.S.tier.harbor < r.tier || !spend(r.cost)) return false;
  G.S.boatTypes[i] = r.next; addXp(15 * r.next);
  bus.emit('refit', i); return true;
}

// Steady-state income estimate ($/s): the slowest stage of the chain wins.
export function steadyRate() {
  const S = G.S;
  const trip = 2 * 13 / stat.boatSpeed() + stat.fishTime() + 3;
  const fishRate = stat.fleetCap() / trip;
  const haulTrip = 2 * 20 / stat.workerSpeed() + 2 * stat.loadTime();
  const haul = (S.workers * stat.carry() + S.forklifts * 14) / haulTrip / 2 + S.trucks * 24 / 25;  // legs share the haulers
  const demand = 2 / stat.custEvery();
  let flow = Math.min(fishRate, haul, demand);
  if (S.tier.factory) {
    const can = Math.min(flow, stat.canRate()), fil = Math.min(flow - can, stat.facRate());
    return can * stat.canPrice() + fil * stat.prodPrice();
  }
  return flow * stat.rawPrice();
}

export function stage() {
  if (G.S.tier.farm) return 3;
  if (G.S.tier.factory) return 2;
  return 1;
}

// ---- missions / achievements ---------------------------------------------
export function metric(k) {
  const S = G.S;
  if (k.startsWith('up.')) { const [, b, t] = k.split('.'); return S.up[b][t]; }
  if (k.startsWith('tier.')) return S.tier[k.slice(5)];
  if (k === 'workers') return S.workers;
  if (k === 'boats') return S.boats;
  if (k === 'trucks') return S.trucks;
  if (k === 'forklifts') return S.forklifts;
  if (k === 'bestBoat') return Math.max(0, ...S.boatTypes.slice(0, S.boats));
  if (k === 'level') return S.level;
  return S.stats[k] || 0;
}
export function currentMission() {
  const m = MISSIONS[G.S.mission];
  if (!m) return null;
  const v = metric(m.k);
  return { ...m, v: Math.min(v, m.n), done: v >= m.n };
}
export function claimMission() {
  const m = currentMission();
  if (!m || !m.done) return false;
  reward(m.r); G.S.mission++;
  bus.emit('mission'); return true;
}
export function achState(a) {
  const claimed = G.S.ach[a.id] || 0;
  const step = a.steps[claimed];
  return { claimed, step, v: metric(a.id), ready: step !== undefined && metric(a.id) >= step, gems: ACH_GEMS[claimed] };
}
export function claimAch(a) {
  const st = achState(a);
  if (!st.ready) return false;
  G.S.ach[a.id] = st.claimed + 1; addGems(st.gems); bus.emit('ach'); return true;
}
export function anyAchReady() { return ACHIEVEMENTS.some(a => achState(a).ready); }

// ---- research --------------------------------------------------------------
export function researchNode(id) { return RESEARCH.find(r => r.id === id); }
export function startResearch(id) {
  const S = G.S, r = researchNode(id), lv = S.research.lv[id] || 0;
  if (S.research.active || lv >= r.cost.length || !spend(r.cost[lv])) return false;
  S.research.active = { id, ends: Date.now() + r.time[lv] * 1000, total: r.time[lv] };
  bus.emit('research'); return true;
}
export function finishResearchIfDone(force) {
  const S = G.S, a = S.research.active;
  if (!a || (!force && Date.now() < a.ends)) return false;
  S.research.lv[a.id] = (S.research.lv[a.id] || 0) + 1;
  S.research.active = null; S.stats.research++;
  addXp(15);
  bus.emit('research', { done: a.id }); return true;
}
export function rushCost() {
  const a = G.S.research.active;
  return a ? Math.max(1, Math.ceil((a.ends - Date.now()) / 60000) * 3) : 0;
}
