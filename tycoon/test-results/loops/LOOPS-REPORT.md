# Loop berths at the outer jetties: development build, test report

**Status.** Implemented in the sources and in a development build (`.preview/dev.html`, made with `BUILD_OUT=.preview/dev.html node build.mjs`). `index.html` and the APK are **not** rebuilt, as agreed. Everything below was measured in the game's own motion code in headless Chromium; nothing was run on a phone or on the emulator.

**Untouched:** the simulation (`src/sim/`), economy, missions, workers, the multi-sea system, Stage 2 and Balıqçı Idle.

## What the player sees

- **Jetties** at nets 18 / engine 14, as before (about 7 s). Then the boat for the jetty stem moves; then the **head arms** are built (4 s: piles, deck laid outwards, bollards and fenders); then the other boats move, one after another in a fixed order.
- **A trip from a loop berth:** the lines are let go and the boat is pushed off the pier; it leaves ahead, casts its net after about a sixth of the loop, tows it, hauls it in with fish jumping at the net, comes back ahead, stops off the pier and is **hauled in by its lines** (0.55 tiles, 0.6–1.0 s, eased at both ends).
- **Buoys:** a boat that has moved gives up its old fishing ground, and that ground's buoys are taken in.
- **Limits:** no boat sails faster than 5 tiles/s or turns faster than 90°/s from the first engine upgrade on. A boat that cannot make a trip in the simulation's time is late; it is never made faster.

## Layout: changed from the mock-up

The mock-up's west jetty did not survive the full collision check you asked for:

- West of the west jetty a line of surf rocks and a shoal runs along the edge of the map (x ≈ −9.5), with unseen land behind it. The mock-up's loop for the boat on the west stem ran straight across it.
- With every obstacle in (rocks, unseen land, buoys, decorative boats) and a clearance of a quarter of the beam, the west side has room for two loops only side by side in front of the jetty head.

| Boat | Berth | Bow | New deck | Loop | Nearest obstacle while under way | Nearest other loop |
|---|---|---|---|---|---|---|
| 1 | west jetty, head arm towards the harbour | east | 6.5 tiles | 17.6 tiles | 0.46 | 0.53 |
| 2 | east jetty, head arm towards the harbour | west | 2.0 tiles | 17.6 tiles | 0.44 | 2.69 |
| 3 | west jetty, head arm to the west | west | 2.0 tiles | 17.6 tiles | 0.46 | 0.52 |
| 4 | east jetty, stem, outer face | to the sea | none | 18.6 tiles | 0.43 | 2.66 |

- **East jetty:** L-shaped, as in the mock-up (arm 2.0 tiles).
- **West jetty:** a T with a long arm (6.5 tiles towards the harbour, ending 0.2 tiles before the lane of slip 3, and 2.0 tiles to the west). This is more new deck than the "short arm" you approved. The alternative found by the search keeps the west arm short but puts one boat's loop **inside the harbour basin** between the jetty and slip 3; I did not use it because that boat would not leave the harbour to fish.
- **Other scene changes:** one decorative boat moved from (34, 26.6) to (28, 26.5); the buoys of a fishing ground are taken in when its boat moves.
- **Clearances:** the hull keeps at least 0.43 tiles from everything while under way (the search requires 0.30 = a quarter of the beam). Under way the boat is 0.95 tiles off the pier face (the stern swings 0.58 tiles out when it turns away); made fast it lies 0.40 off.
- **Bigger boats:** radius, clearance and pier offsets are computed from the hull (radius 0.7125 × length, clearance 0.25 × beam). Checked with `--scale`: for hulls 1.17× and 1.38× as big, the **west jetty has no room for two loops**; a bigger class would need another berth there. No new boat types were added.

## Speed, turning, trip time and lateness per boat (game code, 15 minutes each)

**Max 30/30, strong economy (stays of 3.7 s):**

