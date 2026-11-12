# Graphics phase 2: boats. Test report

**Scope:** boats only (look, movement, docking, contact with the water). Untouched: the simulation (`src/sim/` has no changes), economy, missions, save/load, workers, cranes' look, buildings, the multi-sea system, the Stage 2 backup and Balıqçı Idle.

## Revision 2 (after review)

Two problems were fixed, and boats are now tested separately with no upgrades and with every upgrade at its maximum.

**1. In the slip before unloading, at every upgrade level.** The time at which the simulation will dock is now a hard deadline for the whole visual trip, computed from the simulation's own formulas.
- When a boat leaves, its speed is planned so that way out + nets + way home end **0.5 s before** the simulation docks.
- If the simulation's trip is shorter than a calm manoeuvre allows, the whole animation runs faster. Cruise and harbour speeds, the turn rate and the gear-change pause all scale together, up to 8× the normal speed share. The route itself does not change, so the clearance checks still hold.
- **Result:** in all 6 scenarios, including every harbour upgrade at 30 plus the speed research at its top level, the boat is in its slip **0.43–0.57 s before** unloading starts.
- **The cost:** at those extreme levels, where the simulation's whole trip lasts about 5–6 s, the boats move very fast: up to 19 tiles/s and about 350°/s in turns. This only happens when needed. With no upgrades, top speed is 3–5 tiles/s.

**2. The net at every fishing time.** Every trip now shows a net:
- paid out astern on two warps, with a float line and orange floats;
- towed;
- hauled back in, with the catch shining silver in the cod end.

The animation is scaled to the time available: 45 % of the simulation's fishing time, 0.9–2.5 s, never shorter than 0.7 s. Even with fishing at 0.7 s (nets upgraded to 30), every trip shows the net (0 trips without it).

**Fish jumps** now come from the net while it is hauled in, 5 per trip. The game's random splash event is no longer used for this. In the tests, every jump was at most 0.41 tiles from a net that was being hauled.

**Performance (High, 4 boats):**
- Boats off screen are no longer drawn: no sprites, shadows or lines.
- Fewer temporary objects per frame.
- The way home is estimated once and cached.
- Boats do their planning on different frames.

Average boat logic cost is about 0.2 ms per frame. Occasional 6–13 ms frames remain; they appear in the previous build as well and look like garbage collection.

**Simulation unchanged:**
- 1 boat over 10 minutes: every leg is identical to the build before phase 2, and the catch is 211 = 211.
- 4 boats: every boat's out / fishing / back legs are identical.
- In all 6 scenarios, the legs are the same with and without visual boats.

**Tests after the fixes (`tests/boat-sync.cjs`):**

| Scenario | Overlaps | Touching land / pier / decor | Closest gap (tiles) | In slip before unloading (s) | Net cast + haul (s, min / median) | Trips without the net | Fish jumps (farthest from the net, tiles) | Top speed (tiles/s) / turn (°/s) |
|---|---|---|---|---|---|---|---|---|
| 4 boats, no upgrades, 15 min | **0** | **0** | 0.249 | 0.50 … 0.57 | 0.7 / 2.07 | **0** | 445 (0.41) | 5.23 / 89.2 |
| 4 boats, engine 10 / nets 8 / hold 6, 10 min | **0** | **0** | 1.045 | 0.47 … 0.57 | 0.7 / 0.73 | **0** | 130 (0.39) | 6.05 / 111.2 |
| 1 boat, 5 min | **0** | **0** | – | 0.50 … 0.53 | 1.13 / 1.17 | **0** | 50 (0.41) | 3.05 / 57.2 |
| 1 boat, every harbour upgrade at 30, 5 min | **0** | **0** | – | 0.43 … 0.47 | 0.7 / 0.73 | **0** | 20 (0.41) | 14.54 / 247.2 |
| 4 boats, every harbour upgrade at 30, 6.7 min | **0** | **0** | 1.973 | 0.43 … 0.50 | 0.7 / 0.73 | **0** | 35 (0.41) | 14.54 / 280 |
| 4 boats, harbour upgrades at 30 + sea-charts and big-nets research at 3, 6.7 min | **0** | **0** | 2.77 | 0.43 … 0.50 | 0.7 / 0.73 | **0** | 35 (0.41) | 19.11 / 354.8 |

