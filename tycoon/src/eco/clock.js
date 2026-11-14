// Game clock of the eco layer (GDD §2, approved scale assumption Q4):
// 1 game hour = 60 s of simulation time, 1 game day = 24 game hours,
// 1 season = 7 game days, 1 year = 4 seasons.
//
// The clock runs on the simulation's own time step (the dt that Sim.update
// receives), never on frames or the wall clock, so the number of whole game
// hours after a given amount of simulation time is the same at any frame rate.
// Pure functions over a plain object; nothing here allocates per call.

export const HOUR_SEC = 60;
export const DAY_H = 24;
export const SEASON_D = 7;
export const YEAR_SEASONS = 4;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
// Steps such as 1/30 s do not add up exactly in floating point (1800 × 1/30 is a hair below 60), so an
// hour is complete once it is within EPS of HOUR_SEC; otherwise the hour count would depend on the frame rate.
const EPS = 1e-6;

export function createClock() {
  return { acc: 0, hours: 0 };   // acc: simulation seconds not yet turned into a whole hour
}

// Advances the clock by dt simulation seconds. Calls onHour(hourIndex) once
// for each whole game hour completed and returns how many were completed.
// A dt that is not a finite positive number is ignored.
export function advance(clock, dt, onHour) {
  if (!(dt > 0) || dt === Infinity) return 0;
  clock.acc += dt;
  let n = 0;
  while (clock.acc >= HOUR_SEC - EPS) {
    clock.acc = Math.max(0, clock.acc - HOUR_SEC);
    clock.hours++;
    n++;
    if (onHour) onHour(clock.hours);
  }
  return n;
}

export const hourOfDay = hours => hours % DAY_H;
export const dayOf = hours => Math.floor(hours / DAY_H);
export const seasonIndex = hours => Math.floor(dayOf(hours) / SEASON_D) % YEAR_SEASONS;
export const seasonOf = hours => SEASONS[seasonIndex(hours)];
export const yearOf = hours => Math.floor(dayOf(hours) / (SEASON_D * YEAR_SEASONS));
