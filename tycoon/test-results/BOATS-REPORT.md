# Graphics phase 2: boats. Test report

**Scope:** boats only (look, movement, docking, contact with the water). Untouched: the simulation (`src/sim/` has no changes), economy, missions, save/load, workers, cranes' look, buildings, the multi-sea system, the Stage 2 backup and Balıqçı Idle.

## Revision 4: outer jetties (variant A)

**Goal.** Boats leave the harbour, cast a net and come back at every level, instead of the harbour trip of revision 3.

**What the player sees**
- **Start and mid levels:** the existing slips and the full route to the fishing grounds, as before.
- **Nets ≥ 18 and engine ≥ 14:** two outer jetties are built next to the harbour: piles, then the deck laid from the shore, then bollards and fenders, about 7 s, with dust. No new currency or payment; it is tied to the existing upgrades. Each boat then moves to its own outer berth once, after its next trip; there is no teleport.
- **From the outer berths:** each boat backs out, sails into its **own sector**, tows its net through a 180° turn for home and comes back alongside the jetty. Forklift carts carry crates from the jetties to the quay while the simulation unloads that boat. The carts are visual only.
- **The very top only** (for example 30/30, or 30/30 with the sea-charts research): when even the sector trip cannot be made in the simulation's time at up to 3× pace, the boat makes a **jetty-head trip**. It backs straight out of its outer berth until the whole hull is 0.6 tiles past the jetty head, in open water, casts and hauls the net, then glides back in.

**Precomputed routes (no searching in the game).**
- `tools/boats/zones.mjs` searches the sectors once, at development time, on a 0.1-tile occupancy grid. It now picks the set of zones whose **longest** trip is shortest (branch and bound), with a 15-minute hard limit. This run took 3 min 49 s, with 7,733 tries in the final step.
- The result is written to `src/render/boatzones.js` and the game only reads it. At run time the only computation is the Dubins route home from the end of the turn: a few arcs, once per trip.
- The fleet-wide step is cached and is recomputed only when the engine, the nets or the jetties change.
- Zone lengths (way out + net turn + way home, in tiles): 21.6 / 22.1 / 22.2 / 32.8. Boat 1 went from 33.6 to 22.1 with the new search. Boat 3, on the east side of the east jetty, cannot go below 30.8: that is its shortest clear zone.

**Honest findings**
- A closed trip that leaves a berth and returns to it needs about 360° of turning, so it is never shorter than about 20 tiles, wherever the zone is. "Nearer zones" off the slips save almost nothing. No clear set of them exists either: they cross the neighbours' lanes. So mid levels keep the full route at a higher pace.
- At high levels the trip still has to fit the simulation's few seconds. Boats therefore sail faster than the "calm" pace (cruise share 1.6). This was already the case before revision 3 at mid levels, so it is not new.

| Level | Trip | Top speed (tiles/s) | × the simulation's cruise | Top turn (°/s) |
|---|---|---|---|---|
| Start, 4 boats | full fishing grounds | 5.4 | 2.85 | 91 |
| Mid (engine 6 / nets 3) | full fishing grounds | 6.8 | 2.4 | 115 |
| Mid+ (engine 10 / nets 8) | full fishing grounds (revision 3: harbour trip) | 6.1 | 1.77 | 109 |
| Engine 20 / nets 18 | outer sectors | 10.5 | 2.12 | 182 |
| Max 30/30 | outer sectors (boat 3: jetty-head) | 9.9–12.1 | 1.5–1.9 | 198–211 |
| 30/30 + sea charts 3 | jetty-head trip | 4.3 | 0.51 | 0 |

For comparison: revision 2 reached 19 tiles/s and 350°/s, and revision 3 (harbour trip) 4.8 tiles/s and 0°/s.

**Which trip, by level** (no research; the cruise share needed is in brackets):