**Normal play (4 boats, no upgrades):** towing time is 2.1 s (median). The shortest, 0.7 s, happens when a boat had to wait for another one first.

## How it works

The simulation still moves every boat along its straight route with the same timings as before. A new visual layer (`src/render/boats.js`) draws each boat along realistic manoeuvres instead and plans its speed from the simulation's clock:

- it starts backing out when the simulation leaves the berth;
- it is back in its slip just before the simulation starts unloading.

Trip time, catch and income therefore cannot change: the visual layer only reads the simulation.

**One trip:**

1. **Moored.** Bow line to a bollard on the quay, stern line to a bollard on the pier.
2. **Cast off.** The lines go slack and are pulled back on board; prop wash appears at the stern.
3. **Back out of the slip.** The boat reverses, the stern swings out, it stops (a short pause for the gearbox), then goes ahead.
4. **At sea.** Smooth curves, never tighter than 2.8 tiles radius. The boat speeds up and slows down gradually and slows before bends.
5. **Fishing.** It tows the nets slowly between buoys, then lies still; fish jump around it.
6. **Coming home.** It lines up with its slip and glides straight in, braking gently.
7. **Arriving.** A small surge forward that the lines take back; lines are thrown to the bollards and tightened.

**Keeping boats apart:** each boat predicts the next 4.5 s (7 s before leaving the slip). The boat with less right of way waits at the berth or stops at sea until the way is clear. Right of way: a boat gliding in, then a boat coming home, then a boat fishing, then a boat leaving.

## What changed

| Requirement | Done |
|---|---|
| 8 → 16 directions | **32 directions** (11.25° steps) for working boats, so turns show no steps. The nearest direction is drawn, never a blend of two, which looked doubled. Decorative boats keep 8. |
| Gradual speed and natural turns | The speed planner has acceleration, braking ahead of stops and bends, and a turn-rate limit (57°/s with the starting engine). Turns at sea have a radius of at least 2.8 tiles; backing out uses 2.5. |
| Rocking with the waves, leaning in turns | Heave, pitch and roll come from the same two swells as the High water shader, measured under bow, stern and both sides. The boat heels out of a turn in proportion to speed × turn rate and lifts its bow when accelerating. All motion is smoothed. |
| Realistic docking | Slow straight glide → stop → small surge → lines thrown and made fast. When leaving: lines let go → back out → stop → ahead. |
| Hull–water contact, shadow, reflection | A contact shadow on the water (sun from the upper left), a wet rim, water lapping over the near side of the hull at the waterline, a bow wave whose arms grow with speed, and prop wash (behind the stern going ahead, along the hull going astern, extra when changing gear). The reflection is **baked**: a mirrored 3D render, faded with depth, tinted to the sea and blurred, swaying opposite to the boat. |
| V-wake with the new motion | The Kelvin wake now starts from the visual boat's stern and follows its real heading and speed. Going astern leaves no V, only prop wash. |
| Materials and details | Semi-gloss paint, metal parts, rub rail, deck planks, portholes with rims and rust streaks, registration number (AZ-011), navigation lights (red/green), searchlight, horn, antennas, mast light, rope coils, mooring cleats, floats on the gantry, tyre fenders. The isometric style is unchanged. |
| Harbour details | 8 bollards (quay and piers) and mooring lines. One decorative boat that sat in berth 3's approach was moved. Fishing-ground buoys now flank where the boats actually fish. |
| Cranes | Only the crane at a boat's own berth moves, and only once that boat is moored. Before, boats 3 and 4 moved the cranes of berths 1 and 2. |

**Presets:**

| | High | Medium | Low |
|---|---|---|---|
| Directions | 32 | 32 | 32 |
| Baked reflection | ✓ | ✓ | – |
| Shadow | ✓ | ✓ | ✓ |
| Wet rim | ✓ always | ✓ when moving | – |
| Waterline lapping | ✓ | ✓ | – |
| Bow wave | wide + bright | bright | bright |
| Prop wash | 3 patches | 2 patches | 2 patches |
| Heave / pitch / roll / heel | ✓ | ✓ | ✓ |
| Mooring lines | two-tone | two-tone | thin |

## Trip time, catch and income: unchanged

