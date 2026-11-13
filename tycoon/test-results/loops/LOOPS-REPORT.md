# Loop berths at the outer jetties: development build, report after the second review

**Status.** In the sources and in a development build (`BUILD_OUT=.preview/dev.html node build.mjs`). `index.html` and the APK are **not** rebuilt. Everything was measured in the game's own motion code in headless Chromium; nothing was run on a phone or on the emulator.

**Untouched:** the simulation (`src/sim/`), economy, missions, workers, the multi-sea system, Stage 2 and Balıqçı Idle.

## What changed since the last report

| Point | Change | Result |
|---|---|---|
| 3. Start-level safety | A boat at its berth now looks 15 s ahead before backing out (7.5 s under way), and boats keep half a beam plus a look-ahead pad apart | Smallest gap between hulls at the start level: **0.63 tiles** (was 0.014) over 30 minutes |
| 4. Lateness at the top | A loop berth is left as soon as the simulation has finished unloading (the lines are let go while the last fish are landed), 1.15 s before the simulation leaves instead of 0.55 s | 30/30 + sea charts 3: median **0.33 s** late (was 0.9 s); per boat 0.08–0.56 s on average |
| 4. Panel | The harbour panel's label says what the boat on screen is doing; load and catch stay the simulation's numbers | Panel, crane / carts and the boat's position agree |
| 5. Old saves | A save already past the unlock level when it is loaded gets the jetties and head arms as finished, with the boats at their loop berths | No late move in old saves; nothing teleports on screen (it is the state at load) |
| 2. Mid levels | Studied, not built: a shorter curve to sea from each slip | Fits every level of normal progress up to the unlock (see below) |
| 1. West jetty | Long arm kept; a compact variant drawn | 2 tiles less deck (see below) |

The unlock level (nets 18 / engine 14) and the limits (5 tiles/s, 90°/s) are unchanged.

## Long runs with four boats (`tests/boat-sync.cjs`, stepped at 30 FPS, seeded)

| Scenario | Length | Trips | Smallest gap between hulls (tiles) | Top speed (tiles/s) | Top turn (°/s) | Latest arrival vs. the simulation (s) | Trips skipped | Simulation unchanged |
|---|---|---|---|---|---|---|---|---|
| Start, 4 boats | 30 min | grounds 158 | **0.63** | 5.5 (limits not in force yet) | 92 | 0.33 early | 0 | yes |
| Start, 1 boat | 5 min | grounds 11 | – | 3.1 | 57 | 0.50 early | 0 | yes |
| Mid, engine 6 / nets 3 | 15 min | grounds 31, harbour 11 | 1.50 | 5.0 | 86 | 0.47 early | 0 | yes |
| Mid+, engine 10 / nets 8 | 10 min | harbour 26 | 4.08 | 1.6 | 0 | 0.83 early | 0 | yes |
| Change-over: nets 18 bought in play at engine 14 | 15 min | harbour 15, move 4, loop 231 | 0.76 | 5.0 | 86 | loops 0.43 early; moves 0.07 early … 0.70 late | 0 | yes |
| Change-over, 2 boats | 10 min | harbour 3, move 2, loop 80 | – | 5.0 | 86 | loops 0.43 early; moves up to 0.70 late | 0 | yes |
| Engine 20 / nets 18 | 15 min | loop 283 | 0.67 | 5.0 | 86 | 0.37 early | 0 | yes |
| Max 30/30 loaded from an old save | 15 min | loop 280 | 0.69 | 4.3 | 86 | 0.23 late (median 0.43 early) | 0 | yes |
| Max 30/30, strong economy | 15 min | loop 280 | 0.69 | 4.3 | 86 | 0.10 late (median 0.43 early) | 0 | yes |
| Max 30/30, hold 30 | 10 min | loop 9 | 2.48 | 4.3 | 86 | 0.10 late | 0 | yes |
| Max + sea charts 3, strong economy | 15 min | loop 186 | 0.66 | 4.2 | 86 | 1.03 late (median 0.33 late) | 0 | yes |
| Max + sea charts 3, hold 30 | 10 min | loop 7 | 2.48 | 4.2 | 86 | 1.00 late | 0 | yes |
| Nets 18 bought in play at engine 30 (far above the unlock) | 15 min | harbour 16, move 4, loop 260 | 0.54 | 5.0 | 86 | moves 3.4–4.0 late, once per boat | 0 | yes |