| | Engine 0 | 10 | 14 | 18 | 22 | 30 |
|---|---|---|---|---|---|---|
| **Nets 0** | grounds (1.35–1.5) | grounds (1.7–1.85) | grounds (1.8–1.9) | grounds (1.85–1.95) | grounds (1.9–2.05) | grounds (2.05–2.1) |
| **Nets 10** | grounds (1.65–1.8) | grounds (2.15–2.3) | grounds (2.4–2.5) | grounds (2.55–2.75) | grounds (2.65–2.9) | harbour 3, grounds 1 |
| **Nets 14** | grounds (1.7–1.85) | grounds (2.3–2.4) | grounds (2.45–2.7) | grounds (2.7–3) | harbour 3, grounds 1 | harbour |
| **Nets 18** | grounds (1.75–1.9) | grounds (2.45–2.6) | **outer** (1.85–2.45) | outer (1.95–2.55) | outer (2.05–2.6) | outer (2.2–2.85) |
| **Nets 30** | grounds (1.85–2.05) | grounds 3, harbour 1 | **outer** (2.1–2.7) | outer (2.3–2.9) | outer 3, jetty-head 1 | outer 3, jetty-head 1 |

Rows are nets, columns are engine. With the sea-charts research at 3:

| sea charts 3 | Engine 0 | 10 | 14 | 18 | 22 | 30 |
|---|---|---|---|---|---|---|
| **Nets 0** | grounds (1.4–1.65) | grounds (1.85–1.95) | grounds (1.9–2) | grounds (2–2.1) | grounds (2.05–2.15) | grounds (2.1–2.2) |
| **Nets 10** | grounds (1.8–1.95) | grounds (2.5–2.7) | grounds (2.7–2.9) | harbour 3, grounds 1 | harbour | harbour |
| **Nets 14** | grounds (1.85–2.05) | grounds (2.65–2.9) | harbour 3, grounds 1 | harbour | harbour | harbour |
| **Nets 18** | grounds (1.95–2.15) | harbour 2, grounds 2 | **outer** (2.05–2.6) | outer (2.15–2.85) | outer (2.25–2.95) | outer 3, jetty-head 1 |
| **Nets 30** | grounds (2.15–2.4) | harbour | **outer 3, jetty-head 1** | outer 3, jetty-head 1 | outer 2, jetty-head 2 | jetty-head |

- With sea charts at 3, harbour trips start earlier: at engine 14 with nets 14.
- Known gap: a player who raises the engine far beyond 14 while the nets are still below 18 (or the reverse) gets harbour trips until the jetties unlock. The unlock thresholds are fixed by the approved plan, so they were not changed.

**Collisions and the new jetties**
- The jetties sit where no existing route runs. The full fishing grounds were searched again with the jetties present (`tools/boats/grounds.mjs`), and every existing route, departure, arrival, harbour trip and decorative boat passes the static check with them.
- Each boat's outer zone, its way out, way home, the first trip from the slip and the jetty-head trip are clear of land, the jetties, the other berths, decorative boats, buoys and the water where the other boats tow their nets.
- The zone search and `tests/boat-check.cjs` check the same things; the static check passed with 0 failures.

**Long runs (`tests/boat-sync.cjs`, stepped at 30 FPS, seeded)**

| Scenario | Length | Trips | Overlaps / land / decor contacts | In berth before unloading (s, max) | Slip → outer move (s) | Trips without net | Simulation unchanged |
|---|---|---|---|---|---|---|---|
| Start, 4 boats | 15 min | grounds 91 | **0 / 0 / 0** | −0.50 | – | **0** | yes |
| Start, 1 boat | 5 min | grounds 11 | **0 / 0 / 0** | −0.50 | – | **0** | yes |
| Mid, engine 6 / nets 3 | 15 min | grounds 41 | **0 / 0 / 0** | −0.40 | – | **0** | yes |
| Mid+, engine 10 / nets 8 | 10 min | grounds 26 | **0 / 0 / 0** | −0.47 | – | **0** | yes |
| Engine 20 / nets 18, jetties built during the run | 15 min | harbour 4 → outer 20 | **0 / 0 / 0** | −0.43 | −1.33 … −0.40 | **0** | yes |
| Max 30/30, jetties built during the run | 15 min | harbour 4 → outer 8 | **0 / 0 / 0** | −0.50 | −1.53 … **+0.73** | **0** | yes |
| Max 30/30, 1 boat | 5 min | outer 4 | **0 / 0 / 0** | −1.40 | – | **0** | yes |
| 30/30 + sea charts 3 | 15 min | jetty-head 8 | **0 / 0 / 0** | −0.47 | – | **0** | yes |

