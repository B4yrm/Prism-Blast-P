// Game content: building info, upgrade tracks, missions, achievements,
// research, shop. All balance numbers live here.

export const BINFO = {
  harbor:    { name: 'Balıqçı Limanı', icon: 'b_harbor', desc: 'Qayıqlar dənizə çıxır, balıq tutub iskələyə boşaldır.' },
  warehouse: { name: 'Anbar', icon: 'b_warehouse', desc: 'Tutulan balıq burada saxlanır. Dolarsa, iskələ də dolur.' },
  factory:   { name: 'Balıq Emalı Zavodu', icon: 'b_factory', desc: 'Anbardan konveyerlə gələn balığı qablaşdırılmış məhsula çevirir.' },
  market:    { name: 'Balıq Bazarı', icon: 'b_market', desc: 'Müştərilər gəlib balıq və məhsul alır. Pul kassaya yığılır.' },
  hq:        { name: 'Baş Ofis', icon: 'b_hq', desc: 'İşçilərin bazası. Tədqiqat və təlim burada aparılır.' },
  farm:      { name: 'Balıq Ferması', icon: 'b_farm', desc: 'Akvakultura hovuzları. Mərhələ 3-də açılır.' },
};

// Each track: max level = 10 × building tier.
export const TRACKS = {
  harbor: [
    { id: 'cap',   name: 'Qayıq tutumu',   icon: 'basket', base: 30,  g: 1.19, fx: l => `${10 + 3 * l} balıq` },
    { id: 'speed', name: 'Mühərrik',       icon: 'gear', base: 45,  g: 1.2,  fx: l => `${Math.round(100 * (1 + 0.08 * l))}% sürət` },
    { id: 'net',   name: 'Torlar',         icon: 'net', base: 60,  g: 1.21, fx: l => `${(6 * Math.pow(0.93, l)).toFixed(1)} s tutma` },
  ],
  warehouse: [
    { id: 'cap',   name: 'Rəflər',         icon: 'box', base: 35,  g: 1.18, fx: l => `${40 + 30 * l} yer` },
    { id: 'load',  name: 'Yükləmə',        icon: 'shop', base: 50,  g: 1.2,  fx: l => `${(0.9 * Math.pow(0.9, l)).toFixed(2)} s` },
    { id: 'cold',  name: 'Soyuducu',       icon: 'snow', base: 80,  g: 1.22, fx: l => `+${5 * l}% təzə balıq qiyməti` },
  ],
  factory: [
    { id: 'speed', name: 'Emal xətti',     icon: 'gear', base: 120, g: 1.2,  fx: l => `${(0.6 * Math.pow(1.15, l)).toFixed(2)} /s` },
    { id: 'out',   name: 'Qablaşdırma',    icon: 'box', base: 100, g: 1.18, fx: l => `${30 + 20 * l} yer` },
    { id: 'qual',  name: 'Keyfiyyət',      icon: 'star', base: 160, g: 1.23, fx: l => `+${8 * l}% məhsul qiyməti` },
  ],
  market: [
    { id: 'price', name: 'Qiymətlər',      icon: 'tag', base: 40,  g: 1.2,  fx: l => `+${10 * l}% qiymət` },
    { id: 'ads',   name: 'Reklam',         icon: 'mega', base: 55,  g: 1.2,  fx: l => `+${12 * l}% müştəri` },
    { id: 'till',  name: 'Kassa',          icon: 'coin', base: 45,  g: 1.19, fx: l => `${fmt(400 * Math.pow(1.4, l))} tutum` },
  ],
  hq: [
    { id: 'train', name: 'Təlim',          icon: 'bolt', base: 50,  g: 1.2,  fx: l => `+${8 * l}% işçi sürəti` },
    { id: 'carry', name: 'Arabalar',       icon: 'shop', base: 70,  g: 1.22, fx: l => `${6 + l} qutu daşıyır` },
  ],
  farm: [],
};

// Building tier (Lv) expansion: cost and player-level requirement for tiers 2 and 3.
export const TIER = {
  harbor:    { cost: [0, 0, 2500, 40000], lvl: [0, 0, 4, 9] },
  warehouse: { cost: [0, 0, 1800, 30000], lvl: [0, 0, 3, 8] },
  factory:   { cost: [0, 900, 6000, 60000], lvl: [0, 3, 6, 10] },
  market:    { cost: [0, 0, 1500, 25000], lvl: [0, 0, 3, 8] },
  hq:        { cost: [0, 0, 3000, 45000], lvl: [0, 0, 5, 10] },
  farm:      { cost: [0, 0, 0, 0], lvl: [0, 99, 99, 99] },
};

export const MAX_WORKERS = [0, 3, 6, 10];   // by HQ tier
export const MAX_BOATS = [0, 1, 2, 4];      // by harbor tier
export const BOAT_COST = [0, 0, 1200, 9000, 60000];
export const workerCost = n => Math.round(60 * Math.pow(2.3, n - 1));