- **All 14 scenarios pass every check:** no overlap, hulls at least a quarter of a beam (0.30 tiles) apart, no contact with land, rocks, piers, jetties, head arms or decorative boats, the limits kept, a net and fish jumps on every trip, no trip skipped, no unloading shown without the boat, every simulation leg as long as without visual boats.
- **Every loop boat was ready for its next trip every time;** made fast at least 1.97 s between trips at the top level.
- **Start level:** in one earlier 30-minute run 1 of 156 arrivals was 0.8 s late after giving way (the crane waits); in the run in the table none was.

**Per boat at the top levels**

| | Boat | Top speed | Top turn | Loop trip (s) | Made fast vs. the simulation docking, mean / worst (s) | Made fast before the next trip, min (s) |
|---|---|---|---|---|---|---|
| 30/30 | 1 | 4.31 | 86.4 | 6.93 | 0.39 early / 0.07 late | 2.57 |
| | 2 | 4.31 | 86.4 | 6.90 | 0.40 early / 0.10 late | 2.53 |
| | 3 | 4.09 | 83.7 | 7.16 | 0.50 early / 0.43 early | 3.10 |
| | 4 | 4.22 | 86.4 | 6.97 | 0.46 early / 0.27 early | 2.90 |
| 30/30 + sea charts 3 | 1 | 4.22 | 86.4 | 6.37 | 0.37 late / 0.83 late | 1.97 |
| | 2 | 4.22 | 86.4 | 6.37 | 0.43 late / 0.90 late | 1.97 |
| | 3 | 4.22 | 86.4 | 6.37 | 0.08 late / 0.53 late | 2.07 |
| | 4 | 4.22 | 86.4 | 6.63 | 0.56 late / 1.03 late | 1.97 |

The worst values with sea charts are the first trips after loading (the boat starts 0.55 s before the simulation that once). The remaining lateness is the loop itself: 6.4 s at the limits against a simulation trip of 5.0 s plus the 1.15 s head start.

## 5. The one move

- **Old saves** (and saves of the previous build): berths in place at load, no move at all.
- **Nets 18 bought in play at the normal level (engine 14):** the move is made fast 0.07 s early … 0.70 s late; the next trip starts on time.
- **Bought in play far above the unlock (engine 30):** the 29–34-tile route takes 12–13.5 s at the limits and the simulation's trip is 7 s, so the move is 3.4–4.0 s late once per boat; the first trip afterwards starts up to 1.7 s late and the boat is back on the simulation's clock 8 s after the last move. No trip is skipped and no unloading is shown without the boat. I found no way to make this one trip on time without teleporting or exceeding the limits.

## 2. Mid levels: a shorter curve to sea from the existing slips (study, not built)

`tools/boats/nearloops.cjs` searched, for each slip, the quickest clear curve: back out as today, sail one curve round a way point with the net out, come straight back in. No stop at sea, nothing new is built. Picture: `mid-level-curves.png`.

| Boat | Curve (tiles) | Time at the limits (s) | Reaches beyond the slip mouth (tiles) | Full route to the grounds (tiles) |
|---|---|---|---|---|
| 1 | 31.6 | 12.3 | 4.5 | 37.4 |
| 2 | 29.5 | 11.8 | 3.2 | 35.3 |
| 3 | 28.5 | 11.5 | 3.2 | 38.4 |
| 4 | 26.1 | 10.8 | 3.2 | 38.9 |

Fit against the simulation's trip (no research; "late" = made fast that long after the simulation docks):