- **Arrivals:** every regular arrival was in its berth before the simulation started unloading (negative = early).
- **One exception:** the single move of one boat from its slip to its new outer berth at 30/30 came in 0.73 s after the simulation docked. This happens at most once per boat, only when the jetties open at levels far above the threshold, for example with an old save. The crane and the carts wait until the boat is moored, so no unloading is shown without the boat.
- **Fish jumps:** always within 0.42 tiles of the net.
- **Simulation:** every out, fishing and back leg lasts exactly as long as in a run without visual boats, in all 8 scenarios.
- **Timeline (`tests/boat-timeline.cjs`, simulation only, 10 min):** with 1 boat, every leg and the catch (211) are identical to the state before phase 2. With 4 boats the catch varies from run to run because the start-up frames run in real time: 651 and 681 now, 661 with revision 3, 711 before phase 2. The legs themselves match in the seeded `boat-sync` runs.

**Construction and saves (`tests/outer-save.cjs`)**
- Construction progress, once a second: 0.08, 0.22, 0.37, 0.51, 0.65, 0.79, 0.94, 1.
- `harborOuter = 1` is stored; after a reload the jetties are there at once, with no second construction, and the progress snapshot is unchanged.
- An old save without the field, below the threshold, loads without jetties and without errors.
- An old save above the threshold builds the jetties once.
- A failure during development came from the test's own seeding script (an init script that could restore the seed save on reload). It was not a game bug: the test now seeds the save in a separate page load.

**Browser suite (`tests/run-tests.cjs`):**
- First run: 14/15. The fail was double tap 6/10 on High; this timing-sensitive touch test also failed earlier when the machine was busy.
- Second run, alone: **15/15**, including save/load, save/load after real play, old saves and corrupt saves.

**Performance (`tests/bench.cjs`, revision 3 vs. now, mean of 2 runs each; headless Chromium with a software GPU, so compare rows with each other, not with phones).** The new scene `fleetmax` has 4 boats at 30/30 with the jetties built.

| Preset / scene | FPS before → after | Frame ms avg | Frame ms p90 | Update ms | Draw calls | Texture MB | JS heap MB |
|---|---|---|---|---|---|---|---|
| low/fit | 37.7 → 44.6 | 27.3 → 22.9 | 41.7 → 41.6 | 0.42 → 0.42 | 1.7 → 1.4 | 37.5 → 37.5 | 42.5 → 44.0 |
| low/harbour | 60.1 → 60.2 | 16.6 → 16.6 | 16.7 → 16.7 | 0.38 → 0.33 | 1.1 → 1.1 | 37.5 → 37.5 | 42.9 → 43.5 |
| low/fleet | 17.0 → 17.2 | 59.0 → 58.2 | 116.5 → 100.0 | 0.45 → 0.53 | 2.5 → 2.7 | 37.5 → 37.5 | 45.2 → 45.0 |
| low/fleetmax | 17.1 → 16.9 | 59.7 → 59.4 | 108.3 → 108.3 | 0.40 → 0.44 | 2.7 → 2.8 | 37.5 → 37.5 | 43.8 → 45.4 |
| medium/fit | 12.6 → 11.7 | 79.3 → 85.9 | 133.3 → 150.0 | 0.79 → 0.69 | 5.0 → 5.0 | 96.6 → 96.6 | 56.2 → 56.4 |
| medium/harbour | 12.2 → 11.7 | 82.8 → 85.6 | 141.7 → 158.3 | 0.89 → 0.73 | 5.0 → 5.0 | 96.6 → 96.6 | 55.4 → 56.0 |
| medium/fleet | 10.4 → 10.2 | 96.5 → 98.1 | 141.7 → 158.3 | 0.98 → 0.69 | 5.0 → 5.0 | 96.6 → 96.6 | 61.7 → 60.8 |
| medium/fleetmax | 9.8 → 10.2 | 102.8 → 97.8 | 183.3 → 166.6 | 0.50 → 0.57 | 5.0 → 5.0 | 96.6 → 96.6 | 57.5 → 58.1 |
| high/fit | 9.9 → 10.4 | 100.4 → 95.5 | 175.0 → 174.9 | 1.04 → 0.82 | 5.0 → 5.0 | 98.9 → 98.9 | 56.9 → 57.6 |
| high/harbour | 10.0 → 9.7 | 100.2 → 104.0 | 168.8 → 183.4 | 0.83 → 0.66 | 5.0 → 5.0 | 98.9 → 98.9 | 58.6 → 58.7 |
| high/fleet | 8.4 → 9.4 | 118.8 → 106.3 | 191.7 → 183.3 | 0.67 → 0.67 | 5.0 → 5.0 | 98.9 → 98.9 | 61.9 → 61.2 |
| high/fleetmax | 9.2 → 9.6 | 109.0 → 104.1 | 183.4 → 183.4 | 0.45 → 0.49 | 5.0 → 5.0 | 98.9 → 98.9 | 61.2 → 61.1 |