| Boat | Loop trips | Top speed (tiles/s) | Top turn (°/s) | Loop trip (s) | Made fast vs. the simulation docking (s) | Made fast before the next trip, min (s) |
|---|---|---|---|---|---|---|
| 1 | 71 | 4.22 | 86.4 | 6.40 | 0.40 early | 3.57 |
| 2 | 71 | 4.22 | 86.4 | 6.40 | 0.37 early | 3.53 |
| 3 | 68 | 4.09 | 83.7 | 6.67 | 0.47 early | 3.63 |
| 4 | 69 | 4.22 | 86.4 | 6.63 | 0.27 early | 3.43 |

**Max 30/30 + sea charts 3, strong economy:**

| Boat | Loop trips | Top speed (tiles/s) | Top turn (°/s) | Loop trip (s) | Made fast vs. the simulation docking (s) | Made fast before the next trip, min (s) |
|---|---|---|---|---|---|---|
| 1 | 48 | 4.22 | 86.4 | 6.37 | **0.83 late** | 2.33 |
| 2 | 48 | 4.22 | 86.4 | 6.37 | **0.90 late** | 2.27 |
| 3 | 45 | 4.22 | 86.4 | 6.37 | **0.57 late** | 2.60 |
| 4 | 45 | 4.22 | 86.4 | 6.63 | **1.03 late** | 2.13 |

- In both tables every boat left with the simulation on every trip (it starts to move 0.53 s before the simulation leaves), and the number of visual trips equals the number of simulation trips.
- With sea charts at 3 the boat is made fast 0.6–1.0 s after the simulation docks. The crane and the carts wait for it; the panel shows "Limanda" that much earlier.
- The net was out 2.7 s on every loop at these levels; fish jump at most 0.42 tiles from the net.

## All scenarios (`tests/boat-sync.cjs`, stepped at 30 FPS, seeded; simulation legs compared with a run without visual boats)

| Scenario | Length | Trips | Top speed / turn | Overlaps, contacts | Slip trips: latest arrival (s) | Loop trips: latest arrival (s) | Trips skipped | Unloading shown without the boat |
|---|---|---|---|---|---|---|---|---|
| Start, 4 boats | 15 min | grounds 92 | 5.5 / 105 (limits not in force yet) | 0 | −0.40 | – | 0 | 0 |
| Start, 1 boat | 5 min | grounds 11 | 3.1 / 57 | 0 | −0.50 | – | 0 | 0 |
| Mid, engine 6 / nets 3 | 15 min | grounds 30, harbour 11 | 5.0 / 86 | 0 | −0.47 | – | 0 | 0 |
| Mid+, engine 10 / nets 8 | 10 min | harbour 26 | 1.6 / 0 | 0 | −0.83 | – | 0 | 0 |
| Unlock 14/18: everything is built, boats move | 15 min | harbour 15, move 4, loop 231 | 5.0 / 86 | 0 | −0.57 | −0.50 | 0 | 0 |
| Unlock, 2 boats | 10 min | harbour 3, move 2, loop 79 | 5.0 / 86 | 0 | −0.57 | −0.50 | 0 | 0 |
| Engine 20 / nets 18 | 15 min | loop 282 | 4.6 / 86 | 0 | – | −0.43 | 0 | 0 |
| Max 30/30 from an old save: built and moved at the top | 15 min | harbour 16, move 4, loop 262 | 5.0 / 86 | 0 | −0.53 | −0.27 (2.80 during the change-over) | 0 | 0 |
| Max 30/30, strong economy | 15 min | loop 281 | 4.2 / 86 | 0 | – | −0.27 | 0 | 0 |
| Max 30/30, hold 30 | 10 min | loop 9 | 4.2 / 86 | 0 | – | −0.30 | 0 | 0 |
| Max 30/30, 1 boat | 5 min | loop 31 | 4.2 / 86 | 0 | – | −0.40 | 0 | 0 |
| Max + sea charts 3, strong economy | 15 min | loop 187 | 4.2 / 86 | 0 | – | +1.03 | 0 | 0 |
| Max + sea charts 3, hold 30 | 10 min | loop 7 | 4.2 / 86 | 0 | – | +1.03 | 0 | 0 |

