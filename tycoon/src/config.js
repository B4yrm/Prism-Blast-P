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
export const BOUNDS = { x0: -12, y0: -12, x1: 54, y1: 44 };

export function isLand(i, j) {
  if (i < -12 || j < -12) return true;
  // south-west harbour coast: straight quay x 4..23, wobbly elsewhere
  let coastY = 29;
  if (i < 3 || i > 23) coastY = 29 + Math.round(Math.sin(i * 0.7) * 0.8 + hash(i, 7) * 0.6 - 0.3);
  if (i > 38) coastY = 28 + Math.round(Math.sin(i * 0.5));
  // east coast with a cape for the lighthouse
  let coastX = 50 + Math.round(Math.sin(j * 0.6) * 0.8 + hash(3, j) * 0.6 - 0.3);
  if (j >= 22 && j <= 28) coastX = 52;
  return j < coastY && i < coastX;
}

// ---- roads, pavements ------------------------------------------------------
// rects: [x0, y0, x1, y1] inclusive tile ranges
export const ROADS = [
  [1, 13, 49, 14],   // north avenue (tunnel on the west)
  [4, 26, 47, 27],   // harbour road
  [4, 13, 5, 27],    // west street
  [23, 13, 24, 27],  // central street
  [37, 13, 38, 27],  // east street
];
export const PAVE = [
  [7, 11, 15, 12],   // HQ plaza
  [25, 12, 36, 12],  // factory front
  [13, 24, 22, 25],  // market front
  [26, 25, 36, 25],  // warehouse front
  [39, 12, 47, 12],  // farm front
  [6, 25, 11, 25],   // harbour office
  [5, 28, 23, 28],   // quay (land row)
];
// Wooden piers over water: quay strip + finger piers.
export const PIERS = [
  [5, 29, 23, 29],
  [9, 30, 10, 35],
  [16, 30, 17, 35],
];

export const BUILDINGS = {
  hq:        { x: 7,  y: 3,  w: 8, d: 7, door: [11, 11] },
  factory:   { x: 26, y: 3,  w: 9, d: 8, door: [28, 12] },
  farm:      { x: 40, y: 3,  w: 8, d: 8, door: [43, 12] },
  market:    { x: 14, y: 17, w: 8, d: 6, door: [18, 24] },
  warehouse: { x: 27, y: 17, w: 9, d: 7, door: [30, 25] },
  harbor:    { x: 6,  y: 20, w: 5, d: 4, door: [8, 25] },
};

// Points of interest used by the simulation (tile coords, walkable).
export const POI = {
  quay: [14, 28],        // where boats drop the catch and haulers pick up
  spawn: [1, 13],        // tunnel mouth: customers come and go here
  rest: [11, 11],        // idle haulers wait at the HQ
  queue: [[19, 24], [20, 24], [21, 24], [21, 25], [20, 25], [19, 25]],
};

// Conveyor from warehouse up to the factory, elevated over the avenue.
export const CONVEYOR = { x: 31.5, y0: 17, y1: 11, z: 30 };

// Boat berths and their sailing routes out to the fishing grounds.
export const BERTHS = [
  { at: [12.2, 32.5], route: [[12.2, 38], [8, 43], [3, 47]] },
  { at: [19.2, 32.5], route: [[19.5, 38], [23, 43], [27, 47]] },
  { at: [7.0, 33.5], route: [[6.5, 39], [-1, 42], [-5, 45]] },
  { at: [22.6, 32.0], route: [[25, 36], [31, 40], [35, 44]] },
];

export const CRANES = [[12, 29], [18, 29]];
export const LIGHTHOUSE = [50.5, 24.5];