- **Texture memory:** unchanged. The jetties and carts are drawn with existing art and Graphics; there is no new atlas page.
- **Frame time:** all differences are within the run-to-run noise of this machine (±10 %).

**Not tested on a real phone.** All results above come from headless Chromium and from the Android emulator (CI). Smoothness, speed perception, FPS and touch on a real device have **not** been verified.

**Videos** (`test-results/outer/`):
- `outer-start.mp4`: start, full fishing grounds.
- `outer-mid.mp4`: mid levels.
- `outer-build.mp4` / `.gif`: the jetties being built.
- `outer-max.mp4` / `.gif`: 30/30, sector trip with the net in the turn.
- `outer-top.mp4`: 30/30 + sea charts 3, jetty-head trip.

## Revision 3: natural motion at the highest levels

**Problem.** In revision 2, boats with maxed upgrades did keep the deadline, but only by speeding up the whole animation: up to 19 tiles/s and 350°/s, about 3× the speed of the old straight-line boats. That did not look natural.

**Fix: a harbour trip.** When the trip to the fishing grounds does not fit the simulation's trip without going more than 2× the normal speed share (`C_FULL`), boats make a short trip instead:
- the boat backs straight out along its own slip until its bow is just clear of the pier heads (4.5–6.3 tiles);
- it pays out its net astern into the open water and hauls it in, with fish jumping from the net;
- it goes straight back in and makes fast.

There is no turning, the boat never leaves its own lane, so it cannot meet another boat, and every trip is still in the slip before unloading. With every harbour upgrade at 30, the fastest boat now moves at 4.8 tiles/s: **0.74 ×** the simulation's own speed, which the old boats used to show, instead of 19 tiles/s. The emergency speed-up for catching up after waiting for another boat is limited to 3 × (was 8 ×).

**When boats switch to the harbour trip.** The switch depends on the engine level (speed), the nets level and the sea-charts research; with these levels or higher, boats make harbour trips:

| Nets level | 0 | 5 | 10 | 15 | 20 | 30 |
|---|---|---|---|---|---|---|
| Engine level, no research | 21 | 9 | 6 | 4 | 2 | 0 |
| Engine level, sea charts at 3 | 15 | 4 | 1 | 0 | 0 | 0 |

The reason: the realistic route out to the fishing grounds is about 1.5× longer than the simulation's straight route. Once fishing gets short, the full route only fits at more than twice the speed. The threshold is one constant (`C_FULL` in `src/render/boats.js`); raising it keeps the long trip at higher levels, but faster.

