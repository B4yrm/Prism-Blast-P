# Loop berths, compact west arm and short curves to sea: development build, report

**Status.** In the sources and in a development build (`BUILD_OUT=.preview/dev.html node build.mjs`). `index.html` and the APK are **not** rebuilt. All results are from headless Chromium running the game's own motion code; nothing was run on a phone or on the emulator.

**Untouched:** the simulation (`src/sim/`), economy, workers, the multi-sea system, Stage 2 and Balıqçı Idle. The unlock level (nets 18 / engine 14) and the limits (5 tiles/s, 90°/s) are unchanged.

## What was done

| Request | Result |
|---|---|
| 1. West jetty | The long arm is cut from 6.5 to 4.5 tiles. The bow line goes to a mooring dolphin of three piles. Berths, loops and move routes are byte-for-byte as before (only the arm length, the dolphin and the bollard positions differ in `boatloops.js`). |
| 2. Middle levels | Each slip has a short curve to sea (26.8–32.8 tiles): back out as always, one curve with the net out, straight back into the slip. Boats yield to each other; if the curve does not fit the simulation's time, the harbour trip remains the fallback. |
| 3. The one move | Unchanged, as agreed: 3.4–4.0 s late once per boat at nets 18 / engine 30. The panel now shows the real state of the boat on screen and its hold while it is still arriving. The crane and carts wait for the boat. |
| 4. Tests | 18 four-boat scenarios (30 minutes where it matters), save and old-save tests, browser suite, pre-unlock measurement at 69 levels twice (with and without sea charts 3), performance against the shipped and the previous development build. |
| 5. Videos | Before / after at two middle levels, start, change-over, west arm being built, 30/30, 30/30 + sea charts 3. |

## 1. West jetty

- **Dolphin position:** it stands 0.15 tiles *behind* the boat's centre, not at the old bow bollard (4.2). The old place is in the lane of the third slip, where that boat backs out on every trip. The generator tried positions from the bow side backwards and kept the first one that is clear of every loop, every move route and every moored hull by at least the 0.3-tile margin plus the pile radius.
- **Lines:** bow line to the dolphin's bollard, stern line to a bollard on the shortened deck (x = 1.15, the stern is at 1.0). Tyre fenders hang only where there is deck or a dolphin. See `west-compact-closeup.png`: hull, ropes, piles and bollard fit.
- **Construction (`loops-westarm.mp4`):** the piles are driven first, the deck is laid outwards from the jetty, the dolphin gets its plank cap and the bollards come last. `harborOuter = 2` is stored when it is finished; the save test checks the stages (0.02, 0.27, 0.52, 0.77, then done) and a reload.
- **Static check:** the dolphin piles are obstacles in `boat-check` (hull clearance 0.3 tiles); 0 failures.
- **Pictures:** `west-compact-closeup.png`, `west-compact-wide.png`, `composition-overview-compact.png`.

## 2. Middle levels: short curves to sea

**How it works**