- **`tests/boat-timeline.cjs`** runs the simulation alone with seeded random and compares against the build from before this phase (`test-results/boat-timeline-before.json` vs `boats/boat-timeline-after.json`):
  - 1 boat, 10 minutes: every leg is identical (out 8.4 s, fishing 6.05 s, back 10.6 s, dock 3.7 s), and the catch is **211 = 211**. The whole timeline is shifted by a constant 0.3 s, which comes from the real-time start-up frames before the test pauses the game.
  - 4 boats: every boat's out / fishing / back legs are identical.
- **`tests/boat-sync.cjs`** runs the game for 5–15 minutes with and without the visual boats. In all 4 scenarios every leg duration is identical, and so is the catch (921 = 921, 729 = 729, 101 = 101, 701 = 701).
  - Money differs by about 1 % even between two runs *without* visual boats. It depends on the start-up frames and wall-clock timers (measured: two plain runs gave 881 and 901 fish over 900 s), not on the boats.

## Sync with the simulation and safety: first version (`tests/boat-sync.cjs`, stepped at 30 FPS)

| Scenario | Hull overlaps | Touching land / pier / decor | Closest gap (tiles) | Arrival vs. unloading start (s) | Towing (median s) | Waits (s) |
|---|---|---|---|---|---|---|
| 4 boats, no upgrades, 15 min | **0** | **0** | 0.24 | −0.20 … −0.10 (early) | 2.1 | 13.1 |
| 4 boats, engine 10 / nets 8 / hold 6, 10 min | **0** | **0** | 0.42 | −0.17 … +0.40 | — (fishing lasts 3.4 s) | 1.0 |
| 1 boat, 5 min | **0** | **0** | – | −0.20 | 1.2 | 0 |
| 4 boats, every harbour upgrade at 30, 6.7 min | **0** | **0** | 1.80 | +1.5 … +3.5 (late) | — | 0 |

- The boat starts backing out 0.53 s before the simulation leaves.
- Largest speed: 3.05 tiles/s with the starting engine (the old boats moved at 1.9). Largest turn rate: 58°/s.
- *(First version. The limitation that stood here, boats arriving late with maxed upgrades and no towing with short fishing, is fixed in Revision 2 above.)*

**Static check (`tests/boat-check.cjs`):**
- For all 4 berths, nothing touches land, piers, the quay, moored or decorative boats, or buoys:
  - the back-out manoeuvre (2.9–4.7 tiles) and the way out (10.9–15.0 tiles);
  - towing (2.5 tiles);
  - the way home from every point of the tow and from every point where a boat can be called home early (29–68 starting points per berth).
- No route crosses a neighbour's fishing spot or a neighbour's final approach.
- No turn is tighter than 2.8 tiles.
- Tools that found the manoeuvres: `tools/boats/search.mjs` (back-out) and `tools/boats/grounds.mjs` (fishing spots).

## Performance: before phase 2 / after revision 2

Script: `tests/bench.cjs`. Headless Chromium with a software GPU, 844×390 at DPR 2.75, 5 s per scene. Scenes:
- **fit**: the opening view;
- **harbour**: the quay up close;
- **fleet** (new): 4 boats, the harbour after 20 game seconds.

| Preset/scene | FPS | Frame time p90 (ms) | Update (ms) | Textures (MB) | JS heap (MB) |
|---|---|---|---|---|---|
| low/fit | 60.1 → **60.1** | 16.7 → 16.7 | 0.21 → 0.31 | 35.7 → 37.5 | 39.5 → 41.7 |
| low/harbour | 60.1 → **60.1** | 16.7 → 16.7 | 0.24 → 0.27 | 35.7 → 37.5 | 39.7 → 44.2 |
| low/fleet | 28.9 → **25.1** | 66.7 → 83.4 | 0.17 → 0.3 | 35.7 → 37.5 | 42.9 → 45.3 |
| medium/fit | 14.3 → **14.5** | 133.3 → 116.7 | 0.33 → 0.64 | 89.2 → 96.6 | 55.1 → 57.4 |
| medium/harbour | 15.3 → **14.8** | 116.7 → 116.7 | 0.4 → 0.7 | 89.2 → 96.6 | 53.2 → 56.1 |
| medium/fleet | 13.7 → **12.6** | 133.3 → 149.9 | 0.42 → 0.64 | 89.2 → 96.6 | 55.4 → 63 |
| high/fit | 12.9 → **12.5** | 133.3 → 149.9 | 0.5 → 0.7 | 91.5 → 98.9 | 54.4 → 59.1 |
| high/harbour | 12.7 → **11.1** | 133.4 → 150 | 0.33 → 0.61 | 91.5 → 98.9 | 56 → 57.7 |
| high/fleet | 10.4 → **10.1** | 150 → 130.1 | 0.36 → 0.54 | 91.5 → 98.9 | 57.1 → 62.4 |