- **All 13 scenarios pass every check:** no overlap, no contact with land, rocks, piers, jetties, head arms or decorative boats, the limits kept, a net on every trip, no trip skipped, no unloading shown without the boat, simulation legs identical.
- **Smallest gap between two loop boats:** 0.55 tiles. Between two **slip** boats at the start of the game it was 0.014–0.13 tiles in different runs: no overlap, but tight. That is the old slip traffic, which this work did not change in shape; I lengthened its look-ahead, which removed an overlap that appeared once in an earlier run of this build.
- **Turn rate** is measured over 0.1 s. The largest heading step in a single frame was 3.1° (93°/s for one frame) where two curves of a route join.

## The one move from a slip to the loop berth

| | At the unlock level (14/18) | In a save already at 30/30 |
|---|---|---|
| Route | 28.9–33.7 tiles, net out on the sea leg | same |
| Made fast vs. the simulation docking | 0.07 s early … **0.70 s late** | **4.3 … 5.0 s late** |
| First trip after the move | on time | starts 1.9–2.6 s late |
| Back on the simulation's clock | at once | 16 s after the last boat has moved (loop trips up to 2.8 s late until then) |
| Trips skipped / unloading shown without the boat | 0 / 0 | 0 / 0 |
| Whole change-over (4 boats) | 97 s | 82 s |

At 30/30 the move cannot be on time at 5 tiles/s; as agreed it is late once and nothing is sped up. The crane and carts wait; the panel is ahead of the boat for those seconds.

## Before the unlock: where harbour trips appear (`tests/prelock-measure.cjs`, 4 boats, 4 minutes per level)

With the 5 tiles/s limit the full route to the fishing grounds fits only at low engine levels:

| Nets \ Engine | 0 | 2 | 4 | 6 | 8 | 10 and up (until 14 with nets ≥ 18) |
|---|---|---|---|---|---|---|
| 0 | grounds | grounds | grounds | grounds | grounds and harbour | harbour |
| 6 | grounds | grounds | grounds | harbour | harbour | harbour |
| 12 | grounds | grounds | grounds and harbour | harbour | harbour | harbour |
| 17–18 | grounds | grounds | grounds and harbour | harbour | harbour | harbour |
| 24–30 | grounds | grounds (one arrival 0.2–0.7 s late) | harbour | harbour | harbour | harbour |

- From about **engine 6–10** until the jetties open, boats make harbour trips (back out of the slip, net, back in; 1.6 tiles/s). In today's shipped build these levels still sail to the grounds, faster than 5 tiles/s.
- At nets ≥ 12 with the engine at 26–30 even the harbour trip is shortened (the boat backs out 70–85 % of the way) to be home in time.
- **Better change-over, proposed:** open the jetties when the full route stops fitting, i.e. at **engine 6** (any nets level), instead of nets 18 / engine 14. The loops work at any level: longer loops and slower towing fill the longer trips (checked up to 27.6–30.6 tiles; at 14/18 the loop trip lasts 10.6 s). Then boats sail to sea at every level and the harbour trip remains only as a short stopgap while a boat waits for its turn to move. The thresholds were **not** changed in this build.

## Saves (`tests/outer-save.cjs`)

- Jetties: built once, stored (`harborOuter = 1`), there at once after a reload.
- Head arms and moves: all four boats at their loop berths after 60 s of play; `harborOuter = 2` stored; after a reload every boat lies at its loop berth, nothing is built twice, the progress snapshot is unchanged.
- Old save without the field, below the threshold: no jetties, no errors. Above the threshold: built once.
- Save of the previous build (`harborOuter = 1`): loads without errors, the head arms are built and the boats move.
- **Economy:** in all 13 scenarios every out / fishing / back leg of the simulation lasts exactly as long as without visual boats. Simulation-only timeline, 1 boat, 10 minutes: every leg and the catch (211) identical to the state before the boats work.
- **Browser suite:** 15/15.
- **Static check (`tests/boat-check.cjs`):** 0 failures. It found two real mistakes in the first version of the game code (the longer loops were stretched sideways, and one loop did not close); both are fixed.