| Nets \ Engine | 0–10 | 14 | 18 | 22 | 26 | 30 |
|---|---|---|---|---|---|---|
| 0 | fits | fits | fits | fits | fits | 0.2 s late |
| 5 | fits | fits | fits | 0.7 s late | 1.4 s late | no |
| 10 | fits | fits | 1.0 s late | no | no | no |
| 14 | fits | 0.6 s late | no | no | no | no |
| 18–30 | fits (engine 10 with nets 26–30: 0.2–0.5 s late) | loop berths | loop berths | loop berths | loop berths | loop berths |

- With this curve the boats would keep going to sea at **every level a player normally passes before the unlock**. Harbour trips would remain only for lopsided upgrades (engine 18 or more with nets 10–17) and, with sea charts at 3, from about engine 10.
- **These times are a speed profile on the searched curves, not runs of the game.** The four curves cross each other's water, so boats will have to give way as they do on today's routes; lateness from that is not in the table. It needs the same implementation and long-run tests as the loops before it can be relied on.

## 1. West jetty

- Kept: arm of 6.5 tiles towards the harbour, 2.0 tiles to the west (`west-jetty-long-arm.png`, `composition-overview.png`).
- **Why it cannot simply be shorter:** two loops side by side need their berths 8.3 tiles apart (each loop sweeps 3.9 tiles either side of its centre), between the rocks in the west and the lane of slip 3 in the east.
- **Compact variant** (`west-jetty-compact-variant.png`): the deck ends 2 tiles earlier (4.5 tiles); the bow line goes to a mooring dolphin (three piles) standing where the deck ended. Routes, berths and clearances stay exactly as tested, because nothing is added outside the present deck. It is a drawing in the development build's picture only, not built in.

## 6. Bigger boats

Radius, clearance and pier offsets are computed from the hull (radius 0.7125 × length, clearance 0.25 × beam; `tools/boats/loops.cjs --scale=…`).

| Hull scale | Water one loop sweeps (tiles across) | Two loops side by side need | West front available (rocks to the lane of slip 3) | East jetty |
|---|---|---|---|---|
| 1.00 | 7.8 | 15.9 | about 16.6 | fits |
| 1.17 | 9.1 | 18.6 | about 17.1 | fits |
| 1.38 | 10.8 | 21.9 | about 17.6 | fits |

- The west jetty has room for two of today's boats with 0.7 tiles to spare, so it cannot take two bigger loops. The east side is open water up to the edge of the map.
- Ways to make room later without changing today's layout: berth bigger boats at the east jetty (a second arm to the east), or add a third jetty east of it. The data format already carries radius and offsets per berth.

## Saves, economy, other tests

- `tests/outer-save.cjs`: the jetties are built once in play and stored; head arms and moves follow and are stored (`harborOuter = 2`); after a reload every boat lies at its loop berth and the progress snapshot is unchanged; an old save below the unlock loads without jetties; old saves above it and saves of the previous build load with the berths in place. All pass.
- Simulation-only timeline, 1 boat, 10 minutes: every leg and the catch (211) identical to the state before the boats work.
- Browser suite: 15/15. Static check (`tests/boat-check.cjs`): 0 failures.

## Open points

1. West jetty: keep the long arm as built, or use the compact variant with the mooring dolphin?
2. Mid levels: build the shorter curves from the slips (with long-run tests), or keep the harbour trip from about engine 6–10 until the unlock?
3. Nets 18 bought in play far above the unlock: accept the one late move (3.4–4.0 s), as it is now?

## Files

- Videos: `loops-start.mp4`, `loops-mid.mp4`, `loops-change.mp4`, `loops-max.mp4`, `loops-top.mp4`.
- Pictures: `composition-overview.png`, `west-jetty-long-arm.png`, `west-jetty-compact-variant.png`, `mid-level-curves.png`.
- Data: `../boat-sync.json`, `../boat-check.json`, `../outer-save.json`, `../prelock-measure.json` (from the previous round), `nearloops.json`, `search.json`.