- `tools/boats/curves.cjs` searches, once, on the real map (land, piers, rocks, jetty stems, decorative boats, buoys, the other slips' boats) all clear curves per slip and picks the four that share the least water and are short. The game only reads the result (`src/render/boatcurves.js`).
- Curves: boat 1 32.8 tiles, boat 2 30.2, boat 3 29.4, boat 4 26.8; the net is out for 7.3–10.4 tiles of each. The sea leg turns at the sea radius (2.8 tiles). Water shared by two curves: 9.1 tiles² (boats 1 and 3), 4.9 (boats 2 and 4), none for the other pairs.
- **Trip choice at a slip:** the full route to the grounds if it fits; else the curve (0.5 s kept in hand for giving way); else the harbour trip, as before. After the jetties exist only a boat waiting for its turn to move uses the harbour trip.
- **Giving way:** every 0.2 s the controller predicts the next 7.5 s (15 s for a boat still at its berth). A boat at the berth does not back out into the way of a boat that will pass its slip mouth. Boats under way keep half a beam of the bigger hull plus a look-ahead pad apart. The one with the lower right of way stops and goes on when clear; it is never made faster than the limits.
- **Staying in step with the simulation:** a boat that was kept waiting at its berth chooses its trip again from what the simulation's clock allows then, so it takes a shorter trip instead of being late. The simulation never waits; the crane and carts wait for the boat. This removed the long delays (up to 3.2 s) that appeared in the first version.

**Which trip, level by level** (4 boats, 4 game minutes each; G = full route to the grounds, C = short curve, H = harbour trip, "C 48 % / H" = some boats curve and some make the harbour trip)

No research:

| Nets \ Engine | 0 | 4 | 6 | 8 | 10 | 12 | 14 | 18 | 22 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|
| **0** | G | G | G | G+C | C | C | C | C | C | C 48 % / H |
| **6** | G | G | C | C | C | C | C | C 48 % / H | H | H |
| **12** | G | G+C | C | C | C | C 75 % / H | C 48 % / H | H | H | H |
| **17** | G | G+C | C | C | C 75 % / H | C 49 % / H | H | H | H | H |
| **18** | G | G+C | C | C | C 74 % / H | C 49 % / H | open | open | open | open |
| **24** | G | C | C | C 74 % / H | C 48 % / H | H | open | open | open | open |
| **30** | G | C | C | C 75 % / H | C 49 % / H | H | open | open | open | open |

Sea charts at 3:

| Nets \ Engine | 0 | 4 | 6 | 8 | 10 | 12 | 14 | 18 | 22 | 30 |
|---|---|---|---|---|---|---|---|---|---|---|
| **0** | G | C | C | C | C | C | C | C 50 % / H | C 25 % / H | H |
| **6** | G | C | C | C | C 49 % / H | C 23 % / H | H | H | H | H |
| **12** | G | C | C 74 % / H | C 49 % / H | H | H | H | H | H | H |
| **17** | G+C | C | C 49 % / H | H | H | H | H | H | H | H |
| **18** | G+C | C | C 49 % / H | H | H | H | open | open | open | open |
| **24** | C | C 48 % / H | C 25 % / H | H | H | H | open | open | open | open |
| **30** | C | C 50 % / H | H | H | H | H | open | open | open | open |

- Before this work boats made harbour trips from about engine 6–10 until the unlock. Now they sail to sea with the net out at every level a player normally passes (engine and nets rising together). Harbour trips remain at lopsided levels: engine 12–14 or more with nets of 12–17, engine 18+ with nets below 12, and with sea charts at 3 from about engine 8–10.
- The latest arrival in these measurements was 1.2 s late (slip trips at engine 2–4 with nets 17+, give-way); with sea charts 0.73 s. Everything else was early.

**Pictures and videos:** `mid-level-curves.png` (the four curves on the map), `compare-mid-engine10.mp4` and `compare-mid-engine14.mp4` (before | after).

## 3. The one move at nets 18 / engine 30

- Bought in play: the four moves arrive 3.37–4.03 s late (median 3.97), once per boat; the first trip afterwards starts 1.0–1.7 s late; the fleet is back on the simulation's clock 7.7 s after the last move. No trip skipped, no teleport, no speed above the limits, 0 unloading animations without the boat.
- At the unlock level (engine 14) the moves are 0.07 s early … 0.70 s late.
- **Panel:** the label follows the boat on screen; a boat that is still arriving while the simulation already unloads it shows its full hold. The quay stock shown in the panel still follows the simulation (the economy is not changed), so for those seconds it can show fish landed before the boat is in.

## 4. Four-boat runs (`tests/boat-sync.cjs`, stepped at 30 FPS, seeded; simulation legs compared with a run without visual boats)

| Scenario | Length | Trips | Smallest gap between hulls (tiles) | Top speed (tiles/s) | Top turn (°/s) | Latest arrival vs. the simulation (s) |
|---|---|---|---|---|---|---|
| Start, 4 boats | 30 min | grounds 158 | **0.60** | 5.7 (limits not yet in force) | 103 | slip: 1 trip 1.4 late, else early |
| Start, 1 boat | 5 min | grounds 11 | – | 3.1 | 57 | 0.50 early |
| Mid, engine 6 / nets 3 | 30 min | grounds 50, curve 19 | 1.05 | 5.0 | 86 | 0.13 late (1 trip), else early |
| Mid+, engine 10 / nets 8 | 30 min | curve 57 | 1.05 | 4.5 | 86 | curve: 1 trip 0.23 late, else 0.5 early |
| Mid++, engine 14 / nets 12 | 30 min | curve 21, harbour 25 | 1.96 | 4.4 | 84 | 0.47 early |
| Mid+ with sea charts 2 | 15 min | curve 21, harbour 8 | 1.39 | 4.5 | 85 | 0.43 early |
| Lopsided, engine 22 / nets 12 | 15 min | harbour 34 | 4.08 | 2.6 | 0 | 0.47 early |
| Change-over: nets 18 bought in play at engine 14 | 30 min | harbour 15, move 4, loop 342 | 0.76 | 5.0 | 86 | loops 0.43 early; moves 0.07 early … 0.70 late |
| Same, 2 boats | 10 min | harbour 3, move 2, loop 80 | – | 5.0 | 86 | loops 0.43 early; moves up to 0.70 late |
| Engine 20 / nets 18 | 30 min | loop 364 | 0.67 | 5.0 | 86 | 0.37 early |
| 30/30 loaded from an old save | 15 min | loop 280 | 0.69 | 4.3 | 86 | 0.07 late |
| 30/30 bought in play at engine 30 | 15 min | harbour 16, move 4, loop 259 | 0.55 | 5.0 | 86 | moves 3.4–4.0 late (once per boat); loops 0.17 late |
| 30/30, strong economy | 30 min | loop 365 | 0.52 | 4.3 | 86 | 0.17 late |
| 30/30, hold 30 | 10 min | loop 9 | 2.48 | 4.3 | 86 | 0.10 late |
| 30/30, 1 boat | 5 min | loop 31 | – | 4.3 | 86 | 0.03 late |
| 30/30 + sea charts 3, strong economy | 30 min | loop 243 | 0.52 | 4.2 | 86 | **1.03 late** (mean 0.45) |
| 30/30 + sea charts 3, hold 30 | 10 min | loop 7 | 2.48 | 4.2 | 86 | 1.03 late |

- **All 18 scenarios pass every check:** no overlap, hulls at least a quarter of a beam (0.30 tiles) apart, no contact with land, rocks, piers, jetties, arms, dolphins or decorative boats, limits kept, a net and fish jumps on every trip, **0 trips skipped, 0 unloading animations without the boat**, every simulation leg as long as without visual boats.
- The turn rate is measured over 0.1 s; a single frame can show up to 3° more where two curves join.
- **Per boat at the top levels** (30 minutes):

| | Boat | Top speed | Top turn | Loop trip (s) | Made fast vs. the simulation docking, mean / worst (s) | Between trips, min (s) |
|---|---|---|---|---|---|---|
| 30/30 | 1 | 4.31 | 86.4 | 6.91 | 0.32 early / 0.17 late | 2.57 |
| | 2 | 4.31 | 86.4 | 6.89 | 0.31 early / 0.17 late | 2.53 |
| | 3 | 4.19 | 85.8 | 7.09 | 0.49 early / 0.43 early | 3.10 |
| | 4 | 4.22 | 86.4 | 6.91 | 0.45 early / 0.27 early | 2.90 |
| 30/30 + sea charts 3 | 1 | 4.22 | 86.4 | 6.37 | 0.46 late / 0.83 late | 1.97 |
| | 2 | 4.22 | 86.4 | 6.37 | 0.52 late / 0.90 late | 1.97 |
| | 3 | 4.22 | 86.4 | 6.37 | 0.18 late / 0.57 late | 2.03 |
| | 4 | 4.22 | 86.4 | 6.63 | 0.66 late / 1.03 late | 1.97 |
| Mid+ (engine 10), curves | 1–4 | 3.9–4.5 | 72–86 | – | curves: 0.5 early, one trip 0.23 late | – |

## Saves, economy, old saves (`tests/outer-save.cjs`, `tests/boat-timeline.cjs`, `tests/run-tests.cjs`)

- Jetties built once in play and stored; head arms (with the dolphin) built next and stored (`harborOuter = 2`); all four boats at their loop berths after 60 s; after a reload every boat lies at its berth, nothing is built twice, the progress snapshot is unchanged.
- An old save below the unlock loads without jetties; old saves above it and saves of the previous build load with berths in place (no move). All pass.
- Simulation-only timeline, 1 boat, 10 minutes: every leg and the catch (211) identical to before the boats work; with 4 boats the catch varies with the start-up frames (671 now, 661–711 before).
- Browser suite 15/15 (run alone). Static check 0 failures, now including the curves and the dolphin.

## Performance (headless Chromium, software GPU, idle machine, single runs: shipped build → previous development build → now)

| Preset / scene | FPS: shipped → previous dev → now | Frame ms avg | Update ms | Texture MB | JS heap MB |
|---|---|---|---|---|---|
| low/fit | 55.9 → 56.5 → 60.2 | 17.9 → 17.7 → 16.6 | 0.32 → 0.36 → 0.36 | 37.5 → 37.5 → 37.5 | 42.4 → 43.4 → 43.8 |
| low/harbour | 60.1 → 60.1 → 60.1 | 16.6 → 16.6 → 16.6 | 0.32 → 0.32 → 0.35 | 37.5 → 37.5 → 37.5 | 42.2 → 41.6 → 42.0 |
| low/fleet | 22.2 → 22.9 → 21.7 | 45.0 → 43.7 → 46.1 | 0.43 → 0.57 → 0.60 | 37.5 → 37.5 → 37.5 | 45.3 → 45.4 → 46.5 |
| low/fleetmax | 25.2 → 24.5 → 26.5 | 39.7 → 40.7 → 37.8 | 0.39 → 0.35 → 0.31 | 37.5 → 37.5 → 37.5 | 45.8 → 46.7 → 46.4 |
| medium/fit | 16.0 → 15.1 → 14.2 | 62.6 → 66.3 → 70.5 | 0.56 → 0.53 → 0.71 | 96.6 → 96.6 → 96.6 | 56.4 → 57.4 → 54.9 |
| medium/harbour | 14.5 → 14.2 → 15.1 | 68.8 → 70.2 → 66.3 | 0.60 → 0.50 → 0.54 | 96.6 → 96.6 → 96.6 | 57.1 → 57.4 → 54.6 |
| medium/fleet | 12.7 → 13.1 → 11.6 | 78.8 → 76.3 → 86.3 | 0.68 → 0.76 → 0.57 | 96.6 → 96.6 → 96.6 | 61.0 → 59.1 → 60.5 |
| medium/fleetmax | 12.8 → 12.2 → 13.0 | 78.2 → 82.2 → 77.0 | 0.80 → 0.63 → 0.67 | 96.6 → 96.6 → 96.6 | 59.1 → 58.5 → 58.8 |
| high/fit | 11.6 → 11.9 → 12.2 | 86.3 → 83.7 → 82.3 | 0.59 → 0.52 → 0.53 | 98.9 → 98.9 → 98.9 | 56.8 → 59.5 → 56.7 |
| high/harbour | 12.3 → 11.7 → 12.0 | 81.6 → 85.5 → 83.5 | 0.53 → 0.57 → 0.49 | 98.9 → 98.9 → 98.9 | 59.3 → 58.9 → 59.7 |
| high/fleet | 9.8 → 10.6 → 9.8 | 102.2 → 94.6 → 101.6 | 0.71 → 0.66 → 0.95 | 98.9 → 98.9 → 98.9 | 59.7 → 60.9 → 65.7 |
| high/fleetmax | 10.8 → 10.0 → 9.7 | 92.9 → 99.6 → 102.6 | 0.48 → 0.65 → 0.50 | 98.9 → 98.9 → 98.9 | 60.0 → 62.5 → 62.5 |

Frame times and heap sizes are within the run-to-run spread; texture memory is identical.

## Remaining problems

1. **Top level with sea charts 3:** the loop trip (6.4 s at the limits) is longer than the simulation's trip plus head start, so boats are 0.2–1.0 s late every time (mean 0.45 s). The crane, carts and panel wait for the boat; there is no way to remove this without breaking the limits.
2. **The one move far above the unlock** is 3.4–4.0 s late (allowed).
3. **Lopsided upgrades** still give harbour trips (list above).
4. **Curves share water:** boats 1 and 3 and boats 2 and 4 cross each other's curve a little; giving way costs those boats a few tenths of a second (all within the arrival figures above).
5. **Start level:** with four boats one trip in 158 was 1.4 s late after giving way.
6. **Not tested:** real phone, emulator, touch and FPS on a device.

## Bigger boats (unchanged from the last report)

The west jetty has room for two of today's boats with 0.7 tiles to spare, so it cannot take two 1.17× or 1.38× loops (they need 18.6 and 21.9 tiles against about 16.6 available). The east side is open water. Later: berth bigger boats at the east jetty (a second arm to the east) or add a third jetty. Radius, clearance and pier offsets are computed from the hull (`tools/boats/loops.cjs --scale=…`). No new boat types were added.

## Files

- Videos: `compare-mid-engine10.mp4`, `compare-mid-engine14.mp4` (before | after), `loops-start.mp4`, `loops-mid.mp4`, `loops-change.mp4`, `loops-westarm.mp4`, `loops-max.mp4`, `loops-top.mp4`.
- Pictures: `west-compact-closeup.png`, `west-compact-wide.png`, `composition-overview-compact.png`, `mid-level-curves.png`.
- Data: `../boat-sync.json`, `../boat-check.json`, `../outer-save.json`, `../prelock-measure.json`, `../prelock-measure-nav3.json`, `curves.json`, `search.json`, `bench-*.json`.
- Code: `src/render/boats.js`, `boatpaths.js`, `boatloops.js` and `boatcurves.js` (both generated), `jetties.js`; tools `tools/boats/loops.cjs` and `tools/boats/curves.cjs`.