**Reading the numbers:**
- Between runs of the same build this software renderer varies by ±10–15 %. Repeated fleet runs:
  - Low: old 20.9 / 21.7 vs new 24.1 / 25.1 FPS;
  - Medium: old 12.8 / 12.3 vs new 12.2 / 12.5 FPS;
  - High: old 11.4 / 11.0 vs new 9.1 / 10.5 FPS.
- Medium and Low are unchanged within noise. High is about 5–10 % slower with 4 boats on screen (reflections, wet rim, wide bow waves).
- **Texture memory:** +1.8 MB on Low (the atlas is halved there) and +7.4 MB on Medium and High. This covers 32 directions, baked reflections and the low-resolution page for decorative boats. Building atlases are byte-for-byte unchanged.
- **Boat logic:** about 0.2–0.3 ms per frame (speed planning twice a second per boat, the wait check five times a second).

## Tests

- **Browser suite (`tests/run-tests.cjs`), revision 2:** **15/15** in the latest run (`boats/browser-tests.json`):
  - layout on 12 screen sizes;
  - double tap 10/10 on Low and 4/10 on High (High is the known headless limitation from `TEST-REPORT.md`);
  - real play → close → reopen with all 13 fields equal;
  - old-save compatibility, offline earnings, corrupt save, simulation and presets.

  **Flaky:** on **High**, the check "a quick double tap on a building keeps its panel open" failed in 2 of 3 runs. It sends two taps 120 ms apart while this software renderer needs about 100 ms per frame on High. Low passes every time. Like the High double tap, it needs checking on a real phone.
- **Android 14 emulator (CI, Pixel 6, software GPU), first version** (revision 2 results are added after its CI run):
  - every UI and touch step passed;
  - real play → force-stop → reopen: all 13 fields equal;
  - 0 crashes.
  - Medium: `water mode=layers`, emulator FPS 10.9, textures 96.6 MB.
    - Boat log: `arrivals=1 lagMean=-0.18`, so the boat was in its slip 0.18 s before unloading started.
  - High: `water mode=shader`, FPS 8.3, textures 98.9 MB.
    - The boat log ends with the boat settling in its slip: `arrivals=1 lagMean=-0.47`.
  - Memory: total PSS 103 MB (the water phase measured 118–122 MB at a similar point).
  - The emulator's FPS comes from a software GPU and does not indicate phone speed. Water phase for comparison: Medium 11.2–12.6, High 8.0–8.8.
  - The new APK is `apk/FishingTycoon.apk` (commit `db75685`), and the emulator files are in `test-results/android/`.
- **Real phone: not tested.** On a real phone, check:
  - FPS on High with 4 boats;
  - how the docking and leaving look;
  - whether the rocking is too much or too little;
  - whether the lines and wakes are readable at normal zoom.

## Files

- **Screenshots:** `test-results/boats/` (`high-*`, `medium-*`, `low-*`, `compare-presets-*`)
- **Motion:**
  - `test-results/boats/boats-motion.gif` (420 px, 23 s, no upgrades: leaving the slip, the net cast and hauled with fish jumping, coming home and making fast) and `boats-motion.mp4`;
  - `boats-maxed.gif` and `boats-maxed.mp4` (every harbour upgrade at 30: a whole trip in about 7 s, in the slip before unloading).
- **Net animation:** `net-sequence.jpg`, `high-net-*.jpg` and `net-medium-low.jpg`
- **Benchmarks:** `test-results/boats/bench-before.json` and `bench-after.json`
- **Boat checks:** `test-results/boat-check.json` and `test-results/boat-sync.json`
- **Code:**
  - `src/render/boats.js` (visual boats);
  - `src/render/boatpaths.js` (manoeuvre geometry);
  - `tools/bake/units.js` (boat model);
  - `tools/bake/render.js` (baked reflections)