export const RESEARCH = [
  { id: 'nav',   name: 'Dəniz xəritələri', icon: 'compass', desc: '+10% qayıq sürəti',      cost: [400, 3500, 28000], time: [30, 120, 300] },
  { id: 'nets',  name: 'Böyük torlar',     icon: 'net', desc: '+15% qayıq tutumu',      cost: [600, 5000, 40000], time: [40, 150, 360] },
  { id: 'ergo',  name: 'Erqonomika',       icon: 'workers', desc: '+10% işçi sürəti',       cost: [500, 4000, 32000], time: [30, 120, 300] },
  { id: 'brand', name: 'Premium brend',    icon: 'gem', desc: '+10% bütün qiymətlər',   cost: [900, 7000, 55000], time: [45, 180, 420] },
  { id: 'mkt',   name: 'Marketinq',        icon: 'mega', desc: '+15% müştəri axını',     cost: [700, 6000, 45000], time: [40, 150, 360] },
  { id: 'cash',  name: 'Kassir',           icon: 'coin', desc: 'Kassa avtomatik toplanır', cost: [2500], time: [90] },
  { id: 'night', name: 'Gecə növbəsi',     icon: 'moon', desc: '+2 saat oflayn limit',   cost: [1500, 12000], time: [60, 240] },
];

export const SHOP = [
  { id: 'boost',  name: 'Gəlir ×2',          icon: 'bolt', desc: '10 dəqiqə bütün satışlar ikiqat', gems: 15 },
  { id: 'warp',   name: 'Vaxt sıçrayışı',     icon: 'ff', desc: 'Dərhal 1 saatlıq gəlir',          gems: 40 },
  { id: 'purse',  name: 'Pul kisəsi',         icon: 'coin', desc: 'Dərhal 20 dəqiqəlik gəlir',        gems: 15 },
];
export const FREE_CHEST_EVERY = 4 * 3600 * 1000;

// Missions are a guided sequence; one active at a time.
export const MISSIONS = [
  { t: 'Balıq tut',                   k: 'caught',   n: 20,    r: { c: 50 } },
  { t: 'Qayıq tutumunu artır',        k: 'up.harbor.cap', n: 1, r: { c: 60, g: 5 } },
  { t: 'Kassanı topla',               k: 'collected', n: 100,  r: { g: 5 } },
  { t: 'İkinci işçini götür',         k: 'workers',  n: 2,     r: { c: 120 } },
  { t: 'Bazar qiymətləri Lv 3',       k: 'up.market.price', n: 3, r: { c: 150, g: 5 } },
  { t: '200 balıq sat',               k: 'sold',     n: 200,   r: { c: 250 } },
  { t: 'Anbar rəfləri Lv 3',          k: 'up.warehouse.cap', n: 3, r: { g: 8 } },
  { t: 'Oyunçu səviyyəsi 3',          k: 'level',    n: 3,     r: { g: 10 } },
  { t: 'Emal zavodunu tik',           k: 'tier.factory', n: 1, r: { c: 500, g: 20 } },
  { t: '300 məhsul sat',              k: 'soldProd', n: 300,   r: { c: 1000, g: 10 } },
  { t: '3 işçi saxla',                k: 'workers',  n: 3,     r: { g: 10 } },
  { t: 'Limanı Lv 2-yə genişləndir',  k: 'tier.harbor', n: 2,  r: { g: 15 } },
  { t: 'İkinci qayığı al',            k: 'boats',    n: 2,     r: { c: 3000, g: 15 } },
  { t: 'Tədqiqat apar',               k: 'research', n: 1,     r: { g: 10 } },
  { t: 'Ümumi qazanc $25K',           k: 'earned',   n: 25000, r: { g: 25 } },
  { t: 'Zavodu Lv 2-yə genişləndir',  k: 'tier.factory', n: 2, r: { g: 20 } },
  { t: 'Oyunçu səviyyəsi 8',          k: 'level',    n: 8,     r: { g: 30 } },
  { t: 'Ümumi qazanc $250K',          k: 'earned',   n: 250000, r: { g: 40 } },
];

export const ACHIEVEMENTS = [
  { id: 'caught', name: 'Balıqçı',     icon: 'fish', steps: [100, 1000, 10000, 100000] },
  { id: 'sold',   name: 'Satıcı',      icon: 'tag', steps: [100, 1000, 10000, 100000] },
  { id: 'earned', name: 'Milyonçu',    icon: 'coin', steps: [1000, 100000, 1e6, 1e7] },
  { id: 'workers',name: 'Komanda',     icon: 'workers', steps: [3, 6, 10] },
  { id: 'boats',  name: 'Donanma',     icon: 'boats', steps: [2, 3, 4] },
  { id: 'level',  name: 'Təcrübə',     icon: 'star', steps: [5, 10, 20, 30] },
];
export const ACH_GEMS = [5, 10, 20, 40];

export const DAILY = [
  { c: 200 }, { g: 5 }, { c: 600 }, { g: 10 }, { c: 1500 }, { g: 15 }, { g: 30, c: 3000 },
];

export const STAGES = [
  { n: 1, name: 'Kiçik balıqçı kəndi', desc: '1 qayıq, kiçik bazar, sadə anbar.' },
  { n: 2, name: 'Böyüyən liman',       desc: 'Emal zavodu, bir neçə qayıq, daha çox işçi.' },
  { n: 3, name: 'Balıqçılıq imperiyası', desc: 'Ferma, böyük zavodlar, avtomatik logistika. Növbəti yeniləmədə.' },
];

export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return '' + n;
  const u = ['K', 'M', 'B', 'T', 'Qa'];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n)) + u[i];
}