## Performance (single runs, headless Chromium with a software GPU: shipped build → development build)

| Preset / scene | FPS | Frame ms avg | Frame ms p90 | Update ms | Texture MB | JS heap MB |
|---|---|---|---|---|---|---|
| low/fit | 56.7 → 54.1 | 17.6 → 18.5 | 16.7 → 16.8 | 0.47 → 0.40 | 37.5 → 37.5 | 42.1 → 41.8 |
| low/harbour | 60.1 → 60.1 | 16.7 → 16.6 | 16.7 → 16.7 | 0.37 → 0.36 | 37.5 → 37.5 | 41.8 → 41.8 |
| low/fleet | 21.0 → 21.8 | 47.6 → 45.8 | 99.9 → 99.9 | 0.57 → 0.47 | 37.5 → 37.5 | 45.1 → 45.9 |
| low/fleetmax | 16.1 → 19.7 | 62.0 → 50.6 | 116.6 → 116.5 | 0.32 → 0.43 | 37.5 → 37.5 | 44.9 → 45.7 |
| medium/fit | 11.2 → 11.2 | 89.4 → 89.4 | 166.6 → 150.1 | 0.69 → 0.76 | 96.6 → 96.6 | 54.8 → 55.0 |
| medium/harbour | 12.8 → 12.3 | 78.2 → 81.1 | 133.4 → 149.9 | 0.60 → 0.47 | 96.6 → 96.6 | 55.4 → 57.5 |
| medium/fleet | 9.9 → 10.3 | 100.9 → 96.7 | 166.6 → 166.6 | 0.63 → 0.83 | 96.6 → 96.6 | 61.2 → 59.0 |
| medium/fleetmax | 10.4 → 9.1 | 95.8 → 110.0 | 150.1 → 183.3 | 0.43 → 0.51 | 96.6 → 96.6 | 58.6 → 59.0 |
| high/fit | 9.9 → 9.1 | 101.0 → 110.0 | 166.8 → 209.5 | 0.55 → 0.70 | 98.9 → 98.9 | 58.7 → 57.6 |
| high/harbour | 9.2 → 8.9 | 108.8 → 112.7 | 183.3 → 216.7 | 0.46 → 0.73 | 98.9 → 98.9 | 57.7 → 56.7 |
| high/fleet | 8.7 → 8.4 | 115.6 → 119.4 | 183.3 → 199.9 | 0.63 → 0.88 | 98.9 → 98.9 | 60.6 → 64.2 |
| high/fleetmax | 10.1 → 7.5 | 99.1 → 133.1 | 166.6 → 233.3 | 0.69 → 0.53 | 98.9 → 98.9 | 60.2 → 64.4 |

Texture memory is unchanged. The differences are within the run-to-run spread of this machine: the two `fleetmax` rows were repeated twice and gave 9.3–10.6 → 9.6–10.5 FPS (Medium) and 9.5 → 9.1–9.7 FPS (High).

## Open points for your decision

1. **West jetty:** the long arm (6.5 tiles) as built here, or the short arm with one loop inside the harbour basin?
2. **Unlock level:** keep nets 18 / engine 14 (harbour trips from about engine 6–10 until then), or open the jetties at engine 6?
3. **Start-level slip traffic** passes with gaps as small as 0.014 tiles between hulls. It can be hardened separately if you want.

## Files

- Videos: `loops-start.mp4`, `loops-mid.mp4`, `loops-change.mp4` (jetties, first move, head arms), `loops-max.mp4`, `loops-top.mp4` (30/30 + sea charts 3, hauling in close up).
- Data: `../boat-sync.json`, `../boat-check.json`, `../outer-save.json`, `../prelock-measure.json`, `search.json`, `bench-shipped.json`, `bench-dev.json`.
- Code: `src/render/boats.js`, `boatpaths.js`, `boatloops.js` (generated), `jetties.js`; tool `tools/boats/loops.cjs`.