**Unchanged:** trip time, catch and income. The simulation's legs are identical with and without visual boats in all 7 scenarios; 1 boat over 10 minutes: every leg identical, catch 211 = 211.

**Tests after revision 3 (`tests/boat-sync.cjs`, 7 scenarios, stepped at 30 FPS):**

| Scenario | Trip | Overlaps / contacts | In slip before unloading (s) | Net (s, min / median) | Trips without net | Top speed (tiles/s) | × the simulation's cruise | Top turn (°/s) |
|---|---|---|---|---|---|---|---|---|
| 4 boats, no upgrades, 15 min | to the fishing grounds | **0 / 0** | 0.50 … 0.57 | 0.7 / 2.33 | **0** | 4.43 | 2.32 | 81.3 |
| 4 boats, engine 10 / nets 8 / hold 6, 10 min | harbour trip | **0 / 0** | 0.83 … 2.20 | 1.5 / 1.53 | **0** | 1.55 | 0.45 | 0 |
| 1 boat, 5 min | to the fishing grounds | **0 / 0** | 0.50 … 0.53 | 1.13 / 1.17 | **0** | 3.05 | 1.6 | 57.2 |
| 4 boats, engine 6 / nets 3 / hold 4, 10 min | to the fishing grounds | **0 / 0** | 0.23 … 0.57 | 0.7 / 1 | **0** | 6.72 | 2.39 | 118.4 |
| 1 boat, every harbour upgrade at 30, 5 min | harbour trip | **0 / 0** | 0.47 … 0.50 | 0.7 / 0.73 | **0** | 4.81 | 0.74 | 0 |
| 4 boats, every harbour upgrade at 30, 6.7 min | harbour trip | **0 / 0** | 0.47 … 0.53 | 0.7 / 0.73 | **0** | 4.81 | 0.74 | 0 |
| 4 boats, upgrades at 30 + sea-charts and big-nets research at 3, 6.7 min | harbour trip | **0 / 0** | 0.47 … 0.53 | 0.7 / 0.73 | **0** | 6.26 | 0.74 | 0 |

- **Static check (`tests/boat-check.cjs`):** passed. It now also covers the harbour trips: all 4 berths are clear of piers, the quay, moored and decorative boats.
- **Browser suite:** **15/15** in 2 of 2 runs, including double tap 10/10 on Low, save/load, save/load after real play (all 13 fields equal), old saves and corrupt saves.
- **Android 14 emulator, revision 2 build (CI run #41):**
  - every step passed, including save/load after real play + force-stop (13 fields equal), and 0 crashes;
  - Medium: FPS 14.2; the boat was in its slip 0.57 s before unloading, with the net shown;
  - High: FPS 10.8; the boat was in its slip 0.65 s before unloading, with the net shown;
  - total PSS 105 MB.
  
- **Android 14 emulator, revision 3 build (CI run #42, APK commit `9d60d0e`):**
  - every step passed, including save/load after real play + force-stop (13 fields equal), and 0 crashes;
  - one game pop-up took the first tap on the centre button, and the step passed on retry;
  - Medium: FPS 11.2, `trip=grounds`; the boat was in its slip 0.60 s before unloading, with the net shown;
  - High: FPS 8.1, `trip=grounds`; the net was shown;
  - total PSS 107 MB.
  
  The emulator game starts without upgrades, so it shows the trip to the fishing grounds, not the harbour trip.
- **Video:** `test-results/boats/boats-maxed.gif` and `boats-maxed.mp4`: 4 boats with every harbour upgrade at 30, 16 s.

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
- **Revision 4 (outer jetties):**
  - videos and benchmarks: `test-results/outer/` (`outer-*.mp4`, `outer-build.gif`, `outer-max.gif`, `bench-before*.json` = revision 3, `bench-after*.json` = now);
  - `src/render/jetties.js`: construction, carts and fenders;
  - `src/render/boatzones.js`: generated zones and outer-berth moves;
  - `tools/boats/zones.mjs` and `tools/boats/grounds.mjs`: development-time route search;
  - `tests/outer-save.cjs` → `test-results/outer-save.json`
