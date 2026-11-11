// World layout and projection. Grid units are tiles; the island sits in
// roughly x 0..48, y 0..28 with the sea to the south-west (+y) and east (+x).

export const TW = 64, TH = 32;   // iso tile size in world px
export const SEA_Z = -18;        // water surface sits below the land plateau

export function iso(x, y, z = 0) {
  return { x: (x - y) * TW / 2, y: (x + y) * TH / 2 - z };
}
export function unIso(sx, sy) {
  const a = sx / (TW / 2), b = sy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// Deterministic hash noise so the map looks the same every launch.
export function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ---- terrain -------------------------------------------------------------
// Compact layout: the whole company fits in about 36×23 tiles, like the
// reference. Forest continues north/west, sea lies south-west and east.
export const BOUNDS = { x0: -10, y0: -10, x1: 46, y1: 38 };

export function isLand(i, j) {
  if (i < -10 || j < -10) return true;
  let coastY = 23;                                     // harbour quay row is y = 22
  if (i < 1) coastY = 22 + Math.round(Math.sin(i * 0.8) * 0.7 + hash(i, 7) * 0.6);
  if (i > 23) coastY = 22 + Math.round(Math.sin(i * 0.6) * 0.6);
  let coastX = 36 + Math.round(Math.sin(j * 0.7) * 0.6 + hash(3, j) * 0.6 - 0.3);
  if (j >= 13 && j <= 18) coastX = 39;                // lighthouse cape
  return j < coastY && i < coastX;
}

// ---- roads, pavements ------------------------------------------------------
// rects: [x0, y0, x1, y1] inclusive tile ranges; roads are one Kenney tile wide.
export const ROADS = [
  [0, 10, 35, 10],    // north avenue (tunnel on the west)
  [2, 21, 35, 21],    // harbour road
  [2, 10, 2, 21],     // west street
  [14, 10, 14, 21],   // central street
  [25, 10, 25, 21],   // east street
];
export const PAVE = [
  [1, 9, 13, 9],      // HQ front
  [15, 9, 24, 9],     // factory front
  [26, 9, 34, 9],     // farm front
  [3, 19, 13, 20],    // market front & queue
  [15, 19, 24, 20],   // warehouse front
  [26, 19, 34, 20],   // parking strip
  [3, 22, 22, 22],    // quay (land row)
];
// Wooden piers over water: quay strip + finger piers.
export const PIERS = [
  [2, 23, 22, 23],
  [6, 24, 7, 29],
  [13, 24, 14, 29],
  [20, 24, 20, 27],
];

export const BUILDINGS = {
  hq:        { x: 2,  y: 1,  w: 8, d: 8, door: [6, 9] },
  factory:   { x: 15, y: 1,  w: 9, d: 8, door: [17, 9] },
  farm:      { x: 26, y: 1,  w: 9, d: 8, door: [30, 9] },
  market:    { x: 6,  y: 11, w: 8, d: 8, door: [10, 19] },
  warehouse: { x: 15, y: 11, w: 10, d: 8, door: [19, 19] },
  harbor:    { x: 3,  y: 14, w: 3, d: 5, door: [4, 19] },
};

// Points of interest used by the simulation (tile coords, walkable).
export const POI = {
  quay: [10, 22],        // where boats drop the catch and haulers pick up
  spawn: [0, 10],        // tunnel mouth: customers come and go here
  rest: [6, 9],          // idle haulers wait at the HQ
  queue: [[11, 19], [12, 19], [13, 19], [13, 20], [12, 20], [11, 20]],
};

// Conveyor from warehouse up to the factory, elevated over the avenue.
export const CONVEYOR = { x: 21.5, y0: 11, y1: 9, z: 0.75 };

// Boat berths and their sailing routes out to the fishing grounds.
export const BERTHS = [
  { at: [9.6, 26.5], route: [[9.6, 31], [6, 35], [2, 38]] },
  { at: [16.6, 26.5], route: [[16.6, 31], [20, 35], [24, 38]] },
  { at: [4.3, 27.0], route: [[4.3, 31], [-2, 34], [-6, 37]] },
  { at: [22.6, 26.0], route: [[24, 30], [29, 33], [33, 36]] },
];

export const CRANES = [[9, 23], [16, 23]];
export const LIGHTHOUSE = [37.5, 15.5];

// Background town (Kenney CC0 houses) and dense decoration.
export const DECOR = {
  houses: [
    ['a', 27, 12, 0], ['b', 29, 12, 1], ['c', 31, 12, 0], ['d', 33, 12, 1],
    ['c', 27, 15, 1], ['garage', 30, 15, 0], ['a', 33, 15, 0],
  ],
  lots: [[26, 17, 34, 18]],       // parking rows
  parks: [[3, 11, 5, 13]],
};
